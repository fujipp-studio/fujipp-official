import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'
import { loadFeatureMap, ownerOf, root } from './feature-map'

const frontend = join(root, 'frontend')
const planFile = join(frontend, 'node_modules/.cache/ci-affected.json')

export interface Plan {
  full: boolean
  reason: string
  changed: string[]
  features: string[]
  smoke: string[]
  unit: string[]
  boundaries: string[]
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
  for (const file of [...walk(join(frontend, 'src')), ...walk(join(frontend, 'e2e')), ...walk(join(root, 'bot-runner/src/features/price-reader'))]) {
    if (!/\.(ts|vue|js)$/.test(file)) continue
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
  const map = loadFeatureMap()
  const full = (reason: string): Plan => ({ full: true, reason, changed, features: [], smoke: ['*'], unit: [], boundaries: [] })
  if (forceFull || !changed.length) return full('Manual run or no reliable comparison')
  // Deleted/renamed files can lose their incoming edges in the current tree.
  if (changed.some(file => !existsSync(join(root, file)))) return full('Deleted or renamed file')
  const features = new Set<string>()
  const smoke = new Set<string>()
  const unit = new Set<string>()
  const boundaries = new Set<string>()
  const source: string[] = []
  for (const file of changed) {
    if (/^frontend\/src\/__tests__\/[^/]+\.spec\.ts$/.test(file)) {
      unit.add(relative(frontend, join(root, file)))
      continue
    }
    const feature = ownerOf(file, map)
    if (feature) {
      features.add(feature)
      source.push(file)
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
      if (map.boundaries.some(boundary => boundary.path === consumer)) {
        boundaries.add(consumer)
        continue
      }
      if (consumer.endsWith('.smoke.spec.ts')) {
        smoke.add(consumer.split('/').at(-1)!)
        continue
      }
      if (consumer.endsWith('.spec.ts')) {
        unit.add(relative(frontend, join(root, consumer)))
        continue
      }
      const feature = ownerOf(consumer, map)
      if (!feature) return full(`Feature is consumed by shared application code: ${consumer}`)
      features.add(feature)
      affected.add(consumer)
    }
  }
  for (const feature of features) {
    for (const [name, scope] of Object.entries(map.features)) {
      if (scope.dependsOn.includes(feature)) features.add(name)
    }
    for (const path of map.features[feature]!.unit) unit.add(path)
    for (const name of map.features[feature]!.smoke) {
      if (name === '*') return full(`Broad or shared feature: ${feature}`)
      smoke.add(`${name}.smoke.spec.ts`)
    }
  }
  return { full: false, reason: 'Feature map, declared dependents and reverse imports', changed, features: [...features].sort(), smoke: [...smoke].sort(), unit: [...unit].sort(), boundaries: [...boundaries].sort() }
}

function run(args: string[]) {
  const result = spawnSync('bun', args, { cwd: frontend, stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
  return process.exitCode === 0
}

if (import.meta.main) {
  const command = process.argv[2]
  if (command === 'check-map') {
    const map = loadFeatureMap()
    console.log(`Validated ${Object.keys(map.features).length} feature scopes and ${map.boundaries.length} integration boundaries`)
  } else if (command === 'plan') {
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
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Affected frontend tests\n\n${plan.reason}\n\nFeatures: ${plan.features.join(', ') || 'all'}\n\nSmoke: ${plan.smoke.join(', ')}\n\nUnit: ${plan.unit.join(', ') || 'related / full suite'}\n\nIntegration boundaries: ${plan.boundaries.join(', ') || 'none'}\n`)
  } else {
    const plan = JSON.parse(readFileSync(planFile, 'utf8')) as Plan
    if (command === 'unit') {
      const source = plan.changed.filter(file => /\.(ts|js|vue)$/.test(file) && !file.endsWith('.spec.ts')).map(file => relative(frontend, join(root, file)))
      if (plan.full) run(['run', 'test:unit', '--run'])
      else {
        const passed = !plan.unit.length || run(['run', 'test:unit', '--run', ...plan.unit])
        if (passed && source.length) run(['x', '--no-install', 'vitest', 'related', '--run', '--passWithNoTests', ...source])
        else if (!plan.unit.length) console.log('Only smoke specs changed; no unit tests affected.')
      }
    } else if (command === 'smoke') {
      if (!plan.full && !plan.smoke.length) console.log('Only unit tests changed; no smoke tests affected.')
      else run(['run', 'test:smoke', ...(plan.full ? [] : plan.smoke), ...process.argv.slice(3)])
    } else throw new Error(`Unknown CI command: ${command}`)
  }
}
