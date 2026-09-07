import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

interface ManifestEntry {
  file: string
  css?: string[]
  imports?: string[]
  isEntry?: boolean
}
const distDirectory = join(import.meta.dir, '..', 'dist')
const manifest = await Bun.file(join(distDirectory, '.vite', 'manifest.json')).json() as Record<string, ManifestEntry>
const entryKey = Object.keys(manifest).find(key => manifest[key]?.isEntry)
if (!entryKey) throw new Error('Vite manifest does not contain an application entry.')

function collect(keys: string[]) {
  const files = new Set<string>(), visited = new Set<string>()
  function visit(key: string) {
    if (visited.has(key)) return
    visited.add(key)
    const entry = manifest[key]
    if (!entry) throw new Error(`Bundle budget entry is missing: ${key}`)
    files.add(entry.file)
    entry.css?.forEach(file => files.add(file))
    entry.imports?.forEach(visit)
  }
  keys.forEach(visit)
  return files
}

// Include Thai and English fallback plus async components required by each screen.
// Authenticated routes also include the session SDK. Images/fonts/API are separate.
const translations = (...namespaces: string[]) => ['en', 'th'].flatMap(locale =>
  ['common', 'navigation', 'footer', ...namespaces].map(namespace => `src/i18n/locales/${locale}/${namespace}.ts`))
const settings = ['src/features/bots/views/BotSettingsFlowView.vue', 'src/features/bots/views/FeatureSettingsView.vue']
const profiles = [
  {name:'Initial shell', keys:[], js:180, css:50},
  {name:'Home', keys:['src/features/home/views/HomeView.vue', ...translations('home')], js:150, css:50},
  {name:'Work', keys:['src/features/work/views/WorkListView.vue', ...translations()], js:160, css:50},
  {name:'My Bot', keys:['src/features/bots/views/MyBotsView.vue', 'src/lib/supabase.ts', ...translations('myBots','botSettings')], js:230, css:50},
  {name:'Feature config', keys:[...settings, 'src/features/bots/components/FeatureConfigFields.vue', 'src/lib/supabase.ts', ...translations('myBots','botSettings')], js:250, css:50},
  {name:'Presentation editor', keys:[...settings, 'src/features/bots/components/FeaturePresentationEditor.vue', 'src/lib/supabase.ts', ...translations('myBots','botSettings')], js:260, css:50},
]
const sizes = new Map<string, number>()
let failed = false
for (const profile of profiles) {
  const totals = {js:0, css:0}
  for (const file of collect([entryKey, ...profile.keys])) {
    if (!/\.(js|css)$/.test(file)) continue
    if (!sizes.has(file)) sizes.set(file, gzipSync(new Uint8Array(await Bun.file(join(distDirectory, file)).arrayBuffer())).byteLength)
    totals[file.endsWith('.js') ? 'js' : 'css'] += sizes.get(file)!
  }
  console.log(`${profile.name}: JS ${(totals.js/1024).toFixed(1)}/${profile.js} KiB gzip; CSS ${(totals.css/1024).toFixed(1)}/${profile.css} KiB gzip`)
  failed ||= totals.js > profile.js*1024 || totals.css > profile.css*1024
}
const authDialog = manifest['src/shared/ui/dialogs/AppAuthDialog.vue']
if (!authDialog || collect([entryKey]).has(authDialog.file))
  throw new Error('Auth dialog must remain outside the initial bundle.')
if (failed) throw new Error('A route exceeds its bundle budget.')
