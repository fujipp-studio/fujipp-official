import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

interface ManifestEntry {
  file: string
  css?: string[]
  imports?: string[]
  isEntry?: boolean
}

const distDirectory = join(import.meta.dir, '..', 'dist')
const manifest = (await Bun.file(join(distDirectory, '.vite', 'manifest.json')).json()) as Record<
  string,
  ManifestEntry
>
const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry)
if (!entryKey) throw new Error('Vite manifest does not contain an application entry.')

const files = new Set<string>()
const visited = new Set<string>()
function collect(key: string) {
  if (visited.has(key)) return
  visited.add(key)
  const entry = manifest[key]
  if (!entry) return
  files.add(entry.file)
  entry.css?.forEach((file) => files.add(file))
  entry.imports?.forEach(collect)
}
collect(entryKey)

const totals = { js: 0, css: 0 }
for (const file of files) {
  const bytes = new Uint8Array(await Bun.file(join(distDirectory, file)).arrayBuffer())
  const gzipBytes = gzipSync(bytes).byteLength
  if (file.endsWith('.js')) totals.js += gzipBytes
  if (file.endsWith('.css')) totals.css += gzipBytes
}

const budgets = { js: 180 * 1024, css: 50 * 1024 }
console.log(`Initial JS: ${(totals.js / 1024).toFixed(1)} KiB gzip / 180 KiB`)
console.log(`Initial CSS: ${(totals.css / 1024).toFixed(1)} KiB gzip / 50 KiB`)

if (totals.js > budgets.js || totals.css > budgets.css) {
  throw new Error('Initial bundle exceeds the performance budget.')
}
