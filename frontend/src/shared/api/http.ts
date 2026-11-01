import type { Session } from '@supabase/supabase-js'

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export async function fetchAllCursorPages<T>(
  initialUrl: URL,
  headers: Record<string, string>,
  errorMessage: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = []
  let cursor: string | null = null
  const visited = new Set<string>()
  do {
    const url = new URL(initialUrl)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    const response = await apiFetch(url, { headers, signal })
    const page = await readJson<CursorPage<T>>(response, errorMessage)
    items.push(...page.items)
    cursor = page.hasMore ? page.nextCursor : null
    if (cursor && visited.has(cursor))
      throw new ApiError('The server returned a repeated cursor.', 502)
    if (cursor) visited.add(cursor)
  } while (cursor)
  return items
}

export interface ProblemResponse {
  title?: string
  detail?: string
}

export const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8080'

const pendingRequests = new Set<AbortController>()
let identityRevision = 0
const responseRevisions = new WeakMap<Response, number>()
export function cancelApiRequests() {
  identityRevision++
  for (const controller of pendingRequests)
    controller.abort(new DOMException('Account changed', 'AbortError'))
}
function assertResponseIdentity(response: Response) {
  if (responseRevisions.has(response) && responseRevisions.get(response) !== identityRevision) {
    throw new DOMException('Account changed', 'AbortError')
  }
}

interface RequestIdentity {
  init: RequestInit
  receive: (response: Response) => Promise<void>
}
interface ApiIdentityGuard {
  request: (
    input: RequestInfo | URL,
    init: RequestInit,
    controller: AbortController,
  ) => RequestIdentity | undefined
  session: (session: Session) => void
}
let identityGuard: ApiIdentityGuard | undefined
/** Optional identity boundary, installed when a privileged session mode is opened. */
export function configureApiIdentity(guard: ApiIdentityGuard) {
  identityGuard = guard
}

export async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ProblemResponse
    assertResponseIdentity(response)
    throw new ApiError(problem.detail ?? problem.title ?? fallbackMessage, response.status)
  }

  const data = (await response.json()) as T
  assertResponseIdentity(response)
  return data
}

export function authenticatedHeaders(session: Session, contentType = false) {
  identityGuard?.session(session)
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  }
}

export async function adminRequest<T>(
  path: string,
  session: Session,
  init: RequestInit = {},
  fallback = 'Unable to update this work.',
): Promise<T> {
  const response = await apiFetch(`${backendUrl}${path}`, {
    ...init,
    headers:
      init.body instanceof FormData
        ? authenticatedHeaders(session, false)
        : authenticatedHeaders(session, true),
  })
  if (response.status === 204) return undefined as T
  return readJson<T>(response, fallback)
}

/** Transport only: feature modules own endpoint paths and payloads. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const revision = identityRevision
  const identity = identityGuard?.request(input, init, controller)
  pendingRequests.add(controller)
  const cancel = () => controller.abort(init.signal?.reason)
  if (init.signal?.aborted) cancel()
  else init.signal?.addEventListener('abort', cancel, { once: true })
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    30_000,
  )
  try {
    const response = await fetch(input, { ...(identity?.init ?? init), signal: controller.signal })
    if (controller.signal.aborted || revision !== identityRevision) {
      throw controller.signal.reason ?? new DOMException('Account changed', 'AbortError')
    }
    responseRevisions.set(response, revision)
    await identity?.receive(response)
    return response
  } finally {
    pendingRequests.delete(controller)
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', cancel)
  }
}
