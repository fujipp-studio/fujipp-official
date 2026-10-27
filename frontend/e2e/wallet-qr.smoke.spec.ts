import { expect, test } from '@playwright/test'
import { walletTopupConfiguration, walletTopupLicense } from '../src/__tests__/fixtures/walletTopup'

for (const theme of ['LIGHT', 'DARK']) {
  for (const mode of ['EMBED', 'COMPONENTS_V2']) {
    test(`previews Wallet QR image and slip link in ${mode} ${theme}`, async ({
      page,
      isMobile,
    }, testInfo) => {
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const config = structuredClone(walletTopupConfiguration)
      const qr = config.presentations.find((slot) => slot.key === 'promptpay_qr')!
      qr.availableVariables = ['qr_url', 'slip_channel_url', 'amount']
      qr.defaultDefinition = {
        mode,
        title: 'PromptPay QR',
        description: 'Amount: {{amount}} THB',
        image_url: '{{slip_channel_url}}',
        links: [{ label: 'Submit slip', url: '{{slip_channel_url}}' }],
      }
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [walletTopupLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [walletTopupLicense], nextCursor: null, hasMore: false } }),
      )
      await page.route('**/configuration', (route) => route.fulfill({ json: config }))
      await page.goto(
        `/my-bot/fixture-bot/settings/packages/fixture-license/${mode === 'EMBED' ? 'embed' : 'components-v2'}?locale=en&message=promptpay_qr`,
      )
      if (isMobile && mode === 'EMBED')
        await page.getByRole('button', { name: 'Preview', exact: true }).click()
      const preview = page.locator(
        mode === 'EMBED' ? '.embed-preview-pane' : '.wallet-builder-preview',
      )
      if (mode === 'COMPONENTS_V2')
        await preview.getByRole('button', { name: 'Current', exact: true }).click()
      const image = preview.locator('img[src="/images/preview/promptpay-qr.svg"]').first()
      await expect(image).toBeVisible()
      expect(
        await image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      ).toBeGreaterThan(0)
      await expect(preview.getByRole('link', { name: /Submit slip/ }).first()).toHaveAttribute(
        'href',
        'https://discord.com/channels/123456789012345678/234567890123456789',
      )
      await preview.screenshot({
        path: testInfo.outputPath(`wallet-qr-${mode}.png`),
        animations: 'disabled',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    })
  }
}
