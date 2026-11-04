import { expect, it, vi } from 'vitest'

it('loads only visited namespaces and prepares a language before switching it', async () => {
  vi.resetModules()
  const { i18n, loadRouteMessages, setAppLocale } = await import('@/i18n')
  await loadRouteMessages('/')
  expect(Object.keys(i18n.global.getLocaleMessage('en')).sort()).toEqual([
    'common',
    'footer',
    'home',
    'navigation',
  ])
  expect(i18n.global.getLocaleMessage('th')).toEqual({})
  const pending = setAppLocale('th')
  expect(i18n.global.locale.value).toBe('en')
  await pending
  expect(i18n.global.locale.value).toBe('th')
  expect(i18n.global.t('home.hero.title')).not.toBe('home.hero.title')
  await loadRouteMessages('/my-bot/test/settings')
  expect(i18n.global.getLocaleMessage('th')).toHaveProperty('botSettings')
  expect(i18n.global.getLocaleMessage('th')).toHaveProperty('botRuntime')
  expect(i18n.global.getLocaleMessage('th')).not.toHaveProperty('myBots')
  expect(i18n.global.t('botRuntime.runtimeStateRunning')).toBe('กำลังทำงาน')
  expect(i18n.global.getLocaleMessage('th')).not.toHaveProperty('admin')
  expect(i18n.global.getLocaleMessage('th')).not.toHaveProperty('privacy')
  await loadRouteMessages('/my-bot')
  expect(i18n.global.getLocaleMessage('th')).toHaveProperty('myBots')
  expect(i18n.global.t('myBots.signInToViewBots')).toBe('เข้าสู่ระบบเพื่อดูและจัดการบอทของคุณ')
  await loadRouteMessages('/privacy')
  expect(i18n.global.t('privacy.sections.rights.title')).not.toBe('privacy.sections.rights.title')
  await Promise.all([setAppLocale('en'), setAppLocale('th')])
  expect(i18n.global.locale.value).toBe('th')
})
