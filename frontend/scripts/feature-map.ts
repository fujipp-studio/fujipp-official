import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export interface FeatureScope {
  paths: string[]
  routes: string[]
  dependsOn: string[]
  smoke: string[]
  unit: string[]
  guides: string[]
}
export interface FeatureMap {
  version: number
  boundaries: { path: string; reason: string }[]
  features: Record<string, FeatureScope>
}

export function matchesPath(rule: string, file: string): boolean {
  return rule.endsWith('/') ? file.startsWith(rule)
    : rule.endsWith('*') ? file.startsWith(rule.slice(0, -1)) : rule === file
}

// More specific feature rules override the broad bots-core folder.
export function ownerOf(file: string, map: FeatureMap): string | undefined {
  let owner: string | undefined
  let length = -1
  for (const [name, feature] of Object.entries(map.features)) {
    for (const rule of feature.paths) {
      if (matchesPath(rule, file) && rule.length > length) {
        owner = name
        length = rule.length
      }
    }
  }
  return owner
}

export function loadFeatureMap(): FeatureMap {
  const map = JSON.parse(readFileSync(join(root, 'frontend/ci/feature-map.json'), 'utf8')) as FeatureMap
  if (map.version !== 1 || !map.features || !Array.isArray(map.boundaries)) throw new Error('Invalid feature map')
  const seen = new Set<string>()
  for (const [name, feature] of Object.entries(map.features)) {
    for (const field of ['paths', 'routes', 'dependsOn', 'smoke', 'unit', 'guides'] as const) {
      if (!Array.isArray(feature[field]) || feature[field].some(value => typeof value !== 'string')) {
        throw new Error(`Invalid ${name}.${field}`)
      }
    }
    if (!feature.paths.length || !feature.smoke.length) throw new Error(`Missing paths or coverage: ${name}`)
    for (const path of feature.paths) {
      if (seen.has(path)) throw new Error(`Duplicate feature path: ${path}`)
      seen.add(path)
      if (!path.startsWith('frontend/') && !path.startsWith('bot-runner/src/features/price-reader/')) throw new Error(`Unsupported feature path: ${path}`)
      if (path.includes('..') || /[\\\r\n]/.test(path)) throw new Error(`Invalid feature path: ${path}`)
      const source = join(root, path.endsWith('*') ? path.slice(0, -1) : path)
      if (path.endsWith('*')
        ? !existsSync(dirname(source)) || !readdirSync(dirname(source)).some(file => file.startsWith(basename(source)))
        : !existsSync(source)) throw new Error(`Missing feature source: ${path}`)
    }
    for (const dependency of feature.dependsOn) {
      if (!map.features[dependency]) throw new Error(`Unknown dependency: ${name} -> ${dependency}`)
    }
    for (const spec of feature.smoke) {
      if (spec !== '*' && !existsSync(join(root, 'frontend/e2e', `${spec}.smoke.spec.ts`))) throw new Error(`Missing smoke spec: ${spec}`)
    }
    for (const path of [...feature.guides, ...feature.unit.map(path => `frontend/${path}`)]) {
      if (!existsSync(join(root, path))) throw new Error(`Missing feature reference: ${path}`)
    }
  }
  for (const boundary of map.boundaries) {
    if (!boundary.reason || !existsSync(join(root, boundary.path))) throw new Error(`Invalid integration boundary: ${boundary.path}`)
  }
  const hasFiles = (directory: string): boolean => readdirSync(directory, { withFileTypes: true }).some(entry =>
    !entry.name.startsWith('.') && (entry.isFile() || (entry.isDirectory() && hasFiles(join(directory, entry.name)))))
  for (const entry of readdirSync(join(root, 'frontend/src/features'), { withFileTypes: true })) {
    if (entry.isDirectory() && hasFiles(join(root, 'frontend/src/features', entry.name))
      && !ownerOf(`frontend/src/features/${entry.name}/`, map)) throw new Error(`Unmapped feature folder: ${entry.name}`)
  }
  return map
}
