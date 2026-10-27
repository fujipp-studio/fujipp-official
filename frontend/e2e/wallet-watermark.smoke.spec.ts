import { expect, test } from '@playwright/test'
import { walletTopupConfiguration, walletTopupLicense } from '../src/__tests__/fixtures/walletTopup'

for (const theme of ['LIGHT', 'DARK']) {
  test(`configures optional QR text and uploaded logos in ${theme}`, async ({
    page,
    isMobile,
  }, testInfo) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const config = structuredClone(walletTopupConfiguration)
    const field = {
      key: 'PROMPTPAY_QR_WATERMARK',
      label: 'QR watermark',
      description: '',
      type: 'JSON',
      required: false,
      secret: false,
      configured: false,
      value: { mode: 'NONE', text: '', logoDataUri: '' },
      defaultValue: { mode: 'NONE', text: '', logoDataUri: '' },
      validation: null,
      ui: { control: 'wallet-qr-watermark' },
    }
    config.fields.push(field)
    let saved: { values: Record<string, unknown> } | undefined
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [walletTopupLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [walletTopupLicense], nextCursor: null, hasMore: false } }),
    )
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        for (const item of config.fields) item.value = saved!.values[item.key] as typeof item.value
        config.revision++
      }
      await route.fulfill({ json: config })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=en')
    async function category(name: string) {
      if (isMobile) {
        await page.getByRole('combobox', { name: 'Configuration category', exact: true }).click()
        await page.getByRole('option', { name, exact: true }).click()
      } else await page.getByRole('tab', { name, exact: true }).click()
    }
    await category('QR appearance')
    const form = page.locator('[data-wallet-qr-watermark]')
    const save = page.getByRole('button', { name: 'Save all', exact: true })
    await expect(save).toBeDisabled()
    const mode = form.getByRole('combobox', { name: 'Watermark type', exact: true })
    async function choose(name: string) {
      await mode.click()
      await page.getByRole('option', { name, exact: true }).click()
    }
    await choose('Shop name / text')
    await expect(form.locator('figcaption')).toHaveText('Test bot')
    await form.getByRole('textbox', { name: 'Watermark text', exact: true }).fill('ร้านขนม Kanom')
    await expect(form.locator('figcaption')).toHaveText('ร้านขนม Kanom')
    await expect(save).toBeEnabled()
    expect((await form.locator('[data-watermark-preview] > img').boundingBox())!.width).toBeGreaterThan(160)
    await form.screenshot({
      path: testInfo.outputPath('qr-text-watermark.png'),
      animations: 'disabled',
      style:
        '.navbar, .navbar *, .admin-tools, .admin-tools *, .app-scroll-rail { visibility: hidden !important; }',
    })
    await choose('Uploaded logo')
    await expect(save).toBeDisabled()
    await form
      .getByLabel('Upload watermark logo', { exact: true })
      .setInputFiles({
        name: 'invalid.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg/>'),
      })
    await expect(form.getByRole('status')).toContainText('Choose a readable PNG')
    const logo = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 240
      canvas.height = 80
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#182b45'
      ctx.fillRect(0, 0, 240, 80)
      ctx.fillStyle = '#ffffff'
      ctx.font = '32px sans-serif'
      ctx.fillText('KANOM', 50, 52)
      return canvas.toDataURL('image/png').split(',')[1]!
    })
    await form
      .getByLabel('Upload watermark logo', { exact: true })
      .setInputFiles({
        name: 'kanom.png',
        mimeType: 'image/png',
        buffer: Buffer.from(logo, 'base64'),
      })
    await expect(form.getByRole('img', { name: 'Watermark logo', exact: true })).toBeVisible()
    await expect(save).toBeEnabled()
    await category('Payment methods')
    await category('QR appearance')
    await expect(form.getByRole('img', { name: 'Watermark logo', exact: true })).toBeVisible()
    await choose('No watermark')
    await expect(form.locator('figcaption')).toHaveCount(0)
    await expect(form.getByRole('img', { name: 'Watermark logo', exact: true })).toHaveCount(0)
    await choose('Shop name / text')
    await expect(form.getByRole('textbox', { name: 'Watermark text', exact: true })).toHaveValue(
      'ร้านขนม Kanom',
    )
    await choose('Uploaded logo')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await form.screenshot({
      path: testInfo.outputPath('qr-logo-watermark.png'),
      animations: 'disabled',
      style:
        '.navbar, .navbar *, .admin-tools, .admin-tools *, .app-scroll-rail { visibility: hidden !important; }',
    })
    await save.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm save', exact: true })
      .click()
    await expect(save).toBeDisabled()
    const watermark = saved?.values.PROMPTPAY_QR_WATERMARK as {
      mode: string
      text: string
      logoDataUri: string
    }
    expect(watermark.mode).toBe('LOGO')
    expect(watermark.text).toBe('ร้านขนม Kanom')
    const png = Buffer.from(watermark.logoDataUri.split(',')[1]!, 'base64')
    expect(png.readUInt32BE(16)).toBe(160)
    expect(png.readUInt32BE(20)).toBe(64)
    await page.reload()
    await category('QR appearance')
    await expect(form.getByRole('img', { name: 'Watermark logo', exact: true })).toBeVisible()
    await expect(save).toBeDisabled()
  })
}
