import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore } from '../stores'

describe('auth store bootstrap', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    const storage: Storage = {
      get length() {
        return values.size
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    }
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
    setActivePinia(createPinia())
  })

  it('marks a visitor ready without loading Supabase when no session is persisted', () => {
    const auth = useAuthStore()

    auth.initializeGuestState()

    expect(auth.initialized).toBe(true)
    expect(auth.session).toBeNull()
  })

  it('leaves persisted sessions for the full Supabase initialization path', () => {
    window.localStorage.setItem('sb-project-auth-token', '{}')
    const auth = useAuthStore()

    auth.initializeGuestState()

    expect(auth.initialized).toBe(false)
  })
})
