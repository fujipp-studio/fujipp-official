import { expect, test } from '@playwright/test'
import { messageSetsFixture } from '../src/__tests__/fixtures/messageSets'
for (const theme of ['LIGHT', 'DARK']) {
  test(`edits Message Sets in ${theme}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { setsLicense, config } = messageSetsFixture()
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [setsLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [setsLicense], nextCursor: null, hasMore: false } }),
    )
    let saved:
      | { values: Record<string, unknown>; presentations: Record<string, Record<string, unknown>> }
      | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        for (const field of config.fields)
          field.value = saved!.values[field.key] as typeof field.value
        for (const slot of config.presentations)
          slot.overrideDefinition = saved!.presentations[slot.key]!
        config.revision++
      }
      await route.fulfill({ json: config })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    await page.addStyleTag({ content: '#__vue-devtools-container__ { display: none !important; }' })
    const form = page.locator('[data-message-sets-config]')
    await expect(form.getByRole('status')).toHaveText('1 / 20 SET')
    await form.getByRole('textbox', { name: /ชื่อคำสั่ง/ }).fill('design')
    await form.getByRole('button', { name: 'เพิ่ม SET', exact: true }).click()
    await expect(form.getByRole('textbox', { name: /ชื่อ SET 2/ })).toBeFocused()
    await form.getByRole('textbox', { name: /ชื่อ SET 2/ }).fill('welcome')
    await expect(form.getByRole('alert')).toBeVisible()
    await form.getByRole('textbox', { name: /ชื่อ SET 2/ }).fill('Rules')
    await form.getByRole('combobox', { name: 'รูปแบบ SET 2', exact: true }).click()
    await page.getByRole('option', { name: 'Components V2', exact: true }).click()
    const design = page.locator('#feature-presentations')
    await expect(design).toContainText('Rules')
    await page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect.poll(() => saved?.values.MESSAGE_SETS_COMMAND_NAME).toBe('design')
    expect(saved?.values.MESSAGE_SETS).toEqual([
      { name: 'Welcome', presentationSlot: 'set_1' },
      { name: 'Rules', presentationSlot: 'set_2' },
    ])
    expect(saved?.presentations.set_2?.mode).toBe('COMPONENTS_V2')
    await form.screenshot({
      path: testInfo.outputPath(`message-sets-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
    })
    await design.screenshot({
      path: testInfo.outputPath(`message-design-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
    })
    await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
    await expect(page).toHaveURL(/components/)
    await expect(page.getByRole('textbox', { name: 'ข้อความ', exact: true })).toHaveValue(
      '## SET 2\nDesigned message',
    )
    await page
      .getByRole('textbox', { name: 'ข้อความ', exact: true })
      .fill('## Rules\nUpdated on the website')
    await page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })).toBeDisabled()
    await page.goBack()
    await expect(form).toBeVisible()
    await form.getByRole('button', { name: 'ลบ SET 1', exact: true }).click()
    await expect(form.getByRole('textbox', { name: /ชื่อ SET 1/ })).toHaveValue('Rules')
    await form.getByRole('button', { name: 'เพิ่ม SET', exact: true }).click()
    await expect(form.locator('[data-set-slot="set_1"]')).toBeVisible()
    await expect(design).toContainText('SET 1')
    for (let i = 2; i < 20; i++)
      await form.getByRole('button', { name: 'เพิ่ม SET', exact: true }).click()
    await expect(form.getByRole('status')).toHaveText('20 / 20 SET')
    await expect(form.getByRole('button', { name: 'เพิ่ม SET', exact: true })).toBeDisabled()
    expect(errors).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
