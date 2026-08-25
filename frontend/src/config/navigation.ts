import { icons, type IconSource } from './icons'

export interface NavbarLink {
  label: string
  path: string
  icon?: IconSource
  children?: readonly NavbarLink[]
}

/**
 * Navigation naming conventions:
 * - exported values and icon keys: camelCase
 * - interfaces and types: PascalCase
 * - route paths and asset filenames: kebab-case
 */
export const guestNavbarLinks = [
  { label: 'Home', path: '/', icon: icons.navigation.home },
  { label: 'Work', path: '/work', icon: icons.navigation.work },
  { label: 'About', path: '/about', icon: icons.navigation.about },
] satisfies readonly NavbarLink[]

export const authenticatedNavbarLinks = [
  { label: 'Home', path: '/', icon: icons.navigation.home },
  { label: 'Work', path: '/work', icon: icons.navigation.work },
  { label: 'About', path: '/about', icon: icons.navigation.about },
  {
    label: 'My bot',
    path: '/my-bot',
    icon: icons.navigation.myBot,
    children: [
      { label: 'Dashboard', path: '/my-bot', icon: icons.navigation.myBot },
      { label: 'Store', path: '/store', icon: icons.navigation.store },
      { label: 'Top up', path: '/add-credit', icon: icons.navigation.addCredit },
    ],
  },
] satisfies readonly NavbarLink[]
