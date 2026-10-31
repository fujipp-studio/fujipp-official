import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, expect, test } from 'vitest'
import { finalizeCommands, inventory, parseState, planDeployment, retentionMs, stateName, uploadCommands, validatePath, writePlan, type DeployState } from './deploy-ftps'

const now = new Date('2026-10-31T10:00:00Z')
const later = new Date(now.getTime() + retentionMs + 1000)
const record = (text: string) => ({ sha256: createHash('sha256').update(text).digest('hex'), size: Buffer.byteLength(text) })
const initial = { 'index.html': record('html'), 'assets/app-old.js': record('old'), 'icons/logo.svg': record('logo') }
const temps: string[] = []
function temporary() { const path = mkdtempSync(join(tmpdir(), 'ftps-plan-')); temps.push(path); return path }
afterEach(() => { for (const path of temps.splice(0)) rmSync(path, { recursive: true, force: true }) })
const first = () => planDeployment(structuredClone(initial), null, 'release1', now)

test('first deployment uploads everything without deleting unknown server files', () => {
  const plan = first()
  expect(plan.forceUpload).toBe(true)
  expect(plan.upload).toEqual(Object.keys(initial).sort())
  expect(plan.remove).toEqual([])
  expect(parseState(JSON.stringify(plan.pending)).status).toBe('pending')
})

test('identical content sends no files, regardless of release or build timestamps', () => {
  const plan = planDeployment(initial, first().succeeded, 'release2', later)
  expect(plan.upload).toEqual([])
  expect(plan.bytes).toBe(0)
  expect(plan.unchanged).toHaveLength(3)
})

test('same-size changes are uploaded and unchanged assets are skipped', () => {
  const plan = planDeployment({ ...initial, 'icons/logo.svg': record('LOGO') }, first().succeeded, 'release2', now)
  expect(plan.upload).toEqual(['icons/logo.svg'])
  expect(plan.bytes).toBe(4)
})

test('removed files are retained for cached clients and deleted only after the grace period', () => {
  const current = { 'index.html': record('new html'), 'assets/app-new.js': record('new') }
  const second = planDeployment(current, first().succeeded, 'release2', now)
  expect(second.remove).toEqual([])
  expect(Object.keys(second.succeeded.manifest.retained)).toEqual(['assets/app-old.js', 'icons/logo.svg'])
  const third = planDeployment(current, second.succeeded, 'release3', later)
  expect(third.remove).toEqual(['assets/app-old.js', 'icons/logo.svg'])
  expect(third.succeeded.manifest.retained).toEqual({})
  expect(third.remove).not.toContain('uploads/customer.png')
})

test('reviving a retained file cancels its deletion and reuses its verified bytes', () => {
  const removed = planDeployment({ 'index.html': initial['index.html'] }, first().succeeded, 'release2', now)
  const revived = planDeployment(initial, removed.succeeded, 'release3', later)
  expect(revived.upload).toEqual([])
  expect(revived.remove).toEqual([])
  expect(revived.succeeded.manifest.retained).toEqual({})
})

test('an interrupted upload forces a complete repair, including rollback to unchanged baseline files', () => {
  const attempted = planDeployment({ ...initial, 'icons/logo.svg': record('changed'), 'assets/orphan.js': record('extra') }, first().succeeded, 'release2', now)
  const recovery = planDeployment(initial, attempted.pending, 'release3', now)
  expect(recovery.forceUpload).toBe(true)
  expect(recovery.upload).toEqual(Object.keys(initial).sort())
  expect(recovery.succeeded.manifest.retained['assets/orphan.js']).toBeDefined()
  expect(recovery.succeeded.manifest.retained['icons/logo.svg']).toBeUndefined()
  expect(parseState(JSON.stringify(recovery.pending)).previous).toBeDefined()
})

test('interrupted cleanup keeps ownership and original retirement dates on retry', () => {
  const removed = planDeployment({ 'index.html': initial['index.html'] }, first().succeeded, 'release2', now)
  const cleanup = planDeployment({ 'index.html': initial['index.html'] }, removed.succeeded, 'release3', later)
  const retry = planDeployment({ 'index.html': initial['index.html'] }, cleanup.pending, 'release4', later)
  expect(retry.remove).toEqual(cleanup.remove)
})

test('state parser rejects corruption, traversal, command injection and unmanaged namespaces', () => {
  expect(() => parseState('{')).toThrow(/JSON|Expected|position|property/i)
  for (const path of ['../index.html', '/index.html', 'assets/../index.html', 'assets/x\nrm y', 'assets/a;rm', '.env', 'uploads/member.png', 'config.php', 'assets/a.fujipp-next']) {
    expect(() => validatePath(path)).toThrow('Unmanaged or unsafe deployment path')
    const state = JSON.parse(JSON.stringify(first().succeeded)) as DeployState
    state.manifest.files[path] = record('bad')
    expect(() => parseState(JSON.stringify(state))).toThrow('Unmanaged or unsafe deployment path')
  }
  const state = first().succeeded
  state.manifest.files['index.html']!.sha256 = 'bad'
  expect(() => parseState(JSON.stringify(state))).toThrow('Invalid file hash')
})

test('build inventory includes dotfiles and hashes bytes; symlinks fail closed', () => {
  const dist = temporary()
  mkdirSync(join(dist, 'assets'))
  writeFileSync(join(dist, 'index.html'), 'html')
  writeFileSync(join(dist, '.htaccess'), 'rewrite')
  writeFileSync(join(dist, 'assets/a.js'), 'abc')
  expect(inventory(dist)['assets/a.js']).toEqual(record('abc'))
  expect(inventory(dist)['.htaccess']).toEqual(record('rewrite'))
  symlinkSync(join(dist, 'index.html'), join(dist, 'assets/link.js'))
  expect(() => inventory(dist)).toThrow('Symlinks')
})

test('file/directory transitions are rejected before writing to the hosting', () => {
  const state = planDeployment({ 'index.html': record('html'), 'assets/image': record('file') }, null, 'release1', now).succeeded
  expect(() => planDeployment({ 'index.html': record('html'), 'assets/image/a.png': record('png') }, state, 'release2', now)).toThrow('file/directory conflict')
})

test('staged uploads preserve entry point ordering; cleanup and success are separate', () => {
  const files = { ...initial, 'discord-preview.html': record('preview') }
  const plan = planDeployment(files, null, 'release1', now)
  const commands = uploadCommands(plan, '/tmp/deploy')
  expect(commands[1]).toBe(`mv "${stateName}.next" "${stateName}"`)
  const publishIndex = commands.findIndex(command => command === 'mv "index.html.fujipp-next" "index.html"')
  const publishPreview = commands.findIndex(command => command === 'mv "discord-preview.html.fujipp-next" "discord-preview.html"')
  const publishJs = commands.findIndex(command => command === 'mv "assets/app-old.js.fujipp-next" "assets/app-old.js"')
  expect(publishIndex).toBe(commands.length - 1)
  expect(publishPreview).toBeGreaterThan(publishJs)
  expect(publishIndex).toBeGreaterThan(publishPreview)
  expect(commands.join('\n')).not.toContain('rm -f')
  expect(commands.join('\n')).not.toContain('succeeded.json')
  expect(finalizeCommands(plan, '/tmp/deploy').join('\n')).toContain('succeeded.json')
})

test('planning is local, stages only changed files, and clears stale verification evidence', () => {
  const dist = temporary(), out = temporary()
  writeFileSync(join(dist, 'index.html'), 'html')
  const plan = planDeployment(inventory(dist), null, 'release1', now)
  writeFileSync(join(out, 'verified'), 'old run')
  writePlan(plan, dist, out)
  expect(readFileSync(join(out, 'stage/index.html.fujipp-next'), 'utf8')).toBe('html')
  expect(() => readFileSync(join(out, 'verified'))).toThrow('ENOENT')
  expect(parseState(readFileSync(join(out, 'pending.json'), 'utf8')).status).toBe('pending')
})

test('an explicit repair reuploads identical files without forgetting ownership', () => {
  const plan = planDeployment(initial, first().succeeded, 'repair', now, true)
  expect(plan.upload).toEqual(Object.keys(initial).sort())
  expect(plan.pending.previous?.files).toEqual(initial)
})

test('CLI recovers a partial remote overwrite and commits only after verification', () => {
  const workspace = temporary(), remote = temporary()
  const binary = join(workspace, 'lftp')
  copyFileSync('scripts/fixtures/lftp.py', binary)
  chmodSync(binary, 0o700)
  const cache = join(workspace, 'cache'), dist = join(workspace, 'dist')
  mkdirSync(join(dist, 'assets'), { recursive: true })
  mkdirSync(join(dist, 'icons'))
  mkdirSync(join(remote, 'assets'))
  mkdirSync(join(remote, 'icons'))
  const contents = { 'index.html': 'html', 'assets/app-old.js': 'old', 'icons/logo.svg': 'logo' }
  for (const [path, content] of Object.entries(contents)) {
    writeFileSync(join(dist, path), content)
    writeFileSync(join(remote, path), content)
  }
  writeFileSync(join(remote, 'customer.php'), 'unmanaged server file')
  writeFileSync(join(remote, stateName), JSON.stringify(first().succeeded))
  const env = {
    ...process.env, PATH: workspace + ':' + process.env.PATH, FTPS_TEST_ROOT: remote,
    FRONTEND_FTP_HOST: 'fixture.invalid', FRONTEND_FTP_PORT: '21', FRONTEND_FTP_PATH: 'domains/fixture.invalid/public_html',
  }
  const run = (command: string, fail = '') => spawnSync('bun', ['scripts/deploy-ftps.ts', command, '--dist', dist, '--out', cache, '--release', 'fixture'], { encoding: 'utf8', env: { ...env, FTPS_TEST_FAIL: fail } })
  writeFileSync(join(dist, 'icons/logo.svg'), 'LOGO')
  writeFileSync(join(dist, 'index.html'), 'new html')
  expect(run('prepare').status).toBe(0)
  expect(run('upload', 'index.html.fujipp-next').status).not.toBe(0)
  expect(readFileSync(join(remote, 'icons/logo.svg'), 'utf8')).toBe('LOGO')
  expect(parseState(readFileSync(join(remote, stateName), 'utf8')).status).toBe('pending')
  expect(run('finalize').stderr).toContain('HTTP verification has not succeeded')

  // Return to the original build. The old baseline alone would incorrectly skip
  // logo.svg, whose bytes were overwritten before the failed HTML upload.
  writeFileSync(join(dist, 'icons/logo.svg'), 'logo')
  writeFileSync(join(dist, 'index.html'), 'html')
  expect(run('prepare').status).toBe(0)
  const repaired = JSON.parse(readFileSync(join(cache, 'plan.json'), 'utf8'))
  expect(repaired.forceUpload).toBe(true)
  expect(repaired.upload).toHaveLength(3)
  expect(run('upload').status).toBe(0)
  for (const [path, content] of Object.entries(contents)) expect(readFileSync(join(remote, path), 'utf8')).toBe(content)
  writeFileSync(join(cache, 'verified'), 'test verifier compared all served files')
  expect(run('finalize').status).toBe(0)
  expect(parseState(readFileSync(join(remote, stateName), 'utf8')).status).toBe('succeeded')
  expect(parseState(readFileSync(join(cache, 'committed.json'), 'utf8')).status).toBe('succeeded')
  expect(readFileSync(join(remote, 'customer.php'), 'utf8')).toBe('unmanaged server file')

  expect(run('prepare').status).toBe(0)
  expect(JSON.parse(readFileSync(join(cache, 'plan.json'), 'utf8')).upload).toEqual([])
  writeFileSync(join(remote, stateName), '{broken')
  expect(run('prepare').status).not.toBe(0)
  expect(readFileSync(join(remote, stateName), 'utf8')).toBe('{broken')
})
