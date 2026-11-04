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

for (const theme of ['LIGHT', 'DARK']) {
  test(`Feature switches save, recover from failure and persist in ${theme}`, async ({
    page,
    isMobile,
  }, info) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    let status = 'ACTIVE'
    let fail = false
    const requests: boolean[] = []
    await page.route('**/api/v1/feature-licenses', async (route) => {
      const response = await route.fetch()
      const licenses = await response.json()
      licenses[0].installations[0].status = status
      await route.fulfill({ json: licenses })
    })
    await page.route('**/installations/*/enabled', (route) => {
      expect(route.request().method()).toBe('PUT')
      expect(route.request().headers()['content-type']).toContain('application/json')
      const { enabled } = route.request().postDataJSON()
      requests.push(enabled)
      if (fail)
        return route.fulfill({
          status: 409,
          json: { detail: 'License changed; refresh and try again' },
        })
      status = enabled ? 'INSTALLING' : 'DISABLED'
      return route.fulfill({ json: { status } })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages?locale=en&role=USER')
    const row = page.locator('.setting-item').first()
    const toggle = row.getByRole('switch')
    await expect(toggle).toBeChecked()
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await expect(row).toContainText('DISABLED')
    await page.reload()
    await expect(toggle).not.toBeChecked()
    fail = true
    await toggle.click()
    await expect(page.getByRole('alert')).toContainText('License changed')
    await expect(toggle).not.toBeChecked()
    fail = false
    await toggle.focus()
    await page.keyboard.press('Space')
    await expect(toggle).toBeChecked()
    await expect(row).toContainText('INSTALLING')
    expect(requests).toEqual([false, true, true])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await row.screenshot({
      path: info.outputPath(`feature-toggle-${theme}.png`),
      animations: 'disabled',
    })
    await page.locator('.items-card').screenshot({
      path: info.outputPath(`feature-toggle-settings-${theme}.png`),
      animations: 'disabled',
    })
  })
}
