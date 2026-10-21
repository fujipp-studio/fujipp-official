import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const frontend = join(root, 'frontend')
const planFile = join(frontend, 'node_modules/.cache/ci-affected.json')
const featureOf = (file: string) => /^frontend\/src\/features\/([^/]+)\//.exec(file)?.[1]
const smokeByFeature: Record<string, string[]> = {
  home: ['frontend', 'desktop-scroll', 'admin-tools'],
  about: ['frontend', 'admin-tools'],
  privacy: ['privacy', 'frontend'],
  account: ['account-topup', 'frontend', 'admin-tools'],
  topup: ['account-topup', 'frontend'],
  work: ['frontend', 'admin-tools'],
  admin: ['frontend', 'admin-tools'],
  store: ['frontend', 'account-topup'],
  donation: ['frontend'],
  services: ['frontend'],
  auth: ['*'],
  bots: ['*'],
}

export interface Plan {
  full: boolean
  reason: string
  changed: string[]
  features: string[]
  smoke: string[]
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [relative(root, path)]
  })
}

export function readScripts(filename: string, text: string): string {
  if (!filename.endsWith('.vue')) return text
  const { descriptor, errors } = parse(text, { filename })
  if (errors.length) throw new Error(`Cannot parse Vue source: ${filename}`)
  return [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n')
}

// Build reverse imports, including re-exports and literal lazy imports. Vue SFC
// scripts are parsed separately so template text cannot obscure their imports.
function consumers(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()
  for (const file of walk(join(frontend, 'src'))) {
    if (!/\.(ts|vue|js)$/.test(file) || file.includes('/__tests__/')) continue
    const text = readFileSync(join(root, file), 'utf8')
    const scripts = readScripts(file, text)
    for (const entry of ts.preProcessFile(scripts, true, true).importedFiles) {
      const specifier = entry.fileName
      const target = specifier.startsWith('@/') ? join(frontend, 'src', specifier.slice(2))
        : specifier.startsWith('@price-reader/') ? join(root, 'bot-runner/src/features/price-reader', specifier.slice(14))
          : specifier.startsWith('.') ? resolve(root, dirname(file), specifier) : undefined
      if (!target) continue
      const resolved = [target, `${target}.ts`, `${target}.vue`, `${target}.js`, join(target, 'index.ts')]
        .find(path => existsSync(path) && !readdirSafe(path))
      if (!resolved) continue
      const key = relative(root, resolved)
      const imports = graph.get(key) ?? new Set<string>()
      imports.add(file)
      graph.set(key, imports)
    }
  }
  return graph
}

function readdirSafe(path: string): boolean {
  try { readdirSync(path); return true } catch { return false }
}

export function select(changed: string[], forceFull = false): Plan {
  const full = (reason: string): Plan => ({ full: true, reason, changed, features: [], smoke: ['*'] })
  if (forceFull || !changed.length) return full('Manual run or no reliable comparison')
  // Deleted/renamed files can lose their incoming edges in the current tree.
  if (changed.some(file => !existsSync(join(root, file)))) return full('Deleted or renamed file')
  const features = new Set<string>()
  const smoke = new Set<string>()
  const source = changed.filter(file => featureOf(file))
  for (const file of changed) {
    const feature = featureOf(file)
    if (feature) {
      if (!smokeByFeature[feature]) return full('Unmapped feature')
      features.add(feature)
    } else if (/^frontend\/e2e\/[^/]+\.smoke\.spec\.ts$/.test(file)) {
      smoke.add(file.split('/').at(-1)!)
    } else {
      return full('Shared source, configuration, fixtures or unknown file')
    }
  }
  const graph = consumers()
  const affected = new Set(source)
  for (const file of affected) {
    for (const consumer of graph.get(file) ?? []) {
      // The route registry imports all pages but does not make them dependencies
      // of each other. Changes to the registry itself still trigger full tests.
      if (consumer === 'frontend/src/router/index.ts') continue
      const feature = featureOf(consumer)
      if (!feature || !smokeByFeature[feature]) return full('Feature is consumed by shared application code')
      features.add(feature)
      affected.add(consumer)
    }
  }
  for (const feature of features) {
    for (const name of smokeByFeature[feature]!) {
      if (name === '*') return full(`Broad or shared feature: ${feature}`)
      smoke.add(`${name}.smoke.spec.ts`)
    }
  }
  return { full: false, reason: 'Feature changes and reverse import dependencies', changed, features: [...features].sort(), smoke: [...smoke].sort() }
}

function run(args: string[]) {
  const result = spawnSync('bun', args, { cwd: frontend, stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

if (import.meta.main) {
  const command = process.argv[2]
  if (command === 'plan') {
    let plan: Plan
    const base = process.env.CI_BASE ?? ''
    const head = process.env.CI_HEAD ?? 'HEAD'
    if (process.env.CI_EVENT === 'workflow_dispatch' || !/^[0-9a-f]{40}$/.test(base) || /^0+$/.test(base)) {
      plan = select([], true)
    } else {
      const diff = spawnSync('git', ['diff', '--name-only', '-z', '--no-renames', base, head, '--', 'frontend', 'bot-runner/src/features/price-reader', '.github/workflows/frontend-cd.yml'], { cwd: root, encoding: 'utf8' })
      plan = diff.status === 0 ? select(diff.stdout.split('\0').filter(Boolean)) : select([], true)
    }
    const { mkdirSync } = await import('node:fs')
    mkdirSync(dirname(planFile), { recursive: true })
    writeFileSync(planFile, JSON.stringify(plan, null, 2))
    console.log(JSON.stringify(plan, null, 2))
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Affected frontend tests\n\n${plan.reason}\n\nFeatures: ${plan.features.join(', ') || 'all'}\n\nSmoke: ${plan.smoke.join(', ')}\n`)
  } else {
    const plan = JSON.parse(readFileSync(planFile, 'utf8')) as Plan
    if (command === 'unit') {
      const source = plan.changed.filter(file => featureOf(file)).map(file => relative(frontend, join(root, file)))
      if (plan.full) run(['run', 'test:unit', '--run'])
      else if (source.length) run(['x', '--no-install', 'vitest', 'related', '--run', '--passWithNoTests', ...source])
      else console.log('Only smoke specs changed; no unit tests affected.')
    } else if (command === 'smoke') {
      run(['run', 'test:smoke', ...(plan.full ? [] : plan.smoke)])
    } else throw new Error(`Unknown CI command: ${command}`)
  }
}
