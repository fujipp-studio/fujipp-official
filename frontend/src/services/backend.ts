import type { Session } from '@supabase/supabase-js'

export interface CurrentUser {
  id: string
  email: string | null
  role: 'USER' | 'TESTER' | 'EDITOR' | 'ADMIN'
  status: 'ACTIVE'
  username: string | null
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  profileCompletedAt: string | null
}

interface ProblemResponse {
  title?: string
  detail?: string
}

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8080'

export type WorkLocale = 'th' | 'en'

export interface WorkCategory {
  code: string
  name: string
}

export interface WorkPosition {
  code: string
  name: string
}

export interface WorkTechnology {
  slug: string
  name: string
  iconUrl: string | null
  officialUrl: string | null
  group: WorkCategory
}

export interface WorkMedia {
  url: string
  width: number | null
  height: number | null
  format: string | null
  bytes: number | null
  altText: string | null
}

export interface WorkLink {
  type: 'FIGMA' | 'GITHUB' | 'WEBSITE' | 'YOUTUBE' | 'CERTIFICATE' | 'LIVE' | 'OTHER'
  label: string
  url: string
}

export interface WorkContentItem {
  title: string
  description: string
}

export interface WorkSummary {
  slug: string
  name: string
  shortDescription: string
  status: 'PLANNED' | 'IN_PROGRESS' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  startedOn: string | null
  completedOn: string | null
  featured: boolean
  category: WorkCategory
  positions: WorkPosition[]
  technologies: WorkTechnology[]
  cover: WorkMedia | null
}

export interface WorkDetail extends Omit<WorkSummary, 'cover'> {
  overview: string
  feasibility: string
  targetUsers: string
  publishedAt: string
  gallery: WorkMedia[]
  architecture: WorkMedia | null
  links: WorkLink[]
  features: WorkContentItem[]
  challenges: WorkContentItem[]
  learnings: WorkContentItem[]
}

export type AdminWorkStatus = WorkSummary['status']

export interface AdminWorkTranslation {
  locale: WorkLocale
  name: string
  shortDescription: string
  overview: string
  feasibility: string
  targetUsers: string
}

export interface AdminWork {
  id: string
  slug: string
  categoryCode: string
  categoryName: string
  status: AdminWorkStatus
  publicationStatus: 'DRAFT' | 'PUBLISHED'
  startedOn: string | null
  completedOn: string | null
  featured: boolean
  featuredOrder: number | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  positions: string[]
  technologies: string[]
  translations: AdminWorkTranslation[]
}

export interface AdminWorkInput {
  slug: string
  categoryCode: string
  status: AdminWorkStatus
  startedOn: string | null
  completedOn: string | null
}

export interface AdminWorkLink {
  id: string
  type: WorkLink['type']
  label: string
  url: string
  sortOrder: number
}

export interface AdminWorkContent {
  id: string
  type: 'FEATURE' | 'CHALLENGE' | 'LEARNING'
  sortOrder: number
  translations: Array<{ locale: WorkLocale; title: string; description: string }>
}

export interface AdminWorkMedia {
  id: string
  type: 'GALLERY' | 'ARCHITECTURE'
  url: string
  width: number | null
  height: number | null
  format: string | null
  bytes: number | null
  altText: string | null
  sortOrder: number
}

export interface AdminWorkCatalog {
  categories: Array<{ code: string; name: string }>
  positions: Array<{ code: string; name: string }>
  technologies: Array<{ slug: string; name: string; groupCode: string; groupName: string }>
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ProblemResponse
    throw new Error(problem.detail ?? problem.title ?? fallbackMessage)
  }

  return (await response.json()) as T
}

export async function fetchCurrentUser(session: Session): Promise<CurrentUser> {
  const response = await fetch(`${backendUrl}/api/v1/auth/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  return readJson<CurrentUser>(response, 'Unable to load your account.')
}

export async function fetchWorks(locale: WorkLocale): Promise<WorkSummary[]> {
  const query = new URLSearchParams({ locale })
  const response = await fetch(`${backendUrl}/api/v1/works?${query}`, {
    headers: { Accept: 'application/json' },
  })

  return readJson<WorkSummary[]>(response, 'Unable to load portfolio projects.')
}

export async function fetchWork(slug: string, locale: WorkLocale): Promise<WorkDetail> {
  const query = new URLSearchParams({ locale })
  const response = await fetch(
    `${backendUrl}/api/v1/works/${encodeURIComponent(slug)}?${query}`,
    { headers: { Accept: 'application/json' } },
  )

  return readJson<WorkDetail>(response, 'Unable to load this portfolio project.')
}

function adminHeaders(session: Session, contentType = true) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  }
}

export async function fetchAdminWork(id: string, session: Session): Promise<AdminWork> {
  const response = await fetch(`${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}`, {
    headers: adminHeaders(session, false),
  })
  return readJson<AdminWork>(response, 'Unable to load this work.')
}

export async function createAdminWork(input: AdminWorkInput, session: Session): Promise<AdminWork> {
  const response = await fetch(`${backendUrl}/api/v1/admin/works`, {
    method: 'POST',
    headers: adminHeaders(session),
    body: JSON.stringify(input),
  })
  return readJson<AdminWork>(response, 'Unable to create this work.')
}

export async function updateAdminWork(id: string, input: AdminWorkInput, session: Session): Promise<AdminWork> {
  const response = await fetch(`${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: adminHeaders(session),
    body: JSON.stringify(input),
  })
  return readJson<AdminWork>(response, 'Unable to update this work.')
}

export async function upsertAdminWorkTranslation(
  id: string,
  locale: WorkLocale,
  input: Omit<AdminWorkTranslation, 'locale'>,
  session: Session,
): Promise<AdminWork> {
  const response = await fetch(
    `${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}/translations/${locale}`,
    {
      method: 'PUT',
      headers: adminHeaders(session),
      body: JSON.stringify(input),
    },
  )
  return readJson<AdminWork>(response, 'Unable to save this translation.')
}

export async function replaceAdminWorkCodes(
  id: string,
  resource: 'positions' | 'technologies',
  codes: string[],
  session: Session,
): Promise<AdminWork> {
  const response = await fetch(
    `${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}/${resource}`,
    {
      method: 'PUT',
      headers: adminHeaders(session),
      body: JSON.stringify({ codes }),
    },
  )
  return readJson<AdminWork>(response, `Unable to save ${resource}.`)
}

async function adminRequest<T>(
  path: string,
  session: Session,
  init: RequestInit = {},
  fallback = 'Unable to update this work.',
): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: init.body instanceof FormData ? adminHeaders(session, false) : adminHeaders(session),
  })
  if (response.status === 204) return undefined as T
  return readJson<T>(response, fallback)
}

export const fetchAdminWorkLinks = (id: string, session: Session) =>
  adminRequest<AdminWorkLink[]>(`/api/v1/admin/works/${id}/links`, session, { method: 'GET' }, 'Unable to load links.')

export const fetchAdminWorkCatalog = (session: Session) =>
  adminRequest<AdminWorkCatalog>('/api/v1/admin/works/catalog', session, { method: 'GET' }, 'Unable to load the work catalog.')

export const createAdminWorkLink = (id: string, input: Omit<AdminWorkLink, 'id'>, session: Session) =>
  adminRequest<AdminWorkLink>(`/api/v1/admin/works/${id}/links`, session, { method: 'POST', body: JSON.stringify(input) }, 'Unable to create link.')

export const updateAdminWorkLink = (id: string, linkId: string, input: Omit<AdminWorkLink, 'id'>, session: Session) =>
  adminRequest<AdminWorkLink>(`/api/v1/admin/works/${id}/links/${linkId}`, session, { method: 'PUT', body: JSON.stringify(input) }, 'Unable to update link.')

export const deleteAdminWorkLink = (id: string, linkId: string, session: Session) =>
  adminRequest<void>(`/api/v1/admin/works/${id}/links/${linkId}`, session, { method: 'DELETE' }, 'Unable to delete link.')

export const fetchAdminWorkContent = (id: string, session: Session) =>
  adminRequest<AdminWorkContent[]>(`/api/v1/admin/works/${id}/content`, session, { method: 'GET' }, 'Unable to load content.')

export const createAdminWorkContent = (id: string, input: Pick<AdminWorkContent, 'type' | 'sortOrder'>, session: Session) =>
  adminRequest<AdminWorkContent>(`/api/v1/admin/works/${id}/content`, session, { method: 'POST', body: JSON.stringify(input) }, 'Unable to create content.')

export const updateAdminWorkContent = (id: string, contentId: string, input: Pick<AdminWorkContent, 'type' | 'sortOrder'>, session: Session) =>
  adminRequest<AdminWorkContent>(`/api/v1/admin/works/${id}/content/${contentId}`, session, { method: 'PUT', body: JSON.stringify(input) }, 'Unable to update content.')

export const upsertAdminWorkContentTranslation = (id: string, contentId: string, locale: WorkLocale, input: { title: string; description: string }, session: Session) =>
  adminRequest<AdminWorkContent>(`/api/v1/admin/works/${id}/content/${contentId}/translations/${locale}`, session, { method: 'PUT', body: JSON.stringify(input) }, 'Unable to save content translation.')

export const deleteAdminWorkContent = (id: string, contentId: string, session: Session) =>
  adminRequest<void>(`/api/v1/admin/works/${id}/content/${contentId}`, session, { method: 'DELETE' }, 'Unable to delete content.')

export const fetchAdminWorkMedia = (id: string, session: Session) =>
  adminRequest<AdminWorkMedia[]>(`/api/v1/admin/works/${id}/media`, session, { method: 'GET' }, 'Unable to load media.')

export async function uploadAdminWorkMedia(
  id: string,
  input: { type: AdminWorkMedia['type']; sortOrder: number; altText: string; file: File },
  session: Session,
) {
  const body = new FormData()
  body.append('type', input.type)
  body.append('sortOrder', String(input.sortOrder))
  if (input.altText.trim()) body.append('altText', input.altText.trim())
  body.append('file', input.file)
  return adminRequest<AdminWorkMedia>(`/api/v1/admin/works/${id}/media`, session, { method: 'POST', body }, 'Unable to upload media.')
}

export const deleteAdminWorkMedia = (id: string, mediaId: string, session: Session) =>
  adminRequest<void>(`/api/v1/admin/works/${id}/media/${mediaId}`, session, { method: 'DELETE' }, 'Unable to delete media.')

export const publishAdminWork = (id: string, input: { featured: boolean; featuredOrder: number | null }, session: Session) =>
  adminRequest<AdminWork>(`/api/v1/admin/works/${id}/publish`, session, { method: 'POST', body: JSON.stringify(input) }, 'Unable to publish this work.')

export const unpublishAdminWork = (id: string, session: Session) =>
  adminRequest<AdminWork>(`/api/v1/admin/works/${id}/unpublish`, session, { method: 'POST' }, 'Unable to unpublish this work.')
