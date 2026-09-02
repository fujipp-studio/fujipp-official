import { expect, test } from '@playwright/test'

for (const locale of ['en', 'th']) {
  test(`edits Components V2 in ${locale} without switching the active message mode`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const saves: Array<{ presentations: Record<string, unknown> }> = []
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') saves.push(route.request().postDataJSON())
      await route.continue()
    })
    await page.goto(
      `/my-bot/fixture-bot/settings/packages/fixture-license/components-v2?locale=${locale}`,
    )
    await page
      .getByRole('textbox', { name: /\{\{variables\}\}/ })
      .fill('Updated components {{username}}')
    await page
      .getByRole('button', { name: locale === 'th' ? 'บันทึกทั้งหมด' : 'Save all', exact: true })
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', {
        name: locale === 'th' ? 'ยืนยันการบันทึก' : 'Confirm save',
        exact: true,
      })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(saves).toHaveLength(1)
    expect(saves[0]?.presentations.panel).toMatchObject({
      mode: 'EMBED',
      components_v2: { components: [{ type: 10, content: 'Updated components {{username}}' }] },
    })
    expect(errors).toEqual([])
  })
}

test('guards private routes for guests and normal users', async ({ page }) => {
  await page.goto('/admin/users?role=GUEST')
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/admin/users?role=USER')
  await expect(page).toHaveURL(/\/$/)
})

test('navigates nested admin pages and closes account dialog after saving', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Users', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
  await page.getByRole('button', { name: 'Account settings', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
})

test('preserves the purchase attempt key when retrying a failed checkout', async ({ page }) => {
  const keys: string[] = []
  await page.route('**/api/v1/store/orders', async (route) => {
    keys.push(route.request().postDataJSON().idempotencyKey)
    await route.fulfill({
      status: keys.length === 1 ? 503 : 200,
      json:
        keys.length === 1 ? { detail: 'Please retry checkout' } : { orderNumber: 'TEST-ORDER-001' },
    })
  })
  await page.goto('/store/packages')
  await page.getByRole('button', { name: 'Buy', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Confirm payment', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Please retry checkout')
  await dialog.getByRole('button', { name: 'Confirm payment', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBeTruthy()
  expect(keys[0]).toBe(keys[1])
})

test('saves edited embed content without changing its active mode', async ({ page }) => {
  let licenseLoads = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/feature-licenses') licenseLoads += 1
  })
  const saves: Array<{
    presentations: Record<string, { mode: string; embed: { title: string } }>
  }> = []
  await page.route('**/configuration', async (route) => {
    if (route.request().method() === 'PUT') saves.push(route.request().postDataJSON())
    await route.continue()
  })
  await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license')
  await expect(page.getByRole('heading', { name: 'Wallet Topup', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Design Embed/ }).click()
  await expect(page).toHaveURL(/\/embed$/)
  await expect(page.getByText('Live preview', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: /^Title \d+\/256$/ }).fill('Updated {{username}}')
  await expect(page.getByRole('heading', { name: 'Updated FujippPlayer' })).toBeVisible()
  await page.getByRole('button', { name: 'Save all', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm save', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(saves).toHaveLength(2) // Navigation saves config first; confirming saves the presentation.
  expect(saves[1]?.presentations.panel).toMatchObject({
    mode: 'EMBED',
    embed: { title: 'Updated {{username}}' },
  })
  expect(licenseLoads).toBe(1) // The shell and both routed children share the same inventory.
})

test('tops up an active Runtime only after confirmation', async ({ page }) => {
  let renewalRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/renew')) renewalRequests += 1
  })

  await page.goto('/my-bot/fixture-bot/settings/runtime')
  await expect(page.getByRole('heading', { name: 'Runtime settings', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Top up Runtime now', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Confirm Runtime top-up' })).toBeVisible()
  await expect(dialog).toContainText('THB 99.00')
  await expect(dialog).toContainText('30 days')
  expect(renewalRequests).toBe(0)

  await dialog.getByRole('button', { name: 'Confirm top-up', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(renewalRequests).toBe(1)
  await expect(page.getByText(/Oct 3, 2026/)).toBeVisible()
})

test('shows a retry action when bot settings cannot load', async ({ page }) => {
  let failed = true
  await page.route('**/api/v2/bots*', async (route) => {
    if (failed) await route.fulfill({ status: 503, json: { detail: 'Bot service unavailable' } })
    else await route.continue()
  })
  await page.goto('/my-bot/fixture-bot/settings')
  await expect(
    page.getByRole('alert').filter({ hasText: 'Bot service unavailable' }).first(),
  ).toBeVisible()
  failed = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Test bot', exact: true })).toBeVisible()
})

for (const theme of ['light', 'dark']) {
  test(`keeps navigation and settings usable in ${theme} mode`, async ({ page, isMobile }) => {
    await page.goto('/admin')
    await page.getByRole('button', { name: 'Open profile', exact: true }).click()
    await page.getByRole('button', { name: `${theme} theme`, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const userMenu = page.getByRole('complementary', { name: 'User settings', exact: true })
    const avatar = userMenu.locator('.profile-dialog__user img')
    await expect(avatar).toBeVisible()
    await expect
      .poll(() =>
        avatar.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true)
    const avatarBounds = await avatar.boundingBox()
    expect(avatarBounds).not.toBeNull()
    expect(avatarBounds!.width).toBeGreaterThan(0)
    expect(avatarBounds!.width).toBeLessThanOrEqual(48)
    expect(avatarBounds!.height).toBeLessThanOrEqual(48)
    expect(await userMenu.evaluate((menu) => menu.scrollWidth <= menu.clientWidth)).toBe(true)
    await expect(userMenu.getByRole('button', { name: 'Sign out', exact: true })).toBeInViewport()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('complementary', { name: 'User settings', exact: true }),
    ).toBeHidden()
    if (isMobile) {
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
      await expect(
        page.getByRole('dialog', { name: 'Mobile navigation', exact: true }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Close navigation', exact: true }).last().click()
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license/embed')
    await expect(page.getByRole('heading', { name: 'Hello FujippPlayer', exact: true })).toHaveCSS(
      'color',
      theme === 'dark' ? 'rgb(219, 222, 225)' : 'rgb(6, 6, 7)',
    )
  })
}
