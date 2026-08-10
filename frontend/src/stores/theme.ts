import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { ThemeApp } from '../config'
import type { ThemeMode } from '../config/theme'

const themeStorageKey = 'fujipp-theme-mode'
const lightFavicon = '/icons/brand/auth-mark.svg'
const darkFavicon = '/icons/brand/auth-mark-dark.svg'

interface ThemeTransitionOrigin {
  x: number
  y: number
}

interface ViewTransitionHandle {
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionHandle
}

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'SYSTEM'

  try {
    const storedTheme = window.localStorage?.getItem(themeStorageKey)
    return storedTheme === 'LIGHT' || storedTheme === 'DARK' || storedTheme === 'SYSTEM'
      ? storedTheme
      : 'SYSTEM'
  } catch {
    return 'SYSTEM'
  }
}

export const useThemeStore = defineStore('theme', () => {
  const selectedTheme = ref<ThemeMode>(getStoredTheme())
  const systemColorScheme =
    typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined
  const systemPrefersDark = ref(systemColorScheme?.matches ?? false)

  const currentTheme = computed(
    () => ThemeApp.find((theme) => theme.mode === selectedTheme.value) ?? ThemeApp[2]!,
  )
  const isDarkTheme = computed(
    () =>
      selectedTheme.value === 'DARK' ||
      (selectedTheme.value === 'SYSTEM' && systemPrefersDark.value),
  )

  function applyTheme(instant = false) {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    if (instant) root.classList.add('theme-switching')

    root.dataset.theme = isDarkTheme.value ? 'dark' : 'light'
    root.classList.toggle('dark', isDarkTheme.value)

    const favicon = document.querySelector<HTMLLinkElement>('#app-favicon')
    if (favicon) favicon.href = isDarkTheme.value ? darkFavicon : lightFavicon

    if (instant) {
      void root.offsetWidth
      root.classList.remove('theme-switching')
    }
  }

  function setTheme(theme: ThemeMode, origin?: ThemeTransitionOrigin) {
    const updateTheme = (instant: boolean) => {
      selectedTheme.value = theme

      try {
        window.localStorage?.setItem(themeStorageKey, theme)
      } catch {
        // Theme switching still works when storage is unavailable.
      }

      applyTheme(instant)
    }

    const viewTransitionDocument = document as ViewTransitionDocument
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (!origin || reduceMotion || !viewTransitionDocument.startViewTransition) {
      updateTheme(true)
      return
    }

    const root = document.documentElement
    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    )

    root.style.setProperty('--theme-reveal-x', `${origin.x}px`)
    root.style.setProperty('--theme-reveal-y', `${origin.y}px`)
    root.style.setProperty('--theme-reveal-radius', `${radius}px`)
    root.classList.add('theme-reveal')

    const transition = viewTransitionDocument.startViewTransition(() => updateTheme(false))
    void transition.finished.finally(() => {
      root.classList.remove('theme-reveal')
      root.style.removeProperty('--theme-reveal-x')
      root.style.removeProperty('--theme-reveal-y')
      root.style.removeProperty('--theme-reveal-radius')
    })
  }

  systemColorScheme?.addEventListener('change', () => {
    systemPrefersDark.value = systemColorScheme.matches

    if (selectedTheme.value === 'SYSTEM') {
      applyTheme(true)
    }
  })

  applyTheme()

  return { selectedTheme, currentTheme, isDarkTheme, setTheme }
})
