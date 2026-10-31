import { expect, test } from '@playwright/test'
const customer = {
  memberDiscordId: '111111111111111111',
  balanceSatang: '199500',
  totalTopupSatang: '199500',
  lastTopupAt: '2026-11-01T00:00:00Z',
}
const receipt = {
  id: 'synthetic-receipt',
  memberDiscordId: customer.memberDiscordId,
  provider: 'TRUEMONEY',
  status: 'CREDITED',
  grossSatang: '200000',
  feeSatang: '500',
  creditedSatang: '199500',
  reference: 'synthetic-reference',
  failureCode: null,
  legacy: false,
  createdAt: customer.lastTopupAt,
}
for (const theme of ['LIGHT', 'DARK']) {
  test(`per-bot Money overview and provider history in ${theme}`, async ({
    page,
    isMobile,
  }, info) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    await page.route('**/money/overview', (r) =>
      r.fulfill({
        json: {
          customerCount: 2,
          balanceSatang: '200500',
          trueMoneyTopupSatang: '199500',
          slipOkTopupSatang: '1000',
          reviewCount: 1,
          currency: 'THB',
        },
      }),
    )
    await page.route('**/money/customers*', (r) => {
      const url = new URL(r.request().url())
      return r.fulfill({
        json: {
          items: url.searchParams.has('member')
            ? []
            : [
                {
                  ...customer,
                  memberDiscordId: url.searchParams.has('cursor')
                    ? '222222222222222222'
                    : customer.memberDiscordId,
                },
              ],
          nextCursor:
            url.searchParams.has('cursor') || url.searchParams.has('member') ? null : 'next-page',
          hasMore: !url.searchParams.has('cursor'),
        },
      })
    })
    await page.route('**/money/topups*', (r) => {
      const params = new URL(r.request().url()).searchParams
      const review = params.get('review') === 'true'
      return r.fulfill({
        json: {
          items: [
            {
              ...receipt,
              provider: params.get('provider') || 'TRUEMONEY',
              status: review ? 'REVIEW_REQUIRED' : 'CREDITED',
              creditedSatang: review ? null : receipt.creditedSatang,
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
      })
    })
    await page.goto('/my-bot/fixture-bot/settings?locale=en')
    await page.getByRole('button', { name: 'Money', exact: true }).click()
    const view = page.locator('[data-bot-money]')
    await expect(view.getByText('฿2,005.00')).toBeVisible()
    await expect(view.locator('[data-money-customer]')).toHaveCount(1)
    await view.getByRole('button', { name: 'Load more', exact: true }).click()
    await expect(view.locator('[data-money-customer]')).toHaveCount(2)
    await view.getByRole('button', { name: 'Top-up history', exact: true }).click()
    await expect(view.locator('[data-money-topup]')).toContainText('฿5.00')
    await expect(view.locator('[data-money-topup]')).toContainText('฿1,995.00')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await view.screenshot({
      path: info.outputPath(`money-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
    })
    await view.getByLabel('Payment channel').selectOption('SLIPOK')
    await expect(view.locator('[data-money-topup]')).toContainText('SlipOK')
    await view.getByLabel('Payment channel').selectOption('')
    await view.getByRole('button', { name: 'Needs review', exact: true }).click()
    await expect(view.locator('[data-money-topup]')).toContainText('Needs review · do not retry')
    await view.getByRole('button', { name: 'Customers', exact: true }).click()
    await view.getByLabel('Customer Discord ID').fill('333333333333333333')
    await view.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(view.getByText('No matching records.')).toBeVisible()
  })
}

test('read failures are retryable', async ({ page }) => {
  let failed = true
  await page.route('**/money/overview', (r) =>
    r.fulfill({
      json: {
        customerCount: 0,
        balanceSatang: '0',
        trueMoneyTopupSatang: '0',
        slipOkTopupSatang: '0',
        reviewCount: 0,
        currency: 'THB',
      },
    }),
  )
  await page.route('**/money/customers*', (r) =>
    failed
      ? r.fulfill({ status: 403, json: { detail: 'Money access denied.' } })
      : r.fulfill({ json: { items: [], nextCursor: null, hasMore: false } }),
  )
  await page.goto('/my-bot/fixture-bot/settings/money?locale=en')
  const view = page.locator('[data-bot-money]')
  await expect(view.getByText('Money access denied.')).toBeVisible()
  failed = false
  await view.getByRole('button', { name: /try again|retry/i }).click()
  await expect(view.getByText('No matching records.')).toBeVisible()
})

test('admin Money page uses admin endpoints', async ({ page }) => {
  await page.route('**/money/overview', (r) =>
    r.fulfill({
      json: {
        customerCount: 0,
        balanceSatang: '0',
        trueMoneyTopupSatang: '0',
        slipOkTopupSatang: '0',
        reviewCount: 0,
        currency: 'THB',
      },
    }),
  )
  await page.route('**/money/customers*', (r) =>
    r.fulfill({ json: { items: [], nextCursor: null, hasMore: false } }),
  )
  const loaded = page.waitForRequest('**/api/v1/admin/bots/fixture-bot/money/customers*')
  await page.goto('/admin/bots/fixture-bot/settings/money?locale=en')
  await loaded
  await expect(page.locator('[data-bot-money]').getByText('No matching records.')).toBeVisible()
})
