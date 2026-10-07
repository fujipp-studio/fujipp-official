import { expect, test } from '@playwright/test'
import { paymentTriggerFixture } from '../src/__tests__/fixtures/paymentTrigger'

for (const theme of ['LIGHT', 'DARK']) {
  for (const mode of ['EMBED', 'COMPONENTS_V2'] as const) {
    test(`edits Payment Trigger ${mode} in ${theme}`, async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const { paymentLicense, config } = paymentTriggerFixture(mode)
      const original = structuredClone(config)
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [paymentLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [paymentLicense], nextCursor: null, hasMore: false } }),
      )
      await page.route('https://fixture.invalid/*.png', (route) =>
        route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="white"/><path d="M8 8h30v30H8z M82 8h30v30H82z M8 82h30v30H8z M50 50h20v20H50z" fill="black"/><text x="60" y="100" text-anchor="middle" font-size="10">Sample QR</text></svg>',
        }),
      )
      let saved:
        | {
            values: Record<string, unknown>
            presentations: Record<string, Record<string, unknown>>
          }
        | undefined
      let saves = 0
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') {
          saved = route.request().postDataJSON()
          saves++
          for (const field of config.fields)
            field.value = saved!.values[field.key] as typeof field.value
          for (const slot of config.presentations)
            if (saved!.presentations[slot.key])
              slot.overrideDefinition = saved!.presentations[slot.key]!
          config.revision++
        }
        await route.fulfill({ json: config })
      })
      await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
      await page.addStyleTag({
        content: '#__vue-devtools-container__ { display: none !important; }',
      })
      const form = page.locator('#feature-config')
      const categories = form.locator('[data-payment-trigger-config]')
      const category = async (name: string) => {
        if ((page.viewportSize()?.width ?? 0) < 768) {
          await categories.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else {
          const tab = categories.getByRole('tab', { name, exact: true })
          await tab.evaluate((element) => {
            window.scrollBy({
              top: element.getBoundingClientRect().top - innerHeight * 0.25,
              behavior: 'instant',
            })
          })
          await tab.click()
        }
        await expect(categories.getByRole('tabpanel')).toHaveCount(1)
      }
      const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
      const sample = form.locator('[data-payment-trigger-example]')
      const totals = form.locator('[data-payment-amount-preview]')
      await expect(save).toBeDisabled()
      await expect(sample).toHaveText('p10')
      await expect(totals).toContainText('15 บาท')
      for (const name of ['Wallet', 'QR ธนาคาร', 'Trigger']) await category(name)
      await expect(save).toBeDisabled()
      const prefix = form.getByRole('textbox', { name: /คำนำหน้า Trigger/ })
      await prefix.fill('p1')
      await expect(prefix).toHaveAttribute('aria-invalid', 'true')
      await expect(sample).toHaveText('—')
      await prefix.fill('p')
      await expect(save).toBeDisabled()
      await prefix.fill('pay')
      await expect(sample).toHaveText('pay10')
      await category('Wallet')
      const phone = form.getByRole('textbox', { name: /หมายเลข Wallet/ })
      await phone.fill('123')
      await expect(phone).toHaveAttribute('aria-invalid', 'true')
      await phone.fill('0901234567')
      const fee = form.getByRole('spinbutton', { name: /ค่าธรรมเนียม Wallet/ })
      await fee.fill('-1')
      await expect(fee).toHaveAttribute('aria-invalid', 'true')
      await fee.fill('0')
      await expect(totals).not.toContainText('15 บาท')
      await expect(totals.locator('dd').last()).toHaveText('10 บาท')
      await fee.fill('250')
      await expect(form).toContainText('เท่ากับ 2.50 บาท')
      await expect(totals).toContainText('12.5 บาท')
      await category('QR ธนาคาร')
      const qr = form.getByRole('textbox', { name: /URL รูป QR ธนาคาร/ })
      await qr.fill('http://fixture.invalid/newqr.png')
      await expect(qr).toHaveAttribute('aria-invalid', 'true')
      await qr.fill('https://fixture.invalid/newqr.png')
      await expect(qr).toHaveAttribute('aria-invalid', 'false')
      await category('Trigger')
      await expect(prefix).toHaveValue('pay')

      const design = page.locator('#feature-presentations')
      const pick = async (name: string) => {
        if ((page.viewportSize()?.width ?? 0) < 1024) {
          await design.getByRole('combobox', { name: 'ข้อความ', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else
          await design
            .getByRole('button', {
              name: name + ' ' + (mode === 'EMBED' ? 'Embed' : 'Components V2'),
              exact: true,
            })
            .click()
      }
      await pick('เลือกช่องทางชำระเงิน')
      await expect(
        design.locator('.preview-shell').getByRole('button', { name: /สแกน QR ธนาคาร/ }),
      ).toHaveCount(1)
      await expect(
        design.locator('.preview-shell').getByRole('button', { name: /ชำระผ่าน Wallet/ }),
      ).toHaveCount(1)
      await expect(design.locator('.preview-shell')).toContainText('2.5 บาท')
      await pick('ชำระผ่าน Wallet')
      await expect(design.locator('.preview-shell')).toContainText('12.5 บาท')
      await expect(design.locator('.preview-shell')).toContainText('0901234567')
      await expect(
        design.locator('.preview-shell').getByRole('button', { name: /สแกน QR ธนาคาร/ }),
      ).toHaveCount(0)
      await pick('ชำระผ่าน QR ธนาคาร')
      await expect(design.locator('img[src="https://fixture.invalid/newqr.png"]')).toBeVisible()
      await expect(design.locator('[data-preview-image-error]')).toHaveCount(0)
      await pick('แจ้งยอดเงินไม่ถูกต้อง')
      await expect(design.locator('.preview-shell')).toContainText('pay10')
      await pick('เลือกช่องทางชำระเงิน')
      const initialViewport = page.viewportSize()!
      for (const width of [1366, 768, 320]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const [name, key] of [
          ['Trigger', 'trigger'],
          ['QR ธนาคาร', 'bank'],
          ['Wallet', 'wallet'],
        ] as const) {
          await category(name)
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true)
          if (mode === 'COMPONENTS_V2' && width !== 768)
            await categories.screenshot({
              path: testInfo.outputPath(key + '-' + width + '.png'),
              animations: 'disabled',
              scale: 'css',
              style:
                '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
            })
        }
        if (width !== 768)
          await design.screenshot({
            path: testInfo.outputPath('messages-' + width + '.png'),
            animations: 'disabled',
            scale: 'css',
            style:
              '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
          })
      }
      await save.click()
      expect(saved).toBeUndefined()
      await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก', exact: true }).click()
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(save).toBeDisabled()
      expect(saved?.values).toEqual({
        PAYMENT_TRIGGER_PREFIX: 'pay',
        BANK_QR_IMAGE_URL: 'https://fixture.invalid/newqr.png',
        WALLET_NUMBER: '0901234567',
        WALLET_FEE_SATANG: 250,
        FUTURE_SETTING: 'preserved',
      })
      expect(saved?.presentations.method_selector).toEqual(
        original.presentations[0]!.defaultDefinition,
      )
      expect(saves).toBe(1)
      await page.reload()
      await expect(save).toBeDisabled()
      await expect(sample).toHaveText('pay10')
      await category('Wallet')
      await expect(fee).toHaveValue('250')
      await expect(phone).toHaveValue('0901234567')
      await page.setViewportSize(initialViewport)
      await pick('เลือกช่องทางชำระเงิน')
      await design.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
      await expect(page).toHaveURL(
        new RegExp(
          (mode === 'EMBED' ? '/embed' : '/components-v2') + '\\?locale=th&message=method_selector',
        ),
      )
      const editor = page.locator('#feature-presentation-editor')
      const bank = editor.locator('[data-system-component="bank_button"]')
      const wallet = editor.locator('[data-system-component="wallet_button"]')
      await expect(bank).toBeVisible()
      await expect(wallet).toBeVisible()
      await expect(save).toBeDisabled()
      await bank.getByRole('textbox', { name: 'ข้อความบนปุ่ม', exact: true }).fill('โอนผ่านธนาคาร')
      await bank.getByRole('combobox', { name: 'สีปุ่ม', exact: true }).click()
      await page.getByRole('option', { name: 'Danger · Red', exact: true }).click()
      await bank.getByRole('textbox', { name: 'Emoji', exact: true }).fill('💳')
      await wallet.getByRole('textbox', { name: 'ข้อความบนปุ่ม', exact: true }).fill('โอน Wallet')
      if (mode === 'EMBED' && initialViewport.width < 768)
        await editor.getByRole('button', { name: 'ตัวอย่าง', exact: true }).click()
      const preview = editor.locator('.preview-shell')
      await expect(preview.getByRole('button', { name: /โอนผ่านธนาคาร/ })).toHaveClass(
        /preview-button--(?:danger|4)\b/,
      )
      await expect(preview.getByRole('button', { name: /โอน Wallet/ })).toHaveClass(
        /preview-button--(?:primary|1)\b/,
      )
      await preview.screenshot({
        path: testInfo.outputPath('editor-preview.png'),
        animations: 'disabled',
        scale: 'css',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      })
      if (mode === 'EMBED' && initialViewport.width < 768)
        await editor.getByRole('button', { name: 'แก้ไข', exact: true }).click()
      await bank.screenshot({
        path: testInfo.outputPath('button-editor.png'),
        animations: 'disabled',
        scale: 'css',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      })
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(save).toBeDisabled()
      const expected = structuredClone(original.presentations[0]!.defaultDefinition)
      const buttons = expected.components as Record<string, Record<string, unknown>>
      buttons.bank_button = {
        ...buttons.bank_button,
        label: 'โอนผ่านธนาคาร',
        style: 'danger',
        emoji: '💳',
      }
      buttons.wallet_button = { ...buttons.wallet_button, label: 'โอน Wallet' }
      expect(saved?.presentations.method_selector).toEqual(expected)
      expect(saved?.presentations.bank_payment).toEqual(
        original.presentations[1]!.defaultDefinition,
      )
      expect(saved?.presentations.wallet_payment).toEqual(
        original.presentations[2]!.defaultDefinition,
      )
      expect(saved?.presentations.invalid_amount).toEqual(
        original.presentations[3]!.defaultDefinition,
      )
      await page.reload()
      await expect(save).toBeDisabled()
      await expect(bank.getByRole('textbox', { name: 'ข้อความบนปุ่ม', exact: true })).toHaveValue(
        'โอนผ่านธนาคาร',
      )
      expect(errors).toEqual([])
    })
  }
}
