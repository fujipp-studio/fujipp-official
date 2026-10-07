import { expect, test } from '@playwright/test'
import { messageSetsFixture } from '../src/__tests__/fixtures/messageSets'

const table =
  'ราคาตามป้าย   ราคาที่รับ\n209          55\n250          69\n295          75\n459          165'
const markdown = `🦋 __**แบบแยกชิ้น**__\n🧁 · price for effect profile, avatar, nameplate\n\`\`\`\n${table}\n\`\`\`\nInline: \`**literal** ||code||\`\n||**ราคาพิเศษ**|| · ||ซ่อนข้อความนี้||\n\`\`\`text\nLong code line: ${'column   '.repeat(16)}\n\`\`\``

for (const theme of ['LIGHT', 'DARK']) {
  for (const mode of ['EMBED', 'COMPONENTS_V2']) {
    test(`${mode} Markdown in ${theme}`, async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      const { setsLicense, config } = messageSetsFixture()
      config.presentations[0]!.defaultDefinition = {
        mode,
        embed: { title: 'Discord Markdown', description: markdown },
        components_v2: {
          components: [{ type: 17, components: [{ type: 10, content: markdown }] }],
        },
      }
      await page.route('**/api/v1/feature-licenses', (route) =>
        route.fulfill({ json: [setsLicense] }),
      )
      await page.route('**/api/v2/feature-licenses*', (route) =>
        route.fulfill({ json: { items: [setsLicense], nextCursor: null, hasMore: false } }),
      )
      await page.route('**/configuration', (route) => route.fulfill({ json: config }))
      await page.goto('/my-bot/fixture-bot/settings/packages/fixture-license?locale=th')
      await page.addStyleTag({
        content: '#__vue-devtools-container__ { display: none !important; }',
      })
      await page
        .locator('#feature-presentations')
        .getByRole('button', { name: 'แก้ไขข้อความ', exact: true })
        .click()
      if (mode === 'EMBED' && testInfo.project.name === 'mobile')
        await page.getByRole('button', { name: 'ตัวอย่าง', exact: true }).click()
      const preview = page.locator('.preview-shell:visible').first()
      const block = preview.locator('pre code').first()
      await expect(block).toHaveText(table)
      await expect(block).toHaveCSS('white-space', 'pre')
      await expect(preview.locator('code').nth(1)).toHaveText('**literal** ||code||')
      const spoiler = preview.locator('button.discord-text-spoiler').first()
      await expect(spoiler).toHaveAttribute('aria-label', 'เปิดข้อความสปอยล์')
      await expect(spoiler.locator('span')).toHaveCSS('visibility', 'hidden')
      await spoiler.focus()
      await page.keyboard.press('Enter')
      await expect(spoiler).toHaveAttribute('aria-expanded', 'true')
      await expect(spoiler.locator('span').first()).toHaveCSS('visibility', 'visible')
      await page.keyboard.press('Space')
      await expect(spoiler).toHaveAttribute('aria-expanded', 'false')
      await spoiler.click()
      await expect(spoiler).toHaveAttribute('aria-expanded', 'true')
      expect(
        await preview
          .locator('pre')
          .last()
          .evaluate((element) => element.scrollWidth > element.clientWidth),
      ).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await preview.screenshot({
        path: testInfo.outputPath(
          `discord-markdown-${mode.toLowerCase()}-${theme.toLowerCase()}.png`,
        ),
        animations: 'disabled',
        style:
          '.navbar, .admin-tools, .app-scroll-rail, .section-indicator, .app-toast { visibility: hidden !important; }',
      })
      expect(errors).toEqual([])
    })
  }
}
