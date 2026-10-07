import { expect, test } from '@playwright/test'
import {
  runtimeAlertConfiguration,
  runtimeAlertLicense,
} from '../src/__tests__/fixtures/runtimeExpiryAlert'

for (const theme of ['LIGHT', 'DARK']) {
  test('configures Runtime Expiry Alert in ' + theme, async ({ page, isMobile }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [runtimeAlertLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [runtimeAlertLicense], nextCursor: null, hasMore: false } }),
    )
    const configuration = structuredClone(runtimeAlertConfiguration)
    const saves: Array<{
      values: Record<string, unknown>
      presentations: Record<string, Record<string, unknown>>
    }> = []
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        const input = route.request().postDataJSON()
        saves.push(input)
        for (const field of configuration.fields) field.value = input.values[field.key]
        for (const slot of configuration.presentations)
          slot.overrideDefinition = input.presentations[slot.key]
        configuration.revision++
      }
      await route.fulfill({ json: configuration })
    })
    const url = '/my-bot/fixture-bot/settings/packages/fixture-license?locale=th'
    await page.goto(url)
    const form = page.locator('#feature-config')
    const messages = page.locator('#feature-presentations')
    const preview = messages.locator('.preview-shell')
    const saveAll = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    await expect(saveAll).toBeDisabled()
    await expect(form.getByRole('textbox', { name: /Discord Channel ID/ })).toHaveValue(
      '123456789012345678',
    )
    await expect(form.getByRole('textbox', { name: /ผู้รับ DM/ })).toHaveCount(0)
    await expect(preview).toContainText('Test bot')
    await expect(preview).toContainText('3 วัน')
    await expect(preview).not.toContainText('ตัวอย่างข้อมูล')
    await expect(preview.getByRole('link', { name: /ตรวจสอบและต่ออายุ/ })).toHaveAttribute(
      'href',
      'https://fujipp.com/my-bot/fixture-bot/settings/runtime',
    )
    const changeDelivery = async (name: string) => {
      await form.getByRole('radio', { name, exact: true }).check()
    }
    await changeDelivery('ข้อความส่วนตัว (DM)')
    await expect(form.getByRole('textbox', { name: /Discord Channel ID/ })).toHaveCount(0)
    const dm = form.getByRole('textbox', { name: /ผู้รับ DM/ })
    await expect(dm).toHaveValue('987654321098765432')
    await dm.fill('invalid')
    await expect(form.getByText('กรอก Discord ID เป็นตัวเลข 15–30 หลัก')).toBeVisible()
    await dm.fill('987654321098765433')
    await changeDelivery('Channel และ DM')
    const milestones = ['7 วัน', '3 วัน', '1 วัน', '1 ชั่วโมง']
    for (const milestone of milestones)
      await form.getByRole('switch', { name: 'แจ้งเตือนก่อน ' + milestone, exact: true }).click()
    await expect(form.getByText('เลือกอย่างน้อยหนึ่งช่วงเวลาเพื่อรับการแจ้งเตือน')).toBeVisible()
    await changeDelivery('ปิดการแจ้งเตือน')
    await expect(form.getByRole('textbox')).toHaveCount(0)
    for (const milestone of milestones)
      await expect(
        form.getByRole('switch', { name: 'แจ้งเตือนก่อน ' + milestone, exact: true }),
      ).toBeDisabled()
    await changeDelivery('Channel และ DM')
    await expect(form.getByRole('textbox', { name: /Discord Channel ID/ })).toHaveValue(
      '123456789012345678',
    )
    await expect(dm).toHaveValue('987654321098765433')
    for (const milestone of ['7 วัน', '1 ชั่วโมง'])
      await form.getByRole('switch', { name: 'แจ้งเตือนก่อน ' + milestone, exact: true }).click()
    await expect(form.locator('details')).not.toHaveAttribute('open')
    await page.evaluate(() => document.fonts.ready)
    for (const width of [1366, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      expect(
        await preview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true)
      if (width !== 768) {
        await form.screenshot({
          path: testInfo.outputPath('runtime-alert-config-' + width + '.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
        })
        await messages.screenshot({
          path: testInfo.outputPath('runtime-alert-message-' + width + '.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
        })
      }
    }
    await page.setViewportSize(testInfo.project.use.viewport ?? { width: 1366, height: 900 })
    await saveAll.click()
    expect(saves).toHaveLength(0)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(saveAll).toBeDisabled()
    expect(saves[0]?.values).toMatchObject({
      RUNTIME_ALERT_DELIVERY: 'BOTH',
      RUNTIME_ALERT_CHANNEL_ID: '123456789012345678',
      RUNTIME_ALERT_DM_USER_ID: '987654321098765433',
      RUNTIME_ALERT_7D: true,
      RUNTIME_ALERT_3D: false,
      RUNTIME_ALERT_1D: false,
      RUNTIME_ALERT_1H: true,
    })
    expect(saves[0]?.presentations.expiry_alert).toEqual(
      runtimeAlertConfiguration.presentations[0]!.defaultDefinition,
    )
    await messages.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
    await expect(page).toHaveURL(/\/embed\?.*message=expiry_alert/)
    const editor = page.locator('#feature-presentation-editor')
    await expect(editor.locator('article')).toHaveCount(1)
    await editor
      .getByRole('textbox', { name: 'หัวข้อ', exact: true })
      .fill('Runtime ของ {{bot_name}}')
    if (isMobile) await editor.getByRole('button', { name: 'ตัวอย่าง', exact: true }).click()
    await expect(editor.locator('.embed-preview-pane')).toContainText('Runtime ของ Test bot')
    await saveAll.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(saveAll).toBeDisabled()
    expect(saves.at(-1)?.presentations.expiry_alert).toMatchObject({
      embeds: [{ title: 'Runtime ของ {{bot_name}}' }],
    })
    configuration.presentations[0]!.overrideDefinition = {
      mode: 'COMPONENTS_V2',
      components: [
        {
          type: 17,
          components: [
            { type: 10, content: '## Runtime ของ {{bot_name}}\nเหลือ {{remaining}}' },
            {
              type: 1,
              components: [{ type: 2, style: 5, label: 'ต่ออายุ Runtime', url: '{{renew_url}}' }],
            },
          ],
        },
      ],
    }
    await page.goto(url)
    await expect(preview).toContainText('Runtime ของ Test bot')
    await expect(preview.getByRole('link', { name: 'ต่ออายุ Runtime' })).toHaveAttribute(
      'href',
      'https://fujipp.com/my-bot/fixture-bot/settings/runtime',
    )
    await messages.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
    await expect(page).toHaveURL(/\/components-v2\?.*message=expiry_alert/)
    await expect(editor).toBeVisible()
    expect(errors).toEqual([])
  })
}
