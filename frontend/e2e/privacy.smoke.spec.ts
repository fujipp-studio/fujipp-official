import { expect, test } from '@playwright/test'

for (const theme of ['LIGHT', 'DARK']) {
  for (const locale of ['en', 'th']) {
    test(`reads Privacy from the footer as a guest in ${locale} ${theme}`, async ({
      page,
    }, testInfo) => {
      const th = locale === 'th'
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript((value) => localStorage.setItem('fujipp-theme-mode', value), theme)
      await page.goto(`/?locale=${locale}&role=GUEST`)
      await page.evaluate(() => Reflect.set(window, 'privacyNavigationCheck', true))
      const footer = page.getByRole('contentinfo')
      const links = footer.getByRole('navigation')
      await expect(links.getByRole('link')).toHaveText([
        'LinkedIn',
        'GitHub',
        'Instagram',
        'Discord',
        'Terms',
        'Privacy',
      ])
      await expect(links.getByRole('link', { name: 'Terms', exact: true })).toHaveAttribute(
        'href',
        locale === 'th' ? '/terms?locale=th' : '/terms',
      )
      for (const [name, href] of [
        ['LinkedIn', 'https://www.linkedin.com/in/anawat-boripakhirun-aa1799426'],
        ['GitHub', 'https://github.com/Fujipp'],
        ['Instagram', 'https://www.instagram.com/fujipp.official/'],
        ['Discord', 'https://discord.gg/nRn7YDwGSH'],
      ]) {
        const link = links.getByRole('link', { name, exact: true })
        await expect(link).toHaveAttribute('href', href!)
        await expect(link).toHaveAttribute('target', '_blank')
      }
      await links.getByRole('link', { name: 'Privacy', exact: true }).click()
      await expect(page).toHaveURL(/\/privacy(?:\?|$)/)
      expect(await page.evaluate(() => Reflect.get(window, 'privacyNavigationCheck'))).toBe(true)
      await expect(
        page.getByRole('heading', { name: th ? 'ความเป็นส่วนตัว' : 'Privacy.', exact: true }),
      ).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase())
      await expect(page).toHaveTitle('Privacy | Fujipp')
      await expect(page.locator('article section')).toHaveCount(10)
      await expect(page.locator('article')).toContainText(
        th ? 'อนวัตร บริภักดิ์หิรัณย์' : 'Anawat Boripakhirun',
      )
      const minimumReadingWidth = Math.min(600, page.viewportSize()!.width - 32)
      expect(
        (await page.locator('main > header > p').last().boundingBox())!.width,
      ).toBeGreaterThanOrEqual(minimumReadingWidth)
      expect((await page.locator('article').boundingBox())!.width).toBeGreaterThanOrEqual(
        minimumReadingWidth,
      )
      const screenshotOptions = {
        animations: 'disabled' as const,
        style:
          '.admin-tools, .app-scroll-rail, .vue-devtools__anchor, #__vue-devtools-container__ { visibility: hidden !important; }',
      }
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({
        ...screenshotOptions,
        path: testInfo.outputPath(`privacy-${locale}-${theme.toLowerCase()}.png`),
      })
      const contents = page.getByRole('navigation', {
        name: th ? 'เนื้อหาในหน้านี้' : 'On this page',
      })
      const storage = contents.getByRole('link', {
        name: th ? 'คุกกี้และข้อมูลในเบราว์เซอร์' : 'Cookies and browser storage',
        exact: true,
      })
      await storage.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/#privacy-storage$/)
      const storageHeading = page.locator('#privacy-storage-title')
      await expect(storageHeading).toBeInViewport()
      await expect
        .poll(async () => (await storageHeading.boundingBox())?.y ?? 0)
        .toBeGreaterThanOrEqual(64)
      await contents
        .getByRole('link', {
          name: th ? 'ติดต่อเรื่องความเป็นส่วนตัว' : 'Talk to us about privacy',
          exact: true,
        })
        .click()
      const contact = page.locator('#privacy-contact')
      await expect(
        contact.getByRole('link', {
          name: th ? 'ติดต่อผ่าน Discord' : 'Contact on Discord',
          exact: true,
        }),
      ).toHaveAttribute('href', 'https://discord.gg/nRn7YDwGSH')
      await contact.screenshot({
        ...screenshotOptions,
        path: testInfo.outputPath(`privacy-contact-${locale}-${theme.toLowerCase()}.png`),
      })
      await footer.screenshot({
        ...screenshotOptions,
        path: testInfo.outputPath(`footer-${locale}-${theme.toLowerCase()}.png`),
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await page.goto(`/privacy?locale=${locale}&role=GUEST#privacy-contact`)
      await expect(page.locator('#privacy-contact-title')).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      expect(errors).toEqual([])
    })
  }
}

test('reads Privacy in a new tab without losing registration input', async ({ page, isMobile }) => {
  await page.goto('/?role=GUEST')
  if (isMobile) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await page.getByRole('button', { name: 'Sign up', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type="email"]').fill('privacy-reader@example.invalid')
  await dialog.locator('input[type="password"]').first().fill('registration-draft')
  const popupPromise = page.waitForEvent('popup')
  await dialog.getByRole('link', { name: 'Privacy Policy', exact: true }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/\/privacy$/)
  await expect(popup.getByRole('heading', { name: 'Privacy.', exact: true })).toBeVisible()
  await popup.close()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('input[type="email"]')).toHaveValue('privacy-reader@example.invalid')
  await expect(dialog.locator('input[type="password"]').first()).toHaveValue('registration-draft')
})
