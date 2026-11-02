import { expect, test } from '@playwright/test'
import { priceReaderFixture } from '../src/__tests__/fixtures/priceReader'
for (const theme of ['LIGHT', 'DARK']) {
  test(`Price Reader independent Nitro and bundle tables in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { priceLicense, config } = priceReaderFixture('3.1.0')
    const legacy = structuredClone(
      config.fields.find((field) => field.key === 'PRICE_READER_PRICE_MAP')!.value,
    )
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [priceLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [priceLicense], hasMore: false, nextCursor: null } }),
    )
    let saved: { values: Record<string, unknown> } | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        for (const field of config.fields)
          if (!field.secret) field.value = saved!.values[field.key] as typeof field.value
      }
      await route.fulfill({ json: config })
    })
    let itemType = 'BUNDLE',
      standard: number | null = 25000,
      nitro: number | null = 20900
    await page.route('**/price-reader/test', (route) =>
      route.fulfill({
        json: {
          connected: true,
          errorCode: null,
          result: {
            itemType,
            itemName: 'Bundle',
            currency: 'THB',
            standardPriceSatang: standard,
            nitroPriceSatang: nitro,
            originalPriceSatang: 29500,
            discountPercent: 15,
            ambiguous: false,
          },
        },
      }),
    )
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    const settings = page.locator('[data-price-reader-config]')
    async function category(name: string) {
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await settings.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
        await page.getByRole('option', { name, exact: true }).click()
      } else await settings.getByRole('tab', { name, exact: true }).click()
    }
    async function select(label: string, name: string) {
      await settings.getByRole('combobox', { name: label, exact: true }).click()
      await page.getByRole('option', { name, exact: true }).click()
    }
    await category('ตารางราคา')
    const editor = settings.locator('[data-price-reader-pricing]')
    const shop = () =>
      editor
        .locator('[data-price-row]')
        .first()
        .getByRole('spinbutton', { name: /ราคาร้านขาย/ })
    await expect(shop()).toHaveValue('55')
    await shop().press('End')
    await shop().press('1')
    await expect(shop()).toBeFocused()
    await expect(shop()).toHaveValue('551')
    await shop().fill('55')
    await select('ตารางที่กำลังแก้ไข', 'บันเดิล · ไม่มี Nitro')
    await expect(shop()).toHaveValue('80')
    await shop().fill('90')
    await select('ตารางที่กำลังแก้ไข', 'ชิ้นเดียว · ไม่มี Nitro')
    await expect(shop()).toHaveValue('55')
    await select('ราคาที่บอทใช้', 'มี Nitro · ใช้ราคา Nitro ในรูป')
    await expect(shop()).toHaveValue('45')
    await select('ตารางที่กำลังแก้ไข', 'บันเดิล · มี Nitro')
    await expect(shop()).toHaveValue('70')
    await shop().fill('75')
    await select('ราคาที่บอทใช้', 'ทั้งสองแบบ · ไม่มี Nitro และมี Nitro')
    await expect(shop()).toHaveValue('75')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await settings.screenshot({
      path: testInfo.outputPath(`pricing-${theme}.png`),
      animations: 'disabled',
      style: '.navbar, .admin-tools, .app-scroll-rail { visibility: hidden !important; }',
    })
    await select('ราคาที่บอทใช้', 'มี Nitro · ใช้ราคา Nitro ในรูป')
    await category('ทดสอบ')
    const panel = settings.locator('[data-price-reader-test]')
    await panel.locator('input[type="file"]').setInputFiles({
      name: 'bundle.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64',
      ),
    })
    const read = panel.getByRole('button', { name: 'อ่านรูปทดสอบ', exact: true })
    await read.click()
    await expect(panel.locator('[data-price-test-match]')).toContainText('209.00')
    await expect(panel.locator('[data-price-test-match]')).toContainText('75.00 บาท')
    await expect(panel.locator('[data-price-test-match]')).toContainText('บันเดิล · มี Nitro')
    itemType = 'UNKNOWN'
    await read.click()
    await expect(panel.locator('[data-price-test-match]')).toHaveCount(0)
    await expect(panel).toContainText('ระบุไม่ได้ว่าเป็นบันเดิลหรือชิ้นเดียว')
    itemType = 'BUNDLE'
    nitro = null
    await read.click()
    await expect(panel).toContainText('ไม่พบราคา Nitro')
    nitro = 20900
    await category('ตารางราคา')
    await select('ราคาที่บอทใช้', 'ไม่มี Nitro · ใช้ราคาปกติ Discord')
    await category('ทดสอบ')
    await read.click()
    await expect(panel.locator('[data-price-test-match]')).toContainText('250.00')
    await expect(panel.locator('[data-price-test-match]')).toContainText('90.00 บาท')
    await category('ตารางราคา')
    await select('ราคาที่บอทใช้', 'ทั้งสองแบบ · ไม่มี Nitro และมี Nitro')
    await category('ทดสอบ')
    const match = panel.locator('[data-price-test-match]')
    await expect(match).toContainText('ไม่มี Nitro: 90.00 บาท / มี Nitro: 75.00 บาท')
    await expect(panel.locator('.preview-shell')).toContainText(
      'ไม่มี Nitro: 90.00 บาท / มี Nitro: 75.00 บาท',
    )
    await settings.screenshot({
      path: testInfo.outputPath(`both-result-${theme}.png`),
      animations: 'disabled',
    })
    nitro = null
    await read.click()
    await expect(match).toContainText('ไม่มี Nitro: 90.00 บาท / มี Nitro: ไม่พบราคาในรูป')
    nitro = 20900
    standard = null
    await read.click()
    await expect(match).toContainText('ไม่มี Nitro: ไม่พบราคาในรูป / มี Nitro: 75.00 บาท')
    standard = 25000
    await read.click()
    const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    await save.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(save).toBeDisabled()
    expect(saved?.values.PRICE_READER_PRICE_MAP).toEqual(legacy)
    expect(saved?.values.PRICE_READER_PRICING_MODE).toBe('BOTH')
    expect(saved?.values.PRICE_READER_PRICE_RULES).toEqual(
      expect.arrayContaining([
        {
          itemType: 'BUNDLE',
          pricingMode: 'STANDARD',
          discordPriceSatang: 25000,
          shopPriceSatang: 9000,
        },
        {
          itemType: 'BUNDLE',
          pricingMode: 'NITRO',
          discordPriceSatang: 20900,
          shopPriceSatang: 7500,
        },
      ]),
    )
    await page.reload()
    await category('ตารางราคา')
    await expect(
      editor.getByRole('combobox', { name: 'ราคาที่บอทใช้', exact: true }),
    ).toContainText('ทั้งสองแบบ')
    await expect(shop()).toHaveValue('55')
    await select('ตารางที่กำลังแก้ไข', 'บันเดิล · มี Nitro')
    await expect(shop()).toHaveValue('75')
    await select('ตารางที่กำลังแก้ไข', 'บันเดิล · ไม่มี Nitro')
    await editor.getByRole('button', { name: 'ลบราคาคู่ที่ 1', exact: true }).click()
    await editor.getByRole('button', { name: 'นำเข้าตารางเดิมสู่หมวดนี้', exact: true }).click()
    await expect(editor.locator('[data-price-row]')).toHaveCount(2)
    await expect(shop()).toHaveValue('55')
    await select('ตารางที่กำลังแก้ไข', 'บันเดิล · มี Nitro')
    await expect(shop()).toHaveValue('75')
    await editor.locator('[data-add-price]').click()
    const duplicate = editor.locator('[data-price-row]').nth(1)
    await duplicate.getByRole('spinbutton', { name: /ราคา Discord/ }).fill('209')
    await duplicate.getByRole('spinbutton', { name: /ราคาร้านขาย/ }).fill('80')
    await expect(editor.getByRole('alert')).toContainText('ห้ามราคา Discord ซ้ำ')
    await editor.getByRole('button', { name: 'ลบราคาคู่ที่ 2', exact: true }).click()
    await expect(editor.getByRole('alert')).toHaveCount(0)
  })
}
