import { expect, test } from '@playwright/test'
import { configuration, license } from '../src/__tests__/fixtures/domain'
import type { FeatureConfiguration } from '../src/features/bots/api'

for (const theme of ['LIGHT', 'DARK']) {
  test('edits Voice Keeper in ' + theme, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const voiceLicense = {
      ...license,
      featureCode: 'voice-keeper',
      featureName: 'Voice Keeper',
      version: '1.0.0',
    }
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [voiceLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [voiceLicense], nextCursor: null, hasMore: false } }),
    )
    const config: FeatureConfiguration = {
      ...structuredClone(configuration),
      presentations: [],
      fields: [
        {
          key: 'COMMAND_NAME',
          type: 'STRING',
          value: 'voice',
          validation: { pattern: '^[a-z0-9_-]{1,32}$', maxLength: 32 },
        },
        { key: 'SELF_MUTE', type: 'BOOLEAN', value: true },
        { key: 'SELF_DEAF', type: 'BOOLEAN', value: true },
        { key: 'FUTURE_SETTING', type: 'STRING', value: 'preserved' },
      ].map((item) => ({
        label: item.key,
        description: '',
        defaultValue: item.value,
        required: true,
        secret: false,
        configured: true,
        validation: null,
        ui: null,
        ...item,
      })),
    }
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
    await page.addStyleTag({ content: '#__vue-devtools-container__ { display: none !important; }' })
    const form = page.locator('#feature-config')
    const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    const command = form.getByRole('textbox', { name: /ชื่อคำสั่ง/ })
    const commands = form.locator('[data-feature-commands]')
    const preview = commands.locator('[data-feature-command-list]')
    const audioPreview = form.locator('[data-voice-audio-preview]')
    const mute = form.getByRole('switch', { name: 'ปิดไมโครโฟน', exact: true })
    const deaf = form.getByRole('switch', { name: 'ปิดการรับเสียง', exact: true })
    await expect(save).toBeDisabled()
    await expect(commands.getByRole('heading', { name: 'คำสั่ง', exact: true })).toBeVisible()
    await expect(commands.getByText(/Bot Permissions/)).toHaveCount(1)
    await expect(command).toHaveValue('voice')
    await expect(command).toHaveAttribute('maxlength', '32')
    await expect(preview).toContainText('/voice join')
    await expect(preview).toContainText('/voice leave')
    await expect(audioPreview).toContainText('ปิดไมโครโฟน')
    await expect(audioPreview).toContainText('ไม่รับเสียงจากห้อง')
    await expect(page.getByRole('heading', { name: 'ออกแบบข้อความ' })).toHaveCount(0)
    await expect(form.getByRole('textbox', { name: /FUTURE_SETTING/ })).toHaveValue('preserved')
    await command.fill('/INVALID')
    await expect(command).toHaveAttribute('aria-invalid', 'true')
    await command.fill('voice')
    await expect(command).toHaveAttribute('aria-invalid', 'false')
    await expect(save).toBeDisabled()
    await mute.focus()
    await mute.press('Space')
    await expect(mute).toHaveAttribute('aria-checked', 'false')
    await expect(deaf).toHaveAttribute('aria-checked', 'true')
    await expect(audioPreview).toContainText('เปิดไมโครโฟน')
    await expect(save).toBeEnabled()
    await mute.click()
    await expect(save).toBeDisabled()
    await command.fill('lounge')
    await expect(preview).toContainText('/lounge join')
    await expect(preview).toContainText('/lounge leave')
    await mute.click()
    await deaf.click()
    await expect(audioPreview).toContainText('รับเสียงจากห้อง')
    await expect(deaf).toHaveAttribute('aria-checked', 'false')
    await command.fill('x'.repeat(32))
    await expect(command).toHaveAttribute('aria-invalid', 'false')
    await command.blur()
    await page.evaluate(() => document.fonts.ready)
    for (const width of [1366, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      expect(
        await preview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true)
      expect(
        await audioPreview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true)
      await command.fill('lounge')
      await command.blur()
      if (width !== 768)
        await form
          .locator(':scope > div')
          .first()
          .screenshot({
            path: testInfo.outputPath('voice-keeper-' + width + '.png'),
            animations: 'disabled',
            scale: 'css',
            style:
              '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
          })
      if (width !== 768)
        await commands.screenshot({
          path: testInfo.outputPath('commands-' + width + '.png'),
          animations: 'disabled',
          scale: 'css',
        })
      await command.fill('x'.repeat(32))
    }
    await command.fill('lounge')
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
    expect(saved?.values).toEqual({
      COMMAND_NAME: 'lounge',
      SELF_MUTE: false,
      SELF_DEAF: false,
      FUTURE_SETTING: 'preserved',
    })
    await expect(command).toHaveValue('lounge')
    await expect(mute).toHaveAttribute('aria-checked', 'false')
    await expect(deaf).toHaveAttribute('aria-checked', 'false')
    expect(errors).toEqual([])
  })
}
