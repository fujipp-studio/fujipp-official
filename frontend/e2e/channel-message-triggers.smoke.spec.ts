import { expect, test } from '@playwright/test'
import { channelMessageTriggersFixture } from '../src/__tests__/fixtures/channelMessageTriggers'

for (const theme of ['LIGHT', 'DARK']) {
  test(`edits Channel Message Triggers in ${theme}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { triggerLicense, config } = channelMessageTriggersFixture()
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [triggerLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [triggerLicense], nextCursor: null, hasMore: false } }),
    )
    let saved:
      { values: Record<string, unknown>; presentations: Record<string, unknown> } | undefined
    let saves = 0
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        saves++
        for (const field of config.fields)
          field.value = saved!.values[field.key] as typeof field.value
        for (const slot of config.presentations) {
          if (saved!.presentations[slot.key])
            slot.overrideDefinition = saved!.presentations[
              slot.key
            ] as typeof slot.overrideDefinition
        }
        config.revision++
      }
      await route.fulfill({ json: config })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    await page.addStyleTag({ content: '#__vue-devtools-container__ { display: none !important; }' })
    const form = page.locator('#feature-config')
    const categories = form.locator('[data-channel-message-triggers-config]')
    const category = async (name: string) => {
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await categories.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
        await page.getByRole('option', { name, exact: true }).click()
      } else await categories.getByRole('tab', { name, exact: true }).click()
      await expect(categories.getByRole('tabpanel')).toHaveCount(1)
    }
    const panel = categories.getByRole('tabpanel')
    const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    await expect(save).toBeDisabled()
    await category('ข้อความแอดมิน')
    await expect(panel.getByRole('textbox', { name: /ข้อความ Trigger/ })).toHaveValue('pay')
    await category('เมื่อสร้างห้อง')
    await expect(save).toBeDisabled()
    expect(await form.locator('select').count()).toBe(0)
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const tab = categories.getByRole('tab', { name: 'เมื่อสร้างห้อง', exact: true })
      await tab.focus()
      await tab.press('ArrowRight')
      await expect(
        categories.getByRole('tab', { name: 'ข้อความแอดมิน', exact: true }),
      ).toBeFocused()
      await categories.getByRole('tab', { name: 'ข้อความแอดมิน', exact: true }).press('Home')
    }
    const target = panel.getByRole('textbox', { name: /Discord Category ID/ }).first()
    await target.fill('bad-id')
    await expect(target).toHaveAttribute('aria-invalid', 'true')
    await target.fill('123456789012345678')
    await expect(save).toBeDisabled()
    const chooseTemplate = async (rule: number, number: number) => {
      await panel.getByRole('combobox', { name: new RegExp(`Template สำหรับกฎ ${rule}`) }).click()
      await page.getByRole('option', { name: `Template ข้อความ ${number}`, exact: true }).click()
    }
    await chooseTemplate(1, 10)
    await expect(save).toBeEnabled()
    await chooseTemplate(1, 1)
    await expect(save).toBeDisabled()
    await panel.getByRole('button', { name: 'เพิ่มกฎ', exact: true }).click()
    const secondTarget = panel.getByRole('textbox', { name: /Discord Category ID/ }).nth(1)
    await expect(secondTarget).toBeFocused()
    await secondTarget.fill('111111111111111111')
    await chooseTemplate(2, 10)
    await category('ข้อความแอดมิน')
    await panel.getByRole('button', { name: 'เพิ่มกฎ', exact: true }).click()
    const secondTrigger = panel.getByRole('textbox', { name: /ข้อความ Trigger/ }).nth(1)
    await expect(secondTrigger).toBeFocused()
    await secondTrigger.fill(' PAY ')
    await expect(panel.getByRole('status')).toContainText('บอทจะใช้กฎแรก')
    await secondTrigger.fill('balance')
    await expect(panel.getByRole('status')).toHaveCount(0)
    await panel
      .getByRole('textbox', { name: /ข้อความ Trigger/ })
      .first()
      .fill('   ')
    await expect(panel.getByRole('textbox', { name: /ข้อความ Trigger/ }).first()).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await panel
      .getByRole('textbox', { name: /ข้อความ Trigger/ })
      .first()
      .fill('pay')
    await chooseTemplate(2, 2)
    await category('เมื่อสร้างห้อง')
    await expect(secondTarget).toHaveValue('111111111111111111')
    await category('ข้อความแอดมิน')
    await expect(secondTrigger).toHaveValue('balance')

    const design = page.locator('#feature-presentations')
    const pickMessage = async (number: number) => {
      if ((page.viewportSize()?.width ?? 0) < 1024) {
        await design.getByRole('combobox', { name: 'ข้อความ', exact: true }).click()
        await page.getByRole('option', { name: `Template ข้อความ ${number}`, exact: true }).click()
      } else
        await design
          .getByRole('button', {
            name: new RegExp(`^Template ข้อความ ${number} (Embed|Components V2)$`),
          })
          .click()
    }
    await pickMessage(2)
    await expect(design.locator('.preview-container')).toContainText('Template 2')
    await pickMessage(10)
    await expect(
      design.getByRole('heading', { name: 'Template ข้อความ 10', exact: true }),
    ).toBeVisible()
    await expect(design.locator('.preview-shell')).toContainText('Template 10')
    for (const width of [1366, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const [name, key] of [
        ['เมื่อสร้างห้อง', 'channel'],
        ['ข้อความแอดมิน', 'admin'],
      ] as const) {
        await category(name)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        if (width !== 768)
          await categories.screenshot({
            path: testInfo.outputPath(key + '-' + width + '.png'),
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
      await pickMessage(10)
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
    await expect(save).toBeDisabled()
    expect(saved?.values).toMatchObject({
      CHANNEL_CREATE_RULES: [
        { categoryId: '123456789012345678', template: 'template_1', future: { retained: true } },
        { categoryId: '111111111111111111', template: 'template_10' },
      ],
      ADMIN_MESSAGE_TRIGGERS: [
        { trigger: 'pay', template: 'template_2', future: 'keep' },
        { trigger: 'balance', template: 'template_2' },
      ],
      FUTURE_SETTING: 'preserved',
    })
    expect(saves).toBe(1)
    await page.reload()
    await expect(save).toBeDisabled()
    await category('เมื่อสร้างห้อง')
    await expect(secondTarget).toHaveValue('111111111111111111')
    await panel.getByRole('button', { name: 'ลบกฎ 2', exact: true }).click()
    await expect(target).toBeFocused()
    await panel.getByRole('button', { name: 'ลบกฎ 1', exact: true }).click()
    await expect(panel.getByText('ยังไม่มีกฎเมื่อสร้างห้อง')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'เพิ่มกฎ', exact: true })).toBeFocused()
    // Opening an editor must carry the selected template, including when settings are saved first.
    await pickMessage(10)
    await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
    await expect(page).toHaveURL(/embed\?locale=th&message=template_10/)
    await expect(
      page.getByRole('heading', { name: 'Embed · Channel Message Triggers', exact: true }),
    ).toBeVisible()
    await expect(page.locator('input[value="Template 10"]')).toHaveCount(1)
    expect(errors).toEqual([])
  })
}
