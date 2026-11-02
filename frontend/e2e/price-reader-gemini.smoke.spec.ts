import { expect, test } from '@playwright/test'
import { priceReaderFixture } from '../src/__tests__/fixtures/priceReader'

for (const theme of ['LIGHT', 'DARK']) {
  test(`Price Reader Gemini settings and rehearsal in ${theme}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { priceLicense, config } = priceReaderFixture('3.0.0')
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [priceLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [priceLicense], hasMore: false, nextCursor: null } }),
    )
    let saved: { values: Record<string, unknown>; secrets: Record<string, string> } | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        for (const field of config.fields) {
          if (field.secret) field.configured = true
          else field.value = saved!.values[field.key] as typeof field.value
        }
      }
      await route.fulfill({ json: config })
    })
    const requests: Array<Record<string, unknown>> = []
    let quota = false
    await page.route('**/price-reader/test', (route) => {
      const body = route.request().postDataJSON()
      requests.push(body)
      return route.fulfill({
        json: quota
          ? { connected: false, errorCode: 'GEMINI_QUOTA_EXCEEDED', result: null }
          : {
              connected: true,
              errorCode: null,
              result: body.imageBase64
                ? {
                    itemName: 'Test item',
                    currency: 'THB',
                    standardPriceSatang: 25000,
                    originalPriceSatang: null,
                    nitroPriceSatang: 20900,
                    discountPercent: null,
                    ambiguous: false,
                  }
                : null,
            },
      })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    const settings = page.locator('[data-price-reader-config]')
    const category = async (name: string) => {
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await settings.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
        await page.getByRole('option', { name, exact: true }).click()
      } else await settings.getByRole('tab', { name, exact: true }).click()
    }
    await category('Gemini AI')
    const ai = settings.locator('[data-price-reader-gemini]')
    await expect(ai).toContainText('รูปจะถูกส่งไป Google Gemini')
    const key = ai.locator('input[type="password"]')
    await expect(key).toHaveValue('')
    const connection = ai.getByRole('button', { name: 'ทดสอบการเชื่อมต่อ', exact: true })
    await connection.click()
    await expect(ai.getByRole('status')).toContainText('เชื่อมต่อสำเร็จ')
    expect(requests[0]?.apiKey).toBeUndefined()
    expect(requests[0]?.model).toBe('gemini-3.5-flash-lite')
    const syntheticKey = 'synthetic-customer-gemini-key'
    await key.fill(syntheticKey)
    await expect(ai.getByRole('status')).toHaveCount(0)
    quota = true
    await connection.click()
    await expect(ai.getByRole('alert')).toContainText('โควตา Gemini เต็ม')
    expect(requests.at(-1)?.apiKey).toBe(syntheticKey)
    quota = false
    await connection.click()
    await expect(ai.getByRole('status')).toContainText('เชื่อมต่อสำเร็จ')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await settings.screenshot({
      path: testInfo.outputPath(`gemini-${theme}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
    })
    await category('ทดสอบ')
    const panel = settings.locator('[data-price-reader-test]')
    await expect(panel).toContainText('รูปทดสอบจะถูกส่งไป Google Gemini')
    await panel.locator('input[type="file"]').setInputFiles({
      name: 'shop.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64',
      ),
    })
    await panel.getByRole('button', { name: 'อ่านรูปทดสอบ', exact: true }).click()
    await expect(panel.locator('[data-price-test-match]')).toContainText('250.00')
    await expect(panel.locator('[data-price-test-match]')).toContainText('55.00 บาท')
    expect(requests.at(-1)?.mimeType).toBe('image/png')
    expect(requests.at(-1)?.imageBase64).toBeTruthy()
    await category('Gemini AI')
    const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    await save.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(save).toBeDisabled()
    expect(saved?.secrets.GEMINI_API_KEY).toBe(syntheticKey)
    expect(saved?.values.GEMINI_API_KEY).toBeUndefined()
    await expect(key).toHaveValue('')
    expect(errors).toEqual([])
  })
}
