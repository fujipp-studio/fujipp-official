import type { Session } from '@supabase/supabase-js'

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

async function fetchAllCursorPages<T>(
  initialUrl: URL,
  headers: Record<string, string>,
  errorMessage: string,
): Promise<T[]> {
  const items: T[] = []
  let cursor: string | null = null
  do {
    const url = new URL(initialUrl)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    const response = await fetch(url, { headers })
    const page = await readJson<CursorPage<T>>(response, errorMessage)
    items.push(...page.items)
    cursor = page.hasMore ? page.nextCursor : null
  } while (cursor)
  return items
}

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
  walletBalanceSatang?: number
  walletBalance?: number
}

export interface StoreOffer {
  id: string
  code: string
  name: string
  kind: string
  priceSatang: number
  currency: string
  billingPeriodDays: number | null
  installationLimit: number
}

export interface StoreFeature {
  id: string
  code: string
  name: string
  description: string
  category: string
  iconKey: string
  image: { url: string; altText: string | null } | null
  tutorialUrl: string | null
  featured: boolean
  version: string
  offers: StoreOffer[]
}

export interface UserBot {
  id: string
  name: string
  discordApplicationId: string | null
  discordGuildId: string | null
  discordUsername: string | null
  discordAvatarUrl: string | null
  status: string
  desiredState: 'RUNNING' | 'STOPPED'
  restartRevision: number
  createdAt: string
  updatedAt: string
}

export interface FeatureLicense {
  id: string
  featureProductId: string
  featureCode: string
  featureName: string
  version: string
  latestVersionId: string | null
  latestVersion: string | null
  upgradeAvailable: boolean
  status: string
  installationLimit: number
  acquiredAt: string
  expiresAt: string | null
  installations: Array<{
    id: string
    botId: string
    botName: string
    status: string
    installedAt: string
  }>
}

export interface StoreOrder {
  id: string
  orderNumber: string
  status: string
  totalSatang: number
  currency: string
  paidAt: string | null
  licenseIds: string[]
}

export interface WalletTopupInvoice {
  invoiceId: string
  invoiceNumber: string
  amountSatang: number
  currency: string
  status: 'PENDING' | 'VERIFYING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
  promptPayAccountName: string
  qrImageUrl: string
  balanceSatang: number
  expiresAt: string
  completedAt: string | null
  createdAt: string
}

export type WalletTopupSummary = Pick<
  WalletTopupInvoice,
  | 'invoiceId'
  | 'invoiceNumber'
  | 'amountSatang'
  | 'currency'
  | 'status'
  | 'expiresAt'
  | 'completedAt'
  | 'createdAt'
>

export interface RuntimeSubscription {
  id: string
  slotNumber: number
  planId: string
  planName: string
  durationDays: number
  priceSatang: number
  currency: string
  botId: string | null
  botName: string | null
  status: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED'
  autoRenew: boolean
  currentPeriodEnd: string
  graceUntil: string | null
}

export interface RuntimeAvailability {
  totalSlots: number
  usedSlots: number
  availableSlots: number
  slots: Array<{ slotNumber: number; occupancy: 'AVAILABLE' | 'OCCUPIED' }>
}

export type FeatureConfigValue = string | number | boolean | string[] | Record<string, unknown>

export interface FeatureConfiguration {
  licenseId: string
  revision: number
  validatedForBotId: string | null
  fields: Array<{
    key: string
    label: string
    description: string
    type: string
    required: boolean
    secret: boolean
    defaultValue: FeatureConfigValue | null
    value: FeatureConfigValue | null
    configured: boolean
    validation: Record<string, unknown> | null
    ui: Record<string, unknown> | null
  }>
  presentations: Array<{
    slotId: string
    key: string
    label: string
    description: string
    type: string
    availableVariables: string[]
    defaultDefinition: Record<string, unknown>
    overrideDefinition: Record<string, unknown> | null
  }>
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

  const user = await readJson<CurrentUser>(response, 'Unable to load your account.')
  const rawObj = user as unknown as Record<string, unknown>
  const rawSatang = rawObj.walletBalanceSatang ?? rawObj.balanceSatang ?? rawObj.balance_satang
  if (typeof rawSatang === 'number') {
    user.walletBalanceSatang = rawSatang
    user.walletBalance = rawSatang / 100
  } else if (user.walletBalanceSatang !== undefined) {
    user.walletBalance = user.walletBalanceSatang / 100
  } else {
    user.walletBalanceSatang = 0
    user.walletBalance = 0
  }
  return user
}

export async function fetchWorks(locale: WorkLocale): Promise<WorkSummary[]> {
  const url = new URL(`${backendUrl}/api/v2/works`)
  url.searchParams.set('locale', locale)
  return fetchAllCursorPages<WorkSummary>(url, { Accept: 'application/json' }, 'Unable to load portfolio projects.')
}

export async function fetchWork(slug: string, locale: WorkLocale): Promise<WorkDetail> {
  const query = new URLSearchParams({ locale })
  const response = await fetch(`${backendUrl}/api/v1/works/${encodeURIComponent(slug)}?${query}`, {
    headers: { Accept: 'application/json' },
  })

  return readJson<WorkDetail>(response, 'Unable to load this portfolio project.')
}

function adminHeaders(session: Session, contentType = true) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  }
}

function authenticatedHeaders(session: Session, contentType = false) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  }
}

export async function fetchStoreFeatures(signal?: AbortSignal): Promise<StoreFeature[]> {
  const response = await fetch(`${backendUrl}/api/v1/store/features`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  return readJson<StoreFeature[]>(response, 'Unable to load the store.')
}

export async function checkoutStoreOffer(
  offerId: string,
  quantity: number,
  session: Session,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<StoreOrder> {
  const response = await fetch(`${backendUrl}/api/v1/store/orders`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify({ offerId, quantity, idempotencyKey }),
  })
  return readJson<StoreOrder>(response, 'Unable to complete this purchase.')
}

export async function createWalletTopup(
  amountSatang: number,
  session: Session,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<WalletTopupInvoice> {
  const response = await fetch(`${backendUrl}/api/v1/wallet/topups`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify({ amountSatang, idempotencyKey }),
  })
  return readJson<WalletTopupInvoice>(response, 'Unable to create a top-up request.')
}

export async function fetchWalletTopup(
  invoiceId: string,
  session: Session,
): Promise<WalletTopupInvoice> {
  const response = await fetch(
    `${backendUrl}/api/v1/wallet/topups/${encodeURIComponent(invoiceId)}`,
    { headers: authenticatedHeaders(session) },
  )
  return readJson<WalletTopupInvoice>(response, 'Unable to load the top-up request.')
}

export async function listWalletTopups(
  session: Session,
  cursor?: string | null,
  limit = 10,
): Promise<CursorPage<WalletTopupSummary>> {
  const url = new URL(`${backendUrl}/api/v1/wallet/topups`)
  url.searchParams.set('limit', String(limit))
  if (cursor) url.searchParams.set('cursor', cursor)
  const response = await fetch(url, { headers: authenticatedHeaders(session) })
  return readJson<CursorPage<WalletTopupSummary>>(response, 'Unable to load top-up history.')
}

export async function verifyWalletTopupSlip(
  invoiceId: string,
  file: File,
  session: Session,
): Promise<WalletTopupInvoice> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(
    `${backendUrl}/api/v1/wallet/topups/${encodeURIComponent(invoiceId)}/slip`,
    { method: 'POST', headers: authenticatedHeaders(session), body },
  )
  return readJson<WalletTopupInvoice>(response, 'Unable to verify the payment slip.')
}

export async function purchaseRuntime(planId: string, session: Session) {
  const response = await fetch(`${backendUrl}/api/v1/runtime/subscriptions`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify({ planId }),
  })
  return readJson<RuntimeSubscription>(response, 'Unable to purchase this Runtime slot.')
}

export async function fetchRuntimeAvailability(signal?: AbortSignal) {
  const response = await fetch(`${backendUrl}/api/v1/runtime/availability`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  return readJson<RuntimeAvailability>(response, 'Unable to load Runtime availability.')
}

export async function fetchRuntimeSubscriptions(session: Session) {
  const response = await fetch(`${backendUrl}/api/v1/runtime/subscriptions`, {
    headers: authenticatedHeaders(session),
  })
  return readJson<RuntimeSubscription[]>(response, 'Unable to load Runtime slots.')
}

export async function assignRuntime(subscriptionId: string, botId: string, session: Session) {
  const response = await fetch(`${backendUrl}/api/v1/runtime/subscriptions/${subscriptionId}/bot`, {
    method: 'PUT',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify({ botId }),
  })
  return readJson<RuntimeSubscription>(response, 'Unable to assign this Runtime slot.')
}

export async function updateRuntimeAutoRenew(
  subscriptionId: string,
  autoRenew: boolean,
  session: Session,
) {
  const response = await fetch(
    `${backendUrl}/api/v1/runtime/subscriptions/${subscriptionId}/auto-renew`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify({ autoRenew }),
    },
  )
  return readJson<RuntimeSubscription>(response, 'Unable to update automatic renewal.')
}

export async function renewRuntime(subscriptionId: string, session: Session) {
  const response = await fetch(
    `${backendUrl}/api/v1/runtime/subscriptions/${subscriptionId}/renew`,
    {
      method: 'POST',
      headers: authenticatedHeaders(session),
    },
  )
  return readJson<RuntimeSubscription>(response, 'Unable to renew this Runtime slot.')
}

export async function fetchBots(session: Session): Promise<UserBot[]> {
  return fetchAllCursorPages<UserBot>(new URL(`${backendUrl}/api/v2/bots`), authenticatedHeaders(session), 'Unable to load your bots.')
}

export async function createBot(
  input: { name: string; discordApplicationId: string | null; discordGuildId: string | null },
  session: Session,
): Promise<UserBot> {
  const response = await fetch(`${backendUrl}/api/v1/bots`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify(input),
  })
  return readJson<UserBot>(response, 'Unable to create this bot.')
}

export async function updateBot(
  botId: string,
  input: { name: string; discordApplicationId: string | null; discordGuildId: string | null },
  session: Session,
): Promise<UserBot> {
  const response = await fetch(`${backendUrl}/api/v1/bots/${encodeURIComponent(botId)}`, {
    method: 'PUT',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify(input),
  })
  return readJson<UserBot>(response, 'Unable to update this bot.')
}

export async function updateBotDiscordToken(
  botId: string,
  token: string,
  session: Session,
): Promise<UserBot> {
  const response = await fetch(
    `${backendUrl}/api/v1/bots/${encodeURIComponent(botId)}/credentials/discord-token`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify({ token }),
    },
  )
  return readJson<UserBot>(response, 'Unable to update the Discord token.')
}

export async function syncBotDiscordProfile(botId: string, session: Session): Promise<UserBot> {
  const response = await fetch(
    `${backendUrl}/api/v1/bots/${encodeURIComponent(botId)}/discord-profile/sync`,
    { method: 'POST', headers: authenticatedHeaders(session) },
  )
  return readJson<UserBot>(response, 'Unable to sync the Discord bot profile.')
}

export async function controlBot(
  botId: string,
  action: 'start' | 'stop' | 'restart',
  session: Session,
): Promise<UserBot> {
  const response = await fetch(`${backendUrl}/api/v1/bots/${encodeURIComponent(botId)}/${action}`, {
    method: 'POST',
    headers: authenticatedHeaders(session),
  })
  return readJson<UserBot>(response, `Unable to ${action} this bot.`)
}

export async function fetchFeatureLicenses(session: Session): Promise<FeatureLicense[]> {
  const response = await fetch(`${backendUrl}/api/v1/feature-licenses`, {
    headers: authenticatedHeaders(session),
  })
  return readJson<FeatureLicense[]>(response, 'Unable to load your items.')
}

export async function installFeatureLicense(
  licenseId: string,
  botId: string,
  session: Session,
): Promise<{ installationId: string }> {
  const response = await fetch(
    `${backendUrl}/api/v1/feature-licenses/${encodeURIComponent(licenseId)}/installations`,
    {
      method: 'POST',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify({ botId }),
    },
  )
  return readJson(response, 'Unable to install this feature.')
}

export async function upgradeFeatureLicense(licenseId:string,session:Session):Promise<FeatureLicense>{
  const response=await fetch(`${backendUrl}/api/v1/feature-licenses/${encodeURIComponent(licenseId)}/upgrade`,{
    method:'POST',headers:authenticatedHeaders(session,true),
  })
  return readJson<FeatureLicense>(response,'Unable to upgrade this feature.')
}

export async function fetchFeatureConfiguration(licenseId: string, session: Session) {
  const response = await fetch(
    `${backendUrl}/api/v1/feature-licenses/${encodeURIComponent(licenseId)}/configuration`,
    { headers: authenticatedHeaders(session) },
  )
  return readJson<FeatureConfiguration>(response, 'Unable to load feature settings.')
}

export async function updateFeatureConfiguration(
  licenseId: string,
  input: {
    values: Record<string, FeatureConfigValue>
    secrets: Record<string, string>
    presentations: Record<string, Record<string, unknown>>
  },
  session: Session,
) {
  const response = await fetch(
    `${backendUrl}/api/v1/feature-licenses/${encodeURIComponent(licenseId)}/configuration`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify(input),
    },
  )
  return readJson<FeatureConfiguration>(response, 'Unable to save feature settings.')
}

export async function fetchAdminWork(id: string, session: Session): Promise<AdminWork> {
  const response = await fetch(`${backendUrl}/api/v1/admin/works/${encodeURIComponent(id)}`, {
    headers: adminHeaders(session, false),
  })
  return readJson<AdminWork>(response, 'Unable to load this work.')
}

export async function fetchAdminWorks(session: Session): Promise<AdminWork[]> {
  const response = await fetch(`${backendUrl}/api/v1/admin/works`, {
    headers: adminHeaders(session, false),
  })
  return readJson<AdminWork[]>(response, 'Unable to load works.')
}

export async function createAdminWork(input: AdminWorkInput, session: Session): Promise<AdminWork> {
  const response = await fetch(`${backendUrl}/api/v1/admin/works`, {
    method: 'POST',
    headers: adminHeaders(session),
    body: JSON.stringify(input),
  })
  return readJson<AdminWork>(response, 'Unable to create this work.')
}

export async function updateAdminWork(
  id: string,
  input: AdminWorkInput,
  session: Session,
): Promise<AdminWork> {
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

export const saveAdminWorkDraft = (
  id: string,
  input: SaveAdminWorkDraftInput,
  session: Session,
) => adminRequest<SaveAdminWorkDraftResponse>(
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

export interface AdminUserSummary {
  customerId: string
  userId: string | null
  customerCode: string
  email: string | null
  displayName: string | null
  status: string
  role: string
  balanceSatang: number
  createdAt: string
}

export interface AdminWalletHistoryEntry {
  id: string
  direction: 'CREDIT' | 'DEBIT'
  entryType: string
  amountSatang: number
  balanceBeforeSatang: number
  balanceAfterSatang: number
  referenceType: string | null
  referenceId: string | null
  description: string | null
  createdAt: string
}

export interface AdminWalletHistoryResponse {
  customerId: string
  walletId: string
  currentBalanceSatang: number
  entries: AdminWalletHistoryEntry[]
}

export async function fetchAdminUsers(
  session: Session,
  query?: string,
): Promise<AdminUserSummary[]> {
  const url = new URL(`${backendUrl}/api/v2/admin/users`)
  if (query) url.searchParams.set('query', query)
  return fetchAllCursorPages<AdminUserSummary>(url, adminHeaders(session, false), 'โหลดรายการผู้ใช้ไม่สำเร็จ')
}

export async function adjustUserWallet(
  customerId: string,
  input: {
    direction: 'CREDIT' | 'DEBIT'
    entryType: string
    amountSatang: number
    description?: string
    idempotencyKey: string
  },
  session: Session,
): Promise<void> {
  const response = await fetch(
    `${backendUrl}/api/v1/admin/users/${encodeURIComponent(customerId)}/wallet/adjust`,
    {
      method: 'POST',
      headers: adminHeaders(session),
      body: JSON.stringify(input),
    },
  )
  if (!response.ok) {
    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch {}
    throw new Error(
      `ปรับปรุงยอดเงินไม่สำเร็จ (HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''})`,
    )
  }
}

export type AdminAccountRole = 'USER' | 'TESTER' | 'EDITOR' | 'ADMIN'
export type AdminAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DEACTIVATED'

export interface AdminFeatureLicense {
  id: string
  featureProductId: string
  featureCode: string
  featureName: string
  version: string
  status: string
  installationLimit: number
  acquiredAt: string
  expiresAt: string | null
}

export interface AdminFeatureOffer {
  id: string
  code: string
  name: string
  kind: string
  priceSatang: number
  currency: string
  billingPeriodDays: number | null
  installationLimit: number
  active: boolean
  startsAt: string | null
  endsAt: string | null
}

export interface AdminFeature {
  id: string
  code: string
  name: string
  description: string
  category: string
  iconKey: string | null
  imageUrl: string | null
  imageAltText: string | null
  tutorialUrl: string | null
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  featured: boolean
  sortOrder: number
  latestVersion: string | null
  versionStatus: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | null
  publishedAt: string | null
  offers: AdminFeatureOffer[]
}

export interface AdminBot {
  id: string
  ownerUserId: string
  ownerDisplayName: string
  name: string
  status: string
  desiredState: string
  createdAt: string
}

export interface AdminRuntimePlan {
  id: string
  code: string
  name: string
  durationDays: number
  priceSatang: number
  currency: string
  active: boolean
  sortOrder: number
}

export interface AdminRuntimeSubscription {
  id: string
  slotNumber: number
  ownerUserId: string
  ownerDisplayName: string
  planId: string
  planName: string
  botId: string | null
  botName: string | null
  status: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED'
  autoRenew: boolean
  periodStart: string
  periodEnd: string
  graceUntil: string | null
}

export const updateAdminUser = (
  userId: string,
  input: {
    role: AdminAccountRole
    status: AdminAccountStatus
    displayName?: string
    firstName?: string
    lastName?: string
  },
  session: Session,
) =>
  adminRequest<AdminUserSummary>(
    `/api/v1/admin/users/${userId}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update user.',
  )
export const fetchAdminUserFeatures = (userId: string, session: Session) =>
  adminRequest<AdminFeatureLicense[]>(
    `/api/v1/admin/users/${userId}/features`,
    session,
    { method: 'GET' },
    'Unable to load user features.',
  )
export const grantAdminUserFeature = (
  userId: string,
  input: { featureProductId: string; installationLimit: number; expiresAt?: string },
  session: Session,
) =>
  adminRequest<AdminFeatureLicense>(
    `/api/v1/admin/users/${userId}/features`,
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to grant feature.',
  )
export const updateAdminUserFeature = (
  userId: string,
  licenseId: string,
  input: { status: string; installationLimit: number; expiresAt?: string | null },
  session: Session,
) =>
  adminRequest<AdminFeatureLicense>(
    `/api/v1/admin/users/${userId}/features/${licenseId}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update feature license.',
  )

export const fetchAdminFeatures = (session: Session) =>
  adminRequest<AdminFeature[]>(
    '/api/v1/admin/store/features',
    session,
    { method: 'GET' },
    'Unable to load features.',
  )
export const updateAdminFeature = (
  id: string,
  input: Pick<
    AdminFeature,
    'name' | 'description' | 'category' | 'iconKey' | 'status' | 'featured' | 'sortOrder'
  >,
  session: Session,
) =>
  adminRequest<AdminFeature>(
    `/api/v1/admin/store/features/${id}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update feature.',
  )
export const updateAdminFeatureOffer = (
  featureId: string,
  offerId: string,
  input: {
    name: string
    priceSatang: number
    installationLimit: number
    active: boolean
    startsAt?: string | null
    endsAt?: string | null
  },
  session: Session,
) =>
  adminRequest<AdminFeature>(
    `/api/v1/admin/store/features/${featureId}/offers/${offerId}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update offer.',
  )
export const createAdminFeatureOffer = (
  featureId: string,
  input: {
    code: string
    name: string
    kind: 'ONE_TIME' | 'SUBSCRIPTION'
    priceSatang: number
    installationLimit: number
    billingPeriodDays?: number | null
    active: boolean
    startsAt?: string | null
    endsAt?: string | null
  },
  session: Session,
) =>
  adminRequest<AdminFeature>(
    `/api/v1/admin/store/features/${featureId}/offers`,
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to create offer.',
  )
export const publishAdminFeature = (featureId: string, session: Session) =>
  adminRequest<AdminFeature>(
    `/api/v1/admin/store/features/${featureId}/publish`,
    session,
    { method: 'POST' },
    'Unable to publish feature version.',
  )
export const updateAdminFeatureTutorial = (
  featureId: string,
  tutorialUrl: string | null,
  session: Session,
) =>
  adminRequest<unknown>(
    `/api/v1/admin/store/features/${featureId}/tutorial`,
    session,
    { method: 'PUT', body: JSON.stringify({ tutorialUrl }) },
    'Unable to update tutorial.',
  )
export async function uploadAdminFeatureImage(
  featureId: string,
  file: File,
  altText: string,
  session: Session,
) {
  const body = new FormData()
  if (altText.trim()) body.append('altText', altText.trim())
  body.append('file', file)
  return adminRequest<unknown>(
    `/api/v1/admin/store/features/${featureId}/image`,
    session,
    { method: 'POST', body },
    'Unable to upload feature image.',
  )
}
export const deleteAdminFeatureImage = (featureId: string, session: Session) =>
  adminRequest<void>(
    `/api/v1/admin/store/features/${featureId}/image`,
    session,
    { method: 'DELETE' },
    'Unable to delete feature image.',
  )

export async function fetchAdminBots(session: Session, query?: string) {
  const url = new URL(`${backendUrl}/api/v2/admin/bots`)
  if (query) url.searchParams.set('query', query)
  return fetchAllCursorPages<AdminBot>(url, adminHeaders(session, false), 'Unable to load bots.')
}
export const transferAdminBot = (botId: string, newOwnerUserId: string, session: Session) =>
  adminRequest<AdminBot>(
    `/api/v1/admin/bots/${botId}/transfer`,
    session,
    { method: 'POST', body: JSON.stringify({ newOwnerUserId }) },
    'Unable to transfer bot.',
  )
export const controlAdminBot = (botId: string, action: 'start' | 'stop' | 'restart', session: Session) =>
  adminRequest<AdminBot>(
    `/api/v1/admin/bots/${botId}/${action}`,
    session,
    { method: 'POST' },
    `Unable to ${action} bot.`,
  )
export const fetchAdminBotSettings = (botId: string, session: Session) =>
  adminRequest<UserBot>(`/api/v1/admin/bots/${botId}/settings`, session, { method: 'GET' }, 'Unable to load bot settings.')
export const updateAdminBotSettings = (botId: string, input: { name: string; discordApplicationId: string | null; discordGuildId: string | null }, session: Session) =>
  adminRequest<UserBot>(`/api/v1/admin/bots/${botId}/settings`, session, { method: 'PUT', body: JSON.stringify(input) }, 'Unable to update bot settings.')
export const fetchAdminBotLicenses=(botId:string,session:Session)=>adminRequest<FeatureLicense[]>(
  `/api/v1/admin/bots/${botId}/licenses`,session,{method:'GET'},'Unable to load bot features.')
export const fetchAdminFeatureConfiguration=(botId:string,licenseId:string,session:Session)=>adminRequest<FeatureConfiguration>(
  `/api/v1/admin/bots/${botId}/licenses/${licenseId}/configuration`,session,{method:'GET'},'Unable to load feature settings.')
export const updateAdminFeatureConfiguration=(botId:string,licenseId:string,input:{values:Record<string,FeatureConfigValue>;secrets:Record<string,string>;presentations:Record<string,Record<string,unknown>>},session:Session)=>adminRequest<FeatureConfiguration>(
  `/api/v1/admin/bots/${botId}/licenses/${licenseId}/configuration`,session,{method:'PUT',body:JSON.stringify(input)},'Unable to save feature settings.')

export const fetchAdminRuntimePlans = (session: Session) =>
  adminRequest<AdminRuntimePlan[]>(
    '/api/v1/admin/runtime/plans',
    session,
    { method: 'GET' },
    'Unable to load runtime plans.',
  )
export const updateAdminRuntimePlan = (
  id: string,
  input: {
    name: string
    durationDays: number
    priceSatang: number
    active: boolean
    sortOrder: number
  },
  session: Session,
) =>
  adminRequest<AdminRuntimePlan>(
    `/api/v1/admin/runtime/plans/${id}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update runtime plan.',
  )
export const fetchAdminRuntimeSubscriptions = (session: Session, ownerUserId?: string) => {
  const url = new URL(`${backendUrl}/api/v2/admin/runtime/subscriptions`)
  if (ownerUserId) url.searchParams.set('ownerUserId', ownerUserId)
  return fetchAllCursorPages<AdminRuntimeSubscription>(url, adminHeaders(session, false), 'Unable to load runtime subscriptions.')
}
export const grantAdminRuntime = (
  input: {
    ownerUserId: string
    planId: string
    botId?: string
    periodEnd?: string
    autoRenew: boolean
  },
  session: Session,
) =>
  adminRequest<AdminRuntimeSubscription>(
    '/api/v1/admin/runtime/subscriptions',
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to grant runtime.',
  )
export const updateAdminRuntime = (
  id: string,
  input: {
    status: string
    planId: string
    botId?: string | null
    periodEnd: string
    autoRenew: boolean
  },
  session: Session,
) =>
  adminRequest<AdminRuntimeSubscription>(
    `/api/v1/admin/runtime/subscriptions/${id}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update runtime.',
  )

export async function fetchUserWalletHistory(
  customerId: string,
  session: Session,
): Promise<AdminWalletHistoryResponse> {
  const response = await fetch(
    `${backendUrl}/api/v1/admin/users/${encodeURIComponent(customerId)}/wallet/history`,
    {
      headers: adminHeaders(session, false),
    },
  )
  if (!response.ok) {
    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch {}
    throw new Error(
      `โหลดประวัติกระเป๋าไม่สำเร็จ (HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''})`,
    )
  }
  const metadata = (await response.json()) as AdminWalletHistoryResponse
  const url = new URL(`${backendUrl}/api/v2/admin/users/${encodeURIComponent(customerId)}/wallet/history`)
  metadata.entries = await fetchAllCursorPages<AdminWalletHistoryEntry>(url, adminHeaders(session, false), 'โหลดประวัติกระเป๋าไม่สำเร็จ')
  return metadata
}
