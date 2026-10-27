import { expect, test } from '@playwright/test'
import { configuration, license } from '../src/__tests__/fixtures/domain'

for (const theme of ['LIGHT', 'DARK']) {
  test(`configures Role Shop with shared Wallet in ${theme}`, async ({
    page,
    isMobile,
  }, testInfo) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const roleLicense = {
      ...license,
      featureCode: 'role-shop',
      featureName: 'Role Shop',
      version: '1.0.0',
    }
    const config = structuredClone(configuration)
    config.fields = [
      {
        key: 'ROLE_SHOP_PRODUCTS',
        type: 'JSON',
        value: [
          {
            key: 'vip',
            name: 'VIP',
            roleId: '333333333333333333',
            priceSatang: 10000,
            future: 'keep',
          },
        ],
      },
      { key: 'ROLE_SHOP_COMMAND_NAME', type: 'STRING', value: 'role-shop-panel' },
      { key: 'ROLE_SHOP_NOTIFICATION_CHANNEL_ID', type: 'CHANNEL_ID', value: null },
    ].map((field) => ({
      ...field,
      label: field.key,
      description: '',
      required: false,
      secret: false,
      defaultValue: field.value,
      configured: true,
      validation: null,
      ui: null,
    }))
    config.presentations = []
    let saved: { values: Record<string, unknown> } | undefined
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: [roleLicense] }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [roleLicense], nextCursor: null, hasMore: false } }),
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
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=en')
    const form = page.locator('[data-role-shop-config]')
    const save = page.getByRole('button', { name: 'Save all', exact: true })
    await expect(form).toBeVisible()
    await expect(save).toBeDisabled()
    const rows = form.locator('[data-role-product]')
    await rows.first().getByRole('spinbutton', { name: 'Price (THB)' }).fill('100.25')
    await expect(save).toBeEnabled()
    await form.getByRole('button', { name: 'Add role', exact: true }).click()
    await expect(save).toBeDisabled()
    await rows.nth(1).getByRole('textbox', { name: 'Display name' }).fill('Premium')
    await rows.nth(1).getByRole('textbox', { name: 'Discord Role ID' }).fill('333333333333333333')
    await rows.nth(1).getByRole('spinbutton', { name: 'Price (THB)' }).fill('250.25')
    await expect(save).toBeDisabled()
    await rows.nth(1).getByRole('textbox', { name: 'Discord Role ID' }).fill('444444444444444444')
    await expect(save).toBeEnabled()
    await expect(form.getByRole('status')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await form.screenshot({
      path: testInfo.outputPath('role-shop-settings.png'),
      animations: 'disabled',
      style:
        '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
    })
    await save.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm save', exact: true })
      .click()
    await expect(save).toBeDisabled()
    expect(saved?.values.ROLE_SHOP_PRODUCTS).toMatchObject([
      { key: 'vip', name: 'VIP', priceSatang: 10025, future: 'keep' },
      { name: 'Premium', roleId: '444444444444444444', priceSatang: 25025 },
    ])
  })
}
