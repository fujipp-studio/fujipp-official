export type IconColorMode = 'text-primary' | 'original'

export const iconDefaultColor = 'var(--semantic-color-text-text-primary)'

/**
 * Central registry for icon assets in `public/icons`.
 *
 * Keep keys in camelCase and group them by their public directory.
 */
export const icons = {
  action: {
    pause: '/icons/action/pause.svg',
    play: '/icons/action/play.svg',
    restart: '/icons/action/restart.svg',
    save: '/icons/action/save.svg',
    setting: '/icons/action/setting.svg',
  },
  base: {
    add: '/icons/base/add.svg',
    arrowDown: '/icons/base/arrow-down.svg',
    arrowLeft: '/icons/base/arrow-left.svg',
    arrowRight: '/icons/base/arrow-right.svg',
    arrowUp: '/icons/base/arrow-up.svg',
    burger: '/icons/base/burger.svg',
    close: '/icons/base/close.svg',
  },
  brand: {
    authMark: '/icons/brand/auth-mark.svg',
    icon: '/icons/brand/icon.svg',
    lockup: '/icons/brand/lockup.svg',
    lockupDark: '/icons/brand/lockup-dark.svg',
    logo: '/icons/brand/logo.svg',
    wordmark: '/icons/brand/wordmark.svg',
  },
  common: {
    secretHidden: '/icons/common/secret-hidden.svg',
    secretVisible: '/icons/common/secret-visible.svg',
    themeDark: '/icons/common/theme-dark.svg',
    themeLight: '/icons/common/theme-light.svg',
    themeSystem: '/icons/common/theme-system.svg',
    wallet: '/icons/common/wallet.svg',
  },
  language: {
    english: '/icons/language/english.svg',
    thai: '/icons/language/thai.svg',
  },
  navigation: {
    about: '/icons/navigation/about.svg',
    addCredit: '/icons/navigation/add-credit.svg',
    home: '/icons/navigation/home.svg',
    myBot: '/icons/navigation/my-bot.svg',
    store: '/icons/navigation/store.svg',
    work: '/icons/navigation/work.svg',
  },
  social: {
    discord: '/icons/social/discord.svg',
    email: '/icons/social/email.svg',
    google: '/icons/social/google.svg',
    github: '/icons/social/github.svg',
    instagram: '/icons/social/instagram.svg',
    linkedin: '/icons/social/linkedin.svg',
  },
  shop: {
    package: '/icons/shop/package.svg',
    server: '/icons/shop/server.svg',
  },
} as const

export type IconCategory = keyof typeof icons
export type ActionIconName = keyof (typeof icons)['action']
export type BaseIconName = keyof (typeof icons)['base']
export type BrandIconName = keyof (typeof icons)['brand']
export type CommonIconName = keyof (typeof icons)['common']
export type LanguageIconName = keyof (typeof icons)['language']
export type NavigationIconName = keyof (typeof icons)['navigation']
export type SocialIconName = keyof (typeof icons)['social']
export type ShopIconName = keyof (typeof icons)['shop']
export type IconSource =
  | (typeof icons)['action'][ActionIconName]
  | (typeof icons)['base'][BaseIconName]
  | (typeof icons)['brand'][BrandIconName]
  | (typeof icons)['common'][CommonIconName]
  | (typeof icons)['language'][LanguageIconName]
  | (typeof icons)['navigation'][NavigationIconName]
  | (typeof icons)['social'][SocialIconName]
  | (typeof icons)['shop'][ShopIconName]

const originalColorIcons = new Set<IconSource>([
  icons.brand.authMark,
  icons.brand.icon,
  icons.brand.lockup,
  icons.brand.lockupDark,
  icons.brand.logo,
  icons.brand.wordmark,
  icons.common.secretHidden,
  icons.common.secretVisible,
  icons.language.english,
  icons.language.thai,
  icons.social.google,
])

export function getIconColorMode(icon: IconSource): IconColorMode {
  return originalColorIcons.has(icon) ? 'original' : 'text-primary'
}

export function getIconColor(icon: IconSource): string | undefined {
  return getIconColorMode(icon) === 'text-primary' ? iconDefaultColor : undefined
}
