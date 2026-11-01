import { shallowRef, watch } from 'vue'
import type { CurrentUser } from './api'

export interface ImpersonationSession {
  token: string
  expiresAt: string
  user: CurrentUser
  ended?: boolean
}

// Memory only: no capabilities or impersonated identity in browser storage.
export const impersonationContext = shallowRef<ImpersonationSession | null>(null)

let generation = 0
watch(
  impersonationContext,
  () => {
    generation++
  },
  { flush: 'sync' },
)
export function impersonationGeneration() {
  return generation
}

const sessionContexts = new WeakMap<object, number>()
export function bindSessionContext<T extends object>(session: T): T {
  sessionContexts.set(session, generation)
  return session
}
export function assertSessionContext(session: object) {
  if (sessionContexts.has(session) && sessionContexts.get(session) !== generation) {
    throw new DOMException('Account changed', 'AbortError')
  }
}
