import { expect, test, type Locator } from '@playwright/test'
import { configuration, license } from '../src/__tests__/fixtures/domain'

for (const theme of ['LIGHT', 'DARK']) {
  test('edits Bot Permissions rules in ' + theme, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
    const permissionLicense = {
      ...license,
      featureCode: 'bot-permissions',
      featureName: 'Bot Permissions',
      version: '1.0.0',
    }
    const installedLicenses = [
      permissionLicense,
      {
        ...license,
        id: 'fixture-spending',
        featureCode: 'member-spending',
        featureName: 'Member Spending Card',
        version: '1.0.0',
      },
      {
        ...license,
        id: 'fixture-voice',
        featureCode: 'voice-keeper',
        featureName: 'Voice Keeper',
        version: '1.0.0',
      },
      {
        ...license,
        id: 'fixture-review',
        featureCode: 'review-credit',
        featureName: 'Review Credit',
        version: '1.1.0',
      },
      {
        ...license,
        id: 'fixture-presence',
        featureCode: 'bot-presence',
        featureName: 'Bot Presence',
        version: '1.0.0',
      },
      {
        ...license,
        id: 'other-wallet',
        installations: [{ ...license.installations[0]!, botId: 'another-bot' }],
      },
    ]
    await page.route('**/api/v1/feature-licenses', (route) =>
      route.fulfill({ json: installedLicenses }),
    )
    await page.route('**/api/v2/feature-licenses*', (route) =>
      route.fulfill({ json: { items: installedLicenses, nextCursor: null, hasMore: false } }),
    )
    const draft = structuredClone(configuration)
    const originalRules = [
      {
        command: 'spending/add',
        roleIds: ['123456789012345678'],
        userIds: [],
        metadata: { preserve: true },
      },
      { command: '*', roleIds: [], userIds: [] },
    ]
    draft.presentations = []
    draft.fields = [
      {
        key: 'COMMAND_PERMISSION_RULES',
        label: 'Command permissions',
        description: '',
        type: 'JSON',
        required: true,
        secret: false,
        value: originalRules,
        defaultValue: [],
        configured: true,
        validation: { maxItems: 100 },
        ui: { control: 'command-permissions' },
      },
    ]
    let saved: { values: Record<string, unknown> } | undefined
    await page.route('**/configuration', async (route) => {
      if (route.request().url().includes('/fixture-voice/')) {
        await route.fulfill({
          json: {
            ...draft,
            fields: [
              {
                ...draft.fields[0]!,
                key: 'COMMAND_NAME',
                type: 'STRING',
                value: 'lounge',
                defaultValue: 'voice',
              },
            ],
          },
        })
        return
      }
      if (route.request().url().includes('/fixture-review/')) {
        await route.fulfill({ status: 503, json: { message: 'Unavailable' } })
        return
      }
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON()
        draft.fields[0]!.value = saved!.values
          .COMMAND_PERMISSION_RULES as (typeof draft.fields)[0]['value']
        draft.revision++
      }
      await route.fulfill({ json: draft })
    })
    await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
    // The development-only DevTools overlay can intercept clicks on teleported menus.
    await page.addStyleTag({ content: '#__vue-devtools-container__ { display: none !important; }' })
    const form = page.locator('#feature-config')
    const rules = form.locator('.permission-rule')
    async function choose(control: Locator, label: string) {
      await control.click()
      const list = page.getByRole('listbox')
      await list.getByRole('option', { name: label, exact: true }).click()
      await expect(list).toBeHidden()
    }
    const saveAll = page.getByRole('button', { name: 'บันทึกทั้งหมด', exact: true })
    await expect(rules).toHaveCount(2)
    await expect(rules.first()).toHaveAttribute('open')
    await expect(rules.last()).not.toHaveAttribute('open')
    await expect(saveAll).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'ออกแบบข้อความ' })).toHaveCount(0)
    const firstFeature = rules.first().getByRole('combobox', { name: 'Feature', exact: true })
    const firstCommand = rules.first().getByRole('combobox', { name: /^คำสั่ง/ })
    await expect(firstFeature).toHaveText('Member Spending Card')
    await expect(firstCommand).toHaveText('/spending add')
    await expect(form.locator('select')).toHaveCount(0)
    await firstFeature.press('ArrowDown')
    const featureList = page.getByRole('listbox', { name: 'Feature', exact: true })
    await expect(
      featureList.getByRole('option', { name: 'Wallet Topup', exact: true }),
    ).toHaveCount(0)
    await expect(
      featureList.getByRole('option', { name: 'Bot Presence', exact: true }),
    ).toHaveCount(0)
    await expect(featureList.getByRole('option', { name: /Review Credit/ })).toBeDisabled()
    await firstFeature.press('ArrowDown')
    await firstFeature.press('Enter')
    await expect(featureList).toBeHidden()
    await expect(firstFeature).toHaveText('Voice Keeper')
    await expect(saveAll).toBeDisabled()
    await firstCommand.press('ArrowDown')
    await expect(page.getByRole('option', { name: '/lounge join', exact: true })).toBeVisible()
    await firstCommand.press('ArrowDown')
    await firstCommand.press('Enter')
    await expect(page.getByRole('listbox')).toBeHidden()
    await expect(firstCommand).toHaveText('/lounge join')
    await expect(saveAll).toBeEnabled()
    await choose(firstFeature, 'Member Spending Card')
    await choose(firstCommand, '/spending')
    await expect(
      rules.first().getByText('ทุกคำสั่งย่อยของ /spending', { exact: true }),
    ).toBeVisible()
    await choose(firstCommand, '/spending add')
    await expect(saveAll).toBeDisabled()
    const roles = rules.first().getByRole('textbox', { name: 'Role IDs', exact: true })
    await roles.focus()
    await roles.press('End')
    await roles.pressSequentially(', 987654321098765432')
    await expect(roles).toHaveValue('123456789012345678, 987654321098765432')
    await expect(saveAll).toBeEnabled()
    await roles.fill('123456789012345678')
    await expect(saveAll).toBeDisabled()
    await roles.fill('123456789012345678, 987654321098765432')
    await rules.last().locator('summary').focus()
    await rules.last().locator('summary').press('Enter')
    await expect(rules.last()).toHaveAttribute('open')
    await expect(rules.first()).not.toHaveAttribute('open')
    await expect(rules.last().locator('summary')).toContainText('เฉพาะ Administrator')
    await expect(rules.last().getByRole('combobox', { name: 'Feature', exact: true })).toHaveText(
      'ทุกคำสั่ง (*)',
    )
    await rules.last().getByRole('button', { name: 'ลบ Rule 2', exact: true }).click()
    await expect(rules).toHaveCount(1)
    await form.getByRole('button', { name: 'เพิ่ม Rule', exact: true }).click()
    const feature = rules.last().getByRole('combobox', { name: 'Feature', exact: true })
    await expect(feature).toBeFocused()
    await expect(feature).toHaveText('เลือก Feature')
    await choose(feature, 'กำหนดคำสั่งเอง')
    const command = rules.last().getByRole('textbox', { name: 'Command / Subcommand', exact: true })
    await command.fill('wallet/balance')
    await choose(feature, 'ทุกคำสั่ง (*)')
    await expect(rules.last().locator('summary')).toContainText('*')
    await choose(feature, 'Voice Keeper')
    await choose(rules.last().getByRole('combobox', { name: /^คำสั่ง/ }), '/lounge join')
    const users = rules.last().getByRole('textbox', { name: 'User IDs', exact: true })
    await users.fill('invalid')
    await expect(users).toHaveAttribute('aria-invalid', 'true')
    await users.fill('111111111111111111')
    await expect(users).not.toHaveAttribute('aria-invalid')
    await expect(rules.last().locator('summary')).toContainText('0 Role · 1 User')
    await expect(rules.first().locator(':scope > div')).toBeHidden()
    await users.blur()
    await page.evaluate(() => document.fonts.ready)
    for (const width of [1366, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
        true,
      )
      if (width !== 768)
        await form.screenshot({
          path: testInfo.outputPath('bot-permissions-' + width + '.png'),
          animations: 'disabled',
          scale: 'css',
          style:
            '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .vue-devtools__anchor { visibility: hidden !important; }',
        })
      const commandControl = rules.last().getByRole('combobox', { name: /^คำสั่ง/ })
      await commandControl.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        window.scrollTo(0, window.scrollY + rect.bottom - (window.innerHeight - 16))
      })
      await commandControl.click()
      const listbox = page.getByRole('listbox')
      await expect(listbox.getByRole('option', { name: '/lounge join', exact: true })).toBeVisible()
      await expect(listbox).not.toHaveClass(/text-field-dropdown-enter-/)
      expect(
        await listbox.evaluate((element) => element.getBoundingClientRect().right <= innerWidth),
      ).toBe(true)
      await expect
        .poll(() =>
          listbox.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            return rect.top >= 0 && rect.bottom <= window.innerHeight
          }),
        )
        .toBe(true)
      if (width !== 768)
        await page.screenshot({
          path: testInfo.outputPath('bot-permissions-dropdown-' + width + '.png'),
          animations: 'disabled',
          scale: 'css',
        })
      await commandControl.press('Escape')
      await expect(listbox).toBeHidden()
    }
    await saveAll.click()
    expect(saved).toBeUndefined()
    await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก', exact: true }).click()
    await expect(saveAll).toBeEnabled()
    await saveAll.click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยันการบันทึก', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(saveAll).toBeDisabled()
    expect(saved?.values.COMMAND_PERMISSION_RULES).toEqual([
      {
        command: 'spending/add',
        roleIds: ['123456789012345678', '987654321098765432'],
        userIds: [],
        metadata: { preserve: true },
      },
      { command: 'lounge/join', roleIds: [], userIds: ['111111111111111111'] },
    ])
    await form.getByRole('button', { name: 'ลบ Rule 2', exact: true }).click()
    await form.getByRole('button', { name: 'ลบ Rule 1', exact: true }).click()
    await expect(form.getByText('ยังไม่มีกฎเพิ่มเติม')).toBeVisible()
    await expect(form.getByRole('button', { name: 'เพิ่ม Rule', exact: true })).toBeFocused()
    expect(errors).toEqual([])
  })
}
