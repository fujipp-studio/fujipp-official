import { watch, type Ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import type { CurrentUser } from './api'
import { impersonationContext } from './impersonation'
import { installImpersonationTransport } from './impersonation-transport'
import { startImpersonation, stopImpersonation } from './impersonation-api'

interface Dependencies {
  actor: Ref<Session | null>
  user: Ref<CurrentUser | null>
  error: Ref<string | null>
  version: () => number
  invalidate: () => void
  disposed: () => boolean
  reload: () => Promise<void>
}

/** Loaded on demand when an administrator first starts impersonation. */
export function createImpersonationController(deps: Dependencies) {
  installImpersonationTransport()
  let actorUser: CurrentUser | null = null
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let starting = false

  function reset() {
    clearTimeout(expiryTimer)
    impersonationContext.value = null
    actorUser = null
  }

  async function begin(userId: string) {
    if (
      !deps.actor.value ||
      deps.user.value?.role !== 'ADMIN' ||
      impersonationContext.value ||
      starting
    ) {
      throw new Error('An administrator account is required.')
    }
    const version = deps.version()
    const actor = deps.actor.value
    starting = true
    try {
      const started = await startImpersonation(userId, actor)
      if (
        deps.disposed() ||
        version !== deps.version() ||
        deps.actor.value?.user.id !== actor.user.id
      )
        return
      actorUser = deps.user.value
      deps.invalidate()
      impersonationContext.value = started
      deps.user.value = started.user
      expiryTimer = setTimeout(
        () => {
          void end(true)
        },
        Math.max(0, Date.parse(started.expiresAt) - Date.now()),
      )
    } finally {
      starting = false
    }
  }

  async function end(expired = false) {
    const active = impersonationContext.value
    if (!active) return
    // Confirm explicit revocation before leaving the mode; preserve the banner
    // if the server is unavailable, so an administrator can retry.
    if (!expired && deps.actor.value) await stopImpersonation(deps.actor.value)
    if (active !== impersonationContext.value) return
    const restored = actorUser
    deps.invalidate()
    reset()
    deps.user.value = restored
    if (deps.actor.value) {
      try {
        await deps.reload()
      } catch (cause) {
        deps.user.value = null
        deps.error.value = cause instanceof Error ? cause.message : 'Unable to load your account.'
      }
    }
  }

  const unwatch = watch(
    () => impersonationContext.value?.ended,
    (ended) => {
      if (ended) void end(true)
    },
  )
  return {
    begin,
    end,
    reset,
    dispose: () => {
      unwatch()
      reset()
    },
  }
}

export type ImpersonationController = ReturnType<typeof createImpersonationController>
