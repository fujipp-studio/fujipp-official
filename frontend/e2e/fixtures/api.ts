import {
  bot,
  configuration,
  feature,
  license,
  runtimeSubscription,
  user,
} from '../../src/__tests__/fixtures/domain'
import type { AdminUserSummary } from '../../src/features/admin/api/users'
const page = (items: unknown[]) => ({ items, nextCursor: null, hasMore: false })
const customer: AdminUserSummary = {
  customerId: 'fixture-customer',
  userId: user.id,
  customerCode: 'TEST-001',
  displayName: user.displayName,
  email: user.email,
  role: 'USER',
  status: 'ACTIVE',
  balanceSatang: 100000,
  createdAt: bot.createdAt,
}
export function fixtureResponse(path: string, method: string, input: Record<string, unknown>) {
  if (path === '/api/v1/auth/me') return user
  if (path.endsWith('/configuration'))
    return method === 'PUT' ? { ...configuration, revision: 2 } : configuration
  if (path.endsWith('/settings')) return method === 'PUT' ? { ...bot, ...input } : bot
  if (path.endsWith('/start') || path.endsWith('/stop') || path.endsWith('/restart'))
    return { ...bot, desiredState: path.endsWith('/stop') ? 'STOPPED' : 'RUNNING' }
  if (path === '/api/v2/bots') return page([bot])
  if (path === '/api/v2/admin/bots')
    return page([{ ...bot, ownerUserId: user.id, ownerDisplayName: user.displayName }])
  if (path.endsWith('/licenses') || path === '/api/v1/feature-licenses') return [license]
  if (path === '/api/v1/store/features') return [feature]
  if (path === '/api/v1/store/orders')
    return {
      id: 'fixture-order',
      orderNumber: 'TEST-ORDER-001',
      status: 'PAID',
      totalSatang: 10000,
      currency: 'THB',
      paidAt: bot.createdAt,
      licenseIds: [license.id],
    }
  if (path === '/api/v1/runtime/availability')
    return {
      totalSlots: 2,
      usedSlots: 1,
      availableSlots: 1,
      slots: [
        { slotNumber: 1, occupancy: 'OCCUPIED' },
        { slotNumber: 2, occupancy: 'AVAILABLE' },
      ],
    }
  if (path.endsWith('/renew') && path.startsWith('/api/v1/runtime/subscriptions/'))
    return { ...runtimeSubscription, currentPeriodEnd: '2026-10-03T00:00:00Z' }
  if (path === '/api/v1/runtime/subscriptions') return [runtimeSubscription]
  if (path === '/api/v1/admin/store/features')
    return [
      {
        ...feature,
        status: 'ACTIVE',
        sortOrder: 0,
        latestVersion: feature.version,
        versionStatus: 'PUBLISHED',
        publishedAt: bot.createdAt,
        imageUrl: null,
        imageAltText: null,
      },
    ]
  if (path === '/api/v2/admin/users') return page([customer])
  if (path === `/api/v1/admin/users/${user.id}`) return { ...customer, ...input }
  if (path.startsWith('/api/v2/')) return page([])
  return []
}
