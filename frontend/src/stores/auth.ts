import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'

import { fetchCurrentUser, type CurrentUser } from '@/features/auth/api'
import { bindSessionContext, impersonationContext } from '@/features/auth/impersonation'
import type { ImpersonationController } from '@/features/auth/impersonation-controller'

type OAuthProvider = 'google' | 'discord' | 'github'

async function loadSupabaseClient() {
  const { getSupabaseClient } = await import('../lib/supabase')
  return getSupabaseClient()
}

interface AuthActionResult {
  success: boolean
  requiresEmailConfirmation?: boolean
  message?: string
}

function getAuthCallbackUrl(): string {
  const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim().replace(/\/+$/, '')
  const callback = new URL(`${configuredSiteUrl || window.location.origin}/auth/callback`)
  if (['/support', '/supports'].includes(window.location.pathname)) {
    callback.searchParams.set('returnTo', '/support')
    if (new URLSearchParams(window.location.search).get('locale') === 'th') {
      callback.searchParams.set('locale', 'th')
    }
  }
  return callback.toString()
}

export const useAuthStore = defineStore('auth', () => {
  const actorSession = ref<Session | null>(null)
  const impersonation = computed(() => impersonationContext.value)
  const session = computed({
    get: () => {
      const source = actorSession.value
      const acting = impersonation.value
      if (!source) return null
      if (!acting) return bindSessionContext({ ...source })
      return bindSessionContext({
        ...source,
        user: {
          ...source.user,
          id: acting.user.id,
          email: acting.user.email ?? undefined,
          user_metadata: {},
        },
      })
    },
    set: (value: Session | null) => {
      actorSession.value = value
    },
  })
  let impersonationController: ImpersonationController | undefined
  let identityVersion = 0
  const currentUser = ref<CurrentUser | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let listenerRegistered = false
  let unsubscribe: (() => void) | undefined
  let disposed = false
  let userRequest: { token: string; promise: Promise<void> } | undefined
  onScopeDispose(() => {
    disposed = true
    unsubscribe?.()
    impersonationController?.dispose()
    impersonationContext.value = null
  })

  async function authClient() {
    const supabase = await loadSupabaseClient()
    if (!listenerRegistered && !disposed) {
      listenerRegistered = true
      const { data } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, nextSession: Session | null) => {
          if (actorSession.value?.user.id !== nextSession?.user.id) resetImpersonation()
          actorSession.value = nextSession
          if (!nextSession) {
            currentUser.value = null
            userRequest = undefined
            return
          }
          void loadCurrentUser(nextSession).catch((cause) => {
            if (actorSession.value?.access_token === nextSession.access_token)
              error.value = getErrorMessage(cause)
          })
        },
      )
      unsubscribe = () => data.subscription.unsubscribe()
    }
    return supabase
  }
  let initializationPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => actorSession.value !== null)

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
      const supabase = await authClient()
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      actorSession.value = data.session
      if (data.session) await loadCurrentUser(data.session)
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
      const supabase = await authClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: { captchaToken },
      })
      if (signInError) throw signInError
      if (!data.session) throw new Error('No session was returned.')

      actorSession.value = data.session
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
      const supabase = await authClient()
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

      actorSession.value = data.session
      await loadCurrentUser(data.session)
      return { success: true }
    })
  }

  async function signInWithOAuth(provider: OAuthProvider): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      const supabase = await authClient()
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
        const supabase = await authClient()
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) throw exchangeError
      }

      initialized.value = false
      await initialize()
      return { success: actorSession.value !== null }
    })
  }

  async function signOut(): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      if (impersonation.value) await endImpersonation()
      const supabase = await authClient()
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      resetImpersonation()
      actorSession.value = null
      currentUser.value = null
      return { success: true }
    })
  }

  async function updatePassword(password: string): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      if (impersonation.value)
        throw new Error('Return to your administrator account to change authentication settings.')
      const supabase = await authClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      return { success: true }
    })
  }

  async function requestPasswordReset(): Promise<AuthActionResult> {
    return runAuthAction(async () => {
      if (impersonation.value)
        throw new Error('Return to your administrator account to change authentication settings.')
      const email = actorSession.value?.user.email
      if (!email) throw new Error('No email is associated with this account.')
      const redirectTo = `${window.location.origin}/auth/callback?recovery=1`
      const supabase = await authClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (resetError) throw resetError
      return { success: true }
    })
  }

  function loadCurrentUser(activeSession: Session): Promise<void> {
    const token = `${activeSession.access_token}:${identityVersion}`
    const version = identityVersion
    if (userRequest?.token === token) return userRequest.promise
    const request = fetchCurrentUser(activeSession)
      .then((user) => {
        if (
          !disposed &&
          actorSession.value?.access_token === activeSession.access_token &&
          version === identityVersion
        )
          currentUser.value = user
      })
      .finally(() => {
        if (userRequest?.promise === request) userRequest = undefined
      })
    userRequest = { token, promise: request }
    return request
  }

  function invalidateIdentity() {
    identityVersion++
    userRequest = undefined
  }

  function resetImpersonation() {
    invalidateIdentity()
    impersonationController?.reset()
    impersonationContext.value = null
  }

  async function beginImpersonation(userId: string): Promise<void> {
    if (!impersonationController) {
      const { createImpersonationController } =
        await import('@/features/auth/impersonation-controller')
      if (disposed) return
      impersonationController ??= createImpersonationController({
        actor: actorSession,
        user: currentUser,
        error,
        version: () => identityVersion,
        invalidate: invalidateIdentity,
        disposed: () => disposed,
        reload: reloadCurrentUser,
      })
    }
    await impersonationController.begin(userId)
  }

  async function endImpersonation(expired = false): Promise<void> {
    await impersonationController?.end(expired)
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
    if (actorSession.value) {
      await loadCurrentUser(actorSession.value)
    }
  }

  return {
    session,
    impersonation,
    beginImpersonation,
    endImpersonation,
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
    updatePassword,
    requestPasswordReset,
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
