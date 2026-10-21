import { expect, test, type Locator } from '@playwright/test'
import { shopStatusFixture } from '../src/__tests__/fixtures/shopStatus'
for (const theme of ['LIGHT', 'DARK']) {
  test(`edits shop commands, announcements and permissions in ${theme}`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { shopLicense, config } = shopStatusFixture()
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [shopLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [shopLicense], nextCursor: null, hasMore: false } }),
    )
    let saves = 0
    let saved:
      | { values: Record<string, unknown>; presentations: Record<string, Record<string, unknown>> }
      | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saves++
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
    const form = page.locator('[data-shop-status-config]')
    await expect(form).toBeVisible()
    const choose = async (field: Locator, option: string) => {
      await field.click()
      const menu = page.locator('#' + (await field.getAttribute('aria-controls')))
      await menu.getByRole('option', { name: option, exact: true }).click()
      await expect(menu).toHaveCount(0)
    }
    const category = async (name: string) => {
      const mobile = form.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true })
      if (await mobile.isVisible()) await choose(mobile, name)
      else await form.getByRole('tab', { name, exact: true }).click()
    }
    const capture = async (name: string) =>
      form.screenshot({
        path: testInfo.outputPath(`shop-${name}-${theme.toLowerCase()}.png`),
        animations: 'disabled',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
      })
    const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    const design = page.locator('#feature-presentations')
    await expect(save).toBeDisabled()
    // Opening an unchanged Embed is navigation only: no config revision or restart.
    await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
    await expect(page).toHaveURL(/embed/)
    await expect(save).toBeDisabled()
    expect(saves).toBe(0)
    await page.goBack()
    await form.getByRole('textbox', { name: 'ชื่อคำสั่ง', exact: true }).fill('store')
    await form.getByRole('textbox', { name: /^คำสั่งย่อยเปิดร้าน\*/ }).fill('start')
    await form.getByRole('textbox', { name: /^คำสั่งย่อยปิดร้าน\*/ }).fill('start')
    await expect(form.getByRole('alert')).toBeVisible()
    await form.getByRole('textbox', { name: /^คำสั่งย่อยปิดร้าน\*/ }).fill('stop')
    await expect(form.getByRole('alert')).toHaveCount(0)
    await expect(form).toContainText('/store start')
    await capture('commands')
    await category('ประกาศ')
    const openPing = form.getByRole('switch', { name: 'อนุญาต Ping ตอนเปิดร้าน', exact: true })
    const closePing = form.getByRole('switch', { name: 'อนุญาต Ping ตอนปิดร้าน', exact: true })
    await expect(openPing).not.toBeChecked()
    await expect(closePing).not.toBeChecked()
    await openPing.focus()
    await page.keyboard.press('Space')
    await expect(openPing).toBeChecked()
    await expect(closePing).not.toBeChecked()
    await closePing.click()
    await expect(closePing).toBeChecked()
    expect(saves).toBe(0)
    const openName = form.getByRole('textbox', {
      name: 'ชื่อห้องตอนเปิดร้าน (ไม่บังคับ)',
      exact: true,
    })
    const closeName = form.getByRole('textbox', {
      name: 'ชื่อห้องตอนปิดร้าน (ไม่บังคับ)',
      exact: true,
    })
    await expect(openName).toHaveValue('')
    await expect(closeName).toHaveValue('')
    await openName.fill(' ')
    await expect(form.getByRole('alert')).toBeVisible()
    await save.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(saves).toBe(0)
    await openName.fill('🟢・สถานะ・ร้านเปิด')
    await expect(form.getByRole('alert')).toHaveCount(0)
    await closeName.fill('🔴・สถานะ・ร้านปิด')
    expect(saves).toBe(0)
    await choose(
      form.getByRole('combobox', { name: 'การส่งประกาศเปิดร้าน', exact: true }),
      'อัปเดตข้อความเดิม',
    )
    await expect(form).toContainText('หากต้องการแจ้งเตือนใหม่ทุกครั้ง')
    await choose(
      form.getByRole('combobox', { name: 'การส่งประกาศปิดร้าน', exact: true }),
      'ลบข้อความเดิมแล้วส่งใหม่',
    )
    await choose(
      form.getByRole('combobox', { name: 'ข้อความเปิดร้าน', exact: true }),
      'ข้อความธรรมดา',
    )
    await form
      .getByRole('textbox', { name: 'ข้อความประกาศ', exact: true })
      .fill('@here เปิดร้านแล้ว {{guild_name}}')
    await capture('announcements')
    await expect(design).toContainText('ปิดร้าน')
    await choose(
      design.getByRole('combobox', { name: 'รูปแบบข้อความ', exact: true }),
      'Components V2',
    )
    await category('สิทธิ์ห้อง')
    await form.getByRole('button', { name: 'เพิ่มกฎสิทธิ์', exact: true }).click()
    await form.getByRole('textbox', { name: /^ID ห้อง\*/ }).fill('111111111111111111')
    await form.getByRole('textbox', { name: /^ID Role\*/ }).fill('222222222222222222')
    const closed = form.getByRole('group', { name: 'ปิดร้าน', exact: true })
    await choose(closed.getByRole('combobox', { name: 'เห็นห้อง', exact: true }), 'ปฏิเสธ')
    const opened = form.getByRole('group', { name: 'เปิดร้าน', exact: true })
    await choose(opened.getByRole('combobox', { name: 'เห็นห้อง', exact: true }), 'อนุญาต')
    await choose(closed.getByRole('combobox', { name: 'เข้าห้องเสียง', exact: true }), 'ปฏิเสธ')
    await expect(form.getByRole('alert')).toHaveCount(0)
    await capture('permissions')
    // Unsaved command/permission/message drafts survive the editor round trip.
    await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
    await expect(page).toHaveURL(/components/)
    expect(saves).toBe(0)
    await page
      .getByRole('textbox', { name: 'ข้อความ', exact: true })
      .fill('## Updated {{status}} @everyone')
    await page.goBack()
    await category('คำสั่ง')
    await expect(form.getByRole('textbox', { name: 'ชื่อคำสั่ง', exact: true })).toHaveValue(
      'store',
    )
    await category('สิทธิ์ห้อง')
    await expect(form.getByRole('textbox', { name: /^ID ห้อง\*/ })).toHaveValue(
      '111111111111111111',
    )
    expect(saves).toBe(0)
    await save.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect.poll(() => saved?.values.SHOP_COMMAND_NAME).toBe('store')
    expect(saved!.values.SHOP_OPEN_CHANNEL_NAME).toBe('🟢・สถานะ・ร้านเปิด')
    expect(saved!.values.SHOP_CLOSE_CHANNEL_NAME).toBe('🔴・สถานะ・ร้านปิด')
    expect(saved!.values.SHOP_OPEN_ALLOW_EVERYONE_MENTIONS).toBe(true)
    expect(saved!.values.SHOP_CLOSE_ALLOW_EVERYONE_MENTIONS).toBe(true)
    expect(saved!.values.SHOP_OPEN_COMMAND).toBe('start')
    expect(saved!.values.SHOP_CLOSE_COMMAND).toBe('stop')
    expect(saves).toBe(1)
    expect(saved!.values.SHOP_OPEN_DELIVERY_MODE).toBe('UPDATE')
    expect(saved!.values.SHOP_CLOSE_DELIVERY_MODE).toBe('REPLACE')
    expect(saved!.values.SHOP_OPEN_MESSAGE_TYPE).toBe('TEXT')
    expect(saved!.values.SHOP_OPEN_TEXT).toBe('@here เปิดร้านแล้ว {{guild_name}}')
    expect(saved!.values.SHOP_PERMISSION_RULES).toEqual([
      {
        channelId: '111111111111111111',
        roleId: '222222222222222222',
        open: { ViewChannel: 'ALLOW' },
        close: { ViewChannel: 'DENY', Connect: 'DENY' },
      },
    ])
    expect(saved!.presentations.shop_close?.mode).toBe('COMPONENTS_V2')
    await form.screenshot({
      path: testInfo.outputPath(`shop-status-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
    })
    await design.screenshot({
      path: testInfo.outputPath(`shop-design-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
    })
    await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
    await expect(page).toHaveURL(/components/)
    await expect(page.getByRole('textbox', { name: 'ข้อความ', exact: true })).toHaveValue(
      '## Updated {{status}} @everyone',
    )
    expect(saves).toBe(1)
    await page.goBack()
    await category('สิทธิ์ห้อง')
    await form.getByRole('button', { name: 'ลบกฎที่ 1', exact: true }).click()
    await expect(form.getByRole('textbox', { name: /^ID ห้อง\*/ })).toHaveCount(0)
    expect(errors).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
