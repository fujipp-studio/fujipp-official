import { expect, test } from '@playwright/test'
import {
  robloxPayoutConfiguration,
  robloxPayoutLicense,
} from '../src/__tests__/fixtures/robloxPayout'

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'retries preview images without assuming old Discord links are expired in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const expired =
        'https://media.discordapp.net/attachments/1/2/image.png?ex=6abe0f04&hm=fixture'
      const fresh = 'https://media.discordapp.net/attachments/1/2/image.png?ex=ffffffff&hm=fixture'
      const config = structuredClone(robloxPayoutConfiguration)
      let available = false
      config.presentations[0]!.defaultDefinition.image_url = expired
      await page.route('https://media.discordapp.net/attachments/**', (route) =>
        route.request().url() === expired && !available
          ? route.fulfill({ status: 404, body: 'This content is no longer available.' })
          : route.fulfill({
              contentType: 'image/svg+xml',
              body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#cccccc"/><text x="40" y="100">Preview image loaded</text></svg>',
            }),
      )
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [robloxPayoutLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [robloxPayoutLicense], nextCursor: null, hasMore: false } }),
      )
      await page.route('**/configuration', (route) => route.fulfill({ json: config }))
      await page.goto(
        '/my-bot/fixture-bot/settings/packages/fixture-license/embed?locale=en&message=panel_1',
      )
      const editor = page.locator('#feature-presentation-editor')
      await editor.locator('[data-section="images"] summary').click()
      await expect(editor.locator('[data-section="images"]')).not.toContainText('expired')
      const imageField = editor.getByRole('textbox', { name: 'Image URL', exact: true })
      await expect(imageField).toHaveValue(expired)
      await expect(page.getByRole('button', { name: 'Save all', exact: true })).toBeDisabled()
      if (isMobile) await editor.getByRole('button', { name: 'Preview', exact: true }).click()
      const pane = editor.locator('.embed-preview-pane')
      await expect(pane.locator('[data-preview-image-error]')).toContainText(
        'Image could not be loaded in this preview',
      )
      await expect(pane.locator('[data-preview-image-error]')).not.toContainText('expired')
      await pane.screenshot({
        path: testInfo.outputPath('image-load-failed.png'),
        animations: 'disabled',
        scale: 'css',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      })
      available = true
      const retry = pane.getByRole('button', { name: 'Try again', exact: true })
      await retry.focus()
      await retry.press('Enter')
      await expect(pane.locator('img.preview-image')).toHaveAttribute('src', expired)
      await expect
        .poll(() =>
          pane
            .locator('img.preview-image')
            .evaluate((element) => (element as HTMLImageElement).naturalWidth),
        )
        .toBe(320)
      await expect(pane.locator('[data-preview-image-error]')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Save all', exact: true })).toBeDisabled()
      if (isMobile) await editor.getByRole('button', { name: 'Edit', exact: true }).click()
      await imageField.fill(fresh)
      await expect(editor.locator('[data-section="images"]')).not.toContainText('expired')
      if (isMobile) await editor.getByRole('button', { name: 'Preview', exact: true }).click()
      const image = pane.locator('img.preview-image')
      await expect(image).toHaveAttribute('src', fresh)
      await expect
        .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
        .toBe(320)
      await expect(pane.locator('[data-preview-image-error]')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await pane.screenshot({
        path: testInfo.outputPath('image-loaded.png'),
        animations: 'disabled',
        scale: 'css',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
      })
    },
  )
}

for (const theme of ['LIGHT', 'DARK']) {
  test(
    'edits Roblox payout across categories in ' + theme,
    async ({ page, isMobile }, testInfo) => {
      const invalidProps: string[] = []
      page.on('console', (message) => {
        if (message.text().includes('Invalid prop:')) invalidProps.push(message.text())
      })
      if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const config = structuredClone(robloxPayoutConfiguration)
      let saved:
        | {
            values: Record<string, unknown>
            secrets: Record<string, unknown>
            presentations: Record<string, Record<string, unknown>>
          }
        | undefined
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [robloxPayoutLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [robloxPayoutLicense], nextCursor: null, hasMore: false } }),
      )
      await page.route('**/configuration', async (route) => {
        if (route.request().method() === 'PUT') {
          saved = route.request().postDataJSON()
          for (const field of config.fields)
            if (!field.secret) field.value = saved!.values[field.key] as typeof field.value
          for (const slot of config.presentations)
            slot.overrideDefinition = saved!.presentations[slot.key]!
          config.revision++
        }
        await route.fulfill({ json: config })
      })
      await page.goto(
        '/my-bot/fixture-bot/settings/packages/fixture-license?locale=en&message=panel_2',
      )
      const form = page.locator('[data-roblox-payout-config]')
      const save = page.getByRole('button', { name: 'Save all', exact: true })
      const category = async (name: string) => {
        if (isMobile) {
          await form.getByRole('combobox', { name: 'Settings category', exact: true }).click()
          await page.getByRole('option', { name, exact: true }).click()
        } else await form.getByRole('tab', { name, exact: true }).click()
      }
      const capture = async (name: string) => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        await form.screenshot({
          path: testInfo.outputPath(name + '.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
        })
      }
      await expect(save).toBeDisabled()
      const salesToggle = form.getByRole('switch', { name: 'Accept new purchases', exact: true })
      await salesToggle.click()
      await expect(save).toBeEnabled()
      await salesToggle.click()
      await expect(save).toBeDisabled()
      for (const name of ['Roblox groups', 'Panels', 'Discord', 'Commands', 'Sales'])
        await category(name)
      await expect(save).toBeDisabled()
      await form.getByRole('spinbutton', { name: /Default Robux rate/ }).fill('0')
      await expect(form).toContainText('Enter a value within the allowed range.')
      await form.getByRole('spinbutton', { name: /Default Robux rate/ }).fill('4.25')
      await form.getByRole('spinbutton', { name: /Package 1/ }).fill('400')
      await expect(form.locator('output').first()).toHaveText('฿100–฿115')
      await expect(form.locator('.packages-editor__row').first()).toHaveCSS('display', 'grid')
      await expect(form.locator('.packages-editor__delete').first()).toHaveCSS('width', '40px')
      const viewport = page.viewportSize()!
      await page.setViewportSize({ width: 768, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await page.setViewportSize(viewport)
      await capture('sales')
      await category('Roblox groups')
      const group = form.locator('.roblox-group').first()
      await expect(form.locator('.roblox-group').nth(1)).not.toHaveAttribute('open')
      await expect(group.locator('.roblox-group__section--security')).not.toHaveAttribute('open')
      await group.getByRole('textbox', { name: /Group name/ }).fill('Updated Group')
      await group.getByRole('spinbutton', { name: /Robux rate/ }).fill('4.25')
      await group.locator('.roblox-group__credentials-heading').click()
      await expect(group.locator('input[type="password"]').first()).toHaveValue('')
      await group.locator('.roblox-group__credentials-heading').click()
      await capture('groups')
      await category('Panels')
      await form
        .getByRole('textbox', { name: /Panel name/ })
        .first()
        .fill('Updated shop')
      await form
        .getByRole('combobox', { name: /Panel mode/ })
        .first()
        .click()
      await page.getByRole('option', { name: 'Membership check only', exact: true }).click()
      await capture('panels')
      await category('Commands')
      await form.getByRole('textbox', { name: /Command name/ }).fill('my-robux')
      await expect(form.locator('[data-feature-command-list]')).toContainText('/my-robux')
      await expect(form).toContainText('/robux-receipt')
      await capture('commands')
      await category('Roblox groups')
      await expect(form.getByRole('textbox', { name: /Group name/ }).first()).toHaveValue(
        'Updated Group',
      )
      await save.click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Confirm save', exact: true })
        .click()
      await expect(save).toBeDisabled()
      expect(saved?.values.ROBUX_RATE).toBe(4.25)
      expect(saved?.values.ROBLOX_GROUPS).toEqual([
        { key: 'main', name: 'Updated Group', groupId: 12345, rate: 4.25, future: 'preserved' },
        { key: 'premium', name: 'Premium Group', groupId: 23456, rate: 4 },
      ])
      expect(saved?.values.ROBUX_PACKAGES).toEqual([
        { robux: 400, future: 'preserved' },
        { robux: 700 },
      ])
      expect((saved!.values.ROBUX_PANELS as Record<string, unknown>[])[0]).toEqual({
        key: 'main',
        name: 'Updated shop',
        groupKeys: ['main', 'premium'],
        presentationSlot: 'panel_1',
        mode: 'membership_only',
        future: 'preserved',
      })
      expect(saved?.values.FUTURE_ROBUX_SETTING).toBe('keep-this')
      expect(saved?.secrets).toEqual({})
      await page.reload()
      await expect(save).toBeDisabled()
      const messages = page.locator('#feature-presentations')
      await expect(
        messages.getByRole('heading', { name: 'Membership check', exact: true }),
      ).toBeVisible()
      if (isMobile) {
        await messages.getByRole('combobox', { name: 'Message', exact: true }).click()
        await page.getByRole('option', { name: 'Updated shop', exact: true }).click()
      } else await messages.getByRole('button', { name: /^Updated shop/ }).click()
      await messages.screenshot({
        path: testInfo.outputPath('messages.png'),
        animations: 'disabled',
        scale: 'css',
      })
      await messages.getByRole('button', { name: 'Edit message', exact: true }).click()
      await expect(page).toHaveURL(/\/embed\?.*message=panel_1/)
      await expect(
        page
          .locator('#feature-presentation-editor')
          .getByRole('textbox', { name: 'Title', exact: true }),
      ).toHaveValue('Robux shop')
      expect(invalidProps).toEqual([])
    },
  )
}

for (const version of ['1.0.0', '2.2.0']) {
  test('shows version-appropriate Roblox controls for ' + version, async ({ page, isMobile }) => {
    const license = { ...robloxPayoutLicense, version }
    const config = structuredClone(robloxPayoutConfiguration)
    config.fields = config.fields.filter(
      (field) =>
        field.key !== 'ROBUX_PANELS' &&
        (version !== '1.0.0' || field.key !== 'ROBUX_RECEIPT_CHANNEL_ID'),
    )
    await page.route('**/api/v1/feature-licenses', (route) => route.fulfill({ json: [license] }))
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: [license], nextCursor: null, hasMore: false } }),
    )
    await page.route('**/configuration', (route) => route.fulfill({ json: config }))
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=en')
    const form = page.locator('[data-roblox-payout-config]')
    const category = async (name: string) => {
      if (isMobile) {
        await form.getByRole('combobox', { name: 'Settings category', exact: true }).click()
        await expect(page.getByRole('option', { name: 'Panels', exact: true })).toHaveCount(0)
        await page.getByRole('option', { name, exact: true }).click()
      } else {
        await expect(form.getByRole('tab', { name: 'Panels', exact: true })).toHaveCount(0)
        await form.getByRole('tab', { name, exact: true }).click()
      }
    }
    await category('Roblox groups')
    await expect(form.getByRole('spinbutton', { name: /Robux rate/ })).toHaveCount(0)
    await form.locator('.roblox-group__credentials-heading').first().click()
    await expect(form.getByLabel('Roblox Open Cloud API Key', { exact: true })).toHaveCount(
      version === '1.0.0' ? 0 : 2,
    )
    await category('Commands')
    await expect(form.locator('[data-feature-command-list]')).toContainText('/robux-panel')
    if (version === '1.0.0') await expect(form).not.toContainText('/robux-receipt')
    else await expect(form).toContainText('/robux-receipt')
    await expect(page.getByRole('button', { name: 'Save all', exact: true })).toBeDisabled()
  })
}
