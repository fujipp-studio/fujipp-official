import { expect, test } from '@playwright/test'
import { priceReaderCountedFixture, providedRules } from '../src/__tests__/fixtures/priceReaderCounted'
import { readFileSync } from 'node:fs'

for (const theme of ['LIGHT', 'DARK'])
  for (const locale of ['th', 'en']) {
    test(`Counted pricing import, independent prices and confirmation in ${locale} ${theme}`, async ({
      page,
      isMobile,
    }, info) => {
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const { priceLicense, config } = priceReaderCountedFixture(locale === 'en' ? 'EN' : 'TH')
      config.fields.find(row => row.key === 'PRICE_READER_COUNT_PRICE_RULES')!.value = providedRules.slice(0, -1)
      const text = (en: string, th: string) => (locale === 'en' ? en : th)
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [priceLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [priceLicense], hasMore: false, nextCursor: null } }),
      )
      let saves = 0,
        saved: { values: Record<string, unknown>; secrets: Record<string, unknown> } | undefined
      await page.route('**/configuration', (route) => {
        if (route.request().method() === 'PUT') {
          saves++
          saved = route.request().postDataJSON()
        }
        return route.fulfill({ json: config })
      })
      let calls = 0,
        itemCount: number | null = 2
      await page.route('**/price-reader/test', (route) => {
        calls++
        return route.fulfill({
          json: {
            connected: true,
            errorCode: null,
            result: {
              itemName: 'Bundle / บันเดิล',
              itemType: 'BUNDLE',
              itemCount,
              currency: 'THB',
              standardPriceSatang: 47500,
              nitroPriceSatang: 47500,
              originalPriceSatang: null,
              discountPercent: null,
              ambiguous: false,
            },
          },
        })
      })
      await page.goto(`/my-bot/fixture-bot/settings/packages/fixture-license?locale=${locale}`)
      const settings = page.locator('[data-price-reader-config]')
      async function category(name: string) {
        if (isMobile) {
          await settings
            .getByRole('combobox', {
              name: text('Settings category', 'หมวดการตั้งค่า'),
              exact: true,
            })
            .click()
          await page.getByRole('option', { name, exact: true }).click()
        } else await settings.getByRole('tab', { name, exact: true }).click()
      }
      async function select(label: string, option: string) {
        await settings.getByRole('combobox', { name: label, exact: true }).click()
        await page.getByRole('option', { name: option, exact: true }).click()
      }
      await category(text('Pricing', 'ตารางราคา'))
      const pricing = settings.locator('[data-price-reader-counted-pricing]')
      await select(
        text('Table being edited', 'ตารางที่กำลังแก้ไข'),
        text('Bundle · 2 items · with Nitro', 'บันเดิล 2 ชิ้น · มี Nitro'),
      )
      const priceInput = () =>
        pricing
          .locator('[data-price-row]')
          .filter({ has: page.getByRole('spinbutton', { name: /Discord/ }) })
      await expect(priceInput()).toHaveCount(8)
      await select(
        text('Table being edited', 'ตารางที่กำลังแก้ไข'),
        text('Bundle · 3 items · with Nitro', 'บันเดิล 3 ชิ้น · มี Nitro'),
      )
      await expect(
        pricing
          .locator('[data-price-row]')
          .first()
          .getByRole('spinbutton', { name: text('Shop price (THB)', 'ราคาร้านขาย (บาท)') }),
      ).toHaveValue('140')
      await pricing
        .locator('input[type="file"]')
        .setInputFiles({
          name: 'invalid.json',
          mimeType: 'application/json',
          buffer: Buffer.from('[{}]'),
        })
      await expect(pricing.getByRole('alert')).toContainText(
        text('Invalid price file', 'ไฟล์ราคาไม่ถูกต้อง'),
      )
      await pricing
        .locator('input[type="file"]')
        .setInputFiles({
          name: 'prices.json',
          mimeType: 'application/json',
          buffer: readFileSync(
            new URL('../../docs/examples/price-reader-count-prices.json', import.meta.url),
          ),
        })
      await expect(pricing.getByRole('status')).toContainText(
        text('50 price pairs · 10 tables', '50 คู่ราคา · 10 ตาราง'),
      )
      await pricing
        .getByRole('button', { name: text('Review and import', 'ตรวจทานและนำเข้า'), exact: true })
        .click()
      const modal = page.getByRole('dialog', {
        name: text('Review draft changes', 'ตรวจทานการแก้ไข'),
      })
      await expect(modal).toContainText(
        text('Replace all ten price tables', 'แทนที่ตารางราคาทั้ง 10 กลุ่ม'),
      )
      expect(saves).toBe(0)
      await modal.getByRole('button', { name: text('Apply to draft', 'ใช้กับฉบับแก้ไข') }).click()
      await category(text('Status messages', 'ข้อความแต่ละสถานะ'))
      await settings
        .getByRole('button', { name: text('Reset standard messages', 'รีเซ็ตข้อความมาตรฐาน') })
        .click()
      await page.getByRole('dialog', { name: text('Reset standard messages?', 'รีเซ็ตข้อความมาตรฐาน?'), exact: true }).getByRole('button', { name: text('Apply to draft', 'ใช้กับฉบับแก้ไข') }).click()
      expect(saves).toBe(0)
      await category(text('Pricing', 'ตารางราคา'))
      await pricing.screenshot({
        path: info.outputPath(`counted-pricing-${locale}-${theme}.png`),
        animations: 'disabled',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
      })
      await category(text('Test', 'ทดสอบ'))
      const panel = settings.locator('[data-price-reader-test]')
      await panel
        .locator('input[type="file"]')
        .setInputFiles({
          name: 'shop.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC3sAAAAASUVORK5CYII=',
            'base64',
          ),
        })
      await panel.getByRole('button', { name: text('Read test image', 'อ่านรูปทดสอบ') }).click()
      await expect(panel.locator('[data-price-test-match]')).toContainText(
        text('With Nitro: 100.00 THB', 'มี Nitro: 100.00 บาท'),
      )
      itemCount = null
      await panel.getByRole('button', { name: text('Read test image', 'อ่านรูปทดสอบ') }).click()
      const countLabel = text('Number of included items', 'จำนวนสินค้าที่รวมอยู่')
      await expect(panel.getByRole('combobox', { name: countLabel, exact: true })).toBeVisible()
      await expect(panel.locator('[data-price-test-match]')).toHaveCount(0)
      const before = calls
      await select(countLabel, text('Bundle · 3 items', 'บันเดิล 3 ชิ้น'))
      await expect(panel.locator('[data-price-test-match]')).toContainText(
        text('With Nitro: 140.00 THB', 'มี Nitro: 140.00 บาท'),
      )
      expect(calls).toBe(before)
      await panel.screenshot({
        path: info.outputPath(`counted-test-${locale}-${theme}.png`),
        animations: 'disabled',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await page
        .getByRole('button', { name: text('Save all', 'บันทึกทั้งหมด'), exact: true })
        .first()
        .click()
      const saveModal = page.getByRole('dialog', { name: text('Confirm save', 'ยืนยันการบันทึก') })
      await expect(saveModal).toBeVisible()
      await saveModal
        .getByRole('button', { name: text('Confirm save', 'ยืนยันการบันทึก'), exact: true })
        .click()
      await expect.poll(() => saves).toBe(1)
      expect(saved?.values.PRICE_READER_COUNT_PRICE_RULES).toHaveLength(50)
      expect(saved?.values.PRICE_READER_LANGUAGE).toBe(locale === 'en' ? 'EN' : 'TH')
      expect(saved?.secrets.GEMINI_API_KEY).toBeUndefined()
      expect(errors.filter((error) => !error.includes('ResizeObserver loop'))).toEqual([])
    })
  }

for (const theme of ['LIGHT', 'DARK'])
  for (const locale of ['th', 'en']) {
    test(`Custom price text saves and previews in ${locale} ${theme}`, async ({ page, isMobile }, info) => {
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      const text = (en: string, th: string) => locale === 'en' ? en : th
      await page.addInitScript(value => localStorage.setItem('fujipp-theme-mode', value), theme)
      const { priceLicense, config } = priceReaderCountedFixture(locale === 'en' ? 'EN' : 'TH')
      await page.route('**/api/v1/feature-licenses', route => route.fulfill({ json: [priceLicense] }))
      await page.route('**/api/v2/feature-licenses*', route => route.fulfill({ json: { items: [priceLicense], hasMore: false, nextCursor: null } }))
      let saved: { values: Record<string, unknown>; secrets: Record<string, unknown> } | undefined
      await page.route('**/configuration', route => {
        if (route.request().method() === 'PUT') {
          saved = route.request().postDataJSON()
          for (const field of config.fields) if (saved?.values[field.key] !== undefined) field.value = saved.values[field.key]
        }
        return route.fulfill({ json: config })
      })
      let calls = 0
      await page.route('**/price-reader/test', route => {
        calls++
        return route.fulfill({ json: { connected: true, errorCode: null, result: {
          itemName: 'Single item', itemType: 'SINGLE', itemCount: 1, currency: 'THB',
          standardPriceSatang: 38000, nitroPriceSatang: null, originalPriceSatang: null, discountPercent: null, ambiguous: false,
        } } })
      })
      await page.goto(`/my-bot/fixture-bot/settings/packages/fixture-license?locale=${locale}`)
      const settings = page.locator('[data-price-reader-config]')
      async function category(name: string) {
        if (isMobile) {
          await settings.getByRole('combobox', { name: text('Settings category', 'หมวดการตั้งค่า'), exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else await settings.getByRole('tab', { name, exact: true }).click()
      }
      await category(text('Status messages', 'ข้อความแต่ละสถานะ'))
      const details = settings.locator('[role=tabpanel]:visible')
      const discord = settings.locator('[data-price-format-key="PRICE_READER_BOTH_DISCORD_TEMPLATE"]')
      const shop = settings.locator('[data-price-format-key="PRICE_READER_BOTH_SHOP_TEMPLATE"]')
      const missing = settings.locator('[data-price-format-key="PRICE_READER_MISSING_PRICE_TEXT"]')
      const discordText = '💎 VIP {{nitro_price_text}}\n👤 {{standard_price_text}}'
      const shopText = 'VIP ฿{{nitro_shop_amount_text}}\nMember ฿{{standard_shop_amount_text}}'
      const missingText = text('Ask us', 'สอบถามร้าน')
      for (const field of [discord, shop, missing]) await field.getByRole('button', { name: text('Write custom text', 'เขียนข้อความเอง'), exact: true }).click()
      // Inner price formats cannot reference the final combined offer they build.
      await expect(discord.getByRole('button', {name: text('Insert offer_price_text','แทรก offer_price_text'), exact:true})).toHaveCount(0)
      await expect(shop.getByRole('button', {name: text('Insert shop_offer_text','แทรก shop_offer_text'), exact:true})).toHaveCount(0)
      await discord.getByRole('textbox').fill(discordText)
      await shop.getByRole('textbox').fill(shopText)
      await missing.getByRole('textbox').fill(missingText)
      await category(text('Result text', 'ข้อความผลลัพธ์'))
      await settings.getByRole('textbox', { name: text('Result item template', 'รูปแบบผลลัพธ์ต่อรูป'), exact: true }).fill('{{discord_price}}\n{{shop_price_text}}')
      await expect(settings).toContainText('💎 VIP 209.00')
      expect(calls).toBe(0)
      await category(text('Status messages', 'ข้อความแต่ละสถานะ'))
      await discord.getByRole('button', { name: text('Use automatic text', 'ใช้ข้อความอัตโนมัติ'), exact: true }).click()
      await discord.getByRole('button', { name: text('Write custom text', 'เขียนข้อความเอง'), exact: true }).click()
      await expect(discord.getByRole('textbox')).toHaveValue('{{standard_label}}: {{standard_price_text}} / {{nitro_label}}: {{nitro_price_text}}')
      await discord.getByRole('textbox').fill(discordText)
      await details.screenshot({ path: info.outputPath(`price-text-editor-${locale}-${theme}.png`), animations: 'disabled', style: '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }' })
      await category(text('Test', 'ทดสอบ'))
      const panel = settings.locator('[data-price-reader-test]')
      await panel.locator('input[type="file"]').setInputFiles({ name: 'shop.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC3sAAAAASUVORK5CYII=', 'base64') })
      await panel.getByRole('button', { name: text('Read test image', 'อ่านรูปทดสอบ'), exact: true }).click()
      await expect(panel.locator('[data-price-test-match]')).toContainText(`💎 VIP ${missingText}`)
      await expect(panel.locator('[data-price-test-match]')).toContainText('👤 380.00')
      await expect(panel.locator('[data-price-test-match]')).toContainText('Member ฿115.00')
      expect(calls).toBe(1)
      await panel.screenshot({ path: info.outputPath(`price-text-preview-${locale}-${theme}.png`), animations: 'disabled', style: '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.getByRole('button', { name: text('Save all', 'บันทึกทั้งหมด'), exact: true }).first().click()
      const modal = page.getByRole('dialog', { name: text('Confirm save', 'ยืนยันการบันทึก') })
      await modal.getByRole('button', { name: text('Confirm save', 'ยืนยันการบันทึก'), exact: true }).click()
      await expect.poll(() => saved?.values.PRICE_READER_BOTH_DISCORD_TEMPLATE).toBe(discordText)
      expect(saved?.values.PRICE_READER_BOTH_SHOP_TEMPLATE).toBe(shopText)
      expect(saved?.values.PRICE_READER_MISSING_PRICE_TEXT).toBe(missingText)
      expect(saved?.values.PRICE_READER_COUNT_PRICE_RULES).toEqual(providedRules)
      expect(saved?.secrets.GEMINI_API_KEY).toBeUndefined()
      await page.reload()
      await category(text('Status messages', 'ข้อความแต่ละสถานะ'))
      await expect(settings.locator('[data-price-format-key="PRICE_READER_BOTH_DISCORD_TEMPLATE"]').getByRole('textbox')).toHaveValue(discordText)
      await expect(settings.locator('[data-price-format-key="PRICE_READER_MISSING_PRICE_TEXT"]').getByRole('textbox')).toHaveValue(missingText)
      expect(calls).toBe(1)
    })
  }
