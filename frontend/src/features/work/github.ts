export interface GithubContributionDay {
  count: number
  date: string
  intensity: string
}

export interface GithubContributions {
  contributions: GithubContributionDay[][]
  total: number
}

export async function fetchGithubContributions(year = 'last', signal?: AbortSignal): Promise<GithubContributions> {
  if (year !== 'last' && !/^\d{4}$/.test(year)) throw new Error('Invalid contribution year.')
  const url = new URL('https://gh-calendar.rschristian.dev/user/Fujipp')
  if (year !== 'last') url.searchParams.set('year', year)
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' })
    if (!response.ok) throw new Error(`GitHub contribution request failed: ${response.status}`)
    const data = (await response.json()) as GithubContributions
    if (
      !data ||
      !Number.isFinite(data.total) ||
      data.total < 0 ||
      !Array.isArray(data.contributions) ||
      data.contributions.length > 60 ||
      !data.contributions.every(
        (week) =>
          Array.isArray(week) &&
          week.length <= 7 &&
          week.every(
            (day) =>
              day &&
              Number.isFinite(day.count) &&
              day.count >= 0 &&
              typeof day.date === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
              Number.isFinite(Date.parse(`${day.date}T00:00:00Z`)) &&
              /^[0-4]$/.test(String(day.intensity)),
          ),
      )
    )
      throw new Error('Invalid GitHub contribution response.')
    return data
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
