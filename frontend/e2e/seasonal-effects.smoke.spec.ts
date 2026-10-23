import { expect, test } from '@playwright/test'
import type { SeasonalEffect } from '../src/features/seasonal-effects/api'

test('preview is private, saving persists, and live decorations respect motion and dialogs', async ({ page, isMobile }) => {
  let effect: SeasonalEffect = 'NONE'
  let writes = 0
  await page.route('**/api/v1/**/seasonal-effects', async route => {
    if (route.request().method() === 'PUT') {
      effect = route.request().postDataJSON().effect
      writes++
    }
    await route.fulfill({ json: { effect, updatedAt: '2026-10-23T00:00:00Z' } })
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/admin/seasonal-effects')
  await page.getByRole('radio', { name: /Halloween/ }).check()
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Seasonal preview' })
  await expect(preview.locator('[data-seasonal-layer]')).toBeVisible()
  expect(writes).toBe(0)
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Seasonal effect saved')
  expect(writes).toBe(1)
  await page.reload()
  await expect(page.getByRole('radio', { name: /Halloween/ })).toBeChecked()

  await page.goto('/?role=GUEST')
  const live = page.getByTestId('seasonal-effects')
  await expect(live.locator('.seasonal-particle')).toHaveCount(isMobile ? 1 : 2)
  await expect(live.locator('[data-seasonal-layer]')).toHaveAttribute('aria-hidden', 'true')
  expect(await live.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(live).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(live).toBeVisible()
  await page.getByRole('button', { name: 'Sign in', exact: true }).filter({ visible: true }).click()
  await expect(live).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(live).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('supports Thai, still previews, all effect types, and retry after a failed save', async ({ page, isMobile }) => {
  let fail = true
  let effect: SeasonalEffect = 'NONE'
  await page.route('**/api/v1/**/seasonal-effects', async route => {
    if (route.request().method() === 'PUT') {
      if (fail) {
        await route.fulfill({ status: 503, json: { detail: 'Unavailable' } })
        return
      }
      effect = route.request().postDataJSON().effect
    }
    await route.fulfill({ json: { effect, updatedAt: '2026-10-23T00:00:00Z' } })
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/admin/seasonal-effects?locale=th')
  await page.getByRole('radio', { name: /คริสต์มาส/ }).check()
  await page.getByRole('button', { name: 'ดูตัวอย่าง', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'ตัวอย่างลูกเล่นเทศกาล' })
  await expect(preview.locator('.seasonal-scene--still')).toBeVisible()
  await expect(preview.getByText(/อุปกรณ์นี้เปิดการลดการเคลื่อนไหว/)).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('บันทึกลูกเล่นเทศกาลไม่ได้')
  expect(effect).toBe('NONE')
  fail = false
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('บันทึกลูกเล่นเทศกาลแล้ว')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?role=GUEST&locale=th')
  await expect(page.locator('.seasonal-scene--christmas .seasonal-particle')).toHaveCount(isMobile ? 10 : 24)

  await page.goto('/admin/seasonal-effects?locale=th')
  await page.getByRole('radio', { name: /วาเลนไทน์/ }).check()
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('บันทึกลูกเล่นเทศกาลแล้ว')
  await page.goto('/?role=GUEST&locale=th')
  await expect(page.locator('.seasonal-scene--valentine .seasonal-particle')).toHaveCount(isMobile ? 1 : 3)

  await page.goto('/admin/seasonal-effects?locale=th')
  await page.getByRole('radio', { name: /^ปิด/ }).check()
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('บันทึกลูกเล่นเทศกาลแล้ว')
  await page.goto('/?role=GUEST&locale=th')
  await expect(page.getByTestId('seasonal-effects')).toHaveCount(0)
})

test('refreshes visible pages without polling hidden tabs and keeps one renderer across routes', async ({ page, isMobile }) => {
  let effect: SeasonalEffect = 'HALLOWEEN'
  let reads = 0
  await page.clock.install()
  await page.route('**/api/v1/site/seasonal-effects', async route => {
    reads++
    await route.fulfill({ json: { effect, updatedAt: '2026-10-23T00:00:00Z' } })
  })
  await page.goto('/?role=GUEST')
  await expect(page.getByTestId('seasonal-effects')).toHaveCount(1)
  expect(reads).toBe(1)
  effect = 'CHRISTMAS'
  await page.clock.fastForward(60_001)
  await expect(page.locator('.seasonal-scene--christmas')).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByTestId('seasonal-effects')).toHaveCount(0)
  const beforeHidden = reads
  await page.clock.fastForward(120_000)
  expect(reads).toBe(beforeHidden)
  effect = 'VALENTINE'
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.seasonal-scene--valentine')).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await page.getByRole('button', { name: 'About', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/about/)
  await expect(page.getByTestId('seasonal-effects')).toHaveCount(1)
  effect = 'NONE'
  await page.clock.fastForward(60_001)
  await expect(page.getByTestId('seasonal-effects')).toHaveCount(0)
})
