import { expect, test } from '@playwright/test'
import { configuration, license } from '../src/__tests__/fixtures/domain'
import type { FeatureConfiguration } from '../src/features/bots/api'

for (const theme of ['LIGHT', 'DARK']) {
  test('edits Bot Presence with live feedback in ' + theme, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const presenceLicense = {
      ...license,
      featureCode: 'bot-presence',
      featureName: 'Bot Presence',
      version: '1.0.0',
    }
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [presenceLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [presenceLicense], hasMore: false, nextCursor: null } }),
    )
    const config: FeatureConfiguration = {
      ...structuredClone(configuration),
      presentations: [],
      fields: [
        {
          key: 'PRESENCE_STATUS',
          type: 'ENUM',
          value: 'online',
          validation: { enum: ['online', 'idle', 'dnd', 'invisible'] },
        },
        {
          key: 'PRESENCE_ACTIVITY_TYPE',
          type: 'ENUM',
          value: 'WATCHING',
          validation: { enum: ['WATCHING', 'PLAYING', 'LISTENING', 'COMPETING'] },
        },
        {
          key: 'PRESENCE_TEXTS',
          type: 'STRING_LIST',
          value: ['Welcome to our store', 'New arrivals'],
        },
        {
          key: 'PRESENCE_ROTATE_SECONDS',
          type: 'INTEGER',
          value: 30,
          validation: { minimum: 20, maximum: 86400 },
        },
        { key: 'FUTURE_SETTING', type: 'STRING', value: 'preserved' },
      ].map((item) => ({
        label: item.key,
        description: '',
        defaultValue: item.value,
        required: item.type !== 'STRING_LIST',
        secret: false,
        configured: true,
        ui: null,
        validation: null,
        ...item,
      })),
    }
    let saved: { values: Record<string, unknown> } | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        for (const field of config.fields)
          if (saved) field.value = saved.values[field.key] as typeof field.value
        config.revision++
      }
      await route.fulfill({ json: config })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    const form = page.locator('#feature-config')
    const preview = form.locator('[data-presence-preview]')
    const saveAll = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    await expect(preview).toContainText('กำลังดู Welcome to our store')
    await expect(saveAll).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'ออกแบบข้อความ' })).toHaveCount(0)
    await expect(form.getByRole('textbox', { name: /FUTURE_SETTING/ })).toHaveValue('preserved')
    await form.getByRole('button', { name: 'ข้อความถัดไป', exact: true }).click()
    await expect(preview).toContainText('กำลังดู New arrivals')
    await expect(saveAll).toBeDisabled()
    await form.getByRole('button', { name: 'ลบข้อความ 2', exact: true }).click()
    await expect(form.getByRole('spinbutton', { name: 'สลับข้อความทุก' })).toHaveCount(0)
    await form.getByRole('button', { name: 'ลบข้อความ 1', exact: true }).click()
    await expect(form.getByText('ยังไม่มีข้อความ จะแสดงเฉพาะสถานะบอท')).toBeVisible()
    await expect(preview.locator('[data-activity-preview]')).toHaveCount(0)
    await form.getByRole('button', { name: 'เพิ่มข้อความ', exact: true }).click()
    const firstText = form.getByRole('textbox', { name: 'ข้อความ 1', exact: true })
    await expect(firstText).toBeFocused()
    await firstText.fill('FujiPP Official')
    await form.getByRole('button', { name: 'เพิ่มข้อความ', exact: true }).click()
    await form.getByRole('textbox', { name: 'ข้อความ 2', exact: true }).fill('Member rewards')
    await form.getByRole('spinbutton', { name: 'สลับข้อความทุก' }).fill('45')
    await form.getByRole('combobox', { name: /ประเภทกิจกรรม/ }).click()
    await page.getByRole('option', { name: 'กำลังเล่น', exact: true }).click()
    await expect(preview).toContainText('กำลังเล่น FujiPP Official')
    await form.getByRole('combobox', { name: /สถานะบอท/ }).click()
    await page.getByRole('option', { name: 'ซ่อนตัว', exact: true }).click()
    await expect(preview).toContainText('ออฟไลน์')
    await expect(preview.locator('[data-activity-preview]')).toHaveCount(0)
    await form.getByRole('combobox', { name: /สถานะบอท/ }).click()
    await page.getByRole('option', { name: 'ห้ามรบกวน', exact: true }).click()
    await expect(preview).toContainText('กำลังเล่น FujiPP Official')
    await page.evaluate(() => document.fonts.ready)
    for (const width of [1366, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      expect(
        await preview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true)
      if (width !== 768)
        await form
          .locator(':scope > div')
          .first()
          .screenshot({
            path: testInfo.outputPath('bot-presence-' + width + '.png'),
            animations: 'disabled',
            scale: 'css',
            style:
              '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
          })
    }
    await firstText.fill('x'.repeat(128))
    expect(
      await preview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true)
    await expect(firstText).toHaveAttribute('maxlength', '128')
    await firstText.fill('FujiPP Official')
    await expect(saveAll).toBeEnabled()
    await saveAll.click()
    expect(saved).toBeUndefined()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(saveAll).toBeDisabled()
    expect(saved?.values).toMatchObject({
      PRESENCE_STATUS: 'dnd',
      PRESENCE_ACTIVITY_TYPE: 'PLAYING',
      PRESENCE_TEXTS: ['FujiPP Official', 'Member rewards'],
      PRESENCE_ROTATE_SECONDS: 45,
      FUTURE_SETTING: 'preserved',
    })
    // Adding an empty row keeps it editable even though empty texts are not saved.
    await form.getByRole('button', { name: 'เพิ่มข้อความ', exact: true }).click()
    await expect(form.getByRole('textbox', { name: 'ข้อความ 3', exact: true })).toBeFocused()
    await expect(saveAll).toBeDisabled()
    for (let index = 3; index < 20; index++)
      await form.getByRole('button', { name: 'เพิ่มข้อความ', exact: true }).click()
    await expect(form.getByRole('button', { name: 'เพิ่มข้อความ', exact: true })).toBeDisabled()
    expect(errors).toEqual([])
  })
}
