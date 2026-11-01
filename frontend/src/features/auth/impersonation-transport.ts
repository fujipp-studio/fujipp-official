import { watch } from 'vue'
import { backendUrl, cancelApiRequests, configureApiIdentity } from '@/shared/api/http'
import {
  assertSessionContext,
  impersonationContext,
  impersonationGeneration,
} from './impersonation'

let installed = false
/** Add capability handling only after an administrator opens this mode. */
export function installImpersonationTransport() {
  if (installed) return
  installed = true
  watch(impersonationContext, cancelApiRequests, { flush: 'sync' })
  configureApiIdentity({
    session: assertSessionContext,
    request(input, init, controller) {
      const headers = new Headers(
        init.headers ?? (input instanceof Request ? input.headers : undefined),
      )
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.origin,
      )
      const backend = new URL(backendUrl, window.location.origin)
      if (
        url.origin !== backend.origin ||
        !url.pathname.startsWith(`${backend.pathname.replace(/\/$/, '')}/api/`) ||
        !headers.has('Authorization')
      )
        return
      const context = impersonationContext.value
      const generation = impersonationGeneration()
      if (context) headers.set('X-Impersonation-Token', context.token)
      return {
        init: context ? { ...init, headers } : init,
        async receive(response) {
          if (controller.signal.aborted || generation !== impersonationGeneration()) {
            throw new DOMException('Account changed', 'AbortError')
          }
          if (context && response.status === 403) {
            const problem = await response
              .clone()
              .json()
              .catch(() => ({}))
            if (
              problem.reason === 'IMPERSONATION_ENDED' &&
              context === impersonationContext.value
            ) {
              impersonationContext.value = { ...context, ended: true }
            }
          }
        },
      }
    },
  })
}
