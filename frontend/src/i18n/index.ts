import { createI18n } from 'vue-i18n'

export type AppLocale = 'en' | 'th'
export const messageNamespaces = [
  'common',
  'navigation',
  'footer',
  'home',
  'about',
  'store',
  'topup',
  'admin',
  'botSettings',
  'myBots',
  'donation',
  'account',
] as const
export type MessageNamespace = (typeof messageNamespaces)[number]
const loaders = import.meta.glob<{ default: Record<string, unknown> }>([
  './locales/*/*.ts',
  '!./locales/*/index.ts',
])
const loaded = new Map<string, Promise<void>>()
const required = new Set<MessageNamespace>(['common', 'navigation', 'footer'])

function readStoredLocale() {
  try {
    return window.localStorage?.getItem('fujipp-locale')
  } catch {
    return undefined
  }
}
const queryLocale = new URLSearchParams(window.location.search).get('locale')
const initialLocale: AppLocale = queryLocale === 'th' || readStoredLocale() === 'th' ? 'th' : 'en'
let requestedLocale = initialLocale
let localeVersion = 0

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { en: {}, th: {} },
})

export async function loadMessages(locale: AppLocale, namespaces: readonly MessageNamespace[]) {
  await Promise.all(
    namespaces.map((namespace) => {
      const key = `${locale}/${namespace}`
      const existing = loaded.get(key)
      if (existing) return existing
      const loader = loaders[`./locales/${key}.ts`]
      if (!loader) throw new Error(`Translation namespace is unavailable: ${key}`)
      const pending = loader()
        .then((module) => {
          i18n.global.mergeLocaleMessage(locale, { [namespace]: module.default })
        })
        .catch((cause) => {
          loaded.delete(key)
          throw cause
        })
      loaded.set(key, pending)
      return pending
    }),
  )
}

function namespacesForPath(path: string): MessageNamespace[] {
  if (
    path.startsWith('/components') ||
    path.startsWith('/design-system') ||
    path === '/auth/callback'
  )
    return [...messageNamespaces]
  if (path.startsWith('/admin/bots/')) return ['admin', 'botSettings', 'myBots']
  if (path.startsWith('/admin')) return ['admin', 'donation']
  if (path.startsWith('/my-bot')) return ['myBots', 'botSettings']
  if (path.startsWith('/store')) return ['store']
  if (path.startsWith('/add-credit')) return ['topup', 'donation']
  if (path.startsWith('/account')) return ['account']
  if (path === '/about' || path === '/donate') return ['about', 'donation']
  if (path === '/') return ['home']
  return []
}

async function prepare(locale: AppLocale) {
  const namespaces = [...required]
  await Promise.all([
    loadMessages(locale, namespaces),
    ...(locale === 'th' ? [loadMessages('en', namespaces)] : []),
  ])
}

export async function loadRouteMessages(path: string) {
  namespacesForPath(path).forEach((namespace) => required.add(namespace))
  // A locale switch and a navigation can overlap. Both rendered locales must be ready.
  await Promise.all([prepare(requestedLocale), prepare(i18n.global.locale.value)])
}

export async function setAppLocale(locale: AppLocale) {
  const version = ++localeVersion
  requestedLocale = locale
  await prepare(locale)
  if (version !== localeVersion) return
  i18n.global.locale.value = locale
  try {
    window.localStorage?.setItem('fujipp-locale', locale)
  } catch {
    /* Restricted storage. */
  }
  document.documentElement.lang = locale
}

document.documentElement.lang = initialLocale
