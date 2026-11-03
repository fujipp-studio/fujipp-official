import { expect, test } from '@playwright/test'

for (const theme of ['LIGHT', 'DARK']) {
  test(`Feature health diagnoses and checks startup in ${theme}`, async ({
    page,
    isMobile,
  }, info) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const issues = [
      {
        installationId: 'price',
        licenseId: 'fixture-license',
        featureCode: 'price-reader',
        featureName: 'Price Reader',
        version: '3.0.0',
        status: 'ERROR',
        errorCategory: 'CONFIGURATION',
        errorCode: 'FEATURE_ACTIVATION_FAILED',
        errorMessage: 'READER_CHANNEL_ID is required',
        hint: 'แก้การตั้งค่า',
        lastErrorAt: '2026-11-02T00:00:00Z',
        recoveryAttempts: 0,
        nextRetryAt: null,
        canRetry: true,
      },
      {
        installationId: 'voice',
        licenseId: 'voice-license',
        featureCode: 'voice-keeper',
        featureName: 'Voice Keeper',
        version: '1.0.0',
        status: 'ERROR',
        errorCategory: 'TRANSIENT',
        errorCode: 'FEATURE_ACTIVATION_FAILED',
        errorMessage: 'Connection timed out',
        hint: 'รอลองใหม่',
        lastErrorAt: '2026-11-02T00:00:00Z',
        recoveryAttempts: 1,
        nextRetryAt: '2026-11-03T01:00:00Z',
        canRetry: true,
      },
      {
        installationId: 'wallet',
        licenseId: 'wallet-license',
        featureCode: 'wallet-topup',
        featureName: 'Wallet',
        version: '1.0.0',
        status: 'ERROR',
        errorCategory: 'INTERNAL',
        errorCode: 'PAYMENT_FAILED',
        errorMessage: 'Check transaction history',
        hint: 'ตรวจประวัติรายการ',
        lastErrorAt: '2026-11-02T00:00:00Z',
        recoveryAttempts: 0,
        nextRetryAt: null,
        canRetry: false,
      },
    ]
    let attempts = 0
    await page.route('**/feature-health', (route) => route.fulfill({ json: issues }))
    await page.route('**/installations/price/retry', (route) => {
      attempts++
      if (attempts === 1)
        return route.fulfill({
          status: 400,
          json: { detail: 'Bot is missing View Channel permission' },
        })
      issues[0]!.status = 'INSTALLING'
      issues[0]!.canRetry = false
      issues[0]!.errorMessage = ''
      issues[0]!.errorCode = ''
      issues[0]!.errorCategory = ''
      return route.fulfill({ status: 204 })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages?locale=en')
    const panel = page.locator('[data-feature-health]')
    await expect(panel).toContainText('Needs configuration')
    await expect(panel).toContainText('Waiting to retry')
    await expect(
      panel
        .locator('[data-feature-health-id="wallet"]')
        .getByRole('button', { name: 'Check and restart' }),
    ).toHaveCount(0)
    await panel
      .locator('[data-feature-health-id="price"]')
      .getByRole('button', { name: 'Check and restart' })
      .click()
    const modal = page.getByRole('dialog', { name: 'Restart this feature?' })
    await expect(modal).toBeVisible()
    expect(attempts).toBe(0)
    await modal.getByRole('button', { name: 'Check and restart', exact: true }).click()
    await expect(modal.getByRole('alert')).toContainText('View Channel')
    await modal.getByRole('button', { name: 'Check and restart', exact: true }).click()
    await expect(modal).toBeHidden()
    await expect(panel.locator('[data-feature-health-id="price"]')).toContainText('Starting')
    expect(attempts).toBe(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await panel.screenshot({
      path: info.outputPath(`feature-health-${theme}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
    })
    await page.goto('/admin/bots/fixture-bot/settings/packages?locale=en')
    await expect(page.locator('[data-feature-health]')).toContainText('Starting')
  })
}
