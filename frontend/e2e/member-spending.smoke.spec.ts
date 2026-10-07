import { expect, test } from '@playwright/test'
import {
  memberSpendingConfiguration,
  memberSpendingLicense,
} from '../src/__tests__/fixtures/memberSpending'

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'edits Embed settings with a responsive preview in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [memberSpendingLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({
          json: { items: [memberSpendingLicense], nextCursor: null, hasMore: false },
        }),
      )
      const configuration = structuredClone(memberSpendingConfiguration)
      const first = configuration.presentations[0]!
      const definition = first.defaultDefinition as { embeds: Array<Record<string, unknown>> }
      definition.embeds[0]!.future_property = 'keep-existing-data'
      let saved: { presentations: Record<string, Record<string, unknown>> } | undefined
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') saved = route.request().postDataJSON()
        await route.fulfill({ json: configuration })
      })
      await page.goto(
        '/my-bot/fixture-bot/settings/packages/fixture-license/embed?message=first_card&locale=th',
      )
      const editor = page.locator('#feature-presentation-editor')
      const form = editor.locator('.embed-edit-pane')
      const preview = editor.locator('.embed-preview-pane')
      const saveAll = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
      await expect(editor.locator('article')).toHaveCount(1)
      await expect(saveAll).toBeDisabled()
      await expect(form.getByRole('textbox', { name: 'หัวข้อ', exact: true })).toBeVisible()
      await expect(form.locator('.embed-variables')).not.toHaveAttribute('open')
      await expect(form.locator('[data-section="images"]')).not.toHaveAttribute('open')
      await expect(form.locator('[data-section="images"] summary')).toContainText('ตั้งค่าแล้ว')
      if (!isMobile) await expect(preview).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await editor.screenshot({
        path: testInfo.outputPath('embed-settings-clean.png'),
        animations: 'disabled',
        scale: 'css',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      })

      await form.getByRole('textbox', { name: 'หัวข้อ', exact: true }).fill('บัตรสมาชิก {{member}}')
      await expect(saveAll).toBeEnabled()
      await form
        .getByRole('textbox', { name: 'หัวข้อ', exact: true })
        .fill('💗 บัตรสะสมของ {{member}}')
      await expect(saveAll).toBeDisabled()
      await form.getByRole('textbox', { name: 'หัวข้อ', exact: true }).fill('บัตรสมาชิก {{member}}')
      await saveAll.click()
      await expect(page.getByRole('dialog')).toBeVisible()
      expect(saved).toBeUndefined()
      await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก', exact: true }).click()
      await expect(saveAll).toBeEnabled()
      expect(saved).toBeUndefined()
      await form
        .getByRole('textbox', { name: 'รายละเอียด', exact: true })
        .fill('ยอดสะสม **{{total}} บาท**\n-# รายละเอียดสมาชิก')
      await form.getByRole('textbox', { name: 'สีของ Embed (HEX)' }).fill('#123456')
      await form.getByRole('textbox', { name: 'สีของ Embed (HEX)' }).press('Tab')
      const images = form.locator('[data-section="images"]')
      await images.locator('summary').focus()
      await images.locator('summary').press('Enter')
      await images
        .getByRole('textbox', { name: 'URL รูปขนาดย่อ' })
        .fill('/images/profile/avatar-placeholder.png')
      const author = form.locator('[data-section="author"]')
      await author.locator('summary').click()
      await author.getByRole('textbox', { name: /^ชื่อ/ }).fill('สมาชิก Gold')
      const footer = form.locator('[data-section="footer"]')
      await footer.locator('summary').click()
      await footer
        .getByRole('textbox', { name: /^ส่วนท้าย/ })
        .first()
        .fill('ขอบคุณที่ใช้บริการ')
      await footer.getByRole('checkbox').check()
      const fields = form.locator('[data-section="fields"]')
      await fields.locator(':scope > summary').click()
      await fields.getByRole('button', { name: '+ เพิ่ม Field', exact: true }).click()
      await fields.getByRole('textbox', { name: /^ชื่อ/ }).fill('ระดับสมาชิก')
      await fields.getByRole('textbox', { name: /^รายละเอียด/ }).fill('Gold')
      await fields.getByRole('checkbox').check()
      const links = form.locator('[data-section="links"]')
      await links.locator('summary').click()
      await links.getByRole('button', { name: '+ เพิ่มปุ่มลิงก์', exact: true }).click()
      await links.getByRole('textbox', { name: 'ข้อความปุ่ม' }).fill('ร้านค้า')
      await links.getByRole('textbox', { name: 'Emoji', exact: true }).fill('✅')
      await links
        .getByRole('textbox', { name: 'URL', exact: true })
        .fill('https://example.com/store')
      if (isMobile) await editor.getByRole('button', { name: 'ตัวอย่าง', exact: true }).click()
      await expect(
        preview.getByRole('heading', { name: 'บัตรสมาชิก Fujipp', exact: true }),
      ).toBeVisible()
      await expect(preview.locator('.preview-embed')).toHaveCSS(
        'border-left-color',
        'rgb(18, 52, 86)',
      )
      await expect(preview.locator('.discord-subtext')).toHaveText('รายละเอียดสมาชิก')
      await expect(preview.getByText('Gold', { exact: true })).toBeVisible()
      await expect(preview.getByRole('link', { name: /ร้านค้า/ })).toHaveAttribute(
        'href',
        'https://example.com/store',
      )
      const link = preview.getByRole('link', { name: /ร้านค้า/ })
      await expect(link).toHaveCSS('font-size', '14px')
      await expect(link).toHaveCSS('height', '32px')
      await expect(link).toHaveCSS('border-width', '1px')
      await expect(link).toHaveCSS('border-radius', '8px')
      await expect(link.locator('.preview-link-icon')).toHaveCSS('width', '16px')
      await link.focus()
      await expect(link).toBeFocused()
      await preview.screenshot({
        path: testInfo.outputPath('embed-settings-preview.png'),
        animations: 'disabled',
        scale: 'css',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      })
      if (isMobile) {
        await editor.getByRole('button', { name: 'แก้ไข', exact: true }).click()
        await expect(form.getByRole('textbox', { name: 'หัวข้อ', exact: true })).toHaveValue(
          'บัตรสมาชิก {{member}}',
        )
        await expect(images).toHaveAttribute('open')
      }
      await editor.getByRole('button', { name: 'JSON', exact: true }).click()
      const json = form.getByRole('textbox', { name: 'Presentation JSON' })
      const parsed = JSON.parse(await json.inputValue())
      expect(parsed.embeds[0].future_property).toBe('keep-existing-data')
      await editor.getByRole('button', { name: 'แบบฟอร์ม', exact: true }).click()
      await expect(form.getByRole('textbox', { name: 'หัวข้อ', exact: true })).toHaveValue(
        'บัตรสมาชิก {{member}}',
      )
      if (isMobile) {
        for (const width of [768, 320]) {
          await page.setViewportSize({ width, height: 900 })
          expect(
            await form.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
          ).toBe(true)
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true)
          await editor.getByRole('button', { name: 'ตัวอย่าง', exact: true }).click()
          await expect(preview).toBeVisible()
          await expect(form).toBeHidden()
          expect(
            await preview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
          ).toBe(true)
          await editor.getByRole('button', { name: 'แก้ไข', exact: true }).click()
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true }).click()
      expect(saved).toBeUndefined()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect(saveAll).toBeDisabled()
      expect(saved?.presentations.first_card).toMatchObject({
        mode: 'EMBED',
        embeds: [
          {
            title: 'บัตรสมาชิก {{member}}',
            color: 0x123456,
            future_property: 'keep-existing-data',
            author: { name: 'สมาชิก Gold' },
            footer: { text: 'ขอบคุณที่ใช้บริการ' },
            timestamp: true,
            fields: [{ name: 'ระดับสมาชิก', value: 'Gold', inline: true }],
          },
        ],
        links: [{ label: 'ร้านค้า', emoji: '✅', url: 'https://example.com/store' }],
      })
      expect(saved?.presentations.returning_card).toEqual(
        configuration.presentations[1]!.defaultDefinition,
      )
      expect(saved?.presentations.leaderboard).toEqual(
        configuration.presentations[2]!.defaultDefinition,
      )
    },
  )
}

for (const theme of ['LIGHT', 'DARK']) {
  test('renders Components V2 layouts across widths in ' + theme, async ({ page }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [memberSpendingLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [memberSpendingLicense], nextCursor: null, hasMore: false } }),
    )
    await page.route('**/preview-wide.svg', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#5865f2"/><text x="300" y="110" text-anchor="middle" font-family="sans-serif" font-size="32" fill="white">Member Spending Card</text></svg>',
      }),
    )
    const configuration = structuredClone(memberSpendingConfiguration)
    configuration.presentations[0]!.defaultDefinition = {
      mode: 'COMPONENTS_V2',
      components: [
        {
          type: 17,
          components: [
            {
              type: 9,
              components: [
                { type: 10, content: '## 💗 บัตรสะสมของ {{member}}' },
                { type: 10, content: 'ยอดรอบนี้ **{{today}} บาท**\nยอดสะสม `{{total}}` บาท' },
                { type: 10, content: '-# ขอบคุณที่กลับมาใช้บริการอีกครั้ง' },
              ],
              accessory: {
                type: 11,
                media: { url: '/images/profile/avatar-placeholder.png' },
                description: 'รูปสมาชิก',
              },
            },
            { type: 14, spacing: 2 },
            {
              type: 9,
              components: [
                { type: 10, content: '**ระดับ Gold**\nสะสมยอดเพื่อรับสิทธิพิเศษเพิ่มเติม' },
              ],
              accessory: { type: 2, style: 1, label: 'ดูบัตรสมาชิก', custom_id: 'card' },
            },
            { type: 14, spacing: 1, divider: false },
            {
              type: 12,
              items: [
                { media: { url: '/preview-wide.svg' }, description: 'สิทธิพิเศษสำหรับสมาชิก' },
              ],
            },
            {
              type: 1,
              components: [
                { type: 2, style: 3, label: 'ดูยอดสะสม', custom_id: 'balance' },
                { type: 2, style: 2, label: 'ยังไม่พร้อม', custom_id: 'disabled', disabled: true },
                {
                  type: 2,
                  style: 5,
                  label: 'ร้านค้า',
                  emoji: { name: '✅' },
                  url: 'https://example.com/store',
                },
              ],
            },
          ],
        },
        {
          type: 17,
          accent_color: 0xeb459e,
          components: [
            { type: 10, content: '### สิทธิพิเศษของสมาชิก' },
            {
              type: 12,
              items: [1, 2, 3].map((index) => ({
                media: { url: '/images/profile/avatar-placeholder.png' },
                description: 'สิทธิพิเศษ ' + index,
              })),
            },
            {
              type: 1,
              components: [{ type: 3, placeholder: 'เลือกสิทธิพิเศษของคุณ', custom_id: 'rewards' }],
            },
          ],
        },
      ],
    }
    await page.route('**/configuration', (route) => route.fulfill({ json: configuration }))
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    const preview = page.locator('#feature-presentations .preview-shell')
    await expect(preview.getByRole('heading', { name: '💗 บัตรสะสมของ Fujipp' })).toBeVisible()
    await expect(preview.locator('.preview-container').first()).not.toHaveClass(
      /preview-container--accent/,
    )
    await expect(preview.locator('.preview-container--accent')).toHaveCSS(
      'border-left-color',
      'rgb(235, 69, 158)',
    )
    await expect(preview.getByRole('button', { name: 'ยังไม่พร้อม' })).toBeDisabled()
    await expect(preview.getByRole('link', { name: /ร้านค้า/ })).toHaveAttribute(
      'href',
      'https://example.com/store',
    )
    await page.evaluate(() => document.fonts.ready)
    for (const width of [1366, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(preview.locator('.preview-copy').first()).toHaveCSS('font-size', '16px')
      await expect(preview.locator('h2')).toHaveCSS('font-size', '20px')
      await expect(preview.locator('.discord-subtext')).toHaveCSS('font-size', '11px')
      const link = preview.getByRole('link', { name: /ร้านค้า/ })
      await expect(link).toHaveCSS('font-size', '14px')
      await expect(link).toHaveCSS('height', '32px')
      await expect(link).toHaveCSS('border-width', '1px')
      await expect(link).toHaveCSS('border-radius', '8px')
      await expect(link.locator('.preview-link-icon')).toHaveCSS('width', '16px')
      await expect(preview.getByRole('button', { name: 'ดูบัตรสมาชิก', exact: true })).toHaveCSS(
        'background-color',
        'rgb(88, 101, 242)',
      )
      const success = preview.getByRole('button', { name: 'ดูยอดสะสม', exact: true })
      await expect(success).toHaveCSS('background-color', 'rgb(0, 133, 69)')
      await expect(success).toHaveCSS('border-radius', '8px')
      const disabled = preview.getByRole('button', { name: 'ยังไม่พร้อม', exact: true })
      await expect(disabled).toBeDisabled()
      await expect(disabled).toHaveCSS('opacity', '0.5')
      await expect(disabled).toHaveCSS('background-color', 'rgba(151, 151, 159, 0.12)')
      const separators = preview.locator('.preview-separator')
      await expect(separators.nth(0)).toHaveCSS('padding-top', '12px')
      await expect(separators.nth(1)).toHaveCSS('padding-top', '4px')
      const image = preview.locator('.preview-gallery--single img')
      await expect
        .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
        .toBe(600)
      const box = await image.boundingBox()
      expect(box!.width / box!.height).toBeCloseTo(3, 1)
      expect(
        await preview.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return [
            ...element.querySelectorAll(
              '.preview-container, .preview-copy, .preview-section, .preview-component-button, .preview-gallery',
            ),
          ].every((child) => {
            const box = child.getBoundingClientRect()
            return (
              child.scrollWidth <= child.clientWidth + 1 &&
              box.left >= bounds.left &&
              box.right <= bounds.right + 1
            )
          })
        }),
      ).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      if (width !== 768) {
        await preview.evaluate((element) =>
          element.scrollIntoView({ behavior: 'instant', block: 'start' }),
        )
        await preview.screenshot({
          path: testInfo.outputPath('discord-v2-' + width + '.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
        })
      }
    }
    await preview.getByRole('button', { name: 'ดูบัตรสมาชิก', exact: true }).click()
    await expect(preview.getByRole('status')).toContainText('ดูบัตรสมาชิก')
  })
}

for (const theme of ['LIGHT', 'DARK']) {
  test(`configures Member Spending Card in ${theme}`, async ({ page, isMobile }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [memberSpendingLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [memberSpendingLicense], nextCursor: null, hasMore: false } }),
    )
    let saved: { values: Record<string, unknown>; secrets: Record<string, string> } | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') saved = route.request().postDataJSON()
      await route.fulfill({ json: { ...memberSpendingConfiguration, revision: saved ? 2 : 1 } })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    const config = page.locator('#feature-config')
    await expect(config.getByRole('heading', { name: 'ระดับสมาชิก', exact: true })).toBeVisible()
    const saveAll = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    await expect(saveAll).toBeDisabled()
    await expect(config.getByRole('tabpanel')).toHaveCount(1)
    const selectCategory = async (name: string) => {
      if (isMobile) {
        await config.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
        await page.getByRole('option', { name, exact: true }).click()
      } else await config.getByRole('tab', { name, exact: true }).click()
    }
    const levelsTab = config.getByRole('tab', { name: 'ระดับสมาชิก', exact: true })
    if (!isMobile) {
      await expect(
        config.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }),
      ).toHaveCount(0)
      await levelsTab.focus()
      await levelsTab.press('ArrowRight')
      await expect(config.getByRole('tab', { name: 'เงื่อนไขยศ', exact: true })).toBeFocused()
      await config.getByRole('tab', { name: 'เงื่อนไขยศ', exact: true }).press('Home')
      await expect(levelsTab).toHaveAttribute('aria-selected', 'true')
    } else {
      await expect(config.getByRole('tablist')).toHaveCount(0)
      const selector = config.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true })
      await selector.focus()
      await selector.press('Enter')
      await selector.press('ArrowDown')
      await selector.press('Enter')
      await expect(config.getByRole('heading', { name: 'เงื่อนไขยศ', exact: true })).toBeVisible()
      await selectCategory('ระดับสมาชิก')
    }
    await expect(config.getByLabel('PostgreSQL Connection URL')).toHaveCount(0)
    await expect(config.getByLabel('จำนวนครั้งขั้นต่ำ')).toHaveCount(0)
    await expect(config.getByText('ยังไม่มีระดับยอดสะสม')).toBeVisible()
    const roleHelp = config.locator('details')
    await expect(roleHelp).not.toHaveAttribute('open')
    await roleHelp.getByText('วิธีหา Role ID', { exact: true }).click()
    await expect(roleHelp).toHaveAttribute('open')
    await roleHelp.getByText('วิธีหา Role ID', { exact: true }).click()
    const screenshotOptions = {
      animations: 'disabled' as const,
      scale: 'css' as const,
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .vue-devtools__anchor { visibility: hidden !important; }',
    }
    await config.screenshot({
      ...screenshotOptions,
      path: testInfo.outputPath('member-spending-default.png'),
    })

    await config.getByRole('button', { name: 'เพิ่มระดับยอดสะสม' }).click()
    await expect(saveAll).toBeEnabled()
    const amount = config.getByLabel('ยอดสะสมขั้นต่ำ (บาท)').first()
    await expect(amount).toBeFocused()
    await amount.fill('2500.50')
    await config
      .getByLabel(/^Discord Role ID/)
      .first()
      .fill('234567890123456789')
    await config.getByRole('button', { name: 'เพิ่มระดับยอดสะสม' }).click()
    await config.getByLabel('ยอดสะสมขั้นต่ำ (บาท)').nth(1).fill('5000')
    await config
      .getByLabel(/^Discord Role ID/)
      .nth(1)
      .fill('567890123456789012')
    await selectCategory('เงื่อนไขยศ')
    await config.getByRole('switch', { name: 'ให้ยศตามจำนวนครั้งด้วย' }).click()
    await config.getByLabel('จำนวนครั้งขั้นต่ำ').fill('8')
    await config.getByRole('switch', { name: 'ให้ยศตามจำนวนครั้งด้วย' }).click()
    await config.getByRole('switch', { name: 'ให้ยศตามจำนวนครั้งด้วย' }).click()
    await expect(config.getByLabel('จำนวนครั้งขั้นต่ำ')).toHaveValue('8')
    await selectCategory('ฐานข้อมูล')
    await config.getByRole('switch', { name: 'ใช้ฐานข้อมูลของร้าน' }).click()
    const database = config.getByLabel('PostgreSQL Connection URL')
    await expect(database).toHaveAttribute('placeholder', 'บันทึกไว้แล้ว · กรอกเพื่อเปลี่ยน')
    await database.fill('postgresql://demo:example@db.example.com/store')
    await expect(database).toHaveAttribute('type', 'password')
    await config.getByRole('switch', { name: 'ใช้ฐานข้อมูลของร้าน' }).click()
    await config.getByRole('switch', { name: 'ใช้ฐานข้อมูลของร้าน' }).click()
    await expect(database).toHaveValue('postgresql://demo:example@db.example.com/store')
    await selectCategory('อันดับ')
    await config.getByLabel('ยศอันดับ 1').fill('345678901234567890')
    await config.getByLabel('ยศอันดับ 2–5').fill('456789012345678901')
    await selectCategory('ระดับสมาชิก')
    await expect(amount).toHaveValue('2500.5')
    await expect(config.getByLabel(/^Discord Role ID/).first()).toHaveValue('234567890123456789')
    await config.getByRole('heading', { name: 'ระดับสมาชิก', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase())
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await config.screenshot({
      ...screenshotOptions,
      path: testInfo.outputPath('member-spending-configured.png'),
    })
    await selectCategory('สิทธิ์คำสั่ง')
    await expect(
      config.getByRole('heading', { name: 'สิทธิ์การใช้คำสั่ง', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(saveAll).toBeDisabled()
    expect(saved?.values).toMatchObject({
      SPENDING_DB_USE_OWN: true,
      SPENDING_COUNT_ENABLED: true,
      SPENDING_UPGRADE_COUNT: 8,
      SPENDING_TIER_STACK: true,
      SPENDING_UPGRADE_TIERS: [
        { amount: 2500.5, roleId: '234567890123456789' },
        { amount: 5000, roleId: '567890123456789012' },
      ],
      SPENDING_TOP1_ROLE_ID: '345678901234567890',
      SPENDING_TOP5_ROLE_ID: '456789012345678901',
      COMMAND_PERMISSION_RULES: [],
    })
    expect(saved?.secrets).toEqual({
      SPENDING_DB_URL: 'postgresql://demo:example@db.example.com/store',
    })
    await selectCategory('ระดับสมาชิก')
    await config.getByRole('button', { name: 'เพิ่มระดับยอดสะสม' }).click()
    await config.getByRole('button', { name: 'ลบระดับ 1' }).click()
    await expect(config.getByText('ยังไม่มีระดับยอดสะสม')).toBeVisible()
    expect(errors).toEqual([])
  })
}

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'keeps Discord embed content readable across widths in ' + theme,
    async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [memberSpendingLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({
          json: { items: [memberSpendingLicense], nextCursor: null, hasMore: false },
        }),
      )
      const configuration = structuredClone(memberSpendingConfiguration)
      configuration.presentations[0]!.defaultDefinition = {
        mode: 'EMBED',
        embeds: [
          {
            title: '💗 บัตรสมาชิก Member Spending Card',
            description:
              'ยินดีต้อนรับ {{member}}\n**ยอดสะสม** 2,500 บาท\n' + 'long-message-'.repeat(10),
            author: { name: 'Special Support', icon_url: '/images/profile/avatar-placeholder.png' },
            thumbnail: { url: '{{avatar}}' },
            fields: [
              {
                name: 'รายละเอียด',
                value: 'ข้อความภาษาไทยที่ต้องแสดงครบโดยไม่ล้นกรอบ',
                inline: false,
              },
              { name: 'ยอดสะสม', value: '2,500 บาท', inline: true },
              { name: 'จำนวนครั้ง', value: '5 ครั้ง', inline: true },
              { name: 'ระดับสมาชิก', value: 'Gold', inline: true },
            ],
            image: { url: '/images/profile/avatar-placeholder.png' },
            footer: {
              text: 'footer-without-spaces-'.repeat(5),
              icon_url: '/images/profile/avatar-placeholder.png',
            },
          },
        ],
      }
      await page.route('**/configuration', (route) => route.fulfill({ json: configuration }))
      await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
      const preview = page.locator('#feature-presentations .preview-shell')
      await expect(
        preview.getByText('💗 บัตรสมาชิก Member Spending Card', { exact: true }),
      ).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      for (const width of [1366, 768, 320]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(preview.locator('.preview-embed h4')).toHaveCSS('font-size', '16px')
        await expect(preview.locator('.preview-embed .preview-copy')).toHaveCSS('font-size', '14px')
        await expect(preview.locator('.preview-footer')).toHaveCSS('font-size', '12px')
        await expect(preview).toHaveCSS('font-family', /Noto Sans/)
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true)
        expect(
          await preview.evaluate((element) => {
            const bounds = element.getBoundingClientRect()
            return [
              ...element.querySelectorAll(
                '.preview-embed, .preview-field, .preview-image, .preview-footer',
              ),
            ].every((child) => {
              const box = child.getBoundingClientRect()
              return (
                child.scrollWidth <= child.clientWidth + 1 &&
                box.left >= bounds.left &&
                box.right <= bounds.right + 1
              )
            })
          }),
        ).toBe(true)
        const fields = await preview.locator('.preview-field').evaluateAll((elements) =>
          elements.map((element) => {
            const { top, left } = element.getBoundingClientRect()
            return { top, left }
          }),
        )
        if (width >= 768) {
          expect(fields[1]!.top).toBe(fields[2]!.top)
          expect(fields[1]!.left).toBeLessThan(fields[2]!.left)
        } else {
          expect(fields[1]!.top).toBeLessThan(fields[2]!.top)
          const textColumn = await preview.locator('.preview-embed-content').boundingBox()
          expect(textColumn!.width).toBeGreaterThanOrEqual(80)
        }
        if (width !== 768) {
          await preview.evaluate((element) =>
            element.scrollIntoView({ behavior: 'instant', block: 'start' }),
          )
          await preview.screenshot({
            path: testInfo.outputPath('discord-embed-' + width + '.png'),
            animations: 'disabled',
            scale: 'css',
            style:
              '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
          })
        }
      }
    },
  )
}

test('renders the Thai Discord reference message at CSS pixel scale', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fujipp-theme-mode', 'LIGHT'))
  await page.route('**/api/v1/feature-licenses', (route) =>
    route.fulfill({ json: [memberSpendingLicense] }),
  )
  await page.route('**/api/v2/feature-licenses*', (route) =>
    route.fulfill({
      json: { items: [memberSpendingLicense], nextCursor: null, hasMore: false },
    }),
  )
  const configuration = structuredClone(memberSpendingConfiguration)
  configuration.presentations[0]!.defaultDefinition = {
    mode: 'EMBED',
    embeds: [
      {
        color: 0xf15ec0,
        title: '💗 บัตรสมาชิกร้านไอด้า ของคุณ -bxbychi',
        description:
          '🌸 ขอบคุณสำหรับการกลับมาใช้บริการอีกครั้ง 🌸\n୨. !! 🪙 : ค่าใช้จ่ายรอบนี้: `160.00` บาท\n💕 รวมยอดสะสมทั้งหมดของลูกค้า: `580.00` บาท\n\n**' +
          '‿'.repeat(39) +
          '**\n-# **' +
          '‿'.repeat(39) +
          '**',
        thumbnail: { url: '{{avatar}}' },
      },
    ],
  }
  await page.route('**/configuration', (route) => route.fulfill({ json: configuration }))
  await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
  const preview = page.locator('#feature-presentations .preview-shell')
  await expect(
    preview.getByText('💗 บัตรสมาชิกร้านไอด้า ของคุณ -bxbychi', { exact: true }),
  ).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(preview).not.toHaveCSS('font-family', /Kanit|Noto Sans Thai/)
  await expect(preview.locator('.preview-author time')).toHaveText('14:30')
  await expect(preview.locator('.discord-subtext')).toHaveCount(1)
  await expect(preview.locator('.discord-subtext strong')).toHaveCSS('font-size', '11px')
  if (!isMobile) {
    const card = await preview.locator('.preview-embed').boundingBox()
    expect(card!.width).toBeLessThanOrEqual(460)
    expect(card!.height).toBeLessThanOrEqual(180)
    await expect(preview.locator('.preview-thumbnail')).toHaveCSS('max-width', '80px')
    const dividerLines = await preview.locator('.preview-copy strong').evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return range.getClientRects().length
      }),
    )
    expect(dividerLines).toEqual([1, 1])
  }
  await preview.evaluate((element) =>
    element.scrollIntoView({ behavior: 'instant', block: 'start' }),
  )
  await preview.screenshot({
    path: testInfo.outputPath('discord-reference-message.png'),
    animations: 'disabled',
    scale: 'css',
    style:
      '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
  })
})

test('keeps English Member Spending settings compact across categories', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fujipp-theme-mode', 'DARK'))
  await page.route('**/api/v1/feature-licenses', (route) =>
    route.fulfill({ json: [memberSpendingLicense] }),
  )
  await page.route('**/api/v2/feature-licenses*', (route) =>
    route.fulfill({ json: { items: [memberSpendingLicense], nextCursor: null, hasMore: false } }),
  )
  await page.route('**/configuration', (route) =>
    route.fulfill({
      json: {
        ...memberSpendingConfiguration,
        fields: memberSpendingConfiguration.fields.map((field) =>
          field.key === 'SPENDING_UPGRADE_TIERS'
            ? {
                ...field,
                value: [
                  { amount: 5000, roleId: '234567890123456789' },
                  { amount: 10000, roleId: '567890123456789012' },
                ],
              }
            : field,
        ),
      },
    }),
  )
  await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=en')
  const config = page.locator('#feature-config')
  await expect(config.getByRole('heading', { name: 'Member levels', exact: true })).toBeVisible()
  await expect(config.getByRole('tabpanel')).toHaveCount(1)
  await expect(config.getByLabel('Minimum spending (THB)')).toHaveCount(2)
  await config.getByLabel('Minimum spending (THB)').first().fill('5100')
  if (isMobile) {
    const selector = config.getByRole('combobox', { name: 'Configuration category', exact: true })
    await selector.click()
    await page.getByRole('option', { name: 'Database', exact: true }).click()
    await expect(config.getByRole('heading', { name: 'Database', exact: true })).toBeVisible()
    await selector.click()
    await page.getByRole('option', { name: 'Member levels', exact: true }).click()
  } else {
    await config.getByRole('tab', { name: 'Database', exact: true }).click()
    await expect(config.getByRole('heading', { name: 'Database', exact: true })).toBeVisible()
    await config.getByRole('tab', { name: 'Member levels', exact: true }).click()
  }
  await expect(config.getByLabel('Minimum spending (THB)').first()).toHaveValue('5100')
  await config.getByRole('heading', { name: 'Member levels', exact: true }).click()
  await config.screenshot({
    path: testInfo.outputPath('member-spending-clean-english.png'),
    animations: 'disabled',
    scale: 'css',
    style:
      '.navbar, .admin-tools, .app-scroll-rail, .vue-devtools__anchor { visibility: hidden !important; }',
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  const messageDesign = page.locator('#feature-presentations')
  await expect(
    messageDesign.getByRole('heading', { name: 'Message design', exact: true }),
  ).toBeVisible()
  if (isMobile) {
    await messageDesign.getByRole('combobox', { name: 'Message', exact: true }).click()
    await page.getByRole('option', { name: 'Spending leaderboard', exact: true }).click()
  } else await messageDesign.getByRole('button', { name: /^Spending leaderboard/ }).click()
  await expect(
    messageDesign.getByRole('heading', { name: 'Spending leaderboard', exact: true }),
  ).toBeVisible()
  await messageDesign.screenshot({
    path: testInfo.outputPath('member-message-english.png'),
    animations: 'disabled',
    scale: 'css',
    style:
      '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
  })
  if (!isMobile) {
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(config.getByRole('tablist')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  }
})

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'previews and opens a specific Member Spending message in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      await page.route('**/api/v2/bots/fixture-bot', async (route) => {
        const response = await route.fetch()
        await route.fulfill({
          json: {
            ...(await response.json()),
            discordAvatarUrl: '/images/profile/avatar-placeholder.png',
          },
        })
      })
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [memberSpendingLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({
          json: { items: [memberSpendingLicense], nextCursor: null, hasMore: false },
        }),
      )
      let current = structuredClone(memberSpendingConfiguration)
      const saves: Array<{
        values: Record<string, unknown>
        presentations: Record<string, Record<string, unknown>>
      }> = []
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') {
          const input = route.request().postDataJSON()
          saves.push(input)
          current = {
            ...current,
            revision: current.revision + 1,
            fields: current.fields.map((field) =>
              field.secret ? field : { ...field, value: input.values[field.key] },
            ),
            presentations: current.presentations.map((slot) => ({
              ...slot,
              overrideDefinition: input.presentations[slot.key],
            })),
          }
        }
        await route.fulfill({ json: current })
      })
      await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
      const design = page.locator('#feature-presentations')
      await expect(
        design.getByRole('heading', { name: 'ออกแบบข้อความ', exact: true }),
      ).toBeVisible()
      const selectMessage = async (name: string) => {
        if (isMobile) {
          await design.getByRole('combobox', { name: 'ข้อความ', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else await design.getByRole('button', { name: new RegExp('^' + name) }).click()
      }
      await expect(
        design.getByRole('heading', { name: 'เพิ่มยอดครั้งแรก', exact: true }),
      ).toBeVisible()
      await expect(design).toContainText('500.00')
      await expect(design).not.toContainText('first_card')
      await expect(design.getByRole('button', { name: 'ออกแบบ Embed', exact: true })).toHaveCount(0)
      await expect(
        design.getByRole('button', { name: 'ออกแบบ Components V2', exact: true }),
      ).toHaveCount(0)
      const screenshotOptions = {
        animations: 'disabled' as const,
        scale: 'css' as const,
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      }
      await page.evaluate(() => document.fonts.ready)
      await design.evaluate((element) =>
        element.scrollIntoView({ behavior: 'instant', block: 'start' }),
      )
      await design.screenshot({
        ...screenshotOptions,
        path: testInfo.outputPath('member-message-first.png'),
      })
      await selectMessage('เพิ่มยอดครั้งถัดไป')
      await expect(
        design.getByRole('heading', { name: 'เพิ่มยอดครั้งถัดไป', exact: true }),
      ).toBeVisible()
      await expect(design).toContainText('2,500.00')
      await selectMessage('อันดับยอดสะสม')
      await expect(
        design.getByRole('heading', { name: 'อันดับยอดสะสม', exact: true }),
      ).toBeVisible()
      await expect(design).toContainText('@Minnie')
      await expect(design).not.toContainText('returning_card')
      expect(saves).toHaveLength(0)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await design.screenshot({
        ...screenshotOptions,
        path: testInfo.outputPath('member-message-leaderboard.png'),
      })

      await page
        .locator('#feature-config')
        .getByLabel('ยศเมื่อเพิ่มยอดครั้งแรก (ไม่บังคับ)')
        .fill('987654321098765432')
      await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
      await expect(page).toHaveURL(/components-v2/)
      expect(new URL(page.url()).searchParams.get('message')).toBe('leaderboard')
      expect(saves).toHaveLength(1)
      expect(saves[0]?.values.SPENDING_FIRST_ROLE_ID).toBe('987654321098765432')
      expect(saves[0]?.presentations).toMatchObject({
        first_card: { mode: 'EMBED' },
        returning_card: { mode: 'COMPONENTS_V2' },
        leaderboard: { mode: 'COMPONENTS_V2' },
      })
      const editor = page.locator('#feature-presentation-editor')
      await expect(editor.locator('article')).toHaveCount(1)
      await expect(
        editor.getByRole('heading', { name: 'อันดับยอดสะสม', exact: true }),
      ).toBeVisible()
      await page.goBack()
      await expect(
        design.getByRole('heading', { name: 'ออกแบบข้อความ', exact: true }),
      ).toBeVisible()
      await selectMessage('เพิ่มยอดครั้งแรก')
      await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
      await expect(page).toHaveURL(/\/embed\?/)
      expect(new URL(page.url()).searchParams.get('message')).toBe('first_card')
      await expect(
        editor.getByRole('heading', { name: 'เพิ่มยอดครั้งแรก', exact: true }),
      ).toBeVisible()
      await expect(editor.locator('article')).toHaveCount(1)
      await expect(editor.locator('details').first()).not.toHaveAttribute('open')
      await editor.getByRole('textbox', { name: /^หัวข้อ/ }).fill('บัตรสมาชิก {{member}}')
      await page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true }).click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(page.getByRole('dialog')).toBeHidden()
      expect(saves).toHaveLength(3)
      expect(saves[2]?.presentations.first_card).toMatchObject({
        mode: 'EMBED',
        embeds: [{ title: 'บัตรสมาชิก {{member}}' }],
      })
      expect(saves[2]?.presentations.leaderboard).toEqual(saves[0]?.presentations.leaderboard)
      expect(saves[2]?.presentations.returning_card).toEqual(saves[0]?.presentations.returning_card)
      await expect(
        editor.getByRole('heading', { name: 'เพิ่มยอดครั้งถัดไป', exact: true }),
      ).toHaveCount(0)
      await expect(editor.locator('details').first()).not.toHaveAttribute('open')
      await page.reload()
      await expect(editor.locator('article')).toHaveCount(1)
      await expect(
        editor.getByRole('heading', { name: 'เพิ่มยอดครั้งแรก', exact: true }),
      ).toBeVisible()
    },
  )
}
