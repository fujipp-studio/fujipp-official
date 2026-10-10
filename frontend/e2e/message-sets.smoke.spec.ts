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

for (const theme of ['LIGHT', 'DARK']) {
  test(`edits link button rows inside and outside Containers in ${theme}`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { setsLicense, config } = messageSetsFixture()
    const link = (label: string) => ({
      type: 2,
      style: 5,
      label,
      url: `https://example.com/${label.toLowerCase()}`,
    })
    config.presentations[0]!.overrideDefinition = {
      mode: 'COMPONENTS_V2',
      components_v2: {
        components: [
          {
            type: 17,
            components: [
              { type: 10, content: '## Link buttons\nChoose a destination' },
              { type: 1, components: [link('Web'), link('Shop')] },
              { type: 1, components: [link('Help')] },
            ],
          },
          { type: 1, components: [link('Contact')] },
        ],
      },
    }
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [setsLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [setsLicense], nextCursor: null, hasMore: false } }),
    )
    let saved: { presentations: Record<string, Record<string, unknown>> } | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        config.presentations[0]!.overrideDefinition = saved!.presentations.set_1!
        config.revision++
      }
      await route.fulfill({ json: config })
    })
    await page.goto(
      '/my-bot/fixture-bot/settings/packages/fixture-license/components-v2?locale=en&message=set_1',
    )
    await page.addStyleTag({ content: '#__vue-devtools-container__ { display: none !important; }' })
    const editor = page.locator('#feature-presentation-editor')
    const rows = editor.locator('.component-button-row-editor')
    await expect(rows).toHaveCount(3)
    const first = rows.nth(0)
    await first.getByRole('textbox', { name: 'Button label', exact: true }).nth(1).fill('Store')
    await first
      .getByRole('textbox', { name: 'Destination URL', exact: true })
      .nth(1)
      .fill('https://example.com/store')
    await first.getByRole('button', { name: 'Move button 2 left', exact: true }).click()
    await expect(
      first.getByRole('textbox', { name: 'Button label', exact: true }).nth(0),
    ).toHaveValue('Store')
    const add = first.getByRole('button', { name: '+ Add link button to this row', exact: true })
    for (let i = 0; i < 3; i++) await add.click()
    await expect(first.locator('.builder-subitem')).toHaveCount(5)
    await expect(add).toBeDisabled()
    for (let i = 0; i < 3; i++)
      await first
        .locator('.builder-subitem')
        .last()
        .getByRole('button', { name: 'Delete', exact: true })
        .click()
    await rows
      .nth(2)
      .getByRole('button', { name: '+ Add link button to this row', exact: true })
      .click()
    await rows.nth(2).getByRole('textbox', { name: 'Button label', exact: true }).nth(1).fill('FAQ')
    const preview = editor.locator('.preview-shell').first()
    const previewRows = preview.locator('.preview-actions')
    await expect(previewRows).toHaveCount(3)
    await expect(previewRows.nth(0).getByRole('link')).toHaveText(['Store', 'Web'])
    await expect(previewRows.nth(1).getByRole('link')).toHaveText(['Help'])
    await expect(previewRows.nth(2).getByRole('link')).toHaveText(['Contact', 'FAQ'])
    const positions = await previewRows
      .nth(0)
      .getByRole('link')
      .evaluateAll((links) => links.map((element) => element.getBoundingClientRect().top))
    expect(Math.abs(positions[0]! - positions[1]!)).toBeLessThan(1)
    await page.getByRole('button', { name: 'Save all', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm save', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(saved?.presentations.set_1).toMatchObject({
      components_v2: {
        components: [
          {
            type: 17,
            components: [
              { type: 10 },
              { type: 1, components: [link('Store'), link('Web')] },
              { type: 1, components: [link('Help')] },
            ],
          },
          { type: 1, components: [link('Contact'), { type: 2, style: 5, label: 'FAQ' }] },
        ],
      },
    })
    await page.reload()
    await page.addStyleTag({ content: '#__vue-devtools-container__ { display: none !important; }' })
    await expect(rows).toHaveCount(3)
    await expect(
      rows.nth(0).getByRole('textbox', { name: 'Button label', exact: true }).nth(0),
    ).toHaveValue('Store')
    await expect(
      rows.nth(0).getByRole('textbox', { name: 'Button label', exact: true }).nth(1),
    ).toHaveValue('Web')
    await expect(
      rows.nth(2).getByRole('textbox', { name: 'Button label', exact: true }).nth(1),
    ).toHaveValue('FAQ')
    await expect(page.getByRole('button', { name: 'Save all', exact: true })).toBeDisabled()
    for (const control of await first.locator('input, button').all()) {
      const fits = await control.evaluate((element) => {
        const row = element.closest('.component-button-row-editor')!.getBoundingClientRect()
        const rect = element.getBoundingClientRect()
        return rect.left >= row.left && rect.right <= row.right + 1
      })
      expect(fits).toBe(true)
    }
    await first.screenshot({
      path: testInfo.outputPath(`button-row-editor-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      scale: 'css',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
    })
    await preview.screenshot({
      path: testInfo.outputPath(`button-row-preview-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      scale: 'css',
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}
