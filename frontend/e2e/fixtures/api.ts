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
const donationCampaign = {
  title: 'Support Fujipp',
  description: '',
  goalSatang: 10000000,
  raisedSatang: 6750000,
  supporterCount: 8,
  leaderboard: [
    {
      rank: 1,
      displayName: 'Mochi Studio',
      totalSatang: 2500000,
      donationCount: 3,
      lastDonatedAt: bot.createdAt,
    },
    {
      rank: 2,
      displayName: 'Anonymous',
      totalSatang: 1500000,
      donationCount: 1,
      lastDonatedAt: bot.createdAt,
    },
    {
      rank: 3,
      displayName: 'Krit',
      totalSatang: 1000000,
      donationCount: 2,
      lastDonatedAt: bot.createdAt,
    },
    {
      rank: 4,
      displayName: 'Mint',
      totalSatang: 750000,
      donationCount: 2,
      lastDonatedAt: bot.createdAt,
    },
    {
      rank: 5,
      displayName: 'Beam',
      totalSatang: 420000,
      donationCount: 1,
      lastDonatedAt: bot.createdAt,
    },
    {
      rank: 6,
      displayName: 'Anonymous',
      totalSatang: 300000,
      donationCount: 1,
      lastDonatedAt: bot.createdAt,
    },
    {
      rank: 7,
      displayName: 'Palm',
      totalSatang: 180000,
      donationCount: 1,
      lastDonatedAt: bot.createdAt,
    },
    {
      rank: 8,
      displayName: 'Nam',
      totalSatang: 100000,
      donationCount: 1,
      lastDonatedAt: bot.createdAt,
    },
  ],
  updatedAt: bot.createdAt,
}
export function fixtureResponse(path: string, method: string, input: Record<string, unknown>) {
  if (path === '/api/v1/auth/me') return user
  if (path === '/api/v1/auth/me/profile')
    return {
      id: user.id,
      username: user.username,
      displayName: input.displayName ?? user.displayName,
      firstName: input.firstName ?? user.firstName,
      lastName: input.lastName ?? user.lastName,
      avatarUrl: user.avatarUrl,
      profileCompletedAt: user.profileCompletedAt,
    }
  if (path === '/api/v1/auth/me/username')
    return {
      id: user.id,
      username: input.username,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      profileCompletedAt: bot.createdAt,
    }
  if (path === '/api/v1/auth/me/avatar')
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: method === 'POST' ? '/images/profile/avatar-placeholder.png' : null,
      profileCompletedAt: user.profileCompletedAt,
    }
  if (path === '/api/v1/donations/campaign') return donationCampaign
  if (path === '/api/v1/admin/donations/settings')
    return { ...donationCampaign, ...input }
  if (path === '/api/v1/donations' && method === 'POST')
    return {
      donationId: 'fixture-donation',
      donationNumber: 'DON_FIXTURE',
      donorName: input.anonymous ? 'Anonymous' : input.donorName,
      message: input.message || null,
      anonymous: Boolean(input.anonymous),
      amountSatang: input.amountSatang,
      currency: 'THB',
      fundingMethod: input.fundingMethod,
      status: input.fundingMethod === 'WALLET' ? 'SUCCESS' : 'PENDING',
      balanceSatang: 90000,
      completedAt: input.fundingMethod === 'WALLET' ? bot.createdAt : null,
      createdAt: bot.createdAt,
    }
  if (path === '/api/v1/donations/fixture-donation' && method === 'GET')
    return {
      donationId: 'fixture-donation',
      donationNumber: 'DON_FIXTURE',
      donorName: user.displayName,
      message: null,
      anonymous: false,
      amountSatang: 10000,
      currency: 'THB',
      fundingMethod: 'TOPUP',
      status: 'SUCCESS',
      balanceSatang: 100000,
      completedAt: bot.createdAt,
      createdAt: bot.createdAt,
    }
  if (path === '/api/v1/wallet/topups' && method === 'POST')
    return {
      invoiceId: 'fixture-topup',
      invoiceNumber: 'TPU_FIXTURE',
      amountSatang: input.amountSatang,
      currency: 'THB',
      status: 'PENDING',
      promptPayAccountName: 'Anawat Boripakhirun',
      qrImageUrl:
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="white"/%3E%3Cpath d="M8 8h28v28H8zm56 0h28v28H64zM8 64h28v28H8zm40-16h12v12H48zm20 0h8v20h-8zm-20 24h20v8H48zm28 4h16v16H76z" fill="black"/%3E%3C/svg%3E',
      balanceSatang: 100000,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      completedAt: null,
      createdAt: bot.createdAt,
    }
  if (path === '/api/v1/wallet/topups/fixture-topup/slip' && method === 'POST')
    return {
      invoiceId: 'fixture-topup',
      invoiceNumber: 'TPU_FIXTURE',
      amountSatang: 10000,
      currency: 'THB',
      status: 'SUCCESS',
      promptPayAccountName: 'Anawat Boripakhirun',
      qrImageUrl: '',
      balanceSatang: 100000,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      completedAt: bot.createdAt,
      createdAt: bot.createdAt,
    }
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
