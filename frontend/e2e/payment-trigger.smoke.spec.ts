import { expect, test, type Locator } from '@playwright/test'
import { paymentTriggerFixture } from '../src/__tests__/fixtures/paymentTrigger'

const dropdownLabels: Record<string, string> = {
  '0': 'Container 1',
  '4': 'Danger · Red',
  root: 'นอก Container',
  NEW_MESSAGE: 'ส่งข้อความใหม่',
  UPDATE: 'อัปเดตข้อความเดิม',
  EMOJI_ONLY: '◀️ อีโมจิอย่างเดียว',
  TEXT: 'อีโมจิพร้อมข้อความ',
}
async function choose(control: Locator, value: string) {
  await control.click()
  await control.page().getByRole('option', { name: dropdownLabels[value]!, exact: true }).click()
}

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
      await form.getByRole('switch', { name: 'รับชำระด้วยซองอั่งเปา', exact: true }).click()
      await expect(
        form.getByRole('switch', { name: 'รับชำระด้วยซองอั่งเปา', exact: true }),
      ).toBeChecked()
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
      await expect(
        design.locator('.preview-shell').getByRole('button', { name: /ชำระด้วยซองอั่งเปา/ }),
      ).toHaveCount(1)
      await pick('ชำระเงินสำเร็จ')
      await expect(design.locator('.preview-shell')).toContainText('ชำระเงินสำเร็จ')
      await expect(design.locator('.preview-shell')).toContainText('10 บาท')
      await expect(design.locator('.preview-shell')).toContainText('sample-payment')
      await design.screenshot({
        path: testInfo.outputPath('payment-success.png'),
        animations: 'disabled',
        scale: 'css',
      })
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
        TRUEMONEY_ENABLED: true,
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
      if (mode === 'COMPONENTS_V2') {
        await expect(save).toBeDisabled()
        const implicitRow = editor.locator('[data-component-block="1"]')
        await choose(implicitRow.getByRole('combobox', { name: 'ย้ายไป', exact: true }), '0')
        await expect(editor.locator('[data-component-block="1"]')).toHaveCount(0)
        const container = editor.locator('[data-component-block="0"]')
        const bank = container.locator('[data-feature-action="payment.bank"]')
        const voucher = container.locator('[data-feature-action="payment.voucher"]')
        await bank.getByRole('textbox', { name: 'ข้อความปุ่ม', exact: true }).fill('โอนผ่านธนาคาร')
        await choose(bank.getByRole('combobox', { name: 'สีปุ่ม', exact: true }), '4')
        await voucher.getByRole('button', { name: 'ลบ', exact: true }).click()
        const picker = container.locator('[data-feature-picker-location="row"]')
        await picker.getByRole('combobox', { name: 'เพิ่มปุ่ม Feature', exact: true }).click()
        await page.getByRole('option', { name: 'ชำระด้วยซองอั่งเปา', exact: true }).click()
        await expect(voucher).toBeVisible()
        await voucher.getByRole('button', { name: 'เลื่อนปุ่ม 3 ไปทางซ้าย', exact: true }).click()
        await voucher.getByRole('button', { name: 'เลื่อนปุ่ม 2 ไปทางซ้าย', exact: true }).click()
        const preview = editor.locator('.preview-shell')
        await expect(
          preview.locator('.preview-container').getByRole('button', { name: /โอนผ่านธนาคาร/ }),
        ).toHaveCount(1)
        await expect(
          preview.locator('.preview-container').getByRole('button', { name: /ชำระด้วยซองอั่งเปา/ }),
        ).toHaveCount(1)
        await expect(preview.getByRole('button')).toHaveCount(3)
        await preview.screenshot({
          path: testInfo.outputPath('feature-buttons-inside-container.png'),
          animations: 'disabled',
          scale: 'css',
        })
        await save.click()
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
          .click()
        await expect(save).toBeDisabled()
        const definition = saved!.presentations.method_selector!
        expect(definition.feature_buttons_layout).toBe('CUSTOM')
        const blocks = (
          definition.components_v2 as {
            components: Array<{
              components: Array<{
                type: number
                components?: Array<{ action: string; label: string }>
              }>
            }>
          }
        ).components
        expect(blocks).toHaveLength(1)
        const row = blocks[0]!.components.find((child) => child.type === 1)!
        expect(row.components!.map((button) => button.action)).toEqual([
          'payment.voucher',
          'payment.bank',
          'payment.wallet',
        ])
        expect(row.components![1]!.label).toBe('โอนผ่านธนาคาร')
        await page.reload()
        await expect(save).toBeDisabled()
        await expect(editor.locator('[data-feature-action="payment.voucher"]')).toBeVisible()
        expect(errors).toEqual([])
        return
      }
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

for (const theme of ['LIGHT', 'DARK']) {
  test(`offers the envelope button while disabled in ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { paymentLicense, config } = paymentTriggerFixture('COMPONENTS_V2')
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [paymentLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [paymentLicense], nextCursor: null, hasMore: false } }),
    )
    await page.route('**/configuration', (route) => route.fulfill({ json: config }))
    await page.goto(
      '/my-bot/fixture-bot/settings/packages/fixture-license/components-v2?locale=th&message=method_selector',
    )
    const editor = page.locator('#feature-presentation-editor')
    await expect(editor.locator('[data-envelope-button-hint]')).toContainText(
      'ยังปิดรับซองอั่งเปาอยู่',
    )
    const container = editor.locator('[data-component-block="0"]')
    const picker = container.locator('[data-feature-picker-location="container"]')
    await picker.getByRole('combobox', { name: 'เพิ่มปุ่ม Feature', exact: true }).click()
    await expect(
      page.getByRole('option', { name: 'ชำระด้วยซองอั่งเปา', exact: true }),
    ).toBeEnabled()
    await page.getByRole('option', { name: 'ชำระด้วยซองอั่งเปา', exact: true }).click()
    const preview = editor.locator('.preview-shell')
    await expect(
      preview.locator('.preview-container').getByRole('button', { name: /ชำระด้วยซองอั่งเปา/ }),
    ).toBeDisabled()
    await expect(container.locator('[data-feature-action="payment.voucher"]')).toBeVisible()
    await preview.screenshot({
      path: testInfo.outputPath('envelope-button-disabled.png'),
      animations: 'disabled',
      scale: 'css',
    })
  })
}

for (const theme of ['LIGHT', 'DARK'])
  for (const mode of ['EMBED', 'COMPONENTS_V2'] as const) {
    test(`Payment Trigger 1.1 Back and action responses ${mode} in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const { paymentLicense, config } = paymentTriggerFixture(mode, '1.1.0')
      await page.route('https://fixture.invalid/*.png', (route) =>
        route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="white"/><path d="M8 8h30v30H8z M82 8h30v30H82z M8 82h30v30H8z M50 50h20v20H50z" fill="black"/></svg>',
        }),
      )
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [paymentLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [paymentLicense], nextCursor: null, hasMore: false } }),
      )
      let saved: { presentations: Record<string, Record<string, unknown>> } | undefined
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') {
          saved = route.request().postDataJSON()
          for (const slot of config.presentations)
            if (saved!.presentations[slot.key])
              slot.overrideDefinition = saved!.presentations[slot.key]!
          config.revision++
        }
        await route.fulfill({ json: config })
      })
      const url = `/my-bot/fixture-bot/settings/packages/fixture-license/${mode === 'EMBED' ? 'embed' : 'components-v2'}?locale=th&message=bank_payment`
      await page.goto(url)
      await page.addStyleTag({
        content: '#__vue-devtools-container__ { display: none !important; }',
      })
      const editor = page.locator('#feature-presentation-editor')
      const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
      await expect(save).toBeDisabled()
      if (mode === 'COMPONENTS_V2') {
        await expect(editor.locator('[data-envelope-button-hint]')).toHaveCount(0)
        const container = editor.locator('[data-component-block="0"]')
        const back = container.locator('[data-feature-action="payment.back"]')
        await expect(back).toBeVisible()
        await choose(
          back.getByRole('combobox', { name: 'เมื่อกดปุ่มนี้', exact: true }),
          'NEW_MESSAGE',
        )
        const row = container
          .locator('[data-container-child]')
          .filter({ has: page.locator('[data-feature-action="payment.back"]') })
        await row.getByRole('combobox', { name: 'ย้ายไป', exact: true }).click()
        await page.getByRole('listbox', { name: 'ย้ายไป', exact: true }).screenshot({
          path: testInfo.outputPath('website-move-dropdown.png'),
          animations: 'disabled',
          scale: 'css',
        })
        await page.getByRole('option', { name: 'นอก Container', exact: true }).click()
        await expect(container.locator('[data-feature-action="payment.back"]')).toHaveCount(0)
        const outside = editor.locator('[data-component-block="1"]')
        await expect(outside.locator('[data-feature-action="payment.back"]')).toBeVisible()
        await expect(
          outside.getByRole('combobox', { name: 'เมื่อกดปุ่มนี้', exact: true }),
        ).toContainText('ส่งข้อความใหม่')
        await choose(outside.getByRole('combobox', { name: 'ย้ายไป', exact: true }), '0')
        await back.getByRole('button', { name: 'ลบ', exact: true }).click()
        const picker = container.locator('[data-feature-picker-location="container"]')
        const pickerBefore = await picker.boundingBox()
        await picker.getByRole('combobox', { name: 'เพิ่มปุ่ม Feature', exact: true }).click()
        expect((await picker.boundingBox())!.height).toBe(pickerBefore!.height)
        await page.getByRole('listbox', { name: 'เพิ่มปุ่ม Feature', exact: true }).screenshot({
          path: testInfo.outputPath('website-feature-button-menu.png'),
          animations: 'disabled',
          scale: 'css',
        })
        await page.getByRole('option', { name: 'กลับไปเลือกช่องทาง', exact: true }).click()
        await choose(
          back.getByRole('combobox', { name: 'เมื่อกดปุ่มนี้', exact: true }),
          'NEW_MESSAGE',
        )
        await back
          .getByRole('textbox', { name: 'ข้อความปุ่ม', exact: true })
          .fill('เลือกช่องทางอื่น')
        await expect(
          editor
            .locator('.preview-shell .preview-container')
            .getByRole('button', { name: /เลือกช่องทางอื่น/ }),
        ).toHaveCount(1)
      } else {
        const back = editor.locator('[data-system-component="back_button"]')
        await expect(back).toBeVisible()
        await choose(
          back.getByRole('combobox', { name: 'เมื่อกดปุ่มนี้', exact: true }),
          'NEW_MESSAGE',
        )
        await back
          .getByRole('textbox', { name: 'ข้อความบนปุ่ม', exact: true })
          .fill('เลือกช่องทางอื่น')
      }
      const appearance = editor.getByRole('combobox', { name: 'รูปแบบปุ่มกลับ', exact: true })
      await choose(appearance, 'EMOJI_ONLY')
      const previewBack = editor
        .locator('.preview-shell')
        .getByRole('button', { name: 'เลือกช่องทางอื่น', exact: true })
      if (mode === 'EMBED' && (page.viewportSize()?.width ?? 0) < 768)
        await editor.getByRole('button', { name: 'ตัวอย่าง', exact: true }).click()
      await expect(previewBack).toHaveClass(/preview-button--icon-only/)
      await expect(previewBack).not.toContainText('เลือกช่องทางอื่น')
      await expect(previewBack.locator('img')).toHaveAttribute('src', /\/25c0\.svg$/)
      await previewBack.screenshot({
        path: testInfo.outputPath('back-emoji-only-preview.png'),
        animations: 'disabled',
        scale: 'css',
      })
      if (mode === 'EMBED' && (page.viewportSize()?.width ?? 0) < 768)
        await editor.getByRole('button', { name: 'แก้ไข', exact: true }).click()
      const controls = editor.locator(
        mode === 'COMPONENTS_V2'
          ? '[data-feature-action="payment.back"]'
          : '[data-system-component="back_button"]',
      )
      expect(
        await controls.evaluate((el) =>
          [...el.querySelectorAll('.text-field__control')].every(
            (field) => field.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1,
          ),
        ),
      ).toBe(true)
      await editor
        .locator(
          mode === 'COMPONENTS_V2'
            ? '[data-feature-action="payment.back"]'
            : '[data-system-component="back_button"]',
        )
        .screenshot({
          path: testInfo.outputPath('payment-v11-back-controls.png'),
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
          animations: 'disabled',
          scale: 'css',
        })
      await editor.screenshot({
        path: testInfo.outputPath('payment-v11-back-editor.png'),
        animations: 'disabled',
        scale: 'css',
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(save).toBeDisabled()
      expect(JSON.stringify(saved!.presentations.bank_payment)).toContain('EMOJI_ONLY')
      expect(JSON.stringify(saved!.presentations.bank_payment)).toContain('◀️')
      expect(JSON.stringify(saved!.presentations.bank_payment)).toContain('NEW_MESSAGE')
      expect(JSON.stringify(saved!.presentations.bank_payment)).toContain('เลือกช่องทางอื่น')
      await page.reload()
      await expect(save).toBeDisabled()
      await expect(
        editor.getByRole('combobox', { name: 'เมื่อกดปุ่มนี้', exact: true }),
      ).toContainText('ส่งข้อความใหม่')
      await expect(appearance).toContainText('◀️ อีโมจิอย่างเดียว')
      await choose(appearance, 'TEXT')
      const restoredLabel = editor.getByRole('textbox', {
        name: mode === 'EMBED' ? 'ข้อความบนปุ่ม' : 'ข้อความปุ่ม',
        exact: true,
      })
      await expect(restoredLabel).toHaveValue('เลือกช่องทางอื่น')
      await choose(appearance, 'EMOJI_ONLY')
      await expect(save).toBeDisabled()
      await page.goto(url.replace('bank_payment', 'wallet_payment'))
      await expect(
        editor.getByRole('combobox', { name: 'เมื่อกดปุ่มนี้', exact: true }),
      ).toContainText('อัปเดตข้อความเดิม')
      await expect(save).toBeDisabled()
      expect(errors).toEqual([])
    })
  }
