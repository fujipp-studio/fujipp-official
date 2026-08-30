import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { fetchCurrentUser, type CurrentUser } from '@/features/auth/api'

type OAuthProvider = 'google' | 'discord' | 'github'

async function loadSupabaseClient() {
  const { getSupabaseClient } = await import('../lib/supabase')
  return getSupabaseClient()
}

function getAuthCallbackUrl(): string {
  const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim().replace(/\/+$/, '')
  return `${configuredSiteUrl || window.location.origin}/auth/callback`
}

interface AuthActionResult {
  success: boolean
  requiresEmailConfirmation?: boolean
  message?: string
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const currentUser = ref<CurrentUser | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let listenerRegistered = false
  let initializationPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => session.value !== null)

  function initialize() {
    if (initialized.value) return
    if (initializationPromise) return initializationPromise
    initializationPromise = initializeAuth().finally(() => {
      initializationPromise = null
    })
    return initializationPromise
  }

  function initializeGuestState() {
    if (!initialized.value && !hasPersistedAuthSession()) initialized.value = true
  }

  async function initializeAuth() {
    try {
      const supabase = await loadSupabaseClient()
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      session.value = data.session
      if (data.session) await loadCurrentUser(data.session)

      if (!listenerRegistered) {
        listenerRegistered = true
        supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
          session.value = nextSession
          if (!nextSession) {
            currentUser.value = null
            return
          }
          void loadCurrentUser(nextSession)
        })
      }
    } catch (cause) {
      error.value = getErrorMessage(cause)
    } finally {
      initialized.value = true
    }
  }

  async function signIn(
    email: string,
    password: string,
    captchaToken: string,
  ): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      const supabase = await loadSupabaseClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: { captchaToken },
      })
      if (signInError) throw signInError
      if (!data.session) throw new Error('No session was returned.')

      session.value = data.session
      await loadCurrentUser(data.session)
      return { success: true }
    })
  }

  async function signUp(
    email: string,
    password: string,
    captchaToken: string,
  ): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      const supabase = await loadSupabaseClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          captchaToken,
          emailRedirectTo: getAuthCallbackUrl(),
        },
      })
      if (signUpError) throw signUpError

      if (!data.session) {
        return {
          success: true,
          requiresEmailConfirmation: true,
          message: 'Check your email to confirm your account before signing in.',
        }
      }

      session.value = data.session
      await loadCurrentUser(data.session)
      return { success: true }
    })
  }

  async function signInWithOAuth(provider: OAuthProvider): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      const supabase = await loadSupabaseClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthCallbackUrl(),
        },
      })
      if (oauthError) throw oauthError
      return { success: true }
    })
  }

  async function completeOAuthCallback(): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      const code = new URL(window.location.href).searchParams.get('code')
      if (code) {
        const supabase = await loadSupabaseClient()
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) throw exchangeError
      }

      initialized.value = false
      await initialize()
      return { success: session.value !== null }
    })
  }

  async function signOut(): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      const supabase = await loadSupabaseClient()
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      session.value = null
      currentUser.value = null
      return { success: true }
    })
  }

  async function loadCurrentUser(activeSession: Session) {
    currentUser.value = await fetchCurrentUser(activeSession)
  }

  async function runAuthAction(action: () => Promise<AuthActionResult>): Promise<AuthActionResult> {
    loading.value = true
    error.value = null
    try {
      return await action()
    } catch (cause) {
      const message = getErrorMessage(cause)
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  async function reloadCurrentUser() {
    if (session.value) {
      await loadCurrentUser(session.value)
    }
  }

  return {
    session,
    currentUser,
    initialized,
    loading,
    error,
    isAuthenticated,
    initialize,
    initializeGuestState,
    reloadCurrentUser,
    signIn,
    signUp,
    signInWithOAuth,
    completeOAuthCallback,
    signOut,
    clearError,
  }
})

function hasPersistedAuthSession() {
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) return true
    }
  } catch {
    // Treat unavailable storage as a guest session. Explicit auth actions still load Supabase.
  }
  return false
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Authentication failed. Please try again.'
}
