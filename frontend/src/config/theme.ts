import { icons } from './icons'

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM'

export interface ThemeApp {
  mode: ThemeMode
  src: string
}

export const ThemeApp = [
  { mode: 'LIGHT', src: icons.common.themeLight },
  { mode: 'DARK', src: icons.common.themeDark },
  { mode: 'SYSTEM', src: icons.common.themeSystem },
] satisfies readonly ThemeApp[]
