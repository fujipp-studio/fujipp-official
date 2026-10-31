import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

export const stateName = '.fujipp-deploy-state.json'
export const retentionMs = 7 * 24 * 60 * 60 * 1000
interface FileRecord { sha256: string; size: number }
interface RetiredFile extends FileRecord { retiredAt: string }
export interface Manifest {
  release: string
  createdAt: string
  files: Record<string, FileRecord>
  retained: Record<string, RetiredFile>
}
export interface DeployState {
  version: 1
  status: 'pending' | 'succeeded'
  manifest: Manifest
  previous?: Manifest
}
export interface DeployPlan {
  version: 1
  release: string
  forceUpload: boolean
  upload: string[]
  unchanged: string[]
  remove: string[]
  bytes: number
  pending: DeployState
  succeeded: DeployState
}

// Only paths emitted by this application's build can ever be managed/deleted.
// New top-level public folders must be reviewed here before deployment.
export function validatePath(path: string): void {
  const roots = ['assets/', 'icons/', 'images/', 'data/']
  const files = ['index.html', 'discord-preview.html', '.htaccess', '.vite/manifest.json', 'robots.txt', 'sitemap.xml', 'apple-touch-icon.png']
  if (!/^[a-zA-Z0-9._/-]+$/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')
    || path.includes('.fujipp-') || (!files.includes(path) && !roots.some(root => path.startsWith(root)))) {
    throw new Error(`Unmanaged or unsafe deployment path: ${path}`)
  }
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export function parseState(text: string): DeployState {
  if (Buffer.byteLength(text) > 5 * 1024 * 1024) throw new Error('Deployment state is too large')
  const state = JSON.parse(text) as DeployState
  if (state.version !== 1 || !['pending', 'succeeded'].includes(state.status)) throw new Error('Unsupported deployment state')
  function check(manifest: Manifest) {
    if (!manifest || !/^[a-zA-Z0-9_-]{1,100}$/.test(manifest.release) || !validDate(manifest.createdAt)) throw new Error('Invalid deployment manifest')
    for (const [records, retired] of [[manifest.files, false], [manifest.retained, true]] as const) {
      if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('Invalid file inventory')
      for (const [path, file] of Object.entries(records)) {
        validatePath(path)
        if (!file || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error(`Invalid file hash or size: ${path}`)
        if (retired && !validDate((file as RetiredFile).retiredAt)) throw new Error(`Invalid retirement date: ${path}`)
      }
    }
    if (Object.keys(manifest.files).some(path => Object.hasOwn(manifest.retained, path))) throw new Error('Overlapping current and retired files')
    if (!Object.hasOwn(manifest.files, 'index.html')) throw new Error('Deployment manifest has no index.html')
  }
  check(state.manifest)
  if (state.previous) check(state.previous)
  if (state.status === 'succeeded' && state.previous) throw new Error('Successful state cannot contain a pending predecessor')
  return state
}

export function inventory(dist: string): Record<string, FileRecord> {
  const files: Record<string, FileRecord> = {}
  function walk(directory: string, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = prefix + entry.name
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not deployable: ${path}`)
      if (entry.isDirectory()) walk(join(directory, entry.name), `${path}/`)
      else if (entry.isFile()) {
        validatePath(path)
        const bytes = readFileSync(join(directory, entry.name))
        files[path] = { sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length }
      } else throw new Error(`Unsupported build entry: ${path}`)
    }
  }
  walk(dist)
  if (!Object.hasOwn(files, 'index.html')) throw new Error('Build has no index.html')
  return files
}

export function planDeployment(files: Record<string, FileRecord>, state: DeployState | null, release: string, now = new Date(), force = false): DeployPlan {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(release)) throw new Error('Invalid release identifier')
  if (state) parseState(JSON.stringify(state))
  for (const path of Object.keys(files)) validatePath(path)
  if (!Object.hasOwn(files, 'index.html')) throw new Error('Build has no index.html')
  parseState(JSON.stringify({ version: 1, status: 'succeeded', manifest: { release, createdAt: now.toISOString(), files, retained: {} } }))
  const known: Record<string, FileRecord & { retiredAt?: string }> = {}
  for (const manifest of [state?.previous, state?.manifest]) {
    if (!manifest) continue
    Object.assign(known, manifest.retained, manifest.files)
  }
  const retained: Record<string, RetiredFile> = {}
  const remove: string[] = []
  const timestamp = now.toISOString()
  for (const [path, file] of Object.entries(known)) {
    if (Object.hasOwn(files, path)) continue
    const retiredAt = file.retiredAt ?? timestamp
    if (now.getTime() - Date.parse(retiredAt) >= retentionMs) remove.push(path)
    else retained[path] = { ...file, retiredAt }
  }
  // Reject file -> directory changes before any remote write; they require an
  // explicit migration rather than deleting files to make the upload succeed.
  const all = new Set([...Object.keys(files), ...Object.keys(known)])
  for (const path of all) {
    for (let directory = dirname(path); directory !== '.'; directory = dirname(directory)) {
      if (all.has(directory)) throw new Error(`Deployment file/directory conflict: ${directory}`)
    }
  }
  const forceUpload = force || !state || state.status === 'pending'
  const upload = Object.keys(files).filter(path => forceUpload || files[path]!.sha256 !== known[path]?.sha256 || files[path]!.size !== known[path]?.size).sort()
  const uploaded = new Set(upload)
  const manifest: Manifest = { release, createdAt: timestamp, files, retained }
  // Keep a flat ownership inventory while pending so interrupted uploads and
  // partially completed cleanup remain recoverable on the next run.
  const previous = state ? {
    release: state.manifest.release,
    createdAt: state.manifest.createdAt,
    files: state.manifest.files,
    retained: Object.fromEntries(Object.entries(known).filter(([path]) => !Object.hasOwn(state.manifest.files, path)).map(([path, file]) => [path, { ...file, retiredAt: file.retiredAt ?? timestamp }])),
  } : undefined
  const pending: DeployState = { version: 1, status: 'pending', manifest, ...(previous ? { previous } : {}) }
  const succeeded: DeployState = { version: 1, status: 'succeeded', manifest }
  return {
    version: 1, release, forceUpload, upload,
    unchanged: Object.keys(files).filter(path => !uploaded.has(path)).sort(),
    remove: remove.sort(), bytes: upload.reduce((sum, path) => sum + files[path]!.size, 0), pending, succeeded,
  }
}

function quote(value: string): string {
  // lftp expands variables and globs too. Constrain all generated operands,
  // including local paths, before passing them as quoted command arguments.
  if (!/^[a-zA-Z0-9._/ -]+$/.test(value)) throw new Error(`Unsafe FTPS operand: ${value}`)
  return `"${value}"`
}

export function uploadCommands(plan: DeployPlan, directory: string): string[] {
  const commands = [
    `put ${quote(join(directory, 'pending.json'))} -o ${quote(`${stateName}.next`)}`,
    `mv ${quote(`${stateName}.next`)} ${quote(stateName)}`,
  ]
  const html = new Set(['index.html', 'discord-preview.html'])
  const files = plan.upload.filter(path => !html.has(path))
  const directories = [...new Set(files.map(path => dirname(path)))].sort()
  for (const folder of directories) {
    // Some servers/backends return an error for mkdir -p on an existing
    // directory. Accept that only if an explicit lookup succeeds; transfers
    // still fail closed if the entry is a file or is not writable.
    if (folder !== '.') commands.push(`mkdir -p ${quote(folder)} || cls -d ${quote(folder)}`)
    const group = files.filter(path => dirname(path) === folder)
    commands.push(`mput -P 4 -O ${quote(folder)} ${group.map(path => quote(join(directory, 'stage', `${path}.fujipp-next`))).join(' ')}`)
    for (const path of group) commands.push(`mv ${quote(`${path}.fujipp-next`)} ${quote(path)}`)
  }
  // Publish both HTML entry points only after every dependency has uploaded.
  for (const path of ['discord-preview.html', 'index.html']) {
    if (!plan.upload.includes(path)) continue
    commands.push(`put ${quote(join(directory, 'stage', `${path}.fujipp-next`))} -o ${quote(`${path}.fujipp-next`)}`)
    commands.push(`mv ${quote(`${path}.fujipp-next`)} ${quote(path)}`)
  }
  return commands
}

export function finalizeCommands(plan: DeployPlan, directory: string): string[] {
  // Called only after the HTTP verification step succeeds. rm -f permits retry
  // after an interrupted cleanup. Unowned server files never enter this list.
  return [
    ...plan.remove.flatMap(path => [`rm -f ${quote(path)}`, `rm -f ${quote(`${path}.fujipp-next`)}`]),
    `put ${quote(join(directory, 'succeeded.json'))} -o ${quote(`${stateName}.next`)}`,
    `mv ${quote(`${stateName}.next`)} ${quote(stateName)}`,
  ]
}

export function writePlan(plan: DeployPlan, dist: string, directory: string): void {
  mkdirSync(directory, { recursive: true })
  rmSync(join(directory, 'verified'), { force: true })
  rmSync(join(directory, 'committed.json'), { force: true })
  for (const path of plan.upload) {
    const destination = join(directory, 'stage', `${path}.fujipp-next`)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(dist, path), destination)
  }
  for (const [name, value] of Object.entries({ plan, pending: plan.pending, succeeded: plan.succeeded })) {
    writeFileSync(join(directory, `${name}.json`), JSON.stringify(value, null, 2) + '\n')
  }
  writeFileSync(join(directory, 'upload.lftp'), uploadCommands(plan, directory).join('\n') + '\n')
  writeFileSync(join(directory, 'finalize.lftp'), finalizeCommands(plan, directory).join('\n') + '\n')
}

interface Target { host: string; port: string; path: string }
function target(): Target {
  const { FRONTEND_FTP_HOST: host = '', FRONTEND_FTP_PORT: port = '', FRONTEND_FTP_PATH: path = '' } = process.env
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host) || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535
    || !/^\/?domains\/[a-zA-Z0-9.-]+\/public_html$/.test(path)) throw new Error('Invalid FTPS deployment target')
  return { host, port, path }
}

function transfer(destination: Target, commands: string[]): string {
  const settings = ['set cmd:fail-exit yes', 'set net:max-retries 2', 'set net:timeout 20', 'set ftp:ssl-force true', 'set ftp:ssl-protect-data true', 'set ssl:verify-certificate yes', `cd ${quote(destination.path)}`]
  const result = spawnSync('lftp', ['-p', destination.port, destination.host], { input: [...settings, ...commands, 'bye'].join('\n') + '\n', encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 20 * 60 * 1000 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`FTPS failed: ${result.stderr.trim()}`)
  return result.stdout
}

if (import.meta.main) {
  const { positionals, values } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: { dist: { type: 'string', default: 'dist' }, state: { type: 'string' }, out: { type: 'string', default: 'node_modules/.cache/ftps-deploy' }, release: { type: 'string', default: process.env.GITHUB_SHA || 'local' }, force: { type: 'boolean', default: process.env.FRONTEND_DEPLOY_FORCE_FULL === 'true' } } })
  const command = positionals[0]
  const directory = resolve(values.out!)
  if (command === 'plan' || command === 'prepare') {
    mkdirSync(directory, { recursive: true })
    let state: DeployState | null = null
    if (command === 'prepare') {
      const destination = target()
      // List only the root once to distinguish a missing baseline from network,
      // login or permission errors. Never scan the remote directory tree.
      const names = transfer(destination, ['cls -1a']).split(/\r?\n/).map(name => name.trim().split('/').at(-1))
      if (names.includes(stateName)) {
        const local = join(directory, 'remote-state.json')
        transfer(destination, [`get ${quote(stateName)} -o ${quote(local)}`])
        state = parseState(readFileSync(local, 'utf8'))
      }
      writeFileSync(join(directory, 'target.json'), JSON.stringify(destination))
    } else if (values.state) state = parseState(readFileSync(resolve(values.state), 'utf8'))
    const dist = resolve(values.dist!)
    const plan = planDeployment(inventory(dist), state, values.release!, new Date(), values.force)
    writePlan(plan, dist, directory)
    const summary = `FTPS plan: ${plan.upload.length} uploads (${plan.bytes} bytes), ${plan.unchanged.length} unchanged, ${plan.remove.length} expired owned files to remove; ${state ? state.status : 'first deployment'}`
    console.log(summary)
    if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n', { flag: 'a' })
  } else if (command === 'upload' || command === 'finalize') {
    const destination = target()
    if (JSON.stringify(destination) !== readFileSync(join(directory, 'target.json'), 'utf8')) throw new Error('Prepared FTPS target changed')
    const plan = JSON.parse(readFileSync(join(directory, 'plan.json'), 'utf8')) as DeployPlan
    parseState(JSON.stringify(plan.pending))
    parseState(JSON.stringify(plan.succeeded))
    for (const path of [...plan.upload, ...plan.remove]) validatePath(path)
    if (command === 'finalize' && !existsSync(join(directory, 'verified'))) throw new Error('HTTP verification has not succeeded')
    if (command === 'upload') rmSync(join(directory, 'verified'), { force: true })
    console.log(transfer(destination, command === 'upload' ? uploadCommands(plan, directory) : finalizeCommands(plan, directory)))
    if (command === 'finalize') {
      writeFileSync(join(directory, 'committed.json'), JSON.stringify(plan.succeeded, null, 2) + '\n')
      console.log(`Committed verified frontend release ${plan.release}`)
    }
  } else throw new Error('Usage: bun scripts/deploy-ftps.ts plan|prepare|upload|finalize [--state FILE] [--dist DIR] [--out DIR] [--release SHA]')
}
