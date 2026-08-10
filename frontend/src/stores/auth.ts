import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getSupabaseClient } from '../lib/supabase'
import { fetchCurrentUser, type CurrentUser } from '../services/backend'

type OAuthProvider = 'google' | 'discord' | 'github'

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

  async function initializeAuth() {
    try {
      const supabase = getSupabaseClient()
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
      const { data, error: signInError } = await getSupabaseClient().auth.signInWithPassword({
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
      const { data, error: signUpError } = await getSupabaseClient().auth.signUp({
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
      const { error: oauthError } = await getSupabaseClient().auth.signInWithOAuth({
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
        const { error: exchangeError } = await getSupabaseClient().auth.exchangeCodeForSession(code)
        if (exchangeError) throw exchangeError
      }

      initialized.value = false
      await initialize()
      return { success: session.value !== null }
    })
  }

  async function signOut(): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      const { error: signOutError } = await getSupabaseClient().auth.signOut()
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
    reloadCurrentUser,
    signIn,
    signUp,
    signInWithOAuth,
    completeOAuthCallback,
    signOut,
    clearError,
  }
})

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Authentication failed. Please try again.'
}
