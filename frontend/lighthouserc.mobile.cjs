const urls = [
  '/',
  '/about',
  '/work',
  '/work/performance-fixture',
  '/store',
  '/store/packages',
  '/store/runtime',
  '/not-a-real-page',
].map((path) => `http://127.0.0.1:4173${path}`)

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: 3,
      startServerCommand: 'bun scripts/performance-server.ts',
      startServerReadyPattern: 'Performance server ready',
      chromeFlags: '--headless --no-sandbox --disable-dev-shm-usage',
      settings: {
        formFactor: 'mobile',
        throttlingMethod: 'provided',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.98, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median-run' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median-run' }],
        'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median-run' }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/mobile' },
  },
}
