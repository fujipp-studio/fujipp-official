import { expect, test } from 'vitest'
import { readScripts, select } from './ci-affected'

test('page changes select its smoke coverage', () => {
  const plan = select(['frontend/src/features/privacy/views/PrivacyView.vue'])
  expect(plan.full).toBe(false)
  expect(plan.features).toEqual(['privacy'])
  expect(plan.smoke).toContain('privacy.smoke.spec.ts')
  expect(plan.smoke).not.toContain('wallet-topup.smoke.spec.ts')
})

test('shared code, config, deleted files and manual runs use all tests', () => {
  for (const file of ['frontend/src/router/index.ts', 'frontend/src/styles/base.css', 'frontend/bun.lock', 'frontend/src/features/privacy/deleted.vue', 'bot-runner/src/features/price-reader/index.ts']) {
    expect(select([file]).full).toBe(true)
  }
  expect(select([], true).full).toBe(true)
})

test('smoke-only edits select the changed spec', () => {
  expect(select(['frontend/e2e/privacy.smoke.spec.ts']).smoke).toEqual(['privacy.smoke.spec.ts'])
})

test('multiple features combine coverage; broad bot changes use full coverage', () => {
  expect(select(['frontend/src/features/privacy/views/PrivacyView.vue', 'frontend/src/features/account/views/AccountView.vue']).features).toEqual(['account', 'privacy'])
  expect(select(['frontend/src/features/bots/api.ts']).full).toBe(true)
})

test('cross-feature consumers extend coverage', () => {
  const plan = select(['frontend/src/features/work/api.ts'])
  expect(plan.full || plan.features.includes('home')).toBe(true)
})


test('Vue parser reads both script blocks without treating template content as imports', () => {
  const source = `<script lang="ts">import legacy from './legacy'</script>
<script setup lang="ts">import modern from './modern'</script>
<template><p>import fake from './fake'</p></template>`
  expect(readScripts('Page.vue', source)).toContain("import legacy from './legacy'")
  expect(readScripts('Page.vue', source)).toContain("import modern from './modern'")
  expect(readScripts('Page.vue', source)).not.toContain('./fake')
})

test('malformed Vue source fails selection instead of silently omitting dependencies', () => {
  expect(() => readScripts('Broken.vue', '<script setup>import page from "./page"')).toThrow('Cannot parse Vue source: Broken.vue')
})
