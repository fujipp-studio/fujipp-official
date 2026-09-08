import { apiFetch } from '@/shared/api/http'
import type { Session } from '@supabase/supabase-js'
import {
  backendUrl,
  readJson,
  authenticatedHeaders,
  adminRequest,
  type CursorPage,
} from '@/shared/api/http'

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

export interface WorkOverview {
  total: number
  categories: Array<WorkCategory & { total: number }>
  featured: WorkSummary[]
}

// Public read-only lists only. Keep a bounded, short-lived cache across route visits.
const listingCache = new Map<string, { expires: number; value: unknown }>()
export function invalidateWorkListingCache() { listingCache.clear() }

async function cachedListing<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const key = url.href
  const cached = listingCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.value as T
  const response = await apiFetch(url, { headers: { Accept: 'application/json' }, signal })
  const value = await readJson<T>(response, 'Unable to load portfolio projects.')
  if (!signal?.aborted) {
    if (listingCache.size >= 32) listingCache.delete(listingCache.keys().next().value!)
    listingCache.set(key, { expires: Date.now() + 60_000, value })
  }
  return value
}

export function fetchWorkOverview(locale: WorkLocale, signal?: AbortSignal) {
  const url = new URL(`${backendUrl}/api/v2/works/overview`)
  url.searchParams.set('locale', locale)
  return cachedListing<WorkOverview>(url, signal)
}

export function fetchWorksPage(locale: WorkLocale, options: {
  category?: string; cursor?: string | null; limit: number; signal?: AbortSignal
}) {
  const url = new URL(`${backendUrl}/api/v2/works`)
  url.searchParams.set('locale', locale)
  url.searchParams.set('limit', String(options.limit))
  if (options.category && options.category !== 'all') url.searchParams.set('category', options.category)
  if (options.cursor) url.searchParams.set('cursor', options.cursor)
  return cachedListing<CursorPage<WorkSummary>>(url, options.signal)
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

export interface SaveAdminWorkDraftInput {
  work: AdminWorkInput
  en: Omit<AdminWorkTranslation, 'locale'>
  th: Omit<AdminWorkTranslation, 'locale'>
  positions: { codes: string[] }
  technologies: { codes: string[] }
  content: Array<{
    id?: string
    type: AdminWorkContent['type']
    sortOrder: number
    en: { title: string; description: string }
    th: { title: string; description: string }
  }>
  links: Array<{
    id?: string
    value: Omit<AdminWorkLink, 'id'>
  }>
}

export interface SaveAdminWorkDraftResponse {
  work: AdminWork
  content: AdminWorkContent[]
  links: AdminWorkLink[]
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
  technologyGroups: Array<{ code: string; name: string }>
  technologies: Array<{ slug: string; name: string; groupCode: string; groupName: string }>
}

export interface CreateAdminTechnologyInput {
  slug: string
  name: string
  groupCode: string
  iconUrl: string | null
  officialUrl: string | null
}

export async function fetchWork(slug: string, locale: WorkLocale): Promise<WorkDetail> {
  const query = new URLSearchParams({ locale })
  const response = await apiFetch(
    `${backendUrl}/api/v1/works/${encodeURIComponent(slug)}?${query}`,
    {
      headers: { Accept: 'application/json' },
    },
  )

  return readJson<WorkDetail>(response, 'Unable to load this portfolio project.')
}

export async function fetchAdminWork(id: string, session: Session): Promise<AdminWork> {
  const response = await apiFetch(`${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}`, {
    headers: authenticatedHeaders(session, false),
  })
  return readJson<AdminWork>(response, 'Unable to load this work.')
}

export async function fetchAdminWorks(session: Session): Promise<AdminWork[]> {
  const response = await apiFetch(`${backendUrl}/api/v1/admin/works`, {
    headers: authenticatedHeaders(session, false),
  })
  return readJson<AdminWork[]>(response, 'Unable to load works.')
}

export async function createAdminWork(input: AdminWorkInput, session: Session): Promise<AdminWork> {
  const response = await apiFetch(`${backendUrl}/api/v1/admin/works`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify(input),
  })
  return readJson<AdminWork>(response, 'Unable to create this work.')
}

export async function updateAdminWork(
  id: string,
  input: AdminWorkInput,
  session: Session,
): Promise<AdminWork> {
  const response = await apiFetch(`${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authenticatedHeaders(session, true),
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
  const response = await apiFetch(
    `${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}/translations/${locale}`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
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
  const response = await apiFetch(
    `${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}/${resource}`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify({ codes }),
    },
  )
  return readJson<AdminWork>(response, `Unable to save ${resource}.`)
}

export const saveAdminWorkDraft = (id: string, input: SaveAdminWorkDraftInput, session: Session) =>
  adminRequest<SaveAdminWorkDraftResponse>(
    `/api/v1/admin/works/${id}/draft`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to save this draft.',
  )

export const fetchAdminWorkLinks = (id: string, session: Session) =>
  adminRequest<AdminWorkLink[]>(
    `/api/v1/admin/works/${id}/links`,
    session,
    { method: 'GET' },
    'Unable to load links.',
  )

export const fetchAdminWorkCatalog = (session: Session) =>
  adminRequest<AdminWorkCatalog>(
    '/api/v1/admin/works/catalog',
    session,
    { method: 'GET' },
    'Unable to load the work catalog.',
  )

export const createAdminTechnology = (input: CreateAdminTechnologyInput, session: Session) =>
  adminRequest<AdminWorkCatalog['technologies'][number]>(
    '/api/v1/admin/works/catalog/technologies',
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to create the technology.',
  )

export const createAdminWorkLink = (
  id: string,
  input: Omit<AdminWorkLink, 'id'>,
  session: Session,
) =>
  adminRequest<AdminWorkLink>(
    `/api/v1/admin/works/${id}/links`,
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to create link.',
  )

export const updateAdminWorkLink = (
  id: string,
  linkId: string,
  input: Omit<AdminWorkLink, 'id'>,
  session: Session,
) =>
  adminRequest<AdminWorkLink>(
    `/api/v1/admin/works/${id}/links/${linkId}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update link.',
  )

export const deleteAdminWorkLink = (id: string, linkId: string, session: Session) =>
  adminRequest<void>(
    `/api/v1/admin/works/${id}/links/${linkId}`,
    session,
    { method: 'DELETE' },
    'Unable to delete link.',
  )

export const fetchAdminWorkContent = (id: string, session: Session) =>
  adminRequest<AdminWorkContent[]>(
    `/api/v1/admin/works/${id}/content`,
    session,
    { method: 'GET' },
    'Unable to load content.',
  )

export const createAdminWorkContent = (
  id: string,
  input: Pick<AdminWorkContent, 'type' | 'sortOrder'>,
  session: Session,
) =>
  adminRequest<AdminWorkContent>(
    `/api/v1/admin/works/${id}/content`,
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to create content.',
  )

export const updateAdminWorkContent = (
  id: string,
  contentId: string,
  input: Pick<AdminWorkContent, 'type' | 'sortOrder'>,
  session: Session,
) =>
  adminRequest<AdminWorkContent>(
    `/api/v1/admin/works/${id}/content/${contentId}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update content.',
  )

export const upsertAdminWorkContentTranslation = (
  id: string,
  contentId: string,
  locale: WorkLocale,
  input: { title: string; description: string },
  session: Session,
) =>
  adminRequest<AdminWorkContent>(
    `/api/v1/admin/works/${id}/content/${contentId}/translations/${locale}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to save content translation.',
  )

export const deleteAdminWorkContent = (id: string, contentId: string, session: Session) =>
  adminRequest<void>(
    `/api/v1/admin/works/${id}/content/${contentId}`,
    session,
    { method: 'DELETE' },
    'Unable to delete content.',
  )

export const fetchAdminWorkMedia = (id: string, session: Session) =>
  adminRequest<AdminWorkMedia[]>(
    `/api/v1/admin/works/${id}/media`,
    session,
    { method: 'GET' },
    'Unable to load media.',
  )

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
  return adminRequest<AdminWorkMedia>(
    `/api/v1/admin/works/${id}/media`,
    session,
    { method: 'POST', body },
    'Unable to upload media.',
  )
}

export const deleteAdminWorkMedia = (id: string, mediaId: string, session: Session) =>
  adminRequest<void>(
    `/api/v1/admin/works/${id}/media/${mediaId}`,
    session,
    { method: 'DELETE' },
    'Unable to delete media.',
  )

export const publishAdminWork = (
  id: string,
  input: { featured: boolean; featuredOrder: number | null },
  session: Session,
) =>
  adminRequest<AdminWork>(
    `/api/v1/admin/works/${id}/publish`,
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to publish this work.',
  )

export const unpublishAdminWork = (id: string, session: Session) =>
  adminRequest<AdminWork>(
    `/api/v1/admin/works/${id}/unpublish`,
    session,
    { method: 'POST' },
    'Unable to unpublish this work.',
  )
