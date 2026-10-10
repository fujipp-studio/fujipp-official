import { expect, test } from '@playwright/test'
import { adminWork } from './fixtures/adminWorks'

for (const theme of ['LIGHT', 'DARK']) {
  test(`Admin tools routes every shortcut in ${theme}`, async ({ page, isMobile }, testInfo) => {
    const th = theme === 'LIGHT'
    const locale = th ? 'th' : 'en'
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(value => localStorage.setItem('fujipp-theme-mode', value), theme)
    await page.goto(`/?locale=${locale}`)
    const trigger = page.getByRole('button', { name: th ? 'เปิด Admin tools' : 'Open Admin tools', exact: true })
    const dialog = page.getByRole('dialog', { name: 'Admin tools', exact: true })
    await trigger.click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('navigation')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase())
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: testInfo.outputPath('tools.png') })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    for (const [group, links] of [
      [th ? 'เว็บไซต์' : 'Navigate', [
        [th ? 'ผลงาน' : 'Portfolio', '/work'],
        [th ? 'ร้านค้า' : 'Store', '/store'],
        [th ? 'บอทของฉัน' : 'My bots', '/my-bot'],
        [th ? 'หน้าแรก' : 'Home', '/'],
      ]],
      [th ? 'บอท' : 'Bots', [
        [th ? 'บอทของฉัน' : 'My bots', '/my-bot'],
        [th ? 'บอท' : 'Bots', '/admin/bots'],
        ['Runtime', '/admin/runtime'],
        [th ? 'แพ็กเกจ' : 'Packages', '/admin/packages'],
      ]],
      [th ? 'จัดการ' : 'Admin', [
        [th ? 'ภาพรวม' : 'Overview', '/admin'],
        [th ? 'ผู้ใช้' : 'Users', '/admin/users'],
        [th ? 'แพ็กเกจ' : 'Packages', '/admin/packages'],
        ['Runtime', '/admin/runtime'],
        [th ? 'บอท' : 'Bots', '/admin/bots'],
        [th ? 'Donate' : 'Donations', '/admin/donations'],
      ]],
      [th ? 'ผลงาน' : 'Portfolio', [[th ? 'เพิ่มผลงาน' : 'Add project', '/work/add']]],
    ] as const) {
      for (const [label, path] of links) {
        await trigger.click()
        await dialog.getByRole('navigation').getByRole('button', { name: group, exact: true }).click()
        await dialog.getByRole('link', { name: new RegExp(`^${label}(?:\\s|$)`) }).click()
        await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}${th ? '\\?locale=th' : ''}$`))
        await expect(dialog).toBeHidden()
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
      }
    }
    await trigger.click()
    await dialog.getByRole('navigation').getByRole('button', { name: th ? 'จัดการ' : 'Admin', exact: true }).click()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    const viewport = page.viewportSize()!
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    await page.screenshot({ path: testInfo.outputPath(`admin-${isMobile ? 'mobile' : 'desktop'}.png`) })
    expect(errors).toEqual([])
  })
}

test('Admin tools retries project loading, searches, and opens the selected editor', async ({ page }, testInfo) => {
  let reads = 0
  await page.route('**/api/v1/admin/works', async route => {
    reads++
    expect(route.request().headers().authorization).toMatch(/^Bearer /)
    if (reads === 1) await route.fulfill({ status: 503, json: { message: 'Projects temporarily unavailable' } })
    else await route.fulfill({ json: [adminWork] })
  })
  await page.goto('/?locale=en')
  await page.getByRole('button', { name: 'Open Admin tools', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Admin tools', exact: true })
  await dialog.getByRole('button', { name: 'Portfolio', exact: true }).click()
  await dialog.getByRole('button', { name: /^Edit project/ }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click()
  const project = dialog.getByRole('link', { name: /^Support Bot/ })
  await expect(project).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Search projects', exact: true }).fill('no-such-project')
  await expect(dialog.getByRole('status')).toHaveText('No projects match your search.')
  await dialog.getByRole('textbox', { name: 'Search projects', exact: true }).fill('support-bot')
  await expect(project).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('project-picker.png') })
  await project.click()
  await expect(page).toHaveURL(new RegExp(`/work/${adminWork.id}/edit$`))
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('textbox', { name: 'Slug*', exact: true })).toHaveValue('support-bot')
  expect(reads).toBe(2)
})

test('Admin tools are unavailable to guests and regular users', async ({ page }) => {
  for (const role of ['GUEST', 'USER']) {
    await page.goto(`/?role=${role}`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.locator('.admin-tools')).toHaveCount(0)
  }
})
