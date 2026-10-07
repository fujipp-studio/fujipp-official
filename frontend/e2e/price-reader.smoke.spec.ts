import { expect, test } from '@playwright/test'
import { priceReaderFixture } from '../src/__tests__/fixtures/priceReader'

for (const theme of ['LIGHT', 'DARK']) {
  for (const version of ['1.0.0', '2.0.0']) {
    test(`edits Price Reader ${version} in ${theme}`, async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const { priceLicense, config } = priceReaderFixture(version)
      const legacy = version.startsWith('1.')
      const original = structuredClone(config)
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [priceLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [priceLicense], nextCursor: null, hasMore: false } }),
      )
      let saved:
        | {
            values: Record<string, unknown>
            presentations: Record<string, Record<string, unknown>>
          }
        | undefined
      let saves = 0
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') {
          saved = route.request().postDataJSON()
          saves++
          for (const field of config.fields)
            field.value = saved!.values[field.key] as typeof field.value
          for (const slot of config.presentations)
            if (saved!.presentations[slot.key])
              slot.overrideDefinition = saved!.presentations[slot.key]!
          config.revision++
        }
        await route.fulfill({ json: config })
      })
      await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
      await page.addStyleTag({
        content: '#__vue-devtools-container__ { display: none !important; }',
      })
      const form = page.locator('#feature-config')
      const categories = form.locator('[data-price-reader-config]')
      const category = async (name: string) => {
        if ((page.viewportSize()?.width ?? 0) < 768) {
          await categories.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else {
          const tab = categories.getByRole('tab', { name, exact: true })
          await tab.evaluate((element) =>
            window.scrollBy({
              top: element.getBoundingClientRect().top - innerHeight * 0.25,
              behavior: 'instant',
            }),
          )
          await tab.click()
        }
        await expect(categories.getByRole('tabpanel')).toHaveCount(1)
      }
      const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
      await expect(save).toBeDisabled()
      await expect(categories.locator('[data-price-pair-count]')).toHaveText('2 คู่')
      await category('ตารางราคา')
      await expect(save).toBeDisabled()
      const rows = form.locator('[data-price-row]')
      const deleteSize = await rows
        .first()
        .getByRole('button', { name: 'ลบราคาคู่ที่ 1', exact: true })
        .boundingBox()
      expect(deleteSize?.width).toBeGreaterThanOrEqual(40)
      expect(deleteSize?.height).toBeGreaterThanOrEqual(40)
      const firstShop = rows.first().getByRole('spinbutton', { name: /ราคาร้านขาย/ })
      await firstShop.fill('')
      await expect(firstShop).toHaveAttribute('aria-invalid', 'true')
      await category('ช่อง Discord')
      await category('ตารางราคา')
      await expect(firstShop).toHaveValue('')
      await firstShop.fill('55')
      await expect(save).toBeDisabled()
      await firstShop.fill('60.25')
      await rows
        .nth(1)
        .getByRole('spinbutton', { name: /ราคา Discord/ })
        .fill('250')
      await expect(rows.nth(1).getByRole('status')).toContainText('ราคา Discord ซ้ำ')
      await rows
        .nth(1)
        .getByRole('spinbutton', { name: /ราคา Discord/ })
        .fill('295')
      await form.locator('[data-add-price]').click()
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(2).getByRole('spinbutton', { name: /ราคา Discord/ })).toBeFocused()
      await rows
        .nth(2)
        .getByRole('spinbutton', { name: /ราคา Discord/ })
        .fill('339')
      await rows
        .nth(2)
        .getByRole('spinbutton', { name: /ราคาร้านขาย/ })
        .fill('0')
      await expect(rows.nth(2).getByRole('spinbutton', { name: /ราคาร้านขาย/ })).toHaveAttribute(
        'aria-invalid',
        'false',
      )
      if (legacy) {
        const markup = form.getByRole('spinbutton', { name: /ค่าบวกเมื่อไม่มี Nitro/ })
        await markup.fill('250')
        await expect(form).toContainText('เท่ากับ 2.50 บาท')
        await category('ข้อความผลลัพธ์')
        await form
          .getByRole('textbox', { name: 'รูปแบบผลลัพธ์ต่อรูป', exact: true })
          .fill(
            '### สินค้า {{result_index}}\nDiscord {{discord_price}} / ร้าน {{shop_price_text}}\nเพิ่ม {{no_nitro_markup}} บาท',
          )
      } else await expect(categories.getByText('ข้อความผลลัพธ์', { exact: true })).toHaveCount(0)
      await category('ช่อง Discord')
      const channel = form.getByRole('textbox', { name: /ช่องอ่านราคา/ })
      await channel.fill('bad-id')
      await expect(channel).toHaveAttribute('aria-invalid', 'true')
      await channel.fill('234567890123456789')
      await expect(channel).toHaveAttribute('aria-invalid', 'false')
      const design = page.locator('#feature-presentations')
      const pick = async (name: string) => {
        if ((page.viewportSize()?.width ?? 0) < 1024) {
          await design.getByRole('combobox', { name: 'ข้อความ', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else
          await design
            .getByRole('button', {
              name: name + ' ' + (legacy ? 'Embed' : 'Components V2'),
              exact: true,
            })
            .click()
      }
      await pick('ผลการอ่านราคา')
      const preview = design.locator('.preview-shell')
      await expect(preview).toContainText('60.25 บาท')
      await expect(preview).toContainText('65.00 บาท')
      await expect(preview.getByRole('link', { name: /สั่งซื้อคลิก/ })).toHaveCount(0)
      if (legacy) await expect(preview).toContainText('เพิ่ม 2.50 บาท')
      else {
        await expect(preview).not.toContainText('ไนโตร')
        await expect(preview.locator('.preview-container')).toHaveCount(1)
      }
      await pick('กำลังอ่านรูป')
      await expect(preview).toContainText('2 รูป')
      await pick('ผลการอ่านราคา')
      const initialViewport = page.viewportSize()!
      const names = ['ช่อง Discord', 'ตารางราคา', ...(legacy ? ['ข้อความผลลัพธ์'] : [])]
      for (const width of [1366, 768, 320]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const name of names) {
          await category(name)
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true)
          if (width !== 768)
            await categories.screenshot({
              path: testInfo.outputPath(name + '-' + width + '.png'),
              animations: 'disabled',
              scale: 'css',
              style:
                '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
            })
        }
        if (width !== 768)
          await design.screenshot({
            path: testInfo.outputPath('messages-' + width + '.png'),
            animations: 'disabled',
            scale: 'css',
            style:
              '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
          })
      }
      await save.click()
      expect(saved).toBeUndefined()
      await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก', exact: true }).click()
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(save).toBeDisabled()
      expect(saves).toBe(1)
      expect(saved?.values.PRICE_READER_PRICE_MAP).toEqual([
        { discordPrice: 250, shopPrice: 60.25, future: { keep: true } },
        { discordPrice: 295, shopPrice: 65 },
        { discordPrice: 339, shopPrice: 0 },
      ])
      expect(saved?.values.FUTURE_SETTING).toBe('preserved')
      expect(saved?.presentations.processing).toEqual(original.presentations[0]!.defaultDefinition)
      expect(saved?.presentations.result).toEqual(original.presentations[1]!.defaultDefinition)
      await page.reload()
      await expect(save).toBeDisabled()
      await category('ตารางราคา')
      await expect(firstShop).toHaveValue('60.25')
      await expect(rows).toHaveCount(3)
      await page.setViewportSize(initialViewport)
      await pick('ผลการอ่านราคา')
      await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
      await expect(page).toHaveURL(
        new RegExp((legacy ? '/embed' : '/components-v2') + '\\?locale=th&message=result'),
      )
      await expect(page.locator('#feature-presentation-editor')).toContainText('ผลการอ่านราคา')
      await expect(save).toBeDisabled()
      expect(errors).toEqual([])
    })
  }
}
