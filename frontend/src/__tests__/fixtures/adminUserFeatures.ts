import type { AdminFeatureLicense, AdminUserSummary } from '@/features/admin/api/users'
import { user, bot } from './domain'

export const featureOwner: AdminUserSummary = {
  customerId: 'fixture-customer',
  userId: user.id,
  customerCode: 'TEST-001',
  displayName: 'Feature owner',
  email: 'owner@example.invalid',
  role: 'USER',
  status: 'ACTIVE',
  balanceSatang: 100000,
  createdAt: bot.createdAt,
}
export function adminUserFeatures(): AdminFeatureLicense[] {
  return [
    {
      id: 'review-license',
      featureProductId: 'review-product',
      featureCode: 'review-credit',
      featureName: 'Review Credit',
      installationCount: 1,
      installationLimit: 2,
    },
    {
      id: 'unused-core-license',
      featureProductId: 'presence-product',
      featureCode: 'bot-presence',
      featureName: 'Bot Presence',
      installationCount: 0,
      installationLimit: 1,
    },
    {
      id: 'installed-core-license',
      featureProductId: 'permissions-product',
      featureCode: 'bot-permissions',
      featureName: 'Bot Permissions',
      installationCount: 1,
      installationLimit: 1,
    },
  ].map((item) => ({
    ...item,
    version: '1.0.0',
    status: 'ACTIVE',
    acquiredAt: bot.createdAt,
    expiresAt: null,
  }))
}
