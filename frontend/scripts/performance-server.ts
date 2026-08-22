import { extname, join, normalize } from 'node:path'
import { gzipSync } from 'node:zlib'

const port = 4173
const distDirectory = join(import.meta.dir, '..', 'dist')

const workSummary = {
  slug: 'performance-fixture',
  name: 'Performance Fixture',
  shortDescription: 'A stable portfolio entry used for repeatable performance testing.',
  status: 'COMPLETED',
  startedOn: '2025-01-01',
  completedOn: '2025-06-01',
  featured: true,
  category: { code: 'web', name: 'Web application' },
  positions: [{ code: 'developer', name: 'Developer' }],
  technologies: [
    {
      slug: 'vue',
      name: 'Vue.js',
      iconUrl: null,
      officialUrl: 'https://vuejs.org',
      group: { code: 'frontend', name: 'Frontend' },
    },
  ],
  cover: null,
}

const workDetail = {
  ...workSummary,
  overview: 'A deterministic case study used to measure the production application.',
  feasibility: 'The fixture avoids network variance while preserving the real rendering path.',
  targetUsers: 'Visitors viewing the portfolio.',
  publishedAt: '2025-06-01T00:00:00Z',
  gallery: [],
  architecture: null,
  links: [],
  features: [{ title: 'Fast delivery', description: 'Optimized assets and route-level code splitting.' }],
  challenges: [{ title: 'Repeatability', description: 'Performance measurements must be deterministic.' }],
  learnings: [{ title: 'Budgets', description: 'Automated budgets prevent regressions.' }],
}

const storeFeatures = [
  {
    id: 'feature-package',
    code: 'welcome-package',
    name: 'Welcome Package',
    description: 'A fixture package for performance validation.',
    category: 'PACKAGE',
    iconKey: 'package',
    image: null,
    tutorialUrl: null,
    featured: true,
    version: '1.0.0',
    offers: [
      {
        id: 'offer-package',
        code: 'one-time',
        name: 'Lifetime',
        kind: 'ONE_TIME',
        priceSatang: 9900,
        currency: 'THB',
        billingPeriodDays: null,
        installationLimit: 1,
      },
    ],
  },
  {
    id: 'feature-runtime',
    code: 'runtime-hosting',
    name: 'Runtime Hosting',
    description: 'Managed bot runtime fixture.',
    category: 'RUNTIME',
    iconKey: 'server',
    image: null,
    tutorialUrl: null,
    featured: true,
    version: '1.0.0',
    offers: [
      {
        id: 'offer-runtime',
        code: 'seven-days',
        name: '7 Days',
        kind: 'SUBSCRIPTION',
        priceSatang: 4900,
        currency: 'THB',
        billingPeriodDays: 7,
        installationLimit: 1,
      },
    ],
  },
]

function json(value: unknown) {
  return Response.json(value, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

function apiResponse(url: URL): Response | undefined {
  if (url.pathname === '/api/v2/works') {
    return json({ items: [workSummary], nextCursor: null, hasMore: false })
  }
  if (url.pathname === '/api/v1/works/performance-fixture') return json(workDetail)
  if (url.pathname === '/api/v1/store/features') return json(storeFeatures)
  if (url.pathname === '/api/v1/runtime/availability') {
    return json({
      totalSlots: 10,
      usedSlots: 4,
      availableSlots: 6,
      slots: Array.from({ length: 10 }, (_, index) => ({
        slotNumber: index + 1,
        occupancy: index < 4 ? 'OCCUPIED' : 'AVAILABLE',
      })),
    })
  }
  if (url.pathname.startsWith('/api/')) {
    return json({ title: 'Not Found', detail: 'Fixture endpoint not found.' })
  }
}

function contentType(path: string) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }[extname(path)]
}

function isCompressible(path: string) {
  return ['.css', '.html', '.js', '.json', '.svg', '.txt', '.xml'].includes(extname(path))
}

Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(request) {
    const url = new URL(request.url)
    const api = apiResponse(url)
    if (api) return api

    const relativePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.(\/|\\|$))+/, '')
    const requestedPath = join(distDirectory, relativePath === '/' ? 'index.html' : relativePath)
    const requestedFile = Bun.file(requestedPath)
    const file = (await requestedFile.exists()) ? requestedFile : Bun.file(join(distDirectory, 'index.html'))
    const immutable = requestedPath.includes(`${join('dist', 'assets')}`)
    const fileName = file.name ?? ''
    const useGzip = isCompressible(fileName) && request.headers.get('Accept-Encoding')?.includes('gzip')
    const body = useGzip ? gzipSync(new Uint8Array(await file.arrayBuffer())) : file
    return new Response(body, {
      headers: {
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        ...(contentType(fileName) ? { 'Content-Type': contentType(fileName)! } : {}),
        ...(useGzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
      },
    })
  },
})

console.log(`Performance server ready on http://127.0.0.1:${port}`)
