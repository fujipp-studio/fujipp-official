import { beforeEach, expect, it, vi } from 'vitest'
import { testQueryClient as client } from './setupQuery'
import { clearAccountQueries } from '@/shared/api/queryClient'
import { storeCatalogQuery, runtimeAvailabilityQuery } from '@/features/store/queries'
import { donationCampaignQuery } from '@/features/donation/queries'
import { workDetailQuery } from '@/features/work/queries'
import { accountKeys, botListQuery, botDetailQuery, cacheBot } from '@/features/bots/queries'
import { fetchStoreFeatures } from '@/features/store/api'
import { fetchRuntimeAvailability } from '@/features/bots/runtime-api'
import { fetchDonationCampaign, type DonationCampaign } from '@/features/donation/api'
import { fetchWork, type WorkDetail } from '@/features/work/api'
import { fetchBots, fetchBot } from '@/features/bots/api'
import { bot, session, deferred } from './fixtures/domain'

vi.mock('@/features/store/api', () => ({ fetchStoreFeatures: vi.fn<typeof fetchStoreFeatures>() }))
vi.mock('@/features/bots/runtime-api', () => ({
  fetchRuntimeAvailability: vi.fn<typeof fetchRuntimeAvailability>(),
  fetchRuntimeSubscriptions: vi.fn<typeof import('@/features/bots/runtime-api').fetchRuntimeSubscriptions>(),
}))
vi.mock('@/features/donation/api', () => ({ fetchDonationCampaign: vi.fn<typeof fetchDonationCampaign>() }))
vi.mock('@/features/work/api', () => ({ fetchWork: vi.fn<typeof fetchWork>() }))
vi.mock('@/features/bots/api', () => ({
  fetchBots: vi.fn<typeof fetchBots>(), fetchBot: vi.fn<typeof fetchBot>(),
  fetchFeatureLicenses: vi.fn<typeof import('@/features/bots/api').fetchFeatureLicenses>(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchStoreFeatures).mockResolvedValue([])
  vi.mocked(fetchRuntimeAvailability).mockResolvedValue({ totalSlots: 1, usedSlots: 0, availableSlots: 1, slots: [] })
  vi.mocked(fetchDonationCampaign).mockResolvedValue({ raisedSatang: 100 } as DonationCampaign)
  vi.mocked(fetchWork).mockImplementation(async (slug) => ({ slug } as WorkDetail))
  vi.mocked(fetchBot).mockResolvedValue(bot)
  vi.mocked(fetchBots).mockResolvedValue([bot])
})

it('shares catalog reads between prefetch and a page, then keeps the fresh cache', async () => {
  await Promise.all([client.query(storeCatalogQuery()), client.query(storeCatalogQuery())])
  await client.query(storeCatalogQuery())
  expect(fetchStoreFeatures).toHaveBeenCalledTimes(1)
})

it('checks Runtime capacity again even when an earlier result is cached', async () => {
  await client.query(runtimeAvailabilityQuery())
  vi.mocked(fetchRuntimeAvailability).mockResolvedValueOnce({ totalSlots: 1, usedSlots: 1, availableSlots: 0, slots: [] })
  const latest = await client.query(runtimeAvailabilityQuery())
  expect(latest.availableSlots).toBe(0)
  expect(fetchRuntimeAvailability).toHaveBeenCalledTimes(2)
})

it('refreshes a shared donation campaign after a successful donation invalidates it', async () => {
  await client.query(donationCampaignQuery())
  vi.mocked(fetchDonationCampaign).mockResolvedValueOnce({ raisedSatang: 200 } as DonationCampaign)
  await client.invalidateQueries({ queryKey: donationCampaignQuery().queryKey, refetchType: 'none' })
  expect((await client.query(donationCampaignQuery())).raisedSatang).toBe(200)
  expect(fetchDonationCampaign).toHaveBeenCalledTimes(2)
})

it('keeps project details reusable and separates projects and translations', async () => {
  for (const [slug, locale] of [['one', 'en'], ['one', 'en'], ['one', 'th'], ['two', 'en']] as const)
    await client.query(workDetailQuery(slug, locale))
  expect(fetchWork).toHaveBeenCalledTimes(3)
  expect(client.getQueryData(workDetailQuery('two', 'en').queryKey)?.slug).toBe('two')
})

it('cancels old-account reads on logout without discarding public data or leaking into another account', async () => {
  const pending = deferred<typeof bot[]>()
  vi.mocked(fetchBots).mockReturnValueOnce(pending.promise)
  await client.query(storeCatalogQuery())
  const old = client.query(botListQuery(session)).catch(() => undefined)
  clearAccountQueries(client)
  const other = { ...session, user: { ...session.user, id: 'other-user' } }
  vi.mocked(fetchBots).mockResolvedValueOnce([{ ...bot, id: 'other-bot' }])
  await client.query(botListQuery(other))
  pending.resolve([bot])
  await old
  expect(client.getQueryData(accountKeys.list(session))).toBeUndefined()
  expect(client.getQueryData(botListQuery(other).queryKey)?.[0]?.id).toBe('other-bot')
  expect(client.getQueryData(storeCatalogQuery().queryKey)).toEqual([])
  expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.queryKey))).not.toContain(session.access_token)
})

it('does not let an old status read overwrite a confirmed bot command', async () => {
  const pending = deferred<typeof bot>()
  vi.mocked(fetchBot).mockReturnValueOnce(pending.promise)
  client.setQueryData(accountKeys.list(session), [bot])
  const old = client.query(botDetailQuery(session, bot.id)).catch(() => undefined)
  await client.cancelQueries({ queryKey: accountKeys.bots(session) })
  cacheBot(client, session, { ...bot, name: 'Confirmed command' })
  pending.resolve(bot)
  await old
  expect(client.getQueryData(botDetailQuery(session, bot.id).queryKey)?.name).toBe('Confirmed command')
})
