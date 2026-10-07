import { expect, test } from '@playwright/test'
import { fixtureResponse } from './fixtures/api'
import type { WalletTopupInvoice } from '../src/features/topup/api'
import { walletSkinTiers } from '../src/features/topup/config/wallet-skins'

for (const theme of ['LIGHT', 'DARK']) {
  test(`renders current-balance wallet skins in ${theme}`, async ({ page, isMobile }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    if (isMobile) await page.setViewportSize({ width: 320, height: 780 })
    await page.route('**/api/v1/wallet/topups**', (route) =>
      route.fulfill({ json: { items: [], nextCursor: null, hasMore: false } }),
    )
    await page.goto('/add-credit?locale=th&role=USER')
    const card = page.locator('.balance-card')
    const profile = page.locator(isMobile ? '.mobile-profile' : '.profile-navbar')
    await expect(card).toBeVisible()
    const profileBackground = await profile.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )
    // The smoke bootstrap preloads auth; update that test store as a balance event would.
    const setBalance = (amount: number) =>
      page.evaluate(async (balance) => {
        const modulePath = '/src/stores/auth.ts'
        const { useAuthStore } = await import(modulePath)
        // Keep the legacy baht field stale to verify that both views use the canonical satang balance.
        useAuthStore().currentUser.walletBalance = 377
        useAuthStore().currentUser.walletBalanceSatang = balance
      }, amount)
    for (const tier of walletSkinTiers) {
      await setBalance(tier.minimumBaht * 100)
      await expect(card).toHaveAttribute('data-wallet-skin', tier.key)
      expect(await profile.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
        profileBackground,
      )
      await expect(card.getByText('ยอดเงินปัจจุบัน')).toBeVisible()
      await expect(card.locator('strong')).toContainText(
        tier.minimumBaht.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      )
      const iconColor = await card
        .locator('.wallet-icon')
        .evaluate((icon) => getComputedStyle(icon).color)
      expect(iconColor).not.toBe('rgba(0, 0, 0, 0)')
      await expect(card.locator('svg.wallet-icon')).toBeVisible()
      const contrast = await card.evaluate((element) => {
        const luminance = (color: string) => {
          const values = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
          const rgb = color.startsWith('color(srgb') ? values : values.map((value) => value / 255)
          const channels = rgb.map((value) =>
            value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
          )
          return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
        }
        const background = luminance(getComputedStyle(element).backgroundColor)
        return [
          ...element.querySelectorAll(
            '.wallet-balance-label, strong, .card-brand, .card-edition, .card-holder, .card-level',
          ),
        ].map((node) => {
          const foreground = luminance(getComputedStyle(node).color)
          return (
            (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)
          )
        })
      })
      expect(contrast.every((ratio) => ratio >= 4.5)).toBe(true)
      const animation = await card.evaluate(
        (element) => getComputedStyle(element, '::after').animationName,
      )
      expect(animation).toBe('none')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      if ([100, 1500, 4000, 5500, 10000].includes(tier.minimumBaht)) {
        if (!isMobile) {
          await profile.hover()
          await expect(profile.locator('.profile-navbar__wallet')).toHaveCSS('opacity', '1')
          await expect(profile.locator('.profile-navbar__amount')).toContainText(
            tier.minimumBaht.toLocaleString('en-US', { minimumFractionDigits: 2 }),
          )
        }
        await profile.screenshot({ path: testInfo.outputPath(`navbar-${tier.key}.png`) })
      }
    }
    // Choosing a deposit must not grant a skin before the balance actually changes.
    await page.goto('/add-credit?locale=en&role=USER')
    await expect(card).toBeVisible()
    await setBalance(37700)
    await expect(card).toHaveAttribute('data-wallet-skin', 'green')
    await page.locator('.amount-grid button').last().click()
    await expect(card).toHaveAttribute('data-wallet-skin', 'green')
    await expect(card.locator('strong')).toContainText('377.00')
    if (!isMobile) {
      await profile.hover()
      await expect(profile.locator('.profile-navbar__amount')).toHaveText('377.00 THB')
    }
    await profile.screenshot({ path: testInfo.outputPath('navbar-neutral-en.png') })
    await profile.click()
    await expect(page.locator('#profile-dialog')).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(profile).toHaveAttribute('aria-expanded', 'true')
    if (!isMobile)
      await expect(profile.locator('.profile-navbar__wallet')).toHaveCSS('opacity', '1')
    await page.keyboard.press('Escape')
    await expect(page.locator('#profile-dialog')).not.toBeVisible()
    await page.keyboard.press('Tab')
    await profile.focus()
    await expect(profile).toBeFocused()
    await expect(profile).toHaveCSS('outline-style', 'solid')
    if (!isMobile)
      await expect(profile.locator('.profile-navbar__wallet')).toHaveCSS('opacity', '1')
    await card.screenshot({ path: testInfo.outputPath('wallet-green-en.png') })
    await setBalance(100000000000)
    await expect(card).toHaveAttribute('data-wallet-skin', 'black')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page
      .locator(isMobile ? '.mobile-navbar .theme-toggle' : '.desktop-navbar .theme-toggle')
      .click()
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      theme === 'DARK' ? 'light' : 'dark',
    )
    expect(await profile.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
      profileBackground,
    )
    expect(
      await card.evaluate((element) => getComputedStyle(element, '::after').animationName),
    ).toBe('none')
    expect(errors).toEqual([])
  })
}

const slipImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=',
  'base64',
)

for (const theme of ['LIGHT', 'DARK']) {
  for (const locale of ['th', 'en']) {
    test(`completes account top-up in ${locale} and ${theme}`, async ({
      page,
      isMobile,
    }, testInfo) => {
      const thai = locale === 'th'
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const previous: WalletTopupInvoice = {
        ...(fixtureResponse('/api/v1/wallet/topups', 'POST', {
          amountSatang: 30000,
        }) as WalletTopupInvoice),
        invoiceId: 'previous-topup',
        invoiceNumber: 'TPU_PREVIOUS',
      }
      let invoice = { ...previous, invoiceId: 'fixture-topup', invoiceNumber: 'TPU_CURRENT' }
      let balance = 100000
      const created: Array<{ amountSatang: number; idempotencyKey: string }> = []
      let verificationRequests = 0
      let resumed = 0
      await page.route('**/api/v1/auth/me', (route) =>
        route.fulfill({
          json: {
            ...(fixtureResponse('/api/v1/auth/me', 'GET', {}) as object),
            walletBalanceSatang: balance,
          },
        }),
      )
      await page.route('**/api/v1/wallet/topups**', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (request.method() === 'POST' && url.pathname.endsWith('/slip')) {
          verificationRequests++
          if (verificationRequests === 1) {
            await route.fulfill({ status: 422, json: { detail: 'Please try another slip.' } })
            return
          }
          balance += invoice.amountSatang
          invoice = {
            ...invoice,
            status: 'SUCCESS',
            balanceSatang: balance,
            completedAt: new Date().toISOString(),
          }
          await route.fulfill({ json: invoice })
        } else if (request.method() === 'POST') {
          const input = request.postDataJSON()
          created.push(input)
          invoice = { ...invoice, amountSatang: input.amountSatang }
          await route.fulfill({ json: invoice })
        } else if (url.pathname.endsWith('/previous-topup')) {
          resumed++
          await route.fulfill({ json: previous })
        } else if (url.pathname.endsWith('/fixture-topup')) {
          await route.fulfill({ json: invoice })
        } else {
          await route.fulfill({
            json: {
              items: url.searchParams.has('cursor')
                ? [
                    {
                      ...previous,
                      invoiceId: 'older-topup',
                      invoiceNumber: 'TPU_OLDER',
                      status: 'EXPIRED',
                    },
                  ]
                : created.length
                  ? [invoice, previous]
                  : [previous],
              nextCursor: url.searchParams.has('cursor') ? null : 'next-page',
              hasMore: !url.searchParams.has('cursor'),
            },
          })
        }
      })
      await page.goto(`/add-credit?locale=${locale}`)
      await page.addStyleTag({
        content: '#__vue-devtools-container__ { display: none !important; }',
      })
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase())
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        thai ? 'เติมเงินเข้ากระเป๋า' : 'Add wallet credit',
      )
      const presets = page.locator('.amount-grid button')
      const custom = page.getByRole('textbox', {
        name: thai ? 'ระบุจำนวนเงินเอง' : 'Custom amount',
      })
      const next = page.locator('.continue-button')
      await custom.fill('9')
      await expect(custom).toHaveAttribute('aria-invalid', 'true')
      await expect(next).toBeDisabled()
      await expect(page.locator('[data-topup-total]')).toHaveText('—')
      await custom.fill('750')
      await expect(page.locator('[data-topup-total]')).toContainText('750.00')
      await presets.nth(2).click()
      await expect(presets.nth(2)).toHaveAttribute('aria-pressed', 'true')
      await expect(custom).toHaveValue('')
      await expect(page.locator('.summary-card')).toContainText('1,300.00')
      await expect(page.locator('.history-item')).toHaveCount(1)
      await page.locator('.history-next').click()
      await expect(page.locator('.history-item')).toHaveCount(1)
      await expect(page.locator('.history-item')).toContainText('TPU_OLDER')
      await expect(page.locator('.history-next')).toBeDisabled()
      await page.locator('.history-previous').click()
      await expect(page.locator('.history-item')).toContainText('TPU_PREVIOUS')
      const fits = async () =>
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
      await page.setViewportSize({ width: isMobile ? 320 : 1366, height: isMobile ? 900 : 1000 })
      await fits()
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath('amount.png'), fullPage: true })
      await next.click()
      expect(created).toHaveLength(1)
      expect(created[0]?.amountSatang).toBe(30000)
      expect(created[0]?.idempotencyKey).toMatch(/^web-topup:/)
      await expect(page.locator('.topup-steps [aria-current="step"]')).toContainText(
        thai ? 'ชำระเงินและส่งสลิป' : 'Pay & upload slip',
      )
      await expect(page.locator('.qr-frame img')).toBeVisible()
      await expect(page.locator('#qr-heading')).toBeFocused()
      expect(
        await page
          .locator('.qr-frame img')
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      ).toBeGreaterThan(0)
      await expect(page.locator('.payment-details')).toContainText('Anawat Boripakhirun')
      const upload = page.getByLabel(thai ? 'เลือกภาพสลิป' : 'Choose your slip image', {
        exact: true,
      })
      const verify = page.locator('.slip-panel > .app-button')
      await expect(verify).toBeDisabled()
      await upload.setInputFiles({
        name: 'bad.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('text'),
      })
      await expect(page.locator('#topup-slip-error')).toBeVisible()
      await expect(verify).toBeDisabled()
      const slip = { name: 'bank-slip.png', mimeType: 'image/png', buffer: slipImage }
      await upload.setInputFiles(slip)
      await expect(page.locator('#topup-slip-error')).toHaveCount(0)
      await expect(page.locator('.slip-selected')).toContainText('bank-slip.png')
      await page.getByRole('button', { name: thai ? 'ลบสลิป' : 'Remove slip', exact: true }).click()
      await expect(verify).toBeDisabled()
      await upload.setInputFiles(slip)
      await expect(verify).toBeEnabled()
      await fits()
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath('payment.png'), fullPage: true })
      if (!isMobile) {
        await page.setViewportSize({ width: 768, height: 1000 })
        await fits()
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await page.screenshot({ path: testInfo.outputPath('payment-tablet.png'), fullPage: true })
        await page.setViewportSize({ width: 1366, height: 1000 })
      }
      await verify.click()
      await expect(page.locator('#topup-slip-error')).toHaveText('Please try another slip.')
      await expect(page.locator('.slip-selected')).toContainText('bank-slip.png')
      await verify.click()
      await expect(page.locator('.success-panel')).toBeVisible()
      await expect(page.locator('#success-heading')).toBeFocused()
      expect(verificationRequests).toBe(2)
      await expect(page.locator('.success-balance')).toContainText('1,300.00')
      await expect(page.locator('.balance-card')).toContainText('1,300.00')
      await expect(
        page.locator('.history-item').filter({ hasText: 'TPU_CURRENT' }).locator('.history-status'),
      ).toHaveAttribute('data-status', 'SUCCESS')
      await fits()
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath('success.png'), fullPage: true })
      await page
        .getByRole('button', { name: thai ? 'เติมเงินอีกครั้ง' : 'Add more credit', exact: true })
        .click()
      await expect(next).toBeVisible()
      await page
        .locator('.history-item')
        .filter({ hasText: 'TPU_PREVIOUS' })
        .locator('.resume-button')
        .click()
      await expect(page.locator('.qr-panel')).toContainText('TPU_PREVIOUS')
      expect(resumed).toBe(1)
      expect(created).toHaveLength(1)
      expect(errors).toEqual([])
    })
  }
}

for (const theme of ['LIGHT', 'DARK']) {
  test(`pages and filters complete top-up history in ${theme}`, async ({
    page,
    isMobile,
  }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const invoices = Array.from({ length: 27 }, (_, i) => ({
      invoiceId: `history-${i}`,
      invoiceNumber: `TPU_HISTORY_${i.toString().padStart(2, '0')}`,
      amountSatang: (i + 1) * 10000,
      currency: 'THB',
      status: ['SUCCESS', 'EXPIRED', 'CANCELLED'][i % 3],
      createdAt: new Date(Date.now() - i * 2 * 86400000).toISOString(),
      completedAt: null,
      expiresAt: new Date(Date.now() - i * 2 * 86400000).toISOString(),
    }))
    const requests: URL[] = []
    await page.route('**/api/v1/wallet/topups*', async (route) => {
      const url = new URL(route.request().url())
      requests.push(url)
      const status = url.searchParams.get('status')
      const from = url.searchParams.get('createdFrom')
      const filtered = invoices.filter(
        (item) =>
          (!status || item.status === status) &&
          (!from || Date.parse(item.createdAt) >= Date.parse(from)),
      )
      const start = Number(url.searchParams.get('cursor') ?? 0)
      const limit = Number(url.searchParams.get('limit'))
      const end = start + limit
      await route.fulfill({
        json: {
          items: filtered.slice(start, end),
          nextCursor: end < filtered.length ? String(end) : null,
          hasMore: end < filtered.length,
        },
      })
    })
    await page.goto('/add-credit?locale=th')
    await page.addStyleTag({ content: '#__vue-devtools-container__ { display: none !important; }' })
    await page.setViewportSize({ width: isMobile ? 320 : 1366, height: 1000 })
    const history = page.locator('.history-section')
    const rows = history.locator('.history-item')
    await expect(rows).toHaveCount(10)
    await expect(rows.first()).toContainText('TPU_HISTORY_00')
    await expect(history.locator('.history-previous')).toBeDisabled()
    await history.locator('.history-next').click()
    await expect(rows.first()).toContainText('TPU_HISTORY_10')
    await expect(rows).toHaveCount(10)
    await expect(history.locator('[aria-current="page"]')).toHaveText('2')
    await expect(page.locator('#topup-history-heading')).toBeFocused()
    await history.locator('.history-next').click()
    await expect(rows).toHaveCount(7)
    await expect(rows.first()).toContainText('TPU_HISTORY_20')
    await expect(history.locator('.history-next')).toBeDisabled()
    await expect(history.locator('[aria-current="page"]')).toHaveText('3')
    await history.screenshot({ path: testInfo.outputPath('history-page-3.png') })
    await history.locator('.history-previous').click()
    await expect(rows.first()).toContainText('TPU_HISTORY_10')
    expect(requests).toHaveLength(3)
    const statusFilter = history.getByRole('combobox', { name: 'สถานะ', exact: true })
    if (isMobile) {
      await statusFilter.click()
      await page.getByRole('option', { name: 'สำเร็จ', exact: true }).click()
    } else {
      await statusFilter.focus()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
    }
    await expect(rows).toHaveCount(9)
    await expect(history.locator('[aria-current="page"]')).toHaveText('1')
    await expect(history.locator('.history-next')).toBeDisabled()
    expect(requests.at(-1)?.searchParams.get('status')).toBe('SUCCESS')
    expect(requests.at(-1)?.searchParams.has('cursor')).toBe(false)
    await history.getByRole('combobox', { name: 'ช่วงเวลา', exact: true }).click()
    await page.getByRole('option', { name: '7 วันที่ผ่านมา', exact: true }).click()
    await expect(rows).toHaveCount(2)
    expect(requests.at(-1)?.searchParams.get('status')).toBe('SUCCESS')
    expect(requests.at(-1)?.searchParams.has('createdFrom')).toBe(true)
    const statuses = await history
      .locator('.history-status')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-status')))
    expect(statuses).toEqual(['SUCCESS', 'SUCCESS'])
    await history.screenshot({ path: testInfo.outputPath('history-filtered.png') })
    await statusFilter.click()
    await page.getByRole('option', { name: 'ไม่สำเร็จ', exact: true }).click()
    await expect(rows).toHaveCount(0)
    await expect(history).toContainText('ไม่พบรายการที่ตรงกับตัวกรอง')
    await history.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click()
    await expect(rows).toHaveCount(10)
    await expect(statusFilter).toContainText('ทุกสถานะ')
    await expect(history.getByRole('combobox', { name: 'ช่วงเวลา', exact: true })).toContainText(
      'ทั้งหมด',
    )
    expect(requests.at(-1)?.searchParams.has('status')).toBe(false)
    expect(requests.at(-1)?.searchParams.has('createdFrom')).toBe(false)
    expect(requests.at(-1)?.searchParams.get('limit')).toBe('10')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await history.screenshot({ path: testInfo.outputPath('history-all.png') })
  })
}
