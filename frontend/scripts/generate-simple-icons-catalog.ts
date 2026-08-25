import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import * as simpleIcons from 'simple-icons'

const outputPath = resolve(import.meta.dirname, '../public/data/simple-icons.json')
const icons = Object.values(simpleIcons)
  .map(({ title, slug, source }) => ({ title, slug, source }))
  .sort((left, right) => left.title.localeCompare(right.title))

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(icons)}\n`)

console.log(`Generated ${icons.length} Simple Icons entries.`)
