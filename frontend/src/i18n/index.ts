import { createI18n } from 'vue-i18n'

import { messages } from './messages'

export type AppLocale = keyof typeof messages

function readStoredLocale() {
  try {
    return window.localStorage?.getItem('fujipp-locale')
  } catch {
    return undefined
  }
}

const storedLocale = readStoredLocale()
const queryLocale = new URLSearchParams(window.location.search).get('locale')
const initialLocale: AppLocale = queryLocale === 'th' || storedLocale === 'th' ? 'th' : 'en'

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages,
})

export function setAppLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  try {
    window.localStorage?.setItem('fujipp-locale', locale)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
  document.documentElement.lang = locale
}

setAppLocale(initialLocale)
