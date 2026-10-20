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

for (const theme of ['LIGHT', 'DARK']) {
  test(`admin removes a user feature with confirmation and retry in ${theme}`, async ({
    page,
  }, testInfo) => {
    const th = theme === 'LIGHT'
    const { adminUserFeatures, featureOwner } =
      await import('../src/__tests__/fixtures/adminUserFeatures')
    const { license, user } = await import('../src/__tests__/fixtures/domain')
    const features = adminUserFeatures()
    const inventory = () =>
      features.map((feature) => ({
        ...structuredClone(license),
        ...feature,
        installations:
          feature.status === 'REVOKED' || !feature.installationCount
            ? []
            : structuredClone(license.installations),
      }))
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    await page.route('**/api/v2/admin/users*', (route) =>
      route.fulfill({ json: { items: [featureOwner], nextCursor: null, hasMore: false } }),
    )
    await page.route('**/api/v1/feature-licenses', (route) => route.fulfill({ json: inventory() }))
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: inventory(), nextCursor: null, hasMore: false } }),
    )
    await page.route(`**/api/v1/admin/users/${user.id}/features`, (route) =>
      route.fulfill({ json: features }),
    )
    let deletes = 0
    await page.route(`**/api/v1/admin/users/${user.id}/features/*`, async (route) => {
      expect(route.request().method()).toBe('DELETE')
      expect(route.request().headers().authorization).toMatch(/^Bearer /)
      deletes++
      expect(new URL(route.request().url()).pathname.endsWith('/review-license')).toBe(true)
      if (deletes === 1)
        return route.fulfill({
          status: 503,
          json: { detail: 'Feature removal temporarily unavailable' },
        })
      features[0]!.status = 'REVOKED'
      features[0]!.installationCount = 0
      await route.fulfill({ status: 204 })
    })
    await page.goto(`/my-bot?locale=${th ? 'th' : 'en'}`)
    const purchases = page.locator('section[aria-labelledby="purchases-title"]')
    await expect(purchases.getByRole('row').filter({ hasText: 'Review Credit' })).toBeVisible()
    await page.goto(`/admin/users?locale=${th ? 'th' : 'en'}`)
    await page
      .getByRole('button', { name: th ? 'Feature ของผู้ใช้' : 'User features', exact: true })
      .click()
    const dialog = page.getByRole('dialog')
    const review = dialog.locator('[data-license-id="review-license"]')
    await expect(review).toBeVisible()
    await expect(
      dialog.getByRole('button', {
        name: th ? 'ลบ Bot Permissions ออกจากผู้ใช้' : 'Remove Bot Permissions from user',
        exact: true,
      }),
    ).toBeDisabled()
    await expect(
      dialog.getByRole('button', {
        name: th ? 'ลบ Bot Presence ออกจากผู้ใช้' : 'Remove Bot Presence from user',
        exact: true,
      }),
    ).toBeEnabled()
    const screenshotOptions = {
      animations: 'disabled' as const,
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast, #__vue-devtools-container__ { visibility: hidden !important; }',
    }
    await dialog.screenshot({
      ...screenshotOptions,
      path: testInfo.outputPath(`user-features-${theme.toLowerCase()}.png`),
    })
    await review.scrollIntoViewIfNeeded()
    await review.screenshot({ ...screenshotOptions, path: testInfo.outputPath(`user-feature-actions-${theme.toLowerCase()}.png`) })
    const remove = () =>
      review
        .getByRole('button', {
          name: th ? 'ลบ Review Credit ออกจากผู้ใช้' : 'Remove Review Credit from user',
          exact: true,
        })
        .click()
    await remove()
    await expect(dialog).toContainText('Feature owner')
    await expect(dialog).toContainText(th ? 'บอทที่ติดตั้ง: 1 ตัว' : 'Installed bots: 1')
    expect(deletes).toBe(0)
    await dialog.getByRole('button', { name: th ? 'ยกเลิก' : 'Cancel', exact: true }).click()
    expect(deletes).toBe(0)
    await remove()
    await dialog.screenshot({
      ...screenshotOptions,
      path: testInfo.outputPath(`remove-user-feature-${theme.toLowerCase()}.png`),
    })
    const confirm = dialog.getByRole('button', {
      name: th ? 'ยืนยันการลบ' : 'Confirm removal',
      exact: true,
    })
    await confirm.click()
    await expect(dialog.getByRole('alert')).toHaveText('Feature removal temporarily unavailable')
    expect(deletes).toBe(1)
    await confirm.click()
    await expect(review).toHaveCount(0)
    expect(deletes).toBe(2)
    await expect(dialog.locator('[data-license-id="unused-core-license"]')).toBeVisible()
    await expect(dialog.locator('[data-license-id="installed-core-license"]')).toBeVisible()
    await dialog.getByRole('button', { name: th ? 'ปิด' : 'Close', exact: true }).click()
    await page
      .getByRole('button', { name: th ? 'Feature ของผู้ใช้' : 'User features', exact: true })
      .click()
    await expect(review).toHaveCount(0)
    await expect(dialog.locator('[data-license-id="unused-core-license"]')).toBeVisible()
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    await page.goto(`/my-bot?locale=${th ? 'th' : 'en'}`)
    await expect(purchases.getByRole('row').filter({ hasText: 'Review Credit' })).toHaveCount(0)
    await expect(purchases.getByRole('row').filter({ hasText: 'Bot Presence' })).toBeVisible()
    expect(errors).toEqual([])
  })
}
