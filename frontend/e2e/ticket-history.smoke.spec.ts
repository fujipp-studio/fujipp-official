import { expect, test } from '@playwright/test'
import { ticketFixture } from '../src/__tests__/fixtures/ticket'

const order = '111111111111111111',
  support = '222222222222222222'
const tickets = [
  {
    channelId: order,
    name: 'ticket-order',
    categoryKey: 'order',
    ownerId: '333333333333333333',
    status: 'OPEN',
    openedAt: 1793250000000,
  },
  {
    channelId: support,
    name: 'ticket-support',
    categoryKey: 'support',
    ownerId: '444444444444444444',
    status: 'CLOSED',
    archived: true,
    openedAt: 1793240000000,
  },
]
const message = (id: string, content: string, extra = {}) => ({
  id,
  authorId: '333333333333333333',
  authorName: 'Alice',
  bot: false,
  createdAt: '2026-10-29T08:00:00Z',
  editedAt: null,
  content,
  blocks: [],
  attachments: [],
  replyToId: null,
  ...extra,
})
for (const theme of ['LIGHT', 'DARK']) {
  test(`reads paginated open and closed conversations in ${theme}`, async ({
    page,
    isMobile,
  }, testInfo) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { ticketLicense } = ticketFixture()
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [ticketLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [ticketLicense], nextCursor: null, hasMore: false } }),
    )
    await page.route('**/tickets', (route) => route.fulfill({ json: tickets }))
    await page.route('**/tickets/*/messages*', (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.includes(support))
        return route.fulfill({
          json: {
            items: [
              message('888888888888888888', 'แก้ไขปัญหาเรียบร้อยแล้ว', { authorName: 'Support' }),
            ],
            hasMore: false,
            nextBefore: null,
          },
        })
      const earlier = url.searchParams.has('before')
      return route.fulfill({
        json: {
          items: earlier
            ? [
                message('555555555555555555', 'ข้อความเริ่มต้น'),
                message('666666666666666666', 'สั่งซื้อสินค้า VIP', {
                  authorName: 'Ticket Bot',
                  bot: true,
                  blocks: ['สินค้า: VIP', 'จำนวน: 1'],
                }),
              ]
            : [
                message('777777777777777777', '<script>window.ticketXss = true</script>', {
                  editedAt: '2026-10-29T08:10:00Z',
                  replyToId: '666666666666666666',
                  attachments: [
                    {
                      name: 'receipt.png',
                      url: 'https://cdn.discordapp.com/attachments/1/2/receipt.png?ex=123',
                    },
                    { name: 'unsafe', url: 'javascript:alert(1)' },
                  ],
                }),
              ],
          hasMore: !earlier,
          nextBefore: earlier ? null : '777777777777777777',
        },
      })
    })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/my-bot/fixture-bot/settings?locale=en')
    await page.getByRole('button', { name: 'Ticket history', exact: true }).click()
    const reader = page.locator('[data-ticket-history]')
    await expect(reader).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`ticket=${order}`))
    await expect(
      reader.getByText('<script>window.ticketXss = true</script>', { exact: true }),
    ).toBeVisible()
    expect(await page.evaluate(() => Reflect.get(window, 'ticketXss'))).toBeUndefined()
    await expect(reader.getByRole('link', { name: 'receipt.png' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
    await expect(reader.getByRole('link', { name: 'unsafe' })).toHaveCount(0)
    await reader.getByRole('button', { name: 'Load earlier messages', exact: true }).click()
    await expect(reader.locator('[data-ticket-message]')).toHaveCount(3)
    await expect(reader.locator('[data-ticket-message]').first()).toContainText('ข้อความเริ่มต้น')
    await expect(reader.getByText('สินค้า: VIP', { exact: true })).toBeVisible()
    await expect(
      reader.getByRole('button', { name: 'Load earlier messages', exact: true }),
    ).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await reader.screenshot({
      path: testInfo.outputPath(`ticket-history-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
    })
    await reader.getByRole('button', { name: /#ticket-support/ }).click()
    await expect(page).toHaveURL(new RegExp(`ticket=${support}`))
    await expect(reader.getByText('แก้ไขปัญหาเรียบร้อยแล้ว')).toBeVisible()
    await expect(
      reader.getByText('<script>window.ticketXss = true</script>', { exact: true }),
    ).toHaveCount(0)
    await reader.getByRole('textbox', { name: 'Find tickets' }).fill('missing')
    await expect(reader.getByText('No matching tickets.')).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('shows recoverable read errors and an empty ticket list', async ({ page }) => {
  await page.route('**/tickets', (route) => route.fulfill({ json: tickets }))
  let failed = true
  await page.route('**/tickets/*/messages*', (route) =>
    failed
      ? route.fulfill({ status: 403, json: { detail: 'Bot cannot read this history.' } })
      : route.fulfill({ json: { items: [], hasMore: false, nextBefore: null } }),
  )
  await page.goto(`/my-bot/fixture-bot/settings/tickets?locale=en&ticket=${order}`)
  const reader = page.locator('[data-ticket-history]')
  await expect(reader.getByText('Bot cannot read this history.')).toBeVisible()
  failed = false
  await reader.getByRole('button', { name: /try again|retry/i }).click()
  await expect(
    reader.getByText('No messages, or the bot lacks Read Message History.'),
  ).toBeVisible()
  await page.route('**/tickets', (route) => route.fulfill({ json: [] }))
  await reader.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(reader.getByText('No ticket channels found for this bot.')).toBeVisible()
})
