const baseUrl = process.env.BACKEND_URL ?? 'http://localhost:8080'
const iterations = Number(process.env.PERF_ITERATIONS ?? 30)

const targets = [
  { name: 'works-v2', path: '/api/v2/works?limit=100' },
  { name: 'bots-v2', path: '/api/v2/bots?limit=100', token: process.env.USER_TOKEN },
  { name: 'runtime-bootstrap', path: '/internal/v1/runtime/bootstrap', token: process.env.RUNNER_TOKEN, runner: true },
  { name: 'admin-users-v2', path: '/api/v2/admin/users?limit=100', token: process.env.ADMIN_TOKEN },
  { name: 'admin-bots-v2', path: '/api/v2/admin/bots?limit=100', token: process.env.ADMIN_TOKEN },
  { name: 'admin-runtime-v2', path: '/api/v2/admin/runtime/subscriptions?limit=100', token: process.env.ADMIN_TOKEN },
]

const percentile = (sorted, value) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)]

for (const target of targets) {
  if (target.token === undefined && target.name !== 'works-v2') {
    console.log(`${target.name}: skipped (token not configured)`)
    continue
  }
  const samples = []
  let bytes = 0
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now()
    const response = await fetch(`${baseUrl}${target.path}`, {
      headers: target.token
        ? target.runner
          ? { 'X-Runner-Token': target.token }
          : { Authorization: `Bearer ${target.token}` }
        : {},
    })
    const body = await response.arrayBuffer()
    if (!response.ok) throw new Error(`${target.name}: HTTP ${response.status}`)
    samples.push(performance.now() - started)
    bytes = body.byteLength
  }
  samples.sort((a, b) => a - b)
  const p50 = percentile(samples, 0.5)
  const p95 = percentile(samples, 0.95)
  console.log(`${target.name}: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms bytes=${bytes}`)
  if (p95 >= 300) process.exitCode = 1
}
