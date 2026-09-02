import {
  walletConfigCopy,
  robloxConfigCopy,
  priceReaderConfigCopy,
  robloxPresentationCopy,
  priceReaderPresentationCopy,
  presentationModeOptions,
  componentStyleOptions,
  componentStyles,
  variableDescriptions,
  coFeatureCatalog,
} from '../config/feature-editor'
import { clone } from '../models/presentation'
import { usePresentationEditor } from './usePresentationEditor'
import { useBotSettingsData } from '../composables/useBotSettingsData'
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  fetchFeatureConfiguration,
  updateFeatureConfiguration,
  type FeatureConfiguration,
  type FeatureConfigValue,
  type FeatureLicense,
} from '@/features/bots/api'
import {
  fetchAdminFeatureConfiguration,
  updateAdminFeatureConfiguration,
} from '@/features/admin/api/bots'
import { useAuthStore } from '../../../stores'

export function useFeatureSettings() {
  type EditableValue = string | number | boolean

  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const { session, initialized } = storeToRefs(authStore)
  const { locale, t } = useI18n()

  const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)

  const licenseId = computed(() => String(route.params.licenseId ?? ''))
  const flowBotId = computed(() => String(route.params.botId ?? ''))
  const inBotSettingsFlow = computed(() => Boolean(flowBotId.value))
  const adminMode = computed(() => route.path.startsWith('/admin/bots/'))

  const isRobloxPayoutFeature = computed(() => {
    const code = license.value?.featureCode
    return code === 'roblox-robux-payout' || 'ROBLOX_GROUPS' in values.value
  })
  const isRobloxPayoutV2 = computed(
    () => isRobloxPayoutFeature.value && license.value?.version.startsWith('2.'),
  )
  const isWalletTopupFeature = computed(() => license.value?.featureCode === 'wallet-topup')
  const isPriceReaderFeature = computed(() => license.value?.featureCode === 'price-reader')
  const usesPresentationDesigner = computed(
    () => isWalletTopupFeature.value || isRobloxPayoutFeature.value || isPriceReaderFeature.value,
  )
  const isWalletPanelCommand = (key: string) =>
    isWalletTopupFeature.value && key === 'PANEL_COMMAND_NAME'

  function presentationSlotLabel(slot: FeatureConfiguration['presentations'][number]) {
    const copy = isRobloxPayoutFeature.value
      ? robloxPresentationCopy[slot.key]
      : isPriceReaderFeature.value
        ? priceReaderPresentationCopy[slot.key]
        : undefined
    return copy ? text(...copy.label) : slot.label
  }
  function presentationSlotDescription(slot: FeatureConfiguration['presentations'][number]) {
    const copy = isRobloxPayoutFeature.value
      ? robloxPresentationCopy[slot.key]
      : isPriceReaderFeature.value
        ? priceReaderPresentationCopy[slot.key]
        : undefined
    return copy ? text(...copy.description) : slot.description
  }
  function configFieldLabel(field: FeatureConfiguration['fields'][number]) {
    const copy = isWalletTopupFeature.value
      ? walletConfigCopy[field.key]
      : isRobloxPayoutFeature.value
        ? robloxConfigCopy[field.key]
        : isPriceReaderFeature.value
          ? priceReaderConfigCopy[field.key]
          : undefined
    return copy ? text(...copy.label) : field.label
  }
  function configFieldDescription(field: FeatureConfiguration['fields'][number]) {
    const copy = isWalletTopupFeature.value
      ? walletConfigCopy[field.key]
      : isRobloxPayoutFeature.value
        ? robloxConfigCopy[field.key]
        : isPriceReaderFeature.value
          ? priceReaderConfigCopy[field.key]
          : undefined
    return copy ? text(...copy.description) : field.description
  }

  const isRobloxGroupField = (key: string) => {
    return isRobloxPayoutFeature.value && (key === 'ROBLOX_GROUPS' || key === 'ROBLOX_CREDENTIALS')
  }

  const robloxCredentialsConfigured = computed(() => {
    return (
      configuration.value?.fields.find((f) => f.key === 'ROBLOX_CREDENTIALS')?.configured ?? false
    )
  })
  const presentationMode = computed<'EMBED' | 'COMPONENTS_V2' | null>(() => {
    if (
      route.name === 'feature-embed-settings' ||
      route.name === 'bot-feature-embed-settings' ||
      route.name === 'admin-bot-feature-embed-settings'
    )
      return 'EMBED'
    if (
      route.name === 'feature-components-v2-settings' ||
      route.name === 'bot-feature-components-v2-settings' ||
      route.name === 'admin-bot-feature-components-v2-settings'
    )
      return 'COMPONENTS_V2'
    return null
  })
  const pageSections = computed(() =>
    presentationMode.value
      ? [
          {
            id: 'feature-presentation-editor',
            label: t('botSettings.presentationEditor'),
          },
        ]
      : [
          { id: 'feature-config', label: t('botSettings.config') },
          { id: 'feature-presentations', label: t('botSettings.presentations') },
        ],
  )
  const license = ref<FeatureLicense | null>(null)
  const settingsData = useBotSettingsData({ botId: flowBotId, adminMode, licenseId })
  const previewBot = settingsData.bot
  const installedFeatureCodes = ref(new Set<string>())
  const configuration = ref<FeatureConfiguration | null>(null)
  const values = ref<Record<string, EditableValue>>({})
  const secrets = ref<Record<string, string>>({})
  const presentations = ref<Record<string, Record<string, unknown>>>({})
  const presentationJson = ref<Record<string, string>>({})
  const advancedSlots = ref(new Set<string>())
  const walletExpandedSlots = ref(new Set<string>())

  const valueLength = (value: unknown) => String(value ?? '').length

  const availableCoFeatures = computed(() =>
    coFeatureCatalog.filter((item) => installedFeatureCodes.value.has(item.featureCode)),
  )
  const loading = ref(true)
  const saving = ref(false)
  const saveConfirmationOpen = ref(false)
  const walletPreviewScope = ref<'all' | 'current'>('current')
  const walletActiveSlotKey = ref('')
  const draggedComponent = ref<{ slotKey: string; index: number } | null>(null)
  const error = ref('')
  const toastOpen = ref(false)
  const toastMessage = ref('')
  const toastVariant = ref<'success' | 'error'>('success')

  const presentationEditor = usePresentationEditor({
    presentations,
    presentationJson,
    presentationMode,
    text,
    t,
    availableCoFeatures,
    draggedComponent,
    advancedSlots,
  })
  const {
    updatePresentation,
    embedColor,
    updateEmbedColor,
    embedObject,
    updateEmbedObject,
    fixedActions,
    defaultActionLabel,
    updateActionOverride,
    visualArray,
    addEmbedField,
    updateEmbedField,
    removeEmbedField,
    addLink,
    updateLink,
    removeLink,
    componentBlocks,
    supportsBlockBuilder,
    systemComponents,
    updateSystemComponent,
    coFeatureComponents,
    addCoFeature,
    removeCoFeature,
    updateCoFeature,
    availableCoFeatureOptions,
    containerChildren,
    componentCount,
    componentColor,
    updateContainerBlock,
    sectionTextBlocks,
    updateSectionText,
    addSectionText,
    removeSectionText,
    sectionAccessory,
    sectionAccessoryType,
    setSectionAccessory,
    updateSectionAccessory,
    mediaItems,
    mediaItemUrl,
    mediaItemDescription,
    updateMediaItem,
    addMediaItem,
    updateMediaItemField,
    removeMediaItem,
    actionRowButtons,
    componentEmoji,
    updateActionRowButton,
    addActionRowButton,
    removeActionRowButton,
    updateSeparator,
    addComponentBlock,
    addContainerChild,
    removeContainerChild,
    moveContainerChild,
    updateContainerChildContent,
    updateContainerChild,
    removeComponentBlock,
    updateComponentBlock,
    componentBlockValue,
    moveComponentBlock,
    dropComponentBlock,
    blockSummary,
    visualDefinition,
    variableToken,
    toggleAdvanced,
    previewAdvancedJson,
  } = presentationEditor
  function showToast(message: string, variant: 'success' | 'error') {
    toastMessage.value = message
    toastVariant.value = variant
    toastOpen.value = false
    requestAnimationFrame(() => {
      toastOpen.value = true
    })
  }

  function displayValue(value: FeatureConfigValue | null, type: string): EditableValue {
    if (type === 'BOOLEAN') return typeof value === 'boolean' ? value : false
    if (['INTEGER', 'DECIMAL'].includes(type)) return typeof value === 'number' ? value : ''
    if (type === 'STRING_LIST') return Array.isArray(value) ? value.join('\n') : ''
    if (type === 'JSON') return value === null ? '' : JSON.stringify(value, null, 2)
    return typeof value === 'string' ? value : ''
  }

  type ConfigField = FeatureConfiguration['fields'][number]

  function fieldOptions(field: ConfigField) {
    const configuredOptions = field.ui?.options
    if (Array.isArray(configuredOptions)) {
      return configuredOptions.flatMap((option) => {
        if (typeof option === 'string') return [{ value: option, label: option }]
        if (!option || typeof option !== 'object') return []
        const value = Reflect.get(option, 'value')
        const label = Reflect.get(option, 'label')
        return typeof value === 'string'
          ? [{ value, label: typeof label === 'string' ? label : value }]
          : []
      })
    }
    const enumValues = field.validation?.enum
    const options = Array.isArray(enumValues)
      ? enumValues
          .filter((value): value is string => typeof value === 'string')
          .map((value) => ({
            value,
            label: value.replace(/_/g, ' '),
          }))
      : []
    if (isWalletTopupFeature.value && field.key === 'TRUEMONEY_FEE_MODE')
      return options.map((option) => ({
        ...option,
        label:
          option.value === 'FIXED'
            ? t('botSettings.fixedAmount')
            : option.value === 'PERCENT'
              ? t('botSettings.percentage')
              : option.label,
      }))
    return options
  }

  function isDropdownField(field: ConfigField) {
    return field.ui?.control === 'select' || fieldOptions(field).length > 0
  }

  function variableDescription(variable: string) {
    const description = variableDescriptions[variable]
    if (description) return text(description[0], description[1])
    const readable = variable.replace(/_/g, ' ')
    return text(`Value supplied by the Feature: ${readable}`, `ค่าที่ Feature ส่งมา: ${readable}`)
  }

  function isThresholdRoleField(key: string) {
    return key === 'SPENDING_UPGRADE_TIERS' || key === 'TOP_SPENDER_MILESTONE_ROLES'
  }

  function presentationSampleValues(slotKey: string): Record<string, string> {
    if (license.value?.featureCode !== 'price-reader' || slotKey !== 'result') return {}
    const template = String(values.value.PRICE_READER_RESULTS_ITEM_TEMPLATE ?? '')
    if (!template.trim()) return {}
    const samples = [
      {
        result_index: '1',
        discord_price: '289.00',
        discount_text: ' (ลด 20%)',
        shop_price_text: '259.00 บาท',
        no_nitro_markup: '15.00',
      },
      {
        result_index: '2',
        discord_price: '499.00',
        discount_text: '',
        shop_price_text: 'ไม่พบราคาที่ตรงกัน',
        no_nitro_markup: '15.00',
      },
      {
        result_index: '3',
        discord_price: '1,050.00',
        discount_text: ' (ลด 10%)',
        shop_price_text: '999.00 บาท',
        no_nitro_markup: '15.00',
      },
    ]
    const renderItem = (sample: Record<string, string>) =>
      template.replace(/\{\{([^}]+)}}/g, (_, key: string) => sample[key.trim()] ?? '')
    return { results_text: samples.map(renderItem).join('\n\n---\n\n') }
  }

  function goBack() {
    if (presentationMode.value) {
      void router.push(
        inBotSettingsFlow.value
          ? {
              name: adminMode.value ? 'admin-bot-feature-settings' : 'bot-feature-settings',
              params: { botId: flowBotId.value, licenseId: licenseId.value },
            }
          : { name: 'feature-settings', params: { licenseId: licenseId.value } },
      )
      return
    }
    void router.push(
      inBotSettingsFlow.value
        ? {
            name: adminMode.value ? 'admin-bot-package-settings' : 'bot-package-settings',
            params: { botId: flowBotId.value },
          }
        : { name: 'my-bot' },
    )
  }

  async function openPresentation(mode: 'EMBED' | 'COMPONENTS_V2') {
    if (!(await save())) return
    const name = adminMode.value
      ? mode === 'EMBED'
        ? 'admin-bot-feature-embed-settings'
        : 'admin-bot-feature-components-v2-settings'
      : inBotSettingsFlow.value
        ? mode === 'EMBED'
          ? 'bot-feature-embed-settings'
          : 'bot-feature-components-v2-settings'
        : mode === 'EMBED'
          ? 'feature-embed-settings'
          : 'feature-components-v2-settings'
    void router.push({
      name,
      params: {
        ...(inBotSettingsFlow.value ? { botId: flowBotId.value } : {}),
        licenseId: licenseId.value,
      },
    })
  }

  function hydrate(config: FeatureConfiguration) {
    values.value = Object.fromEntries(
      config.fields
        .filter((field) => !field.secret)
        .map((field) => [field.key, displayValue(field.value ?? field.defaultValue, field.type)]),
    )
    secrets.value = {}
    presentations.value = {}
    presentationJson.value = {}
    for (const slot of config.presentations) {
      const definition = clone(slot.overrideDefinition ?? slot.defaultDefinition)
      presentations.value[slot.key] = definition
      presentationJson.value[slot.key] = JSON.stringify(definition, null, 2)
    }
    walletExpandedSlots.value = new Set(config.presentations.slice(0, 1).map((slot) => slot.key))
    walletActiveSlotKey.value = config.presentations[0]?.key ?? ''
  }

  function slotMode(slotKey: string): 'EMBED' | 'COMPONENTS_V2' {
    return String(presentations.value[slotKey]?.mode ?? 'EMBED').toUpperCase() === 'COMPONENTS_V2'
      ? 'COMPONENTS_V2'
      : 'EMBED'
  }

  function setPresentationMode(slotKey: string, mode: string) {
    if (!usesPresentationDesigner.value) return
    const normalized = mode === 'COMPONENTS_V2' ? 'COMPONENTS_V2' : 'EMBED'
    presentations.value[slotKey] = { ...presentations.value[slotKey], mode: normalized }
    presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
  }

  const availablePresentationModes = computed(() =>
    presentationModeOptions.filter(
      (option) =>
        usesPresentationDesigner.value ||
        (configuration.value?.presentations ?? []).some(
          (slot) => slotMode(slot.key) === option.value,
        ),
    ),
  )

  const visiblePresentationSlots = computed(() =>
    (configuration.value?.presentations ?? []).filter(
      (slot) =>
        !presentationMode.value ||
        usesPresentationDesigner.value ||
        slotMode(slot.key) === presentationMode.value,
    ),
  )

  const editablePresentationSlots = computed(() => {
    if (!usesPresentationDesigner.value) return visiblePresentationSlots.value
    const selected =
      walletActiveSlotKey.value &&
      visiblePresentationSlots.value.some((slot) => slot.key === walletActiveSlotKey.value)
        ? walletActiveSlotKey.value
        : visiblePresentationSlots.value[0]?.key
    return visiblePresentationSlots.value.filter((slot) => slot.key === selected)
  })

  function presentationPreviewDefinition(slotKey: string) {
    const definition = presentations.value[slotKey] ?? {}
    const mode = presentationMode.value
    if (!mode) return definition
    return {
      ...definition,
      mode,
      [mode === 'EMBED' ? 'embed' : 'components_v2']: visualDefinition(slotKey),
    }
  }

  function toggleWalletMessage(slotKey: string) {
    walletActiveSlotKey.value = slotKey
    const next = new Set(walletExpandedSlots.value)
    if (next.has(slotKey)) next.delete(slotKey)
    else next.add(slotKey)
    walletExpandedSlots.value = next
  }

  function selectPresentationSlot(slotKey: string) {
    walletActiveSlotKey.value = slotKey
    walletExpandedSlots.value = new Set([slotKey])
  }

  const walletPreviewSlots = computed(() => {
    if (walletPreviewScope.value === 'all') return visiblePresentationSlots.value
    return visiblePresentationSlots.value.filter(
      (slot) => slot.key === (walletActiveSlotKey.value || visiblePresentationSlots.value[0]?.key),
    )
  })

  async function confirmSave() {
    if (await save()) saveConfirmationOpen.value = false
  }

  async function load() {
    loading.value = true
    error.value = ''
    if (!initialized.value) await authStore.initialize()
    if (!session.value) {
      error.value = t('botSettings.pleaseSignInBeforeOpeningFeatureSettings')
      loading.value = false
      return
    }
    try {
      await settingsData.load()
      if (settingsData.error.value) throw new Error(settingsData.error.value)
      const allLicenses = settingsData.licenses.value
      const config = adminMode.value
        ? await fetchAdminFeatureConfiguration(flowBotId.value, licenseId.value, session.value)
        : await fetchFeatureConfiguration(licenseId.value, session.value)
      license.value = allLicenses.find((item) => item.id === licenseId.value) ?? null
      const installedBotId = license.value?.installations.find(
        (item) => item.status === 'ACTIVE',
      )?.botId
      const targetBotId = flowBotId.value || installedBotId
      installedFeatureCodes.value = new Set(
        allLicenses
          .filter((item) =>
            item.installations.some(
              (installation) =>
                installation.botId === targetBotId && installation.status === 'ACTIVE',
            ),
          )
          .map((item) => item.featureCode),
      )
      configuration.value = config
      hydrate(config)
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : t('botSettings.unableToLoadFeatureConfiguration')
    } finally {
      loading.value = false
    }
  }

  function parseField(field: FeatureConfiguration['fields'][number]): FeatureConfigValue {
    const value = values.value[field.key]
    if (field.type === 'INTEGER') return Number.parseInt(String(value), 10)
    if (field.type === 'DECIMAL') return Number(value)
    if (field.type === 'BOOLEAN') return Boolean(value)
    if (field.type === 'STRING_LIST')
      return String(value)
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    if (field.type === 'JSON') return JSON.parse(String(value)) as Record<string, unknown>
    return String(value)
  }

  async function save(): Promise<boolean> {
    if (!session.value || !configuration.value) return false
    saving.value = true
    error.value = ''
    try {
      const normalValues: Record<string, FeatureConfigValue> = {}
      const changedSecrets: Record<string, string> = {}
      for (const field of configuration.value.fields) {
        if (field.secret) {
          const secret = secrets.value[field.key]
          if (secret) changedSecrets[field.key] = secret
        } else normalValues[field.key] = parseField(field)
      }
      for (const slot of configuration.value.presentations) {
        if (!advancedSlots.value.has(slot.key)) continue
        const parsed = JSON.parse(presentationJson.value[slot.key] ?? '{}') as unknown
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
          throw new Error(`${slot.label}: ${t('botSettings.jsonMustBeAnObject')}`)
        presentations.value[slot.key] = parsed as Record<string, unknown>
      }
      const input = {
        values: normalValues,
        secrets: changedSecrets,
        presentations: presentations.value,
      }
      const updated = adminMode.value
        ? await updateAdminFeatureConfiguration(
            flowBotId.value,
            licenseId.value,
            input,
            session.value,
          )
        : await updateFeatureConfiguration(licenseId.value, input, session.value)
      configuration.value = updated
      hydrate(updated)
      showToast(
        text(`Saved · Version ${updated.revision}`, `บันทึกแล้ว · Version ${updated.revision}`),
        'success',
      )
      return true
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : t('botSettings.unableToSaveFeatureSettings'),
        'error',
      )
      return false
    } finally {
      saving.value = false
    }
  }

  onMounted(() => void load())

  return {
    inBotSettingsFlow,
    goBack,
    presentationMode,
    text,
    license,
    configuration,
    saving,
    saveConfirmationOpen,
    error,
    loading,
    isRobloxGroupField,
    configFieldDescription,
    values,
    isDropdownField,
    configFieldLabel,
    fieldOptions,
    isThresholdRoleField,
    secrets,
    isWalletPanelCommand,
    usesPresentationDesigner,
    isRobloxPayoutFeature,
    robloxCredentialsConfigured,
    isRobloxPayoutV2,
    openPresentation,
    presentationSlotLabel,
    slotMode,
    presentationModeOptions,
    availablePresentationModes,
    canSwitchPresentationMode: usesPresentationDesigner,
    setPresentationMode,
    visiblePresentationSlots,
    editablePresentationSlots,
    isPriceReaderFeature,
    walletExpandedSlots,
    toggleWalletMessage,
    walletActiveSlotKey,
    selectPresentationSlot,
    presentationSlotDescription,
    toggleAdvanced,
    advancedSlots,
    variableToken,
    variableDescription,
    valueLength,
    visualDefinition,
    updatePresentation,
    embedObject,
    updateEmbedObject,
    embedColor,
    updateEmbedColor,
    fixedActions,
    defaultActionLabel,
    updateActionOverride,
    componentStyles,
    visualArray,
    addEmbedField,
    updateEmbedField,
    removeEmbedField,
    addLink,
    updateLink,
    removeLink,
    supportsBlockBuilder,
    componentBlocks,
    draggedComponent,
    dropComponentBlock,
    blockSummary,
    moveComponentBlock,
    removeComponentBlock,
    updateComponentBlock,
    componentBlockValue,
    mediaItems,
    mediaItemUrl,
    mediaItemDescription,
    updateMediaItem,
    addMediaItem,
    updateMediaItemField,
    removeMediaItem,
    actionRowButtons,
    componentEmoji,
    updateActionRowButton,
    addActionRowButton,
    removeActionRowButton,
    updateSeparator,
    updateContainerBlock,
    containerChildren,
    componentCount,
    componentColor,
    sectionTextBlocks,
    updateSectionText,
    addSectionText,
    removeSectionText,
    sectionAccessory,
    sectionAccessoryType,
    setSectionAccessory,
    updateSectionAccessory,
    moveContainerChild,
    removeContainerChild,
    updateContainerChildContent,
    updateContainerChild,
    addContainerChild,
    addComponentBlock,
    systemComponents,
    updateSystemComponent,
    componentStyleOptions,
    coFeatureComponents,
    removeCoFeature,
    updateCoFeature,
    availableCoFeatureOptions,
    addCoFeature,
    availableCoFeatures,
    presentationJson,
    previewAdvancedJson,
    presentationPreviewDefinition,
    previewBot,
    presentationSampleValues,
    walletPreviewScope,
    walletPreviewSlots,
    pageSections,
    confirmSave,
    toastOpen,
    toastMessage,
    toastVariant,
    load,
    save,
  }
}
