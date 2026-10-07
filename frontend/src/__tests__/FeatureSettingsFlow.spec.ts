import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeatureSettings } from '@/features/bots/composables/useFeatureSettings'
import {
  fetchFeatureConfiguration,
  fetchFeatureLicenses,
  fetchBots,
  fetchBot,
  updateFeatureConfiguration,
} from '@/features/bots/api'
import type { FeatureConfiguration } from '@/features/bots/api'
import { fetchRuntimeSubscriptions } from '@/features/bots/runtime-api'
import { useAuthStore } from '@/stores'
import { i18n } from '@/i18n'
import { bot, license, configuration, session, user } from './fixtures/domain'
import { memberSpendingConfiguration, memberSpendingLicense } from './fixtures/memberSpending'
vi.mock('@/features/bots/api', () => ({
  controlBot: vi.fn<typeof import('@/features/bots/api').controlBot>(),
  fetchBots: vi.fn<typeof import('@/features/bots/api').fetchBots>(),
  fetchBot: vi.fn<typeof import('@/features/bots/api').fetchBot>(),
  fetchFeatureLicenses: vi.fn<typeof import('@/features/bots/api').fetchFeatureLicenses>(),
  fetchFeatureConfiguration:
    vi.fn<typeof import('@/features/bots/api').fetchFeatureConfiguration>(),
  updateFeatureConfiguration:
    vi.fn<typeof import('@/features/bots/api').updateFeatureConfiguration>(),
}))
vi.mock('@/features/bots/runtime-api', () => ({
  fetchRuntimeSubscriptions: vi.fn<typeof fetchRuntimeSubscriptions>(),
}))
beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.session = session
  auth.currentUser = user
  auth.initialized = true
  vi.mocked(fetchBots).mockResolvedValue([bot])
  vi.mocked(fetchBot).mockResolvedValue(bot)
  vi.mocked(fetchFeatureLicenses).mockResolvedValue([license])
  vi.mocked(fetchRuntimeSubscriptions).mockResolvedValue([])
  vi.mocked(fetchFeatureConfiguration).mockResolvedValue(structuredClone(configuration))
  vi.mocked(updateFeatureConfiguration).mockResolvedValue({
    ...structuredClone(configuration),
    revision: 2,
  })
})
async function setup() {
  let editor!: ReturnType<typeof useFeatureSettings>
  const Harness = defineComponent({
    setup() {
      editor = useFeatureSettings()
      return () => h('div')
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/my-bot/:botId/settings/packages/:licenseId',
        name: 'bot-feature-settings',
        component: Harness,
      },
      {
        path: '/my-bot/:botId/settings/packages/:licenseId/embed',
        name: 'bot-feature-embed-settings',
        component: Harness,
      },
      {
        path: '/my-bot/:botId/settings/packages/:licenseId/components-v2',
        name: 'bot-feature-components-v2-settings',
        component: Harness,
      },
    ],
  })
  await router.push(`/my-bot/${bot.id}/settings/packages/${license.id}`)
  const wrapper = mount(Harness, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { editor, wrapper, router }
}
describe('feature settings save flow', () => {
  it('normalizes Wallet previews without changing saved presentation definitions', async () => {
    const config = structuredClone(configuration)
    config.presentations[0]!.defaultDefinition = {
      mode: 'COMPONENTS_V2',
      title: 'Wallet',
      description: 'Body',
    }
    vi.mocked(fetchFeatureConfiguration).mockResolvedValue(config)
    const { editor, wrapper } = await setup()
    const before = editor.presentationJson.value.panel
    const dirtyBefore = editor.hasChanges.value
    expect(editor.presentationPreviewDefinition('panel').components).toMatchObject([{ type: 17 }])
    expect(editor.presentationJson.value.panel).toBe(before)
    expect(editor.hasChanges.value).toBe(dirtyBefore)
    wrapper.unmount()
  })
  it('uses the empty member avatar supplied by Wallet runtime in sample previews', async () => {
    const { editor, wrapper } = await setup()
    expect(editor.presentationSampleValues('balance').member_avatar_url).toBe('')
    wrapper.unmount()
  })
  it('enables saving for changed values and secrets, and disables it when edits are reverted', async () => {
    const { editor, wrapper } = await setup()
    expect(editor.hasChanges.value).toBe(false)
    expect(editor.canSave.value).toBe(false)
    editor.requestSave()
    expect(editor.saveConfirmationOpen.value).toBe(false)
    await editor.confirmSave()
    expect(updateFeatureConfiguration).not.toHaveBeenCalled()

    editor.values.value.MIN_TOPUP_SATANG = '250'
    expect(editor.canSave.value).toBe(true)
    editor.values.value.MIN_TOPUP_SATANG = '100'
    expect(editor.hasChanges.value).toBe(false)
    editor.secrets.value.SLIPOK_API_KEY = 'new-test-secret'
    expect(editor.hasChanges.value).toBe(true)
    editor.secrets.value.SLIPOK_API_KEY = ''
    expect(editor.canSave.value).toBe(false)
    wrapper.unmount()
  })

  it('compares JSON data rather than formatting and catches incomplete advanced JSON edits', async () => {
    vi.mocked(fetchFeatureLicenses).mockResolvedValue([memberSpendingLicense])
    vi.mocked(fetchFeatureConfiguration).mockResolvedValue(
      structuredClone(memberSpendingConfiguration),
    )
    const { editor, wrapper } = await setup()
    expect(editor.hasChanges.value).toBe(false)
    editor.values.value.SPENDING_UPGRADE_TIERS = '[\n  \n]'
    expect(editor.hasChanges.value).toBe(false)
    editor.values.value.SPENDING_UPGRADE_TIERS = '[{"amount":5000,"roleId":"123"}]'
    expect(editor.hasChanges.value).toBe(true)
    editor.values.value.SPENDING_UPGRADE_TIERS = '[]'
    expect(editor.hasChanges.value).toBe(false)

    editor.selectPresentationSlot('first_card')
    editor.toggleAdvanced('first_card')
    const message = editor.presentationPreviewDefinition('first_card')
    editor.presentationJson.value.first_card = JSON.stringify(
      Object.fromEntries(Object.entries(message).reverse()),
    )
    expect(editor.hasChanges.value).toBe(false)
    editor.presentationJson.value.first_card = '{incomplete'
    expect(editor.hasChanges.value).toBe(true)
    editor.presentationJson.value.first_card = JSON.stringify(message)
    expect(editor.hasChanges.value).toBe(false)
    editor.toggleAdvanced('first_card')
    editor.toggleAdvanced('returning_card')
    editor.toggleAdvanced('returning_card')
    expect(editor.hasChanges.value).toBe(false)
    editor.updatePresentation('returning_card', 'components', [
      { type: 10, content: 'Changed text' },
    ])
    expect(editor.hasChanges.value).toBe(true)
    wrapper.unmount()
  })

  it('tracks embed edits and disables saving after restoring the saved text', async () => {
    const { editor, wrapper } = await setup()
    const initial = structuredClone(configuration.presentations[0]!.defaultDefinition)
    editor.updatePresentation('panel', 'title', 'Changed title')
    expect(editor.hasChanges.value).toBe(true)
    editor.presentationJson.value.panel = JSON.stringify(initial)
    editor.previewAdvancedJson('panel')
    expect(editor.hasChanges.value).toBe(false)
    wrapper.unmount()
  })

  it('requires confirmation, prevents duplicate saves, and resets changes after success', async () => {
    const { editor, wrapper } = await setup()
    editor.values.value.MIN_TOPUP_SATANG = 250
    editor.requestSave()
    expect(editor.saveConfirmationOpen.value).toBe(true)
    expect(updateFeatureConfiguration).not.toHaveBeenCalled()
    editor.saveConfirmationOpen.value = false
    expect(editor.canSave.value).toBe(true)
    expect(updateFeatureConfiguration).not.toHaveBeenCalled()
    editor.requestSave()
    let complete!: (config: FeatureConfiguration) => void
    vi.mocked(updateFeatureConfiguration).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const saving = editor.confirmSave()
    expect(editor.saving.value).toBe(true)
    expect(editor.canSave.value).toBe(false)
    await editor.confirmSave()
    expect(updateFeatureConfiguration).toHaveBeenCalledTimes(1)
    complete({
      ...structuredClone(configuration),
      revision: 2,
      fields: configuration.fields.map((field) =>
        field.key === 'MIN_TOPUP_SATANG' ? { ...field, value: 250 } : field,
      ),
    })
    await saving
    expect(editor.saveConfirmationOpen.value).toBe(false)
    expect(editor.hasChanges.value).toBe(false)
    expect(editor.canSave.value).toBe(false)
    editor.values.value.MIN_TOPUP_SATANG = 300
    expect(editor.canSave.value).toBe(true)
    wrapper.unmount()
  })
  it('opens the selected Member Spending message without changing the message formats', async () => {
    vi.mocked(fetchFeatureLicenses).mockResolvedValue([memberSpendingLicense])
    vi.mocked(fetchFeatureConfiguration).mockResolvedValue(
      structuredClone(memberSpendingConfiguration),
    )
    vi.mocked(updateFeatureConfiguration).mockResolvedValue({
      ...structuredClone(memberSpendingConfiguration),
      revision: 2,
    })
    const { editor, wrapper, router } = await setup()
    const formats = Object.fromEntries(
      editor.visiblePresentationSlots.value.map((slot) => [slot.key, editor.slotMode(slot.key)]),
    )
    await editor.openPresentation('COMPONENTS_V2', 'leaderboard')
    await flushPromises()
    expect(router.currentRoute.value.query.message).toBe('leaderboard')
    expect(editor.editablePresentationSlots.value.map((slot) => slot.key)).toEqual(['leaderboard'])
    expect(updateFeatureConfiguration).toHaveBeenCalledWith(
      license.id,
      expect.objectContaining({
        presentations: expect.objectContaining({
          first_card: expect.objectContaining({ mode: formats.first_card }),
          returning_card: expect.objectContaining({ mode: formats.returning_card }),
          leaderboard: expect.objectContaining({ mode: formats.leaderboard }),
        }),
      }),
      expect.anything(),
    )
    wrapper.unmount()
  })
  it('converts field values, omits unchanged secrets and keeps the server revision', async () => {
    const { editor, wrapper } = await setup()
    editor.values.value.MIN_TOPUP_SATANG = '250'
    expect(await editor.save()).toBe(true)
    expect(updateFeatureConfiguration).toHaveBeenCalledWith(
      license.id,
      expect.objectContaining({ values: { MIN_TOPUP_SATANG: 250 }, secrets: {} }),
      expect.objectContaining({ access_token: session.access_token }),
    )
    expect(editor.configuration.value?.revision).toBe(2)
    wrapper.unmount()
  })
  it('keeps edits available for retry after a failed save', async () => {
    const { editor, wrapper } = await setup()
    editor.values.value.MIN_TOPUP_SATANG = '300'
    vi.mocked(updateFeatureConfiguration).mockRejectedValueOnce(new Error('Service unavailable'))
    editor.requestSave()
    await editor.confirmSave()
    expect(editor.values.value.MIN_TOPUP_SATANG).toBe('300')
    expect(editor.toastMessage.value).toBe('Service unavailable')
    expect(editor.saving.value).toBe(false)
    expect(editor.saveConfirmationOpen.value).toBe(true)
    expect(editor.canSave.value).toBe(true)
    wrapper.unmount()
  })
  it('does not send invalid presentation JSON to the API', async () => {
    const { editor, wrapper } = await setup()
    editor.advancedSlots.value.add('panel')
    editor.presentationJson.value.panel = '{invalid'
    expect(await editor.save()).toBe(false)
    expect(updateFeatureConfiguration).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('shows an independent presentation slot for each configured Robux panel', async () => {
    vi.mocked(fetchFeatureLicenses).mockResolvedValue([
      {
        ...license,
        featureCode: 'roblox-robux-payout',
        featureName: 'Robux Payout',
        version: '3.0.0',
      },
    ])
    const panels = [
      {
        key: 'panel-1',
        name: 'Panel One',
        groupKeys: ['group-1'],
        presentationSlot: 'panel_1',
      },
      {
        key: 'panel-2',
        name: 'Panel Two',
        groupKeys: ['group-2'],
        presentationSlot: 'panel_2',
      },
    ]
    const slot = (key: string) => ({
      ...configuration.presentations[0]!,
      slotId: `slot-${key}`,
      key,
      label: key,
    })
    vi.mocked(fetchFeatureConfiguration).mockResolvedValue({
      ...structuredClone(configuration),
      fields: [
        {
          ...configuration.fields[0]!,
          key: 'ROBUX_PANELS',
          type: 'JSON',
          defaultValue: panels,
          value: panels,
        },
      ],
      presentations: [
        slot('panel'),
        slot('panel_1'),
        slot('panel_2'),
        slot('panel_3'),
        slot('confirmation'),
      ],
    } as unknown as FeatureConfiguration)

    const { editor, wrapper } = await setup()
    expect(editor.visiblePresentationSlots.value.map((item) => item.key)).toEqual([
      'panel_1',
      'panel_2',
      'confirmation',
    ])
    expect(editor.presentationSlotLabel(editor.visiblePresentationSlots.value[0]!)).toBe(
      'Panel One',
    )
    expect(editor.presentationSlotLabel(editor.visiblePresentationSlots.value[1]!)).toBe(
      'Panel Two',
    )
    wrapper.unmount()
  })
})
