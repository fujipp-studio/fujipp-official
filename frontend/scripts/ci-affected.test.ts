import { expect, test } from 'vitest'
import { readScripts, select } from './ci-affected'
import { loadFeatureMap, ownerOf } from './feature-map'

test('page changes select its smoke coverage', () => {
  const plan = select(['frontend/src/features/privacy/views/PrivacyView.vue'])
  expect(plan.full).toBe(false)
  expect(plan.features).toEqual(['privacy'])
  expect(plan.smoke).toContain('privacy.smoke.spec.ts')
  expect(plan.smoke).not.toContain('wallet-topup.smoke.spec.ts')
})

test('shared code, config, deleted files and manual runs use all tests', () => {
  for (const file of ['frontend/src/router/index.ts', 'frontend/src/styles/base.css', 'frontend/bun.lock', 'frontend/src/features/privacy/deleted.vue', 'frontend/ci/feature-map.json']) {
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

test('specific bot ownership overrides the core folder and records routes and guides', () => {
  const map = loadFeatureMap()
  expect(ownerOf('frontend/src/features/bots/components/TicketOpeningMentions.vue', map)).toBe('ticket')
  expect(ownerOf('frontend/src/features/bots/components/NewUnknownConfig.vue', map)).toBe('bots-core')
  expect(map.features.ticket?.routes).toContain('/my-bot/:botId/settings/packages/:licenseId')
  expect(map.features.ticket?.guides).toContain('docs/ticket.md')
})

test('ticket config crosses the documented dispatcher without selecting unrelated features', () => {
  const plan = select(['frontend/src/features/bots/components/TicketOpeningMentions.vue'])
  expect(plan.full).toBe(false)
  expect(plan.features).toEqual(['ticket'])
  expect(plan.smoke).toEqual(['ticket-history.smoke.spec.ts', 'ticket.smoke.spec.ts'])
  expect(plan.unit).toContain('src/__tests__/Ticket.spec.ts')
  expect(plan.boundaries).toContain('frontend/src/features/bots/components/FeatureConfigFields.vue')
})

test('wallet changes include explicitly dependent payout and role shop coverage', () => {
  const plan = select(['frontend/src/features/bots/config/wallet-topup.ts'])
  expect(plan.full).toBe(false)
  expect(plan.features).toEqual(['roblox-payout', 'role-shop', 'wallet-topup'])
  expect(plan.smoke).toContain('wallet-qr.smoke.spec.ts')
  expect(plan.smoke).toContain('role-shop.smoke.spec.ts')
  expect(plan.smoke).toContain('roblox-payout.smoke.spec.ts')
  expect(plan.smoke).not.toContain('ticket.smoke.spec.ts')
})

test('editing a dispatcher itself always uses the full suite', () => {
  for (const boundary of loadFeatureMap().boundaries) expect(select([boundary.path]).full).toBe(true)
})

test('price-reader shared runtime changes retain frontend feature coverage', () => {
  const plan = select(['bot-runner/src/features/price-reader/index.ts'])
  expect(plan.full).toBe(false)
  expect(plan.smoke).toContain('price-reader.smoke.spec.ts')
  expect(plan.smoke).toContain('price-reader-customization.smoke.spec.ts')
})

test('a unit-only edit runs that test without selecting browser tests', () => {
  const plan = select(['frontend/src/__tests__/Ticket.spec.ts'])
  expect(plan.full).toBe(false)
  expect(plan.unit).toEqual(['src/__tests__/Ticket.spec.ts'])
  expect(plan.smoke).toEqual([])
})
