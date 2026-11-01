import { expect, test } from '@playwright/test'
import { user } from '../src/__tests__/fixtures/domain'

const target = {
  ...user,
  id: 'target-user',
  role: 'USER',
  displayName: 'Support customer',
  email: 'customer@example.invalid',
}
const capability = 'fixture-impersonation-capability'

for (const [theme, locale] of [
  ['LIGHT', 'en'],
  ['DARK', 'en'],
  ['DARK', 'th'],
] as const) {
  test(`impersonates a selected user and returns to admin in ${theme.toLowerCase()} theme (${locale})`, async ({
    page,
  }, testInfo) => {
    const startLabel = locale === 'th' ? 'เข้าใช้งานแทน' : 'Act as user'
    const stopLabel = locale === 'th' ? 'กลับเป็นแอดมิน' : 'Return to admin'
    const actingLabel =
      locale === 'th' ? 'กำลังเข้าใช้งานแทน Support customer' : 'Acting as Support customer'
    await page.addInitScript((mode) => localStorage.setItem('fujipp-theme-mode', mode), theme)
    let revoked = false
    const calls: { method: string; header?: string }[] = []
    await page.route('**/api/v2/admin/users?*', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              customerId: 'target-customer',
              userId: target.id,
              displayName: target.displayName,
              customerCode: 'TEST-002',
              email: target.email,
              role: 'USER',
              status: 'ACTIVE',
              balanceSatang: 25000,
              createdAt: '2026-11-01T00:00:00Z',
            },
          ],
          hasMore: false,
          nextCursor: null,
        },
      }),
    )
    await page.route('**/api/v1/admin/impersonations', async (route) => {
      const request = route.request()
      calls.push({ method: request.method(), header: request.headers()['x-impersonation-token'] })
      if (request.method() === 'DELETE') {
        revoked = true
        await route.fulfill({ status: 204 })
      } else {
        expect(request.postDataJSON()).toEqual({ userId: target.id })
        await route.fulfill({
          json: {
            token: capability,
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
            user: target,
          },
        })
      }
    })
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        json: route.request().headers()['x-impersonation-token']
          ? target
          : { ...user, role: 'ADMIN' },
      }),
    )
    await page.goto(`/admin/users?locale=${locale}`)
    await page.getByRole('button', { name: startLabel, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: startLabel })
    await expect(dialog).toContainText('Support customer')
    await expect(dialog).toContainText(locale === 'th' ? '15 นาที' : '15 minutes')
    await page.screenshot({
      path: testInfo.outputPath(`confirm-${theme.toLowerCase()}.png`),
      fullPage: false,
    })
    const targetRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v2/bots') &&
        request.headers()['x-impersonation-token'] === capability,
    )
    await dialog.getByRole('button', { name: startLabel, exact: true }).click()
    await targetRequest
    await expect(page).toHaveURL(/\/my-bot(?:\?|$)/)
    const banner = page.getByRole('complementary').filter({ hasText: actingLabel })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(
      locale === 'th' ? 'บันทึกการกระทำทุกครั้ง' : 'Actions are recorded',
    )
    await page.screenshot({
      path: testInfo.outputPath(`acting-${theme.toLowerCase()}.png`),
      fullPage: false,
    })
    await page.goto(`/admin/users?locale=${locale}`)
    await expect(banner).not.toBeVisible() // A full reload restores the real admin, never persists the capability.
    expect(calls[0]).toEqual({ method: 'POST', header: undefined })
    // Re-enter to verify explicit, server-confirmed revocation.
    await page.getByRole('button', { name: startLabel, exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: startLabel, exact: true }).click()
    await page.getByRole('button', { name: stopLabel }).click()
    await expect(page).toHaveURL(/\/admin\/users/)
    await expect(page.getByRole('button', { name: stopLabel })).not.toBeVisible()
    expect(revoked).toBe(true)
    expect(calls.at(-1)).toEqual({ method: 'DELETE', header: capability })
  })
}

test('does not expose impersonation controls to a regular user', async ({ page }) => {
  await page.goto('/admin/users?role=USER&locale=en')
  await expect(page).toHaveURL(/\/(?:\?|$)/)
  await expect(page.getByRole('button', { name: 'Act as user', exact: true })).not.toBeVisible()
})
