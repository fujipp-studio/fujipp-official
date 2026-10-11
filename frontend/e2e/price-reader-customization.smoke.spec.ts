import { expect, test } from '@playwright/test'
import { priceReaderFixture } from '../src/__tests__/fixtures/priceReader'

for (const theme of ['LIGHT', 'DARK']) {
  test(`customizes and rehearses Price Reader in ${theme}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { priceLicense, config } = priceReaderFixture()
    const template = config.fields.find(
      (field) => field.key === 'PRICE_READER_RESULTS_ITEM_TEMPLATE',
    )!.value
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [priceLicense], nextCursor: null, hasMore: false } }),
    )
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [priceLicense] }),
    )
    // OCR transport is exercised separately; this deterministic test checks draft matching and rendering.
    await page.route('**/src/features/bots/models/price-reader-ocr.ts*', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: 'export async function recognizePriceReaderImage() { return "Shop item\\nTHB 251.00" }',
      }),
    )
    let saves = 0
    let saved:
      | { values: Record<string, unknown>; presentations: Record<string, Record<string, unknown>> }
      | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        saves++
        for (const field of config.fields)
          field.value = saved!.values[field.key] as typeof field.value
        for (const slot of config.presentations)
          slot.overrideDefinition = saved!.presentations[slot.key]!
        config.revision++
      }
      await route.fulfill({ json: config })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    await page.addStyleTag({ content: '#__vue-devtools-container__ { display: none !important; }' })
    const settings = page.locator('[data-price-reader-config]')
    const category = async (name: string) => {
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await settings.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
        await page.getByRole('option', { name, exact: true }).click()
      } else await settings.getByRole('tab', { name, exact: true }).click()
    }
    const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    await expect(save).toBeDisabled()
    await category('ข้อความผลลัพธ์')
    await settings.getByRole('button', { name: 'ออกแบบด้วยบล็อก', exact: true }).click()
    await settings.getByRole('switch', { name: 'แสดงบล็อกที่ 2', exact: true }).click()
    await settings.getByRole('button', { name: 'ย้ายบล็อกที่ 4 ขึ้น', exact: true }).click()
    await settings
      .getByRole('textbox', { name: 'ข้อความบล็อกที่ 3', exact: true })
      .fill('✨ ร้าน {{shop_price_text}}')
    await expect(settings.locator('.preview-shell:visible')).toContainText('✨ ร้าน 55.00 บาท')
    await expect(settings.locator('.preview-shell:visible')).toContainText('Discord Shop 1')
    await settings.screenshot({
      path: testInfo.outputPath('result-blocks.png'),
      animations: 'disabled',
      scale: 'css',
      style: '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
    })
    await category('ข้อความแต่ละสถานะ')
    await settings
      .getByRole('textbox', { name: 'ข้อความเมื่ออ่านไม่พบราคา', exact: true })
      .fill('ส่งรูปที่มีราคาอีกครั้งนะครับ')
    await settings
      .getByRole('textbox', { name: 'ข้อความเมื่อไม่มีคู่ราคา', exact: true })
      .fill('สอบถามร้าน: {{discord_price}} บาท')
    await category('ทดสอบ')
    const panel = settings.locator('[data-price-reader-test]')
    const scenario = panel.getByRole('combobox', { name: 'สถานะตัวอย่าง', exact: true })
    await scenario.click()
    await page.getByRole('option', { name: 'บางรูปอ่านไม่สำเร็จ', exact: true }).click()
    await expect(panel.locator('.preview-shell')).toContainText('ส่งรูปที่มีราคาอีกครั้งนะครับ')
    await expect(panel.locator('.preview-shell')).toContainText('✨ ร้าน 55.00 บาท')
    await scenario.click()
    await page.getByRole('option', { name: 'อ่านไม่พบราคาทุกรูป', exact: true }).click()
    await expect(panel.locator('.preview-shell')).toContainText('ส่งรูปที่มีราคาอีกครั้งนะครับ')
    await panel
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'shop.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=',
          'base64',
        ),
      })
    await panel.getByRole('button', { name: 'อ่านรูปทดสอบ', exact: true }).click()
    await expect(panel.locator('[data-price-test-match]')).toContainText('251.00 บาท')
    await expect(panel.locator('[data-price-test-match]')).toContainText('55.00 บาท')
    expect(saves).toBe(0)
    await category('ตารางราคา')
    await settings.getByRole('spinbutton', { name: /ความคลาดเคลื่อนที่ยอมรับ/ }).fill('0')
    await category('ทดสอบ')
    await expect(panel.locator('.preview-shell')).toContainText('สอบถามร้าน: 251.00 บาท')
    await category('ตารางราคา')
    await settings.getByRole('spinbutton', { name: /ความคลาดเคลื่อนที่ยอมรับ/ }).fill('100')
    await category('ทดสอบ')
    await expect(panel.locator('.preview-shell')).toContainText('✨ ร้าน 55.00 บาท')
    await panel.screenshot({ path: testInfo.outputPath('test-result.png'), animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await save.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(save).toBeDisabled()
    expect(saves).toBe(1)
    expect(saved!.values.PRICE_READER_MATCH_TOLERANCE_SATANG).toBe(100)
    expect(saved!.values.PRICE_READER_RESULTS_ITEM_TEMPLATE).toBe(template)
    expect(
      (saved!.values.PRICE_READER_RESULT_BLOCKS as Array<{ id: string }>).map((block) => block.id),
    ).toEqual(['index', 'name', 'shop', 'discord'])
    await page.reload()
    await expect(save).toBeDisabled()
    await category('ข้อความผลลัพธ์')
    await expect(
      settings.getByRole('textbox', { name: 'ข้อความบล็อกที่ 3', exact: true }),
    ).toHaveValue('✨ ร้าน {{shop_price_text}}')
    expect(errors).toEqual([])
  })
}
