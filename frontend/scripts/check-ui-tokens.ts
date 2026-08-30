import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const source = join(import.meta.dir, '..', 'src')
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : /\.(css|vue)$/.test(entry.name) ? [path] : []
  })
}
const sources = files(source).map((path) => ({ path, text: readFileSync(path, 'utf8') }))
const definitions = new Set(
  sources.flatMap(({ text }) =>
    [...text.matchAll(/(--semantic-[\w-]+)\s*:/g)].map((match) => match[1]),
  ),
)
const missing: string[] = []
for (const { path, text } of sources) {
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/var\((--semantic-[\w-]+)/g)) {
      if (!definitions.has(match[1])) missing.push(`${path}:${index + 1}: undefined ${match[1]}`)
    }
  })
}
if (missing.length) throw new Error(missing.join('\n'))
console.log(`Semantic color references checked in ${sources.length} files.`)
