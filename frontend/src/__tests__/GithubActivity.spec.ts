import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import GithubActivitySection from '@/features/work/components/GithubActivitySection.vue'
import { fetchGithubContributions, type GithubContributions } from '@/features/work/github'
import { githubActivityQuery } from '@/features/work/queries'
import { testQueryClient } from './setupQuery'
import { i18n } from '@/i18n'

vi.mock('@/features/work/github', () => ({ fetchGithubContributions: vi.fn<typeof fetchGithubContributions>() }))
const calendar: GithubContributions = {
  total: 3,
  contributions: [
    [
      { date: '2026-10-24', count: 0, intensity: '0' },
      { date: '2026-10-25', count: 3, intensity: '2' },
    ],
  ],
}
const load = (year = 'last') => testQueryClient.query(githubActivityQuery(year))
const cached = (year = 'last') => testQueryClient.getQueryData(githubActivityQuery(year).queryKey)

beforeEach(() => {
  vi.mocked(fetchGithubContributions).mockReset().mockResolvedValue(calendar)
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }
      disconnect() {}
    },
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('shares a preload with navigation and caches each selected year', async () => {
  let resolve!: (data: GithubContributions) => void
  vi.mocked(fetchGithubContributions).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    }),
  )
  const warmup = load()
  const navigation = load()
  expect(fetchGithubContributions).toHaveBeenCalledTimes(1)
  resolve(calendar)
  await Promise.all([warmup, navigation])
  await load()
  await load('2025')
  await load('2025')
  expect(fetchGithubContributions).toHaveBeenCalledTimes(2)
  expect(cached()?.total).toBe(3)
  expect(cached('2025')?.total).toBe(3)
})

it('retains the previous calendar during a failed refresh and retries later', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  await load()
  now += 10 * 60_000 + 1
  vi.mocked(fetchGithubContributions).mockRejectedValueOnce(new Error('Offline'))
  await expect(load()).rejects.toThrow('Offline')
  expect(cached()?.total).toBe(3)
  expect(testQueryClient.getQueryData(githubActivityQuery().queryKey)).toBeDefined()
  vi.mocked(fetchGithubContributions).mockResolvedValueOnce({ ...calendar, total: 4 })
  await load()
  expect(cached()?.total).toBe(4)
})

it('exposes an initial failure and deduplicates forced retries', async () => {
  vi.mocked(fetchGithubContributions).mockRejectedValueOnce(new Error('Offline'))
  await expect(load()).rejects.toThrow('Offline')
  expect(testQueryClient.getQueryState(githubActivityQuery().queryKey)?.status).toBe('error')
  await Promise.all([load('last'), load('last')])
  expect(fetchGithubContributions).toHaveBeenCalledTimes(2)
  expect(testQueryClient.getQueryData(githubActivityQuery().queryKey)).toBeDefined()
})

it('keeps responses for different years isolated when they finish out of order', async () => {
  let resolve!: (data: GithubContributions) => void
  vi.mocked(fetchGithubContributions).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    }),
  )
  const first = load('2025')
  vi.mocked(fetchGithubContributions).mockResolvedValueOnce({ ...calendar, total: 42 })
  await load('2026')
  resolve(calendar)
  await first
  expect(cached('2026')?.total).toBe(42)
  expect(cached('2025')?.total).toBe(3)
})

it('renders a preloaded calendar immediately, reuses labels, and changes locale without fetching', async () => {
  await load()
  const options = { props: { locale: 'en' as const }, global: { plugins: [i18n] } }
  const wrapper = mount(GithubActivitySection, options)
  const days = wrapper.findAll('a.contribution-day')
  expect(days).toHaveLength(2)
  expect(days[0]!.attributes('aria-label')).toContain('No activity')
  expect(days[0]!.attributes('aria-label')).toBe(days[0]!.attributes('data-tooltip'))
  await wrapper.setProps({ locale: 'th' })
  expect(wrapper.find('a.contribution-day').attributes('aria-label')).toContain('ไม่มีกิจกรรม')
  await flushPromises()
  expect(fetchGithubContributions).toHaveBeenCalledTimes(1)
  wrapper.unmount()
  const second = mount(GithubActivitySection, options)
  expect(second.findAll('a.contribution-day')).toHaveLength(2)
  await flushPromises()
  expect(fetchGithubContributions).toHaveBeenCalledTimes(1)
  second.unmount()
})
