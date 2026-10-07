import { expect, test } from '@playwright/test'
import { reviewCreditFixture } from '../src/__tests__/fixtures/reviewCredit'

for (const theme of ['LIGHT', 'DARK']) {
  for (const version of ['1.0.0', '1.1.0'] as const) {
    test(`edits Review Credit ${version} in ${theme}`, async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const { reviewLicense, config, reply } = reviewCreditFixture(version)
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [reviewLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [reviewLicense], nextCursor: null, hasMore: false } }),
      )
      let saved: { values: Record<string, unknown> } | undefined
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') {
          saved = route.request().postDataJSON()
          for (const field of config.fields)
            field.value = saved!.values[field.key] as typeof field.value
          config.revision++
        }
        await route.fulfill({ json: config })
      })
      await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
      await page.addStyleTag({
        content: '#__vue-devtools-container__ { display: none !important; }',
      })
      const form = page.locator('#feature-config')
      const categories = form.locator('[data-review-credit-config]')
      const category = async (name: string) => {
        if ((page.viewportSize()?.width ?? 0) < 768) {
          await categories.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else await categories.getByRole('tab', { name, exact: true }).click()
        await expect(categories.getByRole('tabpanel')).toHaveCount(1)
      }
      const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
      const channelPreview = form.locator('[data-review-channel-preview]')
      const replyPreview = form.locator('[data-review-reply-preview]')
      const firstReply = form.getByRole('textbox', { name: 'ข้อความตอบกลับ 1', exact: true })
      await expect(save).toBeDisabled()
      await expect(channelPreview).toContainText('💯・review-123')
      for (const name of ['การตอบกลับ', 'ยศผู้รีวิว', 'คำสั่ง', 'ห้องรีวิว']) await category(name)
      await expect(save).toBeDisabled()
      if ((page.viewportSize()?.width ?? 0) >= 768) {
        const channelTab = categories.getByRole('tab', { name: 'ห้องรีวิว', exact: true })
        await channelTab.focus()
        await channelTab.press('ArrowRight')
        await expect(categories.getByRole('tab', { name: 'การตอบกลับ', exact: true })).toBeFocused()
        await categories.getByRole('tab', { name: 'การตอบกลับ', exact: true }).press('End')
        await expect(categories.getByRole('tab', { name: 'คำสั่ง', exact: true })).toBeFocused()
        await categories.getByRole('tab', { name: 'คำสั่ง', exact: true }).press('Home')
      }
      await category('การตอบกลับ')
      await expect(firstReply).toHaveValue(reply)
      await expect(form.locator('textarea')).toHaveCount(2)
      await expect(replyPreview).toHaveText(reply)
      await expect(page.getByRole('heading', { name: 'ออกแบบข้อความ' })).toHaveCount(0)
      await form.getByRole('combobox', { name: 'ตัวอย่างข้อความตอบกลับ', exact: true }).click()
      await page.getByRole('option', { name: 'ข้อความ 2', exact: true }).click()
      await expect(replyPreview).toHaveText('ขอบคุณที่ไว้วางใจครับ')
      await expect(save).toBeDisabled()
      await category('ห้องรีวิว')
      const channel = form.getByRole('textbox', { name: /Channel ID ห้องรีวิว/ })
      await channel.fill('bad-id')
      await expect(channel).toHaveAttribute('aria-invalid', 'true')
      await channel.fill('123456789012345678')
      await expect(save).toBeDisabled()
      const template = form.getByRole('textbox', { name: /รูปแบบชื่อห้อง/ })
      await template.fill('reviews')
      await expect(template).toHaveAttribute('aria-invalid', 'true')
      await template.fill('⭐・reviews-{count}')
      await expect(channelPreview).toContainText('⭐・reviews-123')
      await expect(template).toHaveAttribute('aria-invalid', 'false')
      await category('คำสั่ง')
      const command = form.getByRole('textbox', { name: /ชื่อคำสั่ง/ })
      await command.fill('/INVALID')
      await expect(command).toHaveAttribute('aria-invalid', 'true')
      await command.fill('credit')
      const commands = form.locator('[data-feature-commands]')
      await expect(commands.getByRole('heading', { name: 'คำสั่ง', exact: true })).toBeVisible()
      await expect(commands.getByText(/Bot Permissions/)).toHaveCount(1)
      await expect(form.getByText('/credit recount', { exact: true })).toBeVisible()
      await expect(form.getByText('/credit refresh', { exact: true })).toBeVisible()
      await expect(form.getByText('/credit set-count', { exact: true })).toHaveCount(
        version === '1.1.0' ? 1 : 0,
      )
      await category('ห้องรีวิว')
      await expect(
        form.getByRole('switch', { name: 'นับรีวิวจาก Webhook', exact: true }),
      ).toHaveCount(version === '1.1.0' ? 1 : 0)
      if (version === '1.1.0')
        await form.getByRole('switch', { name: 'นับรีวิวจาก Webhook', exact: true }).click()
      await category('การตอบกลับ')
      await form.getByRole('switch', { name: 'เก็บเฉพาะข้อความตอบกลับล่าสุด', exact: true }).click()
      await category('ยศผู้รีวิว')
      const role = form.getByRole('textbox', { name: 'Role ID ผู้รีวิว (ไม่บังคับ)', exact: true })
      await role.fill('invalid')
      await expect(role).toHaveAttribute('aria-invalid', 'true')
      await role.fill('111111111111111111')
      await category('การตอบกลับ')
      await form.getByRole('button', { name: 'ลบ Reaction 2', exact: true }).click()
      await form.getByRole('button', { name: 'เพิ่ม Reaction', exact: true }).click()
      const reaction = form.getByRole('textbox', { name: 'Reaction 2', exact: true })
      await expect(reaction).toBeFocused()
      await reaction.fill('🎉')
      await expect(reaction).toHaveAttribute('maxlength', '100')
      await form.getByRole('button', { name: 'เพิ่มข้อความตอบกลับ', exact: true }).click()
      const thirdReply = form.getByRole('textbox', { name: 'ข้อความตอบกลับ 3', exact: true })
      await expect(thirdReply).toBeFocused()
      await expect(thirdReply).toHaveAttribute('maxlength', '2000')
      await thirdReply.fill('รีวิวของคุณมีความหมายมากครับ\nขอบคุณครับ 💖')
      await thirdReply.blur()
      await category('ห้องรีวิว')
      await expect(template).toHaveValue('⭐・reviews-{count}')
      await category('การตอบกลับ')
      await expect(thirdReply).toHaveValue('รีวิวของคุณมีความหมายมากครับ\nขอบคุณครับ 💖')
      await page.evaluate(() => document.fonts.ready)
      for (const width of [1366, 768, 320]) {
        await page.setViewportSize({ width, height: 1000 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        expect(
          await channelPreview.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        ).toBe(true)
        expect(
          await replyPreview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true)
        for (const [name, key] of [
          ['ห้องรีวิว', 'channel'],
          ['การตอบกลับ', 'responses'],
          ['ยศผู้รีวิว', 'role'],
          ['คำสั่ง', 'commands'],
        ] as const) {
          await category(name)
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true)
          if (version === '1.1.0' && width !== 768)
            await categories.screenshot({
              path: testInfo.outputPath(key + '-' + width + '.png'),
              animations: 'disabled',
              scale: 'css',
              style:
                '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
            })
        }
        expect(
          await commands.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true)
      }
      await save.click()
      expect(saved).toBeUndefined()
      await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก', exact: true }).click()
      await expect(save).toBeEnabled()
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect(save).toBeDisabled()
      expect(saved?.values).toMatchObject({
        REVIEW_CHANNEL_ID: '123456789012345678',
        REVIEW_CHANNEL_NAME_TEMPLATE: '⭐・reviews-{count}',
        REVIEW_COMMAND_NAME: 'credit',
        REVIEW_ROLE_ID: '111111111111111111',
        REVIEW_REACTIONS: ['💖', '🎉'],
        REVIEW_REPLY_MESSAGES: [
          reply,
          'ขอบคุณที่ไว้วางใจครับ',
          'รีวิวของคุณมีความหมายมากครับ\nขอบคุณครับ 💖',
        ],
        REVIEW_DELETE_OLD_REPLY: false,
        FUTURE_SETTING: 'preserved',
      })
      if (version === '1.1.0') expect(saved?.values.REVIEW_COUNT_WEBHOOKS).toBe(false)
      else expect(saved?.values).not.toHaveProperty('REVIEW_COUNT_WEBHOOKS')
      await page.reload()
      await expect(save).toBeDisabled()
      await expect(channelPreview).toContainText('⭐・reviews-123')
      await category('คำสั่ง')
      await expect(command).toHaveValue('credit')
      await category('การตอบกลับ')
      await expect(firstReply).toHaveValue(reply)
      await expect(form.locator('textarea')).toHaveCount(3)
      await form.getByRole('button', { name: 'เพิ่มข้อความตอบกลับ', exact: true }).click()
      await expect(
        form.getByRole('textbox', { name: 'ข้อความตอบกลับ 4', exact: true }),
      ).toBeFocused()
      await expect(save).toBeDisabled()
      await category('คำสั่ง')
      await category('การตอบกลับ')
      await expect(
        form.getByRole('textbox', { name: 'ข้อความตอบกลับ 4', exact: true }),
      ).toHaveValue('')
      await form.getByRole('button', { name: 'ลบข้อความตอบกลับ 4', exact: true }).click()
      for (let index = 3; index > 0; index--)
        await form.getByRole('button', { name: `ลบข้อความตอบกลับ ${index}`, exact: true }).click()
      await expect(form.getByText('ยังไม่มีข้อความตอบกลับอัตโนมัติ')).toBeVisible()
      await expect(
        form.getByRole('button', { name: 'เพิ่มข้อความตอบกลับ', exact: true }),
      ).toBeFocused()
      await expect(replyPreview).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }
}
