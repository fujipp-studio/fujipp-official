import { expect, test } from '@playwright/test'
import { walletTopupConfiguration, walletTopupLicense } from '../src/__tests__/fixtures/walletTopup'

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'reorders Embed system actions and aligns the preview theme in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const config = structuredClone(walletTopupConfiguration)
      const slot = config.presentations.find((item) => item.key === 'panel')!
      slot.defaultDefinition = {
        ...slot.defaultDefinition,
        action_overrides: { 'wallet.topup': { label: 'Add funds', emoji: '⭐', style: 'danger' } },
      }
      let saved: { presentations: Record<string, Record<string, unknown>> } | undefined
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [walletTopupLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [walletTopupLicense], nextCursor: null, hasMore: false } }),
      )
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') {
          saved = route.request().postDataJSON()
          for (const item of config.presentations)
            item.overrideDefinition = saved!.presentations[item.key]!
          config.revision++
        }
        await route.fulfill({ json: config })
      })
      await page.goto(
        '/my-bot/fixture-bot/settings/packages/fixture-license/embed?locale=en&message=panel',
      )
      const editor = page.locator('#feature-presentation-editor')
      const actions = editor.locator('[data-system-actions]')
      const previewPane = editor.locator('.embed-preview-pane')
      const order = () => previewPane.locator('.preview-actions button').allTextContents()
      const save = page.getByRole('button', { name: 'Save all', exact: true })
      await expect(save).toBeDisabled()
      await expect(
        actions.getByRole('button', { name: 'Move wallet.topup up', exact: true }),
      ).toBeDisabled()
      await expect(
        actions.getByRole('button', { name: 'Move wallet.balance down', exact: true }),
      ).toBeDisabled()
      if (isMobile) await editor.getByRole('button', { name: 'Preview', exact: true }).click()
      expect((await order()).map((label) => label.trim())).toEqual([
        '⭐Add funds',
        '💳Check balance',
      ])
      const alignment = await previewPane.evaluate((element) => {
        const appearance = element.querySelector('.preview-appearance')!.getBoundingClientRect()
        const header = element.querySelector('.embed-preview-header')!
        return {
          inset: appearance.left - element.getBoundingClientRect().left,
          aligned:
            Math.abs(
              appearance.left -
                header.getBoundingClientRect().left -
                parseFloat(getComputedStyle(header).paddingLeft),
            ) < 1,
        }
      })
      expect(alignment.inset).toBeGreaterThan(10)
      expect(alignment.aligned).toBe(true)
      const appearance = previewPane.getByRole('combobox', { name: 'Preview theme', exact: true })
      await appearance.click()
      await page.getByRole('option', { name: 'Discord Onyx', exact: true }).click()
      await expect(save).toBeDisabled()
      if (isMobile) await editor.getByRole('button', { name: 'Edit', exact: true }).click()
      const up = actions.getByRole('button', { name: 'Move wallet.balance up', exact: true })
      await up.focus()
      await up.press('Enter')
      await expect(actions.locator('.component-role strong')).toHaveText([
        'wallet.balance',
        'wallet.topup',
      ])
      await expect(save).toBeEnabled()
      if (isMobile) await editor.getByRole('button', { name: 'Preview', exact: true }).click()
      expect((await order()).map((label) => label.trim())).toEqual([
        '💳Check balance',
        '⭐Add funds',
      ])
      await previewPane.screenshot({
        path: testInfo.outputPath('embed-preview-theme-spacing.png'),
        scale: 'css',
        animations: 'disabled',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      })
      if (isMobile) await editor.getByRole('button', { name: 'Edit', exact: true }).click()
      await actions.getByRole('button', { name: 'Move wallet.balance down', exact: true }).click()
      await expect(save).toBeDisabled()
      await actions.getByRole('button', { name: 'Move wallet.topup down', exact: true }).click()
      await actions.screenshot({
        path: testInfo.outputPath('embed-action-order-controls.png'),
        scale: 'css',
        animations: 'disabled',
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Confirm save', exact: true })
        .click()
      await expect(save).toBeDisabled()
      expect(saved?.presentations.panel).toEqual({
        ...slot.defaultDefinition,
        actions: ['wallet.balance', 'wallet.topup'],
      })
      await page.reload()
      await expect(editor.locator('[data-system-actions] .component-role strong')).toHaveText([
        'wallet.balance',
        'wallet.topup',
      ])
    },
  )
}

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'matches Discord payment button colors and corners in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const config = structuredClone(walletTopupConfiguration)
      const selector = config.presentations.find((slot) => slot.key === 'method_selector')!
      selector.defaultDefinition = {
        mode: 'EMBED',
        title: 'เลือกช่องทางเติมเงิน',
        description:
          '**🔻 อ่านก่อนเติม**\n**เติมผ่านซองอั่งเปาทรูมันนี่หักค่าธรรมเนียม** {{truemoney_fee}}',
        actions: ['wallet.promptpay', 'wallet.truemoney'],
        action_overrides: {
          'wallet.promptpay': { label: 'พร้อมเพย์ธนาคาร' },
          'wallet.truemoney': { label: 'ซองอั่งเปาทรูมันนี่' },
        },
      }
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [walletTopupLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [walletTopupLicense], nextCursor: null, hasMore: false } }),
      )
      await page.route('**/configuration', (route) => route.fulfill({ json: config }))
      await page.goto(
        '/my-bot/fixture-bot/settings/packages/fixture-license?locale=en&message=method_selector',
      )
      const messages = page.locator('#feature-presentations')
      const preview = messages.locator('.preview-shell')
      const appearance = messages.getByRole('combobox', { name: 'Preview theme', exact: true })
      await appearance.click()
      await page.getByRole('option', { name: 'Discord Onyx', exact: true }).click()
      for (const mode of ['Embed', 'Components V2']) {
        if (mode === 'Components V2') {
          await messages.getByRole('combobox', { name: 'Message format', exact: true }).click()
          await page.getByRole('option', { name: mode, exact: true }).click()
        }
        const primary = preview.getByRole('button', { name: /พร้อมเพย์ธนาคาร/ })
        const danger = preview.getByRole('button', { name: /ซองอั่งเปาทรูมันนี่/ })
        await page.mouse.move(0, 0)
        await expect(primary).toHaveCSS('background-color', 'rgb(88, 101, 242)')
        await expect(danger).toHaveCSS('background-color', 'rgb(210, 45, 57)')
        for (const button of [primary, danger]) {
          await expect(button).toHaveCSS('border-radius', '8px')
          await expect(button).toHaveCSS('height', '32px')
          await expect(button).toHaveCSS('font-size', '14px')
          await expect(button).toHaveCSS('border-width', '1px')
          await expect(button).toHaveCSS('border-color', 'rgba(255, 255, 255, 0.08)')
          await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)')
          await expect(button.locator('.discord-unicode-emoji')).toHaveCSS('width', '20px')
        }
        if (!isMobile) {
          await primary.hover()
          await expect(primary).toHaveCSS('background-color', 'rgb(68, 82, 187)')
          await page.mouse.down()
          await expect(primary).toHaveCSS('background-color', 'rgb(58, 72, 163)')
          await page.mouse.up()
          await page.mouse.move(0, 0)
          await expect(primary).toHaveCSS('background-color', 'rgb(88, 101, 242)')
        }
        for (const width of [1366, 768, 320]) {
          await page.setViewportSize({ width, height: 900 })
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true)
          expect(
            await preview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
          ).toBe(true)
        }
        await page.setViewportSize(
          isMobile ? { width: 320, height: 900 } : testInfo.project.use.viewport!,
        )
        await preview.screenshot({
          path: testInfo.outputPath('discord-payment-buttons-' + mode + '.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
        })
      }
      await preview.getByRole('button', { name: /ซองอั่งเปาทรูมันนี่/ }).click()
      await expect(preview.getByRole('status')).toContainText('ซองอั่งเปาทรูมันนี่')
    },
  )
}

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'previews the Wallet Components V2 receipt like its runtime payload in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const config = structuredClone(walletTopupConfiguration)
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [walletTopupLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [walletTopupLicense], nextCursor: null, hasMore: false } }),
      )
      await page.route('**/configuration', (route) => route.fulfill({ json: config }))
      await page.goto(
        '/my-bot/fixture-bot/settings/packages/fixture-license?locale=en&message=adjustment_result',
      )
      const messages = page.locator('#feature-presentations')
      const preview = messages.locator('.preview-shell')
      const container = preview.locator('.preview-container')
      await expect(container).toHaveCount(1)
      await expect(
        container.getByRole('heading', { name: '✅ ปรับยอดเงินสำเร็จ', exact: true }),
      ).toBeVisible()
      await expect(container.locator('h1')).toHaveCSS('font-size', '24px')
      await expect(container.locator('h1')).toHaveCSS('margin-top', '0px')
      await expect(container).toHaveCSS('padding', '16px')
      await expect(container).toHaveCSS('border-radius', '8px')
      await expect(container).not.toHaveClass(/preview-container--accent/)
      await expect(container.locator('.preview-separator hr')).toHaveCount(1)
      await expect(container.locator('.discord-mention')).toHaveText(['@Fujipp', '@Admin'])
      await expect(container).toContainText('รายการ ตั้งยอดเงิน')
      await expect(container).toContainText('6/10/2569 14:30:00')
      await expect(container.locator('.preview-copy').last()).toHaveCSS('font-size', '16px')
      const appearance = messages.getByRole('combobox', { name: 'Preview theme', exact: true })
      await appearance.click()
      await page.getByRole('option', { name: 'Discord Onyx', exact: true }).click()
      await expect(container).toHaveCSS('background-color', 'rgb(10, 10, 10)')
      await expect(container.locator('.discord-mention').first()).toHaveCSS(
        'background-color',
        'rgba(88, 101, 242, 0.3)',
      )
      const save = page.getByRole('button', { name: 'Save all', exact: true })
      await expect(save).toBeDisabled()
      await page.evaluate(() => document.fonts.ready)
      for (const width of [1366, 768, 320]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        expect(
          await preview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true)
      }
      await page.setViewportSize(
        isMobile ? { width: 320, height: 900 } : testInfo.project.use.viewport!,
      )
      await preview.screenshot({
        path: testInfo.outputPath('wallet-components-receipt.png'),
        animations: 'disabled',
        scale: 'css',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
      })
      await messages.getByRole('button', { name: 'Edit message', exact: true }).click()
      await expect(page).toHaveURL(/\/components-v2\?.*message=adjustment_result/)
      const editor = page.locator('#feature-presentation-editor')
      await expect(editor.locator('.preview-container')).toHaveCount(1)
      await expect(editor.locator('.preview-container h1')).toHaveCSS('font-size', '24px')
      await expect(editor.locator('.preview-container .preview-separator hr')).toHaveCount(1)
      await expect(save).toBeDisabled()
    },
  )
}

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'matches the Wallet balance payload and Discord heading metrics in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const config = structuredClone(walletTopupConfiguration)
      const balance = config.presentations.find((slot) => slot.key === 'balance')!
      balance.defaultDefinition = {
        mode: 'EMBED',
        title: '💳 เงินในบัญชีของคุณ',
        description: '# ยอดคงเหลือ {{balance}} {{currency}}',
        thumbnail_url: '{{member_avatar_url}}',
        image_url: '',
      }
      balance.availableVariables = ['member_avatar_url', 'balance', 'currency']
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [walletTopupLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({
          json: { items: [walletTopupLicense], nextCursor: null, hasMore: false },
        }),
      )
      await page.route('**/configuration', (route) => route.fulfill({ json: config }))
      await page.goto(
        '/my-bot/fixture-bot/settings/packages/fixture-license?locale=th&message=balance',
      )
      await page.addStyleTag({
        content: '#__vue-devtools-container__, .vue-devtools__anchor { display: none !important; }',
      })
      const messages = page.locator('#feature-presentations')
      const preview = messages.locator('.preview-shell')
      const embed = preview.locator('.preview-embed')
      await expect(preview.getByRole('heading', { name: '💳 เงินในบัญชีของคุณ' })).toBeVisible()
      await expect(preview.getByRole('heading', { name: 'ยอดคงเหลือ 350.00 THB' })).toBeVisible()
      await expect(embed.locator('h1')).toHaveCSS('font-size', '24px')
      await expect(embed.locator('h1')).toHaveCSS('line-height', '33px')
      await expect(embed.locator('h4')).toHaveCSS('font-size', '16px')
      await expect(preview.locator('.preview-avatar')).toHaveCSS('width', '40px')
      await expect(embed.locator('.preview-thumbnail')).toHaveCount(0)
      await expect(embed.locator('.preview-image')).toHaveCount(0)
      await expect(embed).not.toHaveClass(/preview-embed--thumbnail/)
      await expect
        .poll(() =>
          embed
            .locator('.discord-unicode-emoji')
            .evaluate(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
        )
        .toBe(true)
      const appearance = messages.getByRole('combobox', { name: 'ธีมตัวอย่าง', exact: true })
      await appearance.click()
      await page.getByRole('option', { name: 'Discord Onyx', exact: true }).click()
      await expect(embed).toHaveCSS('background-color', 'rgb(10, 10, 10)')
      await expect(embed).toHaveCSS('border-left-color', 'rgb(43, 43, 47)')
      await expect(page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })).toBeDisabled()
      await page.evaluate(() => document.fonts.ready)
      for (const width of [1366, 768, 320]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        expect(
          await preview.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true)
      }
      await page.setViewportSize(
        isMobile ? { width: 320, height: 900 } : testInfo.project.use.viewport!,
      )
      await preview.screenshot({
        path: testInfo.outputPath('wallet-balance-onyx.png'),
        scale: 'css',
        animations: 'disabled',
      })
      await appearance.click()
      await page.getByRole('option', { name: 'Discord Light', exact: true }).click()
      await expect(embed).toHaveCSS('background-color', 'rgb(242, 243, 245)')
      await preview.screenshot({
        path: testInfo.outputPath('wallet-balance-light.png'),
        scale: 'css',
        animations: 'disabled',
      })
      await messages.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
      await expect(page).toHaveURL(/\/embed\?.*message=balance/)
      const editor = page.locator('#feature-presentation-editor')
      await expect(editor.locator('.preview-thumbnail')).toHaveCount(0)
      await expect(editor.locator('.preview-embed h1')).toHaveCSS('font-size', '24px')
      const color = editor.getByRole('textbox', { name: 'สีของ Embed (HEX)', exact: true })
      const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
      await expect(color).toHaveValue('')
      await color.fill('#123456')
      await color.blur()
      await expect(editor.locator('.preview-embed')).toHaveCSS(
        'border-left-color',
        'rgb(18, 52, 86)',
      )
      await expect(save).toBeEnabled()
      await color.fill('')
      await color.blur()
      await expect(save).toBeDisabled()
    },
  )
}

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'configures Wallet Top-up across categories in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [walletTopupLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [walletTopupLicense], nextCursor: null, hasMore: false } }),
      )
      const config = structuredClone(walletTopupConfiguration)
      const saves: Array<{
        values: Record<string, unknown>
        secrets: Record<string, string>
        presentations: Record<string, Record<string, unknown>>
      }> = []
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') {
          const input = route.request().postDataJSON()
          saves.push(input)
          for (const field of config.fields)
            if (!field.secret) field.value = input.values[field.key]
          for (const slot of config.presentations)
            slot.overrideDefinition = input.presentations[slot.key]
          config.revision++
        }
        await route.fulfill({ json: config })
      })
      await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
      await page.addStyleTag({
        content: '#__vue-devtools-container__, .vue-devtools__anchor { display: none !important; }',
      })
      const form = page.locator('#feature-config')
      const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
      const messages = page.locator('#feature-presentations')
      const preview = messages.locator('.preview-shell')
      const navigation = messages.locator('[data-feature-message-navigation]')
      const scrollUp = messages.getByRole('button', {
        name: 'เลื่อนรายการข้อความขึ้น',
        exact: true,
      })
      const scrollDown = messages.getByRole('button', {
        name: 'เลื่อนรายการข้อความลง',
        exact: true,
      })
      if (isMobile) {
        await expect(navigation).toBeHidden()
        await expect(messages.getByRole('combobox', { name: 'ข้อความ', exact: true })).toBeVisible()
      } else {
        const list = navigation.getByRole('group', { name: 'ข้อความ', exact: true })
        await expect(scrollUp).toBeDisabled()
        await expect(scrollDown).toBeEnabled()
        await expect(
          navigation.getByText('เลื่อนดูข้อความเพิ่มเติม', { exact: true }),
        ).toBeVisible()
        const position = navigation.getByRole('slider', {
          name: 'ตำแหน่งเลื่อนรายการข้อความ',
          exact: true,
        })
        await expect(position).toBeVisible()
        await expect(position).toHaveValue('0')
        await navigation.scrollIntoViewIfNeeded()
        await page.evaluate(() => document.fonts.ready)
        await navigation.screenshot({
          path: testInfo.outputPath('wallet-message-list-start.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
        })
        const rail = (await position.boundingBox())!
        await page.mouse.move(rail.x + rail.width / 2, rail.y + 10)
        await page.mouse.down()
        await page.mouse.move(rail.x + rail.width / 2, rail.y + rail.height / 2, { steps: 6 })
        await page.mouse.up()
        await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
        await position.focus()
        await position.press('Home')
        await expect(scrollUp).toBeDisabled()
        await scrollDown.click()
        await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
        await expect(scrollUp).toBeEnabled()
        await position.focus()
        await position.press('End')
        await expect(scrollDown).toBeDisabled()
        await expect(navigation.getByText('ถึงท้ายรายการแล้ว', { exact: true })).toBeVisible()
        await navigation.screenshot({
          path: testInfo.outputPath('wallet-message-list-end.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
        })
        await scrollUp.click()
        await expect(scrollDown).toBeEnabled()
        await list.focus()
        await list.press('Home')
        await expect(scrollUp).toBeDisabled()
        await expect(
          page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true }),
        ).toBeDisabled()
      }
      const category = async (name: string) => {
        if (isMobile) {
          await form.getByRole('combobox', { name: 'หมวดการตั้งค่า', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else await form.getByRole('tab', { name, exact: true }).click()
      }
      const message = async (name: string) => {
        if (isMobile) {
          await messages.getByRole('combobox', { name: 'ข้อความ', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else await messages.getByRole('button', { name: new RegExp('^' + name) }).click()
      }
      const capture = async (name: string) => {
        await page.evaluate(() => document.fonts.ready)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        await form.screenshot({
          path: testInfo.outputPath(name + '.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
        })
      }
      await expect(save).toBeDisabled()
      await expect(form.getByRole('tabpanel')).toHaveCount(1)
      if (!isMobile) {
        const paymentTab = form.getByRole('tab', { name: 'ช่องทางชำระเงิน', exact: true })
        await paymentTab.focus()
        await paymentTab.press('ArrowRight')
        await expect(form.getByRole('tab', { name: 'ห้องและยศ', exact: true })).toBeFocused()
        await form.getByRole('tab', { name: 'ห้องและยศ', exact: true }).press('Home')
        await expect(paymentTab).toHaveAttribute('aria-selected', 'true')
      }
      const min = form.getByRole('spinbutton', { name: /ยอดเติมขั้นต่ำผ่านพร้อมเพย์/ })
      await expect(min).toHaveValue('1000')
      await min.fill('2500')
      await expect(form.locator('[data-wallet-summary]')).toContainText('25.00 บาท')
      await min.fill('1000')
      await expect(save).toBeDisabled()
      await min.fill('2500')
      const qr = form.getByRole('spinbutton', { name: /อายุ QR/ })
      await expect(qr).toHaveAttribute('min', '1')
      await expect(qr).toHaveAttribute('max', '60')
      await qr.fill('0')
      await expect(qr).toHaveAttribute('aria-invalid', 'true')
      await qr.fill('10')
      const feeMode = form.getByRole('combobox', { name: /รูปแบบค่าธรรมเนียม TrueMoney/ })
      await feeMode.click()
      await page.getByRole('option', { name: /เปอร์เซ็นต์/ }).click()
      const percentage = form.getByRole('spinbutton', {
        name: /ค่าธรรมเนียม TrueMoney แบบเปอร์เซ็นต์/,
      })
      await percentage.fill('12')
      await expect(form.locator('[data-wallet-summary]')).toContainText('12%')
      await feeMode.click()
      await page.getByRole('option', { name: /คงที่/ }).click()
      await expect(
        form.getByRole('spinbutton', { name: /ค่าธรรมเนียม TrueMoney \(สตางค์\)/ }),
      ).toHaveValue('500')
      await feeMode.click()
      await page.getByRole('option', { name: /เปอร์เซ็นต์/ }).click()
      await expect(percentage).toHaveValue('12')
      const apiKey = form.getByLabel(/คีย์ API ของ SlipOK/)
      await expect(apiKey).toHaveAttribute('type', 'password')
      await expect(apiKey).not.toHaveAttribute('required')
      await expect(apiKey).toHaveValue('')
      await form.getByLabel(/รหัสสาขา SlipOK/).fill('test-branch')
      await capture('wallet-payments')
      await category('ห้องและยศ')
      const slipChannel = form.getByRole('textbox', { name: /ช่องส่งสลิป/ })
      await slipChannel.fill('invalid')
      await expect(slipChannel).toHaveAttribute('aria-invalid', 'true')
      await slipChannel.fill('123456789012345682')
      await form.getByRole('textbox', { name: /ยศผู้ดูแลกระเป๋าเงิน/ }).fill('123456789012345683')
      await capture('wallet-discord')
      await category('อันดับและรางวัล')
      await form.getByRole('button', { name: 'เพิ่มเกณฑ์', exact: true }).click()
      const threshold = form.getByRole('spinbutton', { name: /ยอดเติมสะสมขั้นต่ำ/ }).nth(1)
      await expect(threshold).toBeFocused()
      await threshold.fill('2500.50')
      await form
        .getByRole('textbox', { name: /Discord Role ID/ })
        .nth(1)
        .fill('123456789012345684')
      await capture('wallet-rewards')
      await category('คำสั่ง')
      const command = form.getByRole('textbox', { name: /ชื่อคำสั่ง/ })
      await command.fill('topup-panel')
      await expect(form.locator('[data-feature-command-list]').first()).toContainText(
        '/topup-panel',
      )
      await form.locator('details').getByText('คำสั่งผู้ดูแลกระเป๋าเงิน', { exact: true }).click()
      await expect(form).toContainText('/wallet-admin add')
      await form.getByRole('spinbutton', { name: /จำนวนประวัติเริ่มต้น/ }).fill('20')
      await capture('wallet-commands')
      await category('ช่องทางชำระเงิน')
      await expect(form.getByLabel(/รหัสสาขา SlipOK/)).toHaveValue('test-branch')
      await expect(percentage).toHaveValue('12')
      await expect(min).toHaveValue('2500')
      for (const width of [1366, 768, 320]) {
        await page.setViewportSize({ width, height: 1000 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
      }
      await page.setViewportSize(
        isMobile ? { width: 320, height: 900 } : testInfo.project.use.viewport!,
      )
      await save.click()
      expect(saves).toHaveLength(0)
      await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก', exact: true }).click()
      await expect(save).toBeEnabled()
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(save).toBeDisabled()
      expect(saves[0]?.values).toMatchObject({
        MIN_TOPUP_SATANG: 2500,
        TRUEMONEY_FEE_MODE: 'PERCENT',
        TRUEMONEY_FEE_PERCENT: 12,
        TRUEMONEY_FEE_SATANG: 500,
        PROMPTPAY_QR_EXPIRY_MINUTES: 10,
        SLIP_CHANNEL_ID: '123456789012345682',
        WALLET_ADMIN_ROLE_ID: '123456789012345683',
        WALLET_HISTORY_DEFAULT_LIMIT: 20,
        PANEL_COMMAND_NAME: 'topup-panel',
        FUTURE_WALLET_SETTING: 'keep-this',
        TOP_SPENDER_MILESTONE_ROLES: [
          { thresholdBaht: 1000, roleId: '123456789012345681', future: 'preserved' },
          { thresholdBaht: 2500.5, roleId: '123456789012345684' },
        ],
      })
      expect(saves[0]?.secrets).toEqual({ SLIPOK_BRANCH_ID: 'test-branch' })
      await expect(apiKey).toHaveValue('')
      await message('เลือกช่องทางเติมเงิน')
      await expect(preview).toContainText('25.00 บาท')
      await expect(preview).toContainText('12%')
      await message('เติมเงินสำเร็จ')
      expect(
        (await messages.getByRole('combobox', { name: 'รูปแบบข้อความ', exact: true }).boundingBox())
          ?.width,
      ).toBeGreaterThan(150)
      await messages.screenshot({
        path: testInfo.outputPath('wallet-message.png'),
        animations: 'disabled',
        scale: 'css',
        style: '.navbar, .app-scroll-rail, .section-indicator { visibility: hidden !important; }',
      })
      await messages.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
      await expect(page).toHaveURL(/\/embed\?.*message=succeeded/)
      const editor = page.locator('#feature-presentation-editor')
      expect(
        (await editor.getByRole('combobox', { name: 'ข้อความ', exact: true }).boundingBox())?.width,
      ).toBeGreaterThan(150)
      await expect(
        editor.getByRole('heading', { name: 'เติมเงินสำเร็จ', exact: true, level: 3 }),
      ).toBeVisible()
      await editor
        .getByRole('textbox', { name: 'หัวข้อ', exact: true })
        .fill('สำเร็จ {{amount}} บาท')
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
        .click()
      await expect(save).toBeDisabled()
      expect(saves.at(-1)?.presentations.succeeded).toMatchObject({
        title: 'สำเร็จ {{amount}} บาท',
        future: 'preserved',
      })
      expect(saves.at(-1)?.presentations.panel).toEqual(
        walletTopupConfiguration.presentations[0]!.defaultDefinition,
      )
      expect(errors).toEqual([])
    },
  )
}

test('supports Wallet Top-up with fewer configuration fields', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const license = { ...walletTopupLicense, version: '1.0.0' }
  const config = structuredClone(walletTopupConfiguration)
  config.fields = config.fields.filter((field) =>
    [
      'MIN_TOPUP_SATANG',
      'TRUEMONEY_FEE_SATANG',
      'TRUEMONEY_PHONE',
      'SLIPOK_API_KEY',
      'FUTURE_WALLET_SETTING',
    ].includes(field.key),
  )
  config.presentations = []
  await page.route('**/api/v1/feature-licenses', (route) => route.fulfill({ json: [license] }))
  await page.route('**/api/v2/feature-licenses*', (route) =>
    route.fulfill({ json: { items: [license], nextCursor: null, hasMore: false } }),
  )
  await page.route('**/configuration', (route) => route.fulfill({ json: config }))
  await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
  const form = page.locator('#feature-config')
  await expect(form.getByRole('spinbutton', { name: /ยอดเติมขั้นต่ำผ่านพร้อมเพย์/ })).toHaveValue(
    '1000',
  )
  await expect(form.getByRole('spinbutton', { name: /ค่าธรรมเนียม TrueMoney/ })).toHaveValue('500')
  await expect(form.getByRole('combobox')).toHaveCount(0)
  await expect(form.getByRole('tab')).toHaveCount(0)
  await expect(form.getByRole('textbox', { name: /FUTURE_WALLET_SETTING/ })).toHaveValue(
    'keep-this',
  )
  await expect(page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})

test('switches Wallet message formats and opens the selected Components V2 message', async ({
  page,
  isMobile,
}) => {
  const config = structuredClone(walletTopupConfiguration)
  await page.route('**/api/v1/feature-licenses', (route) =>
    route.fulfill({ json: [walletTopupLicense] }),
  )
  await page.route('**/api/v2/feature-licenses*', (route) =>
    route.fulfill({ json: { items: [walletTopupLicense], nextCursor: null, hasMore: false } }),
  )
  await page.route('**/configuration', async (route) => {
    if (route.request().method() === 'PUT') {
      const input = route.request().postDataJSON()
      for (const slot of config.presentations)
        slot.overrideDefinition = input.presentations[slot.key]
      config.revision++
    }
    await route.fulfill({ json: config })
  })
  await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
  await page.addStyleTag({
    content: '#__vue-devtools-container__, .vue-devtools__anchor { display: none !important; }',
  })
  const messages = page.locator('#feature-presentations')
  const save = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
  const format = messages.getByRole('combobox', { name: 'รูปแบบข้อความ', exact: true })
  await format.click()
  await page.getByRole('option', { name: 'Components V2', exact: true }).click()
  await expect(save).toBeEnabled()
  await format.click()
  await page.getByRole('option', { name: 'Embed', exact: true }).click()
  await expect(save).toBeDisabled()
  if (isMobile) {
    await messages.getByRole('combobox', { name: 'ข้อความ', exact: true }).click()
    await page.getByRole('option', { name: 'เลือกช่องทางเติมเงิน', exact: true }).click()
  } else await messages.getByRole('button', { name: /^เลือกช่องทางเติมเงิน/ }).click()
  await messages.getByRole('button', { name: 'แก้ไขข้อความ', exact: true }).click()
  await expect(page).toHaveURL(/\/components-v2\?.*message=method_selector/)
  const editor = page.locator('#feature-presentation-editor')
  await expect(editor.getByRole('tab', { name: /เลือกช่องทางเติมเงิน/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(editor.locator('article')).toHaveCount(1)
  await expect(editor.locator('article .wallet-message-header strong')).toHaveText(
    'เลือกช่องทางเติมเงิน',
  )
  await expect(editor.getByRole('textbox', { name: /^หัวข้อ/ })).toHaveValue('เลือกช่องทางเติมเงิน')
})
