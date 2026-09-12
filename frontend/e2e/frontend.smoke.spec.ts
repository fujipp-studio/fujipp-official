import { expect, test } from '@playwright/test'
import { fixtureResponse } from './fixtures/api'

test('keeps the last language selection while translation chunks are loading', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requested = false
  await page.route('**/i18n/locales/th/**', async route => {
    requested = true
    await gate
    await route.continue()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open profile', exact: true }).click()
  await page.getByRole('button', { name: 'Thai', exact: true }).click()
  await expect.poll(() => requested).toBe(true)
  await page.getByRole('button', { name: 'English', exact: true }).click()
  release()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: 'Open profile', exact: true }).click()
  await page.getByRole('button', { name: 'Thai', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await expect(page).toHaveURL(/locale=th/)
  await expect(page.locator('body')).not.toContainText('home.hero.title')
})

test('loads more Admin users on scroll and resets the cursor for a new search', async ({ page }) => {
  const requests: URL[] = []
  const fixture = fixtureResponse('/api/v2/admin/users', 'GET', {}) as { items: Array<Record<string, unknown>> }
  await page.route('**/api/v2/admin/users*', async route => {
    const url = new URL(route.request().url())
    requests.push(url)
    const start = Number(url.searchParams.get('cursor') ?? 0)
    const searching = Boolean(url.searchParams.get('query'))
    await route.fulfill({ json: {
      items: Array.from({ length: searching ? 1 : start === 0 ? 50 : 20 }, (_, i) => ({
        ...fixture.items[0], userId: `user-${start + i}`, customerId: `customer-${start + i}`,
        displayName: searching ? 'Search result' : `Person ${start + i}`,
      })),
      nextCursor: !searching && start === 0 ? '50' : null, hasMore: !searching && start === 0,
    } })
  })
  await page.goto('/admin/users')
  await expect(page.locator('tbody tr')).toHaveCount(50)
  expect(requests).toHaveLength(1)
  await page.getByText('Person 49', { exact: true }).scrollIntoViewIfNeeded()
  await expect(page.locator('tbody tr')).toHaveCount(70)
  expect(requests).toHaveLength(2)
  await page.getByRole('textbox').fill('needle')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.getByText('Search result', { exact: true })).toBeVisible()
  expect(requests).toHaveLength(3)
  expect(requests[2]?.searchParams.has('cursor')).toBe(false)
  expect(requests[2]?.searchParams.get('query')).toBe('needle')
})

test('navigates from Home without reloading and loads Work pages on demand', async ({ page, isMobile }) => {
  const documents: string[] = []
  const requests: URL[] = []
  page.on('request', request => {
    if (request.resourceType() === 'document') documents.push(request.url())
    const url = new URL(request.url())
    if (url.pathname === '/api/v2/works') requests.push(url)
  })
  await page.goto('/')
  await page.locator('.home-hero__actions a').click()
  await expect(page).toHaveURL(/\/work$/)
  await expect(page.locator('.work-card')).toHaveCount(isMobile ? 4 : 6)
  expect(documents).toHaveLength(1)
  expect(requests).toHaveLength(1)
  expect(requests[0]?.searchParams.get('limit')).toBe(isMobile ? '4' : '6')
  expect(requests.every(url => url.searchParams.get('locale') === 'en')).toBe(true)
  await page.getByRole('button', { name: 'Load more', exact: true }).click()
  await expect(page.locator('.work-card')).toHaveCount(8)
  expect(requests).toHaveLength(2)
  await page.getByRole('button', { name: 'Show less', exact: true }).click()
  await expect(page.locator('.work-card')).toHaveCount(isMobile ? 4 : 6)
  await page.locator('.work-filters').getByRole('button', { name: 'Web', exact: true }).click()
  await expect(page.locator('.work-card')).toHaveCount(4)
  await expect(page.locator('.work-pagination')).toContainText('of 4 projects')
})

test('loads wallet history through v2 only and fetches the next page on scroll', async ({ page }) => {
  const requests: string[] = []
  const entry = (index: number) => ({id: `entry-${index}`, direction:'CREDIT', entryType:'TOP_UP',
    amountSatang:100, balanceBeforeSatang:0, balanceAfterSatang:100,
    referenceType:null, referenceId:null, description:`Entry ${index}`, createdAt:'2026-01-01T00:00:00Z'})
  await page.route('**/wallet/history*', async route => {
    const url = new URL(route.request().url())
    requests.push(url.pathname)
    const start = Number(url.searchParams.get('cursor') ?? 0)
    await route.fulfill({json:{customerId:'fixture-customer',walletId:'fixture-wallet',currentBalanceSatang:7000,
      items:Array.from({length:start === 0 ? 50 : 20},(_,i)=>entry(start+i)),
      nextCursor:start === 0 ? '50' : null,hasMore:start === 0}})
  })
  await page.goto('/admin/users')
  await page.getByRole('button', {name:'History',exact:true}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Entry 0', {exact:true})).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0]).toContain('/api/v2/')
  await dialog.getByText('Entry 49', {exact:true}).scrollIntoViewIfNeeded()
  await expect(dialog.getByText('Entry 69', {exact:true})).toBeAttached()
  expect(requests).toHaveLength(2)
})

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

test('configures channel and administrator message triggers responsively', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.addInitScript((theme) => {
    window.localStorage.setItem('fujipp-theme-mode', theme)
  }, isMobile ? 'DARK' : 'LIGHT')
  await page.route('**/api/v1/feature-licenses', async (route) => {
    await route.fulfill({
      json: [{
        id: 'fixture-license', featureProductId: 'trigger-product',
        featureCode: 'channel-message-triggers', featureName: 'Channel Message Triggers',
        version: '1.0.0', latestVersionId: null, latestVersion: null,
        upgradeAvailable: false, status: 'ACTIVE', installationLimit: 1,
        acquiredAt: '2026-09-12T00:00:00Z', expiresAt: null,
        installations: [{
          id: 'trigger-installation', botId: 'fixture-bot', botName: 'Test bot',
          status: 'ACTIVE', installedAt: '2026-09-12T00:00:00Z',
        }],
      }],
    })
  })
  await page.route('**/configuration', async (route) => {
    await route.fulfill({
      json: {
        licenseId: 'fixture-license', revision: 1, validatedForBotId: 'fixture-bot',
        fields: [
          {
            key: 'CHANNEL_CREATE_RULES', label: 'ข้อความเมื่อสร้างห้องในหมวดหมู่',
            description: 'เลือก Category และ Template', type: 'JSON', required: true,
            secret: false, defaultValue: [],
            value: [{ categoryId: '123456789012345678', template: 'template_1' }],
            configured: true, validation: null,
            ui: { control: 'message-trigger-rules', kind: 'channel-create' },
          },
          {
            key: 'ADMIN_MESSAGE_TRIGGERS', label: 'ข้อความ Trigger สำหรับแอดมิน',
            description: 'ลบ Trigger แล้วส่ง Template', type: 'JSON', required: true,
            secret: false, defaultValue: [],
            value: [{ trigger: 'pay', template: 'template_2' }],
            configured: true, validation: null,
            ui: { control: 'message-trigger-rules', kind: 'admin-message' },
          },
        ],
        presentations: Array.from({ length: 3 }, (_, index) => ({
          slotId: `template-slot-${index + 1}`, key: `template_${index + 1}`,
          label: `Message Template ${index + 1}`, description: 'Reusable message template',
          type: 'EMBED', availableVariables: ['channel_name', 'admin_name', 'trigger'],
          defaultDefinition: {
            mode: index === 1 ? 'COMPONENTS_V2' : 'EMBED',
            embed: { title: `Template ${index + 1}`, description: 'Automatic message' },
            components_v2: { components: [{ type: 10, content: `Template ${index + 1}` }] },
          },
          overrideDefinition: null,
        })),
      },
    })
  })

  await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
  await expect(page.getByRole('heading', { name: 'Channel Message Triggers' })).toBeVisible()
  await expect(page.locator('.trigger-editor input').first()).toHaveValue('123456789012345678')
  await expect(page.locator('.trigger-editor input').nth(1)).toHaveValue('pay')
  await expect(page.locator('html')).toHaveAttribute('data-theme', isMobile ? 'dark' : 'light')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath(`message-triggers-${isMobile ? 'mobile-dark' : 'desktop-light'}.png`),
    fullPage: true,
  })
})

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
  await page.route('**/api/v2/bots/**', async (route) => {
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
