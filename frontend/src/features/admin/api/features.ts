import type { Session } from '@supabase/supabase-js'
import { adminRequest } from '@/shared/api/http'

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
