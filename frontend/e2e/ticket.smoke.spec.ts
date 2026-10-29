import { expect, test } from '@playwright/test'
import { ticketFixture } from '../src/__tests__/fixtures/ticket'

for (const theme of ['LIGHT', 'DARK']) {
  test(`configures ticket topics, forms and timers in ${theme}`, async ({
    page,
    isMobile,
  }, testInfo) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const { ticketLicense, config } = ticketFixture()
    let saved: { values: Record<string, unknown> } | undefined
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [ticketLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [ticketLicense], nextCursor: null, hasMore: false } }),
    )
    await page.route('**/configuration', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        for (const field of config.fields)
          field.value = saved!.values[field.key] as typeof field.value
        config.revision++
      }
      await route.fulfill({ json: config })
    })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=en')
    const form = page.locator('[data-ticket-config]')
    async function category(name: string) {
      if (isMobile) {
        await form.getByRole('combobox', { name: 'Settings category', exact: true }).click()
        await page.getByRole('option', { name, exact: true }).click()
      } else await form.getByRole('tab', { name, exact: true }).click()
    }
    const save = page.getByRole('button', { name: 'Save all', exact: true })
    await expect(form).toBeVisible()
    await expect(
      page
        .locator('#feature-presentations')
        .getByRole('button', { name: 'เลือกหัวข้อเพื่อเปิดตั๋ว' }),
    ).toBeVisible()
    await expect(save).toBeDisabled()
    await form
      .getByRole('textbox', { name: 'Topic emoji', exact: true })
      .first()
      .fill('<:cart:123456789012345678>')
    await form
      .getByRole('textbox', { name: /^Channel name template/ })
      .first()
      .fill('order-{{username}}-{{id}}')
    await expect(form.getByRole('spinbutton', { name: 'Auto-close (minutes)' })).toHaveCount(0)
    await form.getByRole('switch', { name: 'Enable auto-close for สั่งซื้อ', exact: true }).click()
    await form.getByRole('spinbutton', { name: 'Auto-close (minutes)' }).first().fill('30')
    await form
      .getByRole('textbox', { name: /^Question/ })
      .first()
      .fill('Product and quantity')
    await form.getByRole('button', { name: 'Add question (up to 5)' }).first().click()
    await expect(save).toBeDisabled()
    await form
      .getByRole('textbox', { name: /^Question/ })
      .nth(1)
      .fill('Additional details')
    await expect(save).toBeEnabled()
    const roles = form.getByRole('textbox', { name: 'Support role IDs' }).first()
    await roles.fill('222222222222222222, ')
    await roles.pressSequentially('333333333333333333')
    await expect(roles).toHaveValue('222222222222222222, 333333333333333333')
    const timerMode = form.getByRole('combobox', { name: 'Count time from' }).first()
    await timerMode.click()
    await page.getByRole('option', { name: 'Ticket opening', exact: true }).click()
    await form.getByRole('textbox', { name: 'Discord category ID' }).first().fill('invalid')
    await expect(save).toBeDisabled()
    await form
      .getByRole('textbox', { name: 'Discord category ID' })
      .first()
      .fill('111111111111111111')
    await expect(save).toBeEnabled()
    await expect(form.getByRole('status')).toHaveCount(0)
    await category('Ticket behaviour')
    const limit = form.getByRole('spinbutton', { name: 'Max open tickets per user', exact: true })
    await expect(limit).toHaveValue('1')
    await limit.fill('0')
    await expect(save).toBeDisabled()
    await limit.fill('3')
    await form.getByRole('switch', { name: 'Confirm before closing', exact: true }).click()
    await form
      .getByRole('textbox', { name: 'Roles allowed to close', exact: true })
      .fill('222222222222222222')
    await form
      .getByRole('textbox', { name: 'Users allowed to close', exact: true })
      .fill('333333333333333333')
    await form.screenshot({
      path: testInfo.outputPath(`ticket-behavior-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
    })
    await category('History')
    const discordHistory = form.getByRole('switch', { name: 'Enable Discord history', exact: true })
    await expect(discordHistory).not.toBeChecked()
    await discordHistory.click()
    await category('Topics & forms')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await form.screenshot({
      path: testInfo.outputPath(`ticket-${theme.toLowerCase()}.png`),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
    })
    await save.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm save', exact: true })
      .click()
    await expect(save).toBeDisabled()
    expect(saved?.values.TICKET_DISCORD_HISTORY_ENABLED).toBe(true)
    expect(saved?.values.TICKET_BEHAVIOR).toEqual({
      maxOpenPerUser: 3,
      confirmClose: false,
      closeRoleIds: ['222222222222222222'],
      closeUserIds: ['333333333333333333'],
    })
    expect(saved?.values.TICKET_CATEGORIES).toMatchObject([
      {
        key: 'order',
        emoji: '<:cart:123456789012345678>',
        channelNameTemplate: 'order-{{username}}-{{id}}',
        autoCloseMinutes: 30,
        autoCloseMode: 'OPENED',
        supportRoleIds: ['222222222222222222', '333333333333333333'],
        formEnabled: true,
        fields: [{ label: 'Product and quantity' }, { label: 'Additional details' }],
      },
      { key: 'support', formEnabled: true, autoCloseMinutes: 0 },
    ])
    await form.getByRole('button', { name: 'Add topic', exact: true }).click()
    await expect(save).toBeDisabled()
    await form.getByRole('button', { name: 'Delete topic 3', exact: true }).click()
    await expect(save).toBeDisabled()
    expect(errors).toEqual([])
  })
}
