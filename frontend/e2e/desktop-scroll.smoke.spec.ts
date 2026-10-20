import { expect, test } from '@playwright/test'

test('smooths desktop wheel input and settles without moving after navigation', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Touch devices keep native scrolling')
  await page.goto('/?role=GUEST')
  await expect(page.locator('html')).toHaveClass(/\blenis\b/)
  await page.evaluate(() => {
    const positions: number[] = []
    Object.defineProperty(window, 'wheelScrollPositions', { value: positions, configurable: true })
    window.addEventListener('scroll', () => positions.push(scrollY), { passive: true })
  })
  await page.mouse.move(700, 400)
  await page.mouse.wheel(0, 500)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(500)
  await expect(page.locator('html')).not.toHaveClass(/lenis-smooth/)
  const positions = await page.evaluate(
    () => Reflect.get(window, 'wheelScrollPositions') as number[],
  )
  expect(positions.some((position) => position > 0 && position < 500)).toBe(true)

  await page.mouse.wheel(0, 700)
  await page.getByRole('button', { name: 'About', exact: true }).click()
  await expect(page).toHaveURL(/\/about/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => scrollY)).toBe(0)
})

test('lets a nested panel scroll without moving the page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Wheel containment is a desktop interaction')
  await page.goto('/?role=GUEST')
  await expect(page.locator('html')).toHaveClass(/\blenis\b/)
  await page.evaluate(() => {
    const panel = document.createElement('div')
    panel.dataset.testid = 'nested-scroll'
    panel.style.cssText =
      'position:fixed;top:100px;left:100px;width:300px;height:200px;overflow:auto;z-index:9999'
    const content = document.createElement('div')
    content.style.height = '1600px'
    panel.append(content)
    document.body.append(panel)
  })
  await page.getByTestId('nested-scroll').hover()
  await page.mouse.wheel(0, 300)
  await expect
    .poll(() => page.getByTestId('nested-scroll').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0)
  expect(await page.evaluate(() => scrollY)).toBe(0)
})

test('keeps touch and reduced-motion scrolling native and respects menu locks', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?role=USER')
  await expect(page.getByRole('button', { name: 'Open profile', exact: true })).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/\blenis\b/)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  if (isMobile) {
    await expect(page.locator('html')).not.toHaveClass(/\blenis\b/)
    return
  }
  await expect(page.locator('html')).toHaveClass(/\blenis\b/)
  await page.mouse.move(700, 400)
  await page.mouse.wheel(0, 600)
  await page.getByRole('button', { name: 'Open profile', exact: true }).click()
  await expect(page.locator('#profile-dialog')).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/\blenis\b/)
  const lockedPosition = await page.evaluate(() => scrollY)
  await page.mouse.move(700, 400)
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => scrollY)).toBe(lockedPosition)
  await page.keyboard.press('Escape')
  await expect(page.locator('#profile-dialog')).toBeHidden()
  await expect(page.locator('html')).toHaveClass(/\blenis\b/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('html')).not.toHaveClass(/\blenis\b/)
})
