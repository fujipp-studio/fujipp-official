import { join } from 'node:path'

interface LighthouseReport {
  finalUrl?: string
  audits?: {
    'network-requests'?: {
      details?: { items?: Array<{ url?: string }> }
    }
  }
}

const reportsDirectory = join(import.meta.dir, '..', '.lighthouseci')
const reportPaths = new Set<string>()
for await (const path of new Bun.Glob('*/manifest.json').scan({
  cwd: reportsDirectory,
  absolute: true,
})) {
  const manifest = (await Bun.file(path).json()) as Array<{ jsonPath?: string }>
  for (const entry of manifest) {
    if (entry.jsonPath) reportPaths.add(entry.jsonPath)
  }
}

if (reportPaths.size === 0) throw new Error('No Lighthouse JSON reports were found.')

const externalRequests = new Set<string>()
for (const path of reportPaths) {
  const report = (await Bun.file(path).json()) as LighthouseReport
  const requests = report.audits?.['network-requests']?.details?.items ?? []
  for (const request of requests) {
    if (!request.url || request.url.startsWith('data:') || request.url.startsWith('blob:')) continue
    const url = new URL(request.url)
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      externalRequests.add(`${report.finalUrl ?? path} -> ${url.origin}`)
    }
  }
}

if (externalRequests.size > 0) {
  throw new Error(`Unexpected external requests:\n${[...externalRequests].join('\n')}`)
}

console.log(`Checked ${reportPaths.size} Lighthouse reports: no external requests.`)
