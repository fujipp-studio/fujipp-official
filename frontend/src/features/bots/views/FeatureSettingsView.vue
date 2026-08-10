<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Braces, Check, Save, Settings2, Sparkles } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'

import {
  fetchFeatureConfiguration,
  fetchFeatureLicenses,
  fetchBots,
  updateFeatureConfiguration,
  type FeatureConfiguration,
  type FeatureConfigValue,
  type FeatureLicense,
  type UserBot,
} from '../../../services/backend'
import { useAuthStore } from '../../../stores'
import { AppButton, AppSectionIndicator, AppTextField, AppToggle } from '../../../shared/ui'
import DiscordPresentationPreview from '../components/DiscordPresentationPreview.vue'
import PriceMapEditor from '../components/PriceMapEditor.vue'
import RobloxGroupEditor from '../components/RobloxGroupEditor.vue'
import RobuxPackagesEditor from '../components/RobuxPackagesEditor.vue'
import StringListEditor from '../components/StringListEditor.vue'
import ThresholdRoleEditor from '../components/ThresholdRoleEditor.vue'
import CommandPermissionsEditor from '../components/CommandPermissionsEditor.vue'

type EditableValue = string | number | boolean

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { session, initialized } = storeToRefs(authStore)
const { locale } = useI18n()

const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)

const licenseId = computed(() => String(route.params.licenseId ?? ''))
const flowBotId = computed(() => String(route.params.botId ?? ''))
const inBotSettingsFlow = computed(() => Boolean(flowBotId.value))

const isRobloxPayoutFeature = computed(() => {
  const code = license.value?.featureCode
  return code === 'roblox-robux-payout' || 'ROBLOX_GROUPS' in values.value
})

const isRobloxGroupField = (key: string) => {
  return isRobloxPayoutFeature.value && (key === 'ROBLOX_GROUPS' || key === 'ROBLOX_CREDENTIALS')
}

const robloxCredentialsConfigured = computed(() => {
  return (
    configuration.value?.fields.find((f) => f.key === 'ROBLOX_CREDENTIALS')?.configured ?? false
  )
})
const presentationMode = computed<'EMBED' | 'COMPONENTS_V2' | null>(() => {
  if (route.name === 'feature-embed-settings' || route.name === 'bot-feature-embed-settings')
    return 'EMBED'
  if (
    route.name === 'feature-components-v2-settings' ||
    route.name === 'bot-feature-components-v2-settings'
  )
    return 'COMPONENTS_V2'
  return null
})
const pageSections = computed(() =>
  presentationMode.value
    ? [
        {
          id: 'feature-presentation-editor',
          label: text('Presentation editor', 'Presentation editor'),
        },
      ]
    : [
        { id: 'feature-config', label: text('Config', 'Config') },
        { id: 'feature-presentations', label: text('Presentations', 'Presentations') },
      ],
)
const license = ref<FeatureLicense | null>(null)
const previewBot = ref<UserBot | null>(null)
const installedFeatureCodes = ref(new Set<string>())
const configuration = ref<FeatureConfiguration | null>(null)
const values = ref<Record<string, EditableValue>>({})
const secrets = ref<Record<string, string>>({})
const presentations = ref<Record<string, Record<string, unknown>>>({})
const presentationJson = ref<Record<string, string>>({})
const advancedSlots = ref(new Set<string>())
const presentationModeOptions = [
  { value: 'EMBED', label: 'Embed' },
  { value: 'COMPONENTS_V2', label: 'Components V2' },
]
const componentStyleOptions = [
  { value: 'primary', label: 'Primary · Blue' },
  { value: 'secondary', label: 'Secondary · Gray' },
  { value: 'success', label: 'Success · Green' },
  { value: 'danger', label: 'Danger · Red' },
]
const variableDescriptions: Record<string, [english: string, thai: string]> = {
  action: ['Action that was completed', 'รายการที่ระบบดำเนินการ'],
  target: ['Message destination', 'ปลายทางของข้อความ'],
  message_url: ['URL of the Discord message', 'ลิงก์ไปยังข้อความ Discord'],
  message: ['Message returned by the system', 'ข้อความที่ระบบส่งกลับ'],
  content: ['Main message content', 'เนื้อหาหลักของข้อความ'],
  detail: ['Additional operation details', 'รายละเอียดเพิ่มเติมของรายการ'],
  status: ['Current operation status', 'สถานะปัจจุบันของรายการ'],
  error: ['Error description', 'รายละเอียดข้อผิดพลาด'],
  error_lines: ['List of errors, one per line', 'รายการข้อผิดพลาดแบบหลายบรรทัด'],
  reason: ['Reason for the operation', 'เหตุผลของรายการ'],
  failure_reason: ['Reason the operation failed', 'สาเหตุที่ดำเนินการไม่สำเร็จ'],
  failure_code: ['System failure code', 'รหัสข้อผิดพลาดของระบบ'],
  member: ['Discord member display name', 'ชื่อที่แสดงของสมาชิก Discord'],
  member_mention: ['Clickable Discord member mention', 'การ Mention สมาชิก Discord'],
  actor_mention: ['Mention of the administrator who performed the action', 'Mention ผู้ดูแลที่ทำรายการ'],
  avatar: ['Member avatar URL', 'URL รูปโปรไฟล์สมาชิก'],
  member_avatar_url: ['Member avatar URL', 'URL รูปโปรไฟล์สมาชิก'],
  bot_name: ['Current bot name', 'ชื่อของบอทตัวนี้'],
  amount: ['Amount for the current transaction', 'จำนวนเงินของรายการปัจจุบัน'],
  today: ['Amount added this time', 'ยอดที่เพิ่มในครั้งนี้'],
  total: ['Accumulated total amount', 'ยอดสะสมทั้งหมด'],
  balance: ['Current wallet balance', 'ยอดเงินคงเหลือปัจจุบัน'],
  balance_after: ['Wallet balance after the transaction', 'ยอดเงินหลังทำรายการ'],
  minimum_amount: ['Minimum accepted amount', 'จำนวนเงินขั้นต่ำที่รับได้'],
  refund: ['Refunded amount', 'จำนวนเงินที่คืน'],
  currency: ['Currency code such as THB', 'สกุลเงิน เช่น THB'],
  count: ['Accumulated number of uses', 'จำนวนครั้งสะสม'],
  entry_count: ['Number of transactions shown', 'จำนวนรายการที่แสดง'],
  member_count: ['Number of members in the result', 'จำนวนสมาชิกในผลลัพธ์'],
  updated_count: ['Number of members updated', 'จำนวนสมาชิกที่อัปเดตสำเร็จ'],
  image_count: ['Number of images submitted', 'จำนวนรูปภาพที่ส่งเข้ามา'],
  success_count: ['Number of images read successfully', 'จำนวนรูปที่อ่านสำเร็จ'],
  error_count: ['Number of images that failed', 'จำนวนรูปที่อ่านไม่สำเร็จ'],
  discord_price: ['Price detected from Discord', 'ราคาที่อ่านได้จาก Discord'],
  original_price: ['Original price before discount', 'ราคาเดิมก่อนลดราคา'],
  nitro_price: ['Discord Nitro price', 'ราคาสำหรับ Discord Nitro'],
  discount_percent: ['Detected discount percentage', 'เปอร์เซ็นต์ส่วนลดที่ตรวจพบ'],
  shop_price: ['Matched selling price from the shop table', 'ราคาขายที่ตรงจากตารางร้าน'],
  shop_price_found: ['Whether a matching shop price was found', 'พบราคาที่ตรงในตารางร้านหรือไม่'],
  no_nitro_markup: ['Additional price when Nitro is unavailable', 'ราคาที่บวกเพิ่มเมื่อไม่มี Nitro'],
  item_name: ['Detected product name', 'ชื่อสินค้าที่ตรวจพบ'],
  order_url: ['Configured purchase URL', 'ลิงก์สำหรับสั่งซื้อ'],
  results_text: ['Combined formatted results for every image', 'ผลลัพธ์ทุกภาพที่จัดรูปแบบรวมแล้ว'],
  result_index: ['Sequence number of the current image result', 'ลำดับของผลลัพธ์รูปปัจจุบัน'],
  discount_text: ['Formatted discount text, or blank when none', 'ข้อความส่วนลด หรือค่าว่างเมื่อไม่มีส่วนลด'],
  shop_price_text: ['Formatted shop price or not-found message', 'ราคาขายที่จัดรูปแบบ หรือข้อความว่าไม่พบราคา'],
  history_lines: ['Formatted wallet history rows', 'รายการประวัติกระเป๋าเงิน'],
  leaderboard_lines: ['Formatted ranking rows', 'รายการอันดับที่จัดรูปแบบแล้ว'],
  stock_lines: ['Formatted stock list', 'รายการสต็อกที่จัดรูปแบบแล้ว'],
  payment_method: ['Payment method used', 'ช่องทางการชำระเงิน'],
  transaction_time: ['Transaction date and time', 'วันและเวลาที่ทำรายการ'],
  datetime: ['Current formatted date and time', 'วันและเวลาที่จัดรูปแบบแล้ว'],
  expires_at: ['Expiration date and time', 'วันและเวลาหมดอายุ'],
  remaining: ['Remaining runtime', 'ระยะเวลาใช้งานที่เหลือ'],
  remaining_time: ['Formatted remaining time', 'เวลาคงเหลือที่จัดรูปแบบแล้ว'],
  renew_url: ['URL for renewing runtime', 'ลิงก์สำหรับต่ออายุ Runtime'],
  session_id: ['Top-up session reference', 'รหัสอ้างอิงรายการเติมเงิน'],
  qr_url: ['PromptPay QR image URL', 'URL รูป QR พร้อมเพย์'],
  slip_channel_url: ['Link to the slip submission channel', 'ลิงก์ไปยังห้องส่งสลิป'],
  account_name: ['PromptPay account name', 'ชื่อบัญชีพร้อมเพย์'],
  truemoney_fee: ['TrueMoney service fee', 'ค่าธรรมเนียม TrueMoney'],
  auto_renew: ['Current automatic renewal setting', 'สถานะการต่ออายุอัตโนมัติ'],
  username: ['Member or Roblox username', 'ชื่อผู้ใช้ของสมาชิกหรือ Roblox'],
  usernameRoblox: ['Roblox username', 'ชื่อผู้ใช้ Roblox'],
  roblox_username: ['Roblox username', 'ชื่อผู้ใช้ Roblox'],
  roblox_id: ['Roblox user ID', 'รหัสผู้ใช้ Roblox'],
  idRoblox: ['Roblox user ID', 'รหัสผู้ใช้ Roblox'],
  robux: ['Robux amount', 'จำนวน Robux'],
  price: ['Purchase price', 'ราคาที่ต้องชำระ'],
  rate: ['Robux exchange rate', 'อัตราแลกเปลี่ยน Robux'],
  group_name: ['Roblox group name', 'ชื่อกลุ่ม Roblox'],
  group_id: ['Roblox group ID', 'รหัสกลุ่ม Roblox'],
  group_robux: ['Robux available in the group', 'Robux คงเหลือในกลุ่ม'],
  group_stock: ['Available group stock', 'สต็อกคงเหลือของกลุ่ม'],
  queue: ['Current queue position', 'ลำดับคิวปัจจุบัน'],
}
const coFeatureCatalog = [
  {
    featureCode: 'wallet-topup',
    action: 'wallet.topup',
    label: 'Wallet · เติมเงิน',
    emoji: '💰',
    style: 'success',
  },
  {
    featureCode: 'wallet-topup',
    action: 'wallet.balance',
    label: 'Wallet · เช็คยอดเงิน',
    emoji: '💳',
    style: 'secondary',
  },
]
const availableCoFeatures = computed(() =>
  coFeatureCatalog.filter((item) => installedFeatureCodes.value.has(item.featureCode)),
)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
let botRefreshTimer: ReturnType<typeof setInterval> | undefined

function clone(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
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
  return Array.isArray(enumValues)
    ? enumValues
        .filter((value): value is string => typeof value === 'string')
        .map((value) => ({
          value,
          label: value.replace(/_/g, ' '),
        }))
    : []
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
            name: 'bot-feature-settings',
            params: { botId: flowBotId.value, licenseId: licenseId.value },
          }
        : { name: 'feature-settings', params: { licenseId: licenseId.value } },
    )
    return
  }
  void router.push(
    inBotSettingsFlow.value
      ? { name: 'bot-package-settings', params: { botId: flowBotId.value } }
      : { name: 'my-bot' },
  )
}

async function openPresentation(mode: 'EMBED' | 'COMPONENTS_V2') {
  if (!(await save())) return
  const name = inBotSettingsFlow.value
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
}

function slotMode(slotKey: string): 'EMBED' | 'COMPONENTS_V2' {
  return String(presentations.value[slotKey]?.mode ?? 'EMBED').toUpperCase() === 'COMPONENTS_V2'
    ? 'COMPONENTS_V2'
    : 'EMBED'
}

function setPresentationMode(slotKey: string, mode: string) {
  const normalized = mode === 'COMPONENTS_V2' ? 'COMPONENTS_V2' : 'EMBED'
  presentations.value[slotKey] = { ...presentations.value[slotKey], mode: normalized }
  presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
}

function setAllPresentationModes(mode: 'EMBED' | 'COMPONENTS_V2') {
  for (const slot of configuration.value?.presentations ?? []) setPresentationMode(slot.key, mode)
}

function setAllAndOpen(mode: 'EMBED' | 'COMPONENTS_V2') {
  setAllPresentationModes(mode)
  void openPresentation(mode)
}

const visiblePresentationSlots = computed(() =>
  (configuration.value?.presentations ?? []).filter(
    (slot) => !presentationMode.value || slotMode(slot.key) === presentationMode.value,
  ),
)

async function load() {
  loading.value = true
  error.value = ''
  if (!initialized.value) await authStore.initialize()
  if (!session.value) {
    error.value = text(
      'Please sign in before opening Feature Settings',
      'กรุณาเข้าสู่ระบบก่อนเปิด Feature Settings',
    )
    loading.value = false
    return
  }
  try {
    const [allLicenses, config, bots] = await Promise.all([
      fetchFeatureLicenses(session.value),
      fetchFeatureConfiguration(licenseId.value, session.value),
      fetchBots(session.value),
    ])
    license.value = allLicenses.find((item) => item.id === licenseId.value) ?? null
    const installedBotId = license.value?.installations.find(
      (item) => item.status === 'ACTIVE',
    )?.botId
    previewBot.value =
      bots.find((bot) => bot.id === flowBotId.value) ??
      bots.find((bot) => bot.id === installedBotId) ??
      null
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
      cause instanceof Error
        ? cause.message
        : text('Unable to load feature configuration.', 'โหลดการตั้งค่าไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}

async function refreshPreviewBot() {
  if (!session.value || !license.value) return
  const installedBotId =
    flowBotId.value || license.value.installations.find((item) => item.status === 'ACTIVE')?.botId
  if (!installedBotId) return
  try {
    const bots = await fetchBots(session.value)
    previewBot.value = bots.find((bot) => bot.id === installedBotId) ?? null
  } catch {
    // Keep the last known profile while the background refresh retries.
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

function updatePresentation(slotKey: string, key: string, value: unknown) {
  const definition = presentations.value[slotKey] ?? {}
  if (key === 'mode') {
    presentations.value[slotKey] = { ...definition, mode: value }
    presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
    return
  }
  const mode = presentationMode.value ?? String(definition.mode ?? 'EMBED')
  const nestedKey = mode === 'EMBED' ? 'embed' : 'components_v2'
  if (definition[nestedKey] && typeof definition[nestedKey] === 'object') {
    definition[nestedKey] = { ...(definition[nestedKey] as Record<string, unknown>), [key]: value }
    presentations.value[slotKey] = { ...definition }
  } else presentations.value[slotKey] = { ...definition, [key]: value }
  presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
}

function visualArray(slotKey: string, key: string) {
  const value = visualDefinition(slotKey)[key]
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

function updateVisualArray(slotKey: string, key: string, value: Array<Record<string, unknown>>) {
  updatePresentation(slotKey, key, value)
}

function addEmbedField(slotKey: string) {
  updateVisualArray(slotKey, 'fields', [
    ...visualArray(slotKey, 'fields'),
    { name: text('Field name', 'ชื่อ Field'), value: text('Details', 'รายละเอียด'), inline: false },
  ])
}

function updateEmbedField(slotKey: string, index: number, key: string, value: unknown) {
  const fields = visualArray(slotKey, 'fields').map((field) => ({ ...field }))
  if (fields[index]) fields[index][key] = value
  updateVisualArray(slotKey, 'fields', fields)
}

function removeEmbedField(slotKey: string, index: number) {
  updateVisualArray(
    slotKey,
    'fields',
    visualArray(slotKey, 'fields').filter((_, itemIndex) => itemIndex !== index),
  )
}

function addLink(slotKey: string) {
  updateVisualArray(slotKey, 'links', [
    ...visualArray(slotKey, 'links'),
    { label: text('Open link', 'เปิดลิงก์'), url: 'https://example.com', emoji: '🔗' },
  ])
}

function updateLink(slotKey: string, index: number, key: string, value: string) {
  const links = visualArray(slotKey, 'links').map((link) => ({ ...link }))
  if (links[index]) links[index][key] = value
  updateVisualArray(slotKey, 'links', links)
}

function removeLink(slotKey: string, index: number) {
  updateVisualArray(
    slotKey,
    'links',
    visualArray(slotKey, 'links').filter((_, itemIndex) => itemIndex !== index),
  )
}

function componentBlocks(slotKey: string) {
  const raw = visualDefinition(slotKey).components
  if (!Array.isArray(raw)) return [] as Array<Record<string, unknown>>
  const container = raw[0]
  if (
    raw.length === 1 &&
    container &&
    typeof container === 'object' &&
    container.type === 17 &&
    Array.isArray(container.components)
  ) {
    return container.components as Array<Record<string, unknown>>
  }
  return raw as Array<Record<string, unknown>>
}

function supportsBlockBuilder(slotKey: string) {
  const rootComponents = presentations.value[slotKey]?.components
  if (rootComponents && typeof rootComponents === 'object' && !Array.isArray(rootComponents))
    return false
  const components = visualDefinition(slotKey).components
  return !components || Array.isArray(components)
}

function updateRootPresentation(slotKey: string, key: string, value: unknown) {
  presentations.value[slotKey] = { ...presentations.value[slotKey], [key]: value }
  presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
}

function systemComponents(slotKey: string) {
  const value = presentations.value[slotKey]?.components
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>).flatMap(([role, config]) =>
    config && typeof config === 'object' && !Array.isArray(config)
      ? [{ role, config: config as Record<string, unknown> }]
      : [],
  )
}

function updateSystemComponent(slotKey: string, role: string, key: string, value: string) {
  const current = presentations.value[slotKey]?.components
  if (!current || typeof current !== 'object' || Array.isArray(current)) return
  const components = clone(current as Record<string, unknown>)
  const config = components[role]
  if (!config || typeof config !== 'object' || Array.isArray(config)) return
  ;(config as Record<string, unknown>)[key] = value
  updateRootPresentation(slotKey, 'components', components)
}

function coFeatureComponents(slotKey: string) {
  const value = presentations.value[slotKey]?.co_features
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object' && !Array.isArray(item)),
      )
    : []
}

function addCoFeature(slotKey: string, action: string) {
  const source = availableCoFeatures.value.find((item) => item.action === action)
  if (!source || coFeatureComponents(slotKey).some((item) => item.action === action)) return
  updateRootPresentation(slotKey, 'co_features', [...coFeatureComponents(slotKey), { ...source }])
}

function removeCoFeature(slotKey: string, action: string) {
  updateRootPresentation(
    slotKey,
    'co_features',
    coFeatureComponents(slotKey).filter((item) => item.action !== action),
  )
}

function updateCoFeature(slotKey: string, action: string, key: string, value: string) {
  updateRootPresentation(
    slotKey,
    'co_features',
    coFeatureComponents(slotKey).map((item) =>
      item.action === action ? { ...item, [key]: value } : item,
    ),
  )
}

function availableCoFeatureOptions(slotKey: string) {
  return availableCoFeatures.value
    .filter(
      (option) => !coFeatureComponents(slotKey).some((added) => added.action === option.action),
    )
    .map((item) => ({ value: item.action, label: item.label }))
}

function setComponentBlocks(slotKey: string, blocks: Array<Record<string, unknown>>) {
  updatePresentation(slotKey, 'components', [{ type: 17, components: blocks }])
}

function addComponentBlock(
  slotKey: string,
  type: 'text' | 'section' | 'media' | 'separator' | 'link',
) {
  const blocks = [...componentBlocks(slotKey)]
  if (type === 'text') blocks.push({ type: 10, content: text('New content', 'ข้อความใหม่') })
  if (type === 'section')
    blocks.push({
      type: 9,
      components: [{ type: 10, content: text('Section content', 'ข้อความใน Section') }],
      accessory: {
        type: 11,
        media: { url: 'https://example.com/image.png' },
        description: text('Accessory image', 'รูปประกอบ'),
      },
    })
  if (type === 'media')
    blocks.push({
      type: 12,
      items: [
        {
          media: { url: 'https://example.com/image.png' },
          description: text('Accessory image', 'รูปประกอบ'),
        },
      ],
    })
  if (type === 'separator') blocks.push({ type: 14, divider: true, spacing: 1 })
  if (type === 'link')
    blocks.push({
      type: 1,
      components: [
        { type: 2, style: 5, label: text('Open link', 'เปิดลิงก์'), url: 'https://example.com' },
      ],
    })
  setComponentBlocks(slotKey, blocks)
}

function removeComponentBlock(slotKey: string, index: number) {
  setComponentBlocks(
    slotKey,
    componentBlocks(slotKey).filter((_, itemIndex) => itemIndex !== index),
  )
}

function updateComponentBlock(
  slotKey: string,
  index: number,
  key: 'content' | 'mediaUrl' | 'sectionContent' | 'accessoryUrl' | 'label' | 'emoji' | 'url',
  value: string,
) {
  const blocks = componentBlocks(slotKey).map(
    (block) => JSON.parse(JSON.stringify(block)) as Record<string, unknown>,
  )
  const block = blocks[index]
  if (!block) return
  if (key === 'content') block.content = value
  if (key === 'sectionContent') block.components = [{ type: 10, content: value }]
  if (key === 'accessoryUrl')
    block.accessory = {
      type: 11,
      media: { url: value },
      description: text('Accessory image', 'รูปประกอบ'),
    }
  if (key === 'mediaUrl')
    block.items = [{ media: { url: value }, description: text('Accessory image', 'รูปประกอบ') }]
  if (key === 'label' || key === 'emoji' || key === 'url') {
    const row = Array.isArray(block.components) ? block.components : []
    const button =
      row[0] && typeof row[0] === 'object'
        ? (row[0] as Record<string, unknown>)
        : { type: 2, style: 5 }
    button[key] = value
    block.components = [button]
  }
  setComponentBlocks(slotKey, blocks)
}

function componentBlockValue(
  block: Record<string, unknown>,
  key: 'mediaUrl' | 'sectionContent' | 'accessoryUrl' | 'label' | 'emoji' | 'url',
) {
  if (key === 'mediaUrl' && Array.isArray(block.items)) {
    const item = block.items[0]
    if (
      item &&
      typeof item === 'object' &&
      'media' in item &&
      item.media &&
      typeof item.media === 'object' &&
      'url' in item.media
    )
      return String(item.media.url ?? '')
  }
  if (key === 'sectionContent' && Array.isArray(block.components)) {
    const text = block.components[0]
    if (text && typeof text === 'object' && 'content' in text) return String(text.content ?? '')
  }
  if (
    key === 'accessoryUrl' &&
    block.accessory &&
    typeof block.accessory === 'object' &&
    'media' in block.accessory &&
    block.accessory.media &&
    typeof block.accessory.media === 'object' &&
    'url' in block.accessory.media
  )
    return String(block.accessory.media.url ?? '')
  if ((key === 'label' || key === 'emoji' || key === 'url') && Array.isArray(block.components)) {
    const button = block.components[0]
    if (button && typeof button === 'object' && key in button) return String(button[key] ?? '')
  }
  return ''
}

function moveComponentBlock(slotKey: string, index: number, direction: -1 | 1) {
  const blocks = [...componentBlocks(slotKey)]
  const target = index + direction
  if (target < 0 || target >= blocks.length) return
  ;[blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!]
  setComponentBlocks(slotKey, blocks)
}

function blockSummary(block: Record<string, unknown>) {
  if (block.type === 10) return `Content · ${String(block.content ?? '').slice(0, 60)}`
  if (block.type === 9) return 'Section with accessory'
  if (block.type === 12) return 'Media gallery'
  if (block.type === 14) return 'Separator'
  if (block.type === 1) return 'Link button row'
  return `Component type ${String(block.type ?? '?')}`
}

function visualDefinition(slotKey: string) {
  const definition = presentations.value[slotKey] ?? {}
  const mode = presentationMode.value ?? String(definition.mode ?? 'EMBED')
  const nestedKey = mode === 'EMBED' ? 'embed' : 'components_v2'
  const nested = definition[nestedKey]
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : definition
}

function variableToken(variable: string) {
  return `{{${variable}}}`
}

function toggleAdvanced(slotKey: string) {
  const next = new Set(advancedSlots.value)
  if (next.has(slotKey)) next.delete(slotKey)
  else next.add(slotKey)
  advancedSlots.value = next
}

function previewAdvancedJson(slotKey: string) {
  try {
    const parsed = JSON.parse(presentationJson.value[slotKey] ?? '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      presentations.value[slotKey] = parsed as Record<string, unknown>
    }
  } catch {
    // Keep the latest valid preview while JSON is incomplete during typing.
  }
}

async function save(): Promise<boolean> {
  if (!session.value || !configuration.value) return false
  saving.value = true
  error.value = ''
  notice.value = ''
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
        throw new Error(`${slot.label}: ${text('JSON must be an object', 'JSON ต้องเป็น object')}`)
      presentations.value[slot.key] = parsed as Record<string, unknown>
    }
    const updated = await updateFeatureConfiguration(
      licenseId.value,
      { values: normalValues, secrets: changedSecrets, presentations: presentations.value },
      session.value,
    )
    configuration.value = updated
    hydrate(updated)
    notice.value = text(
      `Saved · Revision ${updated.revision}`,
      `บันทึกแล้ว · Revision ${updated.revision}`,
    )
    return true
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : text('Unable to save feature settings.', 'บันทึกการตั้งค่าไม่สำเร็จ')
    return false
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await load()
  botRefreshTimer = setInterval(() => void refreshPreviewBot(), 3000)
})
onBeforeUnmount(() => {
  if (botRefreshTimer) clearInterval(botRefreshTimer)
})
</script>

<template>
  <section
    :class="
      inBotSettingsFlow
        ? 'text-text-primary'
        : 'min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28'
    "
  >
    <div :class="inBotSettingsFlow ? '' : 'page-container pb-5xl'">
      <button
        v-if="!inBotSettingsFlow"
        class="mb-md inline-flex items-center gap-xs text-sm text-text-secondary hover:text-text-primary"
        @click="goBack"
      >
        <ArrowLeft :size="17" />
        {{
          presentationMode
            ? text('Back to Feature Settings', 'กลับไป Feature Settings')
            : inBotSettingsFlow
              ? text('Back to Package Settings', 'กลับไป Package Settings')
              : text('Back to My Bot', 'กลับไป My Bot')
        }}
      </button>
      <header class="flex flex-col gap-md tablet:flex-row tablet:items-end tablet:justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight desktop:text-5xl">
            {{
              presentationMode === 'EMBED'
                ? `Embed · ${license?.featureName ?? 'Feature'}`
                : presentationMode === 'COMPONENTS_V2'
                  ? `Components V2 · ${license?.featureName ?? 'Feature'}`
                  : (license?.featureName ?? text('Feature Settings', 'ตั้งค่า Feature'))
            }}
          </h1>
          <p class="mt-sm text-text-secondary">
            {{
              presentationMode
                ? text(
                    'Edit message layout and preview before saving',
                    'แก้ไขหน้าตาข้อความและดู Preview ก่อนบันทึก',
                  )
                : text(
                    'Config, secrets, and display formats for your bot',
                    'Config, secrets และรูปแบบข้อความที่บอทใช้แสดงผล',
                  )
            }}
            · Revision
            {{ configuration?.revision ?? '—' }}
          </p>
        </div>
        <AppButton
          v-if="configuration"
          class="tablet:!w-auto"
          variant="secondary"
          :disabled="saving"
          @click="save"
        >
          <Save :size="18" />
          {{ saving ? text('Saving…', 'กำลังบันทึก…') : text('Save all', 'บันทึกทั้งหมด') }}
        </AppButton>
      </header>

      <p
        v-if="error"
        class="mt-lg rounded-lg border border-error-border bg-error-bg p-md text-error-text"
      >
        {{ error }}
      </p>
      <p
        v-if="notice"
        class="mt-lg flex items-center gap-xs rounded-lg border border-success-border bg-success-bg p-md text-success-text"
      >
        <Check :size="18" /> {{ notice }}
      </p>
      <div v-if="loading" class="mt-xl grid gap-md desktop:grid-cols-2">
        <div v-for="item in 4" :key="item" class="h-48 animate-pulse rounded-lg bg-bg-surface" />
      </div>

      <template v-else-if="configuration">
        <section v-if="!presentationMode" id="feature-config" class="mt-xl">
          <div class="mb-md flex items-center gap-sm">
            <Settings2 :size="24" />
            <div>
              <h2 class="text-2xl font-semibold">Config</h2>
              <p class="text-sm text-text-secondary">
                {{ text('Feature configuration options', 'ค่าการทำงานของ Feature นี้') }}
              </p>
            </div>
          </div>
          <div v-if="configuration.fields.length" class="grid gap-md desktop:grid-cols-2">
            <template v-for="field in configuration.fields" :key="field.key">
              <div
                v-if="!isRobloxGroupField(field.key)"
                class="rounded-lg border border-border-subtle bg-bg-surface p-lg"
              >
                <div
                  v-if="field.type === 'BOOLEAN'"
                  class="flex cursor-pointer items-start justify-between gap-md"
                >
                  <span
                    ><strong>{{ field.label }}</strong
                    ><small class="mt-xs block text-text-secondary">{{
                      field.description
                    }}</small></span
                  ><AppToggle
                    :model-value="Boolean(values[field.key])"
                    @change="(value) => (values[field.key] = value)"
                  />
                </div>
                <div v-else class="block text-sm font-medium">
                  <AppTextField
                    v-if="isDropdownField(field)"
                    :model-value="String(values[field.key] ?? '')"
                    variant="dropdown"
                    :label="field.label"
                    :options="fieldOptions(field)"
                    :required="field.required"
                    @update:model-value="(value) => (values[field.key] = value)"
                  />
                  <label v-else>
                    {{ field.label }}<span v-if="field.required && field.key !== 'COMMAND_PERMISSION_RULES'" class="text-error-text"> *</span>
                    <PriceMapEditor
                      v-if="field.key === 'PRICE_READER_PRICE_MAP'"
                      :model-value="String(values[field.key] ?? '[]')"
                      @update:model-value="(value) => (values[field.key] = value)"
                    />
                    <RobuxPackagesEditor
                      v-else-if="field.key === 'ROBUX_PACKAGES'"
                      :model-value="String(values[field.key] ?? '[]')"
                      :rate="Number(values['ROBUX_RATE'] ?? 3.5)"
                      @update:model-value="(value) => (values[field.key] = value)"
                    />
                    <ThresholdRoleEditor
                      v-else-if="isThresholdRoleField(field.key)"
                      :model-value="String(values[field.key] ?? '[]')"
                      :threshold-key="field.key === 'SPENDING_UPGRADE_TIERS' ? 'amount' : 'thresholdBaht'"
                      @update:model-value="(value) => (values[field.key] = value)"
                    />
                    <CommandPermissionsEditor
                      v-else-if="field.key === 'COMMAND_PERMISSION_RULES'"
                      :model-value="String(values[field.key] ?? '[]')"
                      @update:model-value="(value) => (values[field.key] = value)"
                    />
                    <StringListEditor
                      v-else-if="field.type === 'STRING_LIST'"
                      :model-value="String(values[field.key] ?? '')"
                      :multiline="field.ui?.multiline === true"
                      :placeholder="String(field.ui?.placeholder ?? '')"
                      @update:model-value="(value) => (values[field.key] = value)"
                    />
                    <textarea
                      v-else-if="['TEXT', 'JSON'].includes(field.type)"
                      v-model="values[field.key] as string"
                      class="field-control mt-xs min-h-32 resize-y py-sm"
                      :rows="field.type === 'JSON' ? 8 : 4"
                    />
                    <input
                      v-else-if="field.secret"
                      v-model="secrets[field.key]"
                      type="password"
                      autocomplete="new-password"
                      class="field-control mt-xs h-11"
                      :placeholder="
                        field.configured
                          ? text('•••••••• Configured', '•••••••• ตั้งค่าไว้แล้ว')
                          : text('Enter secret', 'กรอก secret')
                      "
                    />
                    <input
                      v-else
                      v-model="values[field.key]"
                      :type="['INTEGER', 'DECIMAL'].includes(field.type) ? 'number' : 'text'"
                      :pattern="
                        ['CHANNEL_ID', 'ROLE_ID', 'USER_ID'].includes(field.type)
                          ? '[0-9]{15,30}'
                          : undefined
                      "
                      class="field-control mt-xs h-11"
                    />
                  </label>
                </div>
                <p v-if="field.key !== 'COMMAND_PERMISSION_RULES'" class="mt-xs text-xs text-text-secondary">
                  {{ field.description
                  }}<span v-if="field.type === 'STRING_LIST'">
                    · {{ text('One item per line', 'หนึ่งรายการต่อบรรทัด') }}</span
                  >
                </p>
                <p v-if="field.key !== 'COMMAND_PERMISSION_RULES'" class="mt-sm font-mono text-xs text-text-muted">
                  {{ field.key }} · {{ field.type
                  }}<span v-if="field.configured"> · configured</span>
                </p>
              </div>
            </template>
          </div>

          <RobloxGroupEditor
            v-if="isRobloxPayoutFeature"
            v-model:groups-json="values['ROBLOX_GROUPS'] as string"
            v-model:credentials-json="secrets['ROBLOX_CREDENTIALS'] as string"
            :credentials-configured="robloxCredentialsConfigured"
            class="mt-lg"
          />
          <div
            v-else-if="!configuration.fields.length"
            class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-muted"
          >
            {{ text('This feature has no config fields', 'Feature นี้ไม่มี Config fields') }}
          </div>
        </section>

        <section v-if="!presentationMode" id="feature-presentations" class="mt-2xl">
          <div class="mb-md flex items-center gap-sm">
            <Sparkles :size="24" />
            <div>
              <h2 class="text-2xl font-semibold">Presentation settings</h2>
              <p class="text-sm text-text-secondary">
                {{ text('Select an editor to open', 'เลือก Editor ที่ต้องการเปิด') }}
              </p>
            </div>
          </div>
          <div v-if="configuration.presentations.length" class="space-y-md">
            <div class="presentation-menu">
              <button class="presentation-card" type="button" @click="setAllAndOpen('EMBED')">
                <span class="text-2xl font-bold">Embed · {{ text('All', 'ทั้งหมด') }}</span>
                <span>{{
                  text(
                    'Set every message to Embed and open the editor',
                    'ตั้งทุกข้อความเป็น Embed และเปิด Editor',
                  )
                }}</span>
              </button>
              <button
                class="presentation-card"
                type="button"
                @click="setAllAndOpen('COMPONENTS_V2')"
              >
                <span class="text-2xl font-bold">Components V2 · {{ text('All', 'ทั้งหมด') }}</span>
                <span>{{
                  text(
                    'Set every message to Components V2 and open the editor',
                    'ตั้งทุกข้อความเป็น Components V2 และเปิด Editor',
                  )
                }}</span>
              </button>
            </div>
            <div class="presentation-slot-list">
              <article
                v-for="slot in configuration.presentations"
                :key="slot.slotId"
                class="presentation-slot-row"
              >
                <div class="min-w-0">
                  <strong class="block truncate">{{ slot.label }}</strong>
                  <span class="font-mono text-xs text-text-muted">{{ slot.key }}</span>
                </div>
                <AppTextField
                  :model-value="slotMode(slot.key)"
                  variant="dropdown"
                  label=""
                  :options="presentationModeOptions"
                  @update:model-value="(mode) => setPresentationMode(slot.key, mode)"
                />
                <AppButton
                  class="presentation-slot-edit"
                  variant="secondary"
                  @click="openPresentation(slotMode(slot.key))"
                >
                  {{ text('Edit', 'แก้ไข') }}
                </AppButton>
              </article>
            </div>
          </div>
          <div
            v-else
            class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-muted"
          >
            {{
              text(
                'This feature has no Embed or Components to customize',
                'Feature นี้ไม่มี Embed หรือ Components ให้ปรับแต่ง',
              )
            }}
          </div>
        </section>

        <section v-else id="feature-presentation-editor" class="mt-2xl">
          <div class="mb-md flex items-center gap-sm">
            <Sparkles :size="24" />
            <div>
              <h2 class="text-2xl font-semibold">
                {{
                  presentationMode === 'EMBED'
                    ? text('Embed settings', 'Embed settings')
                    : text('Components V2 settings', 'Components V2 settings')
                }}
              </h2>
              <p class="text-sm text-text-secondary">
                {{
                  text(
                    'Each scenario has a separate Editor and Preview',
                    'แต่ละสถานการณ์แยก Editor และ Preview ออกจากกัน',
                  )
                }}
              </p>
            </div>
          </div>
          <div v-if="visiblePresentationSlots.length" class="space-y-md">
            <article
              v-for="slot in visiblePresentationSlots"
              :key="slot.slotId"
              class="rounded-lg border border-border-subtle bg-bg-surface p-lg"
            >
              <div
                class="flex flex-col gap-sm tablet:flex-row tablet:items-start tablet:justify-between"
              >
                <div>
                  <div class="flex flex-wrap items-center gap-xs">
                    <h3 class="text-lg font-semibold">{{ slot.label }}</h3>
                    <span class="rounded-full border border-border-default px-xs py-xxs text-xs">{{
                      slot.type
                    }}</span
                    ><span
                      v-if="slot.overrideDefinition"
                      class="rounded-full border border-info-border bg-info-bg px-xs py-xxs text-xs text-info-text"
                      >{{ text('Customized', 'ปรับแต่งแล้ว') }}</span
                    >
                  </div>
                  <p class="mt-xs text-sm text-text-secondary">{{ slot.description }}</p>
                  <p class="mt-xs font-mono text-xs text-text-muted">{{ slot.key }}</p>
                </div>
                <button
                  class="inline-flex items-center gap-xs self-start rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover"
                  @click="toggleAdvanced(slot.key)"
                >
                  <Braces :size="16" />
                  {{ advancedSlots.has(slot.key) ? 'Visual editor' : 'Advanced JSON' }}
                </button>
              </div>
              <div v-if="slot.availableVariables.length" class="mt-md rounded-md border border-border-subtle bg-bg-page p-sm">
                <strong class="text-sm">{{ text('Available variables', 'ตัวแปรที่ใช้ได้') }}</strong>
                <p class="mt-xxs text-xs text-text-secondary">{{ text('Insert these variables into text fields. The bot replaces them with real data when sending.', 'นำตัวแปรเหล่านี้ไปใส่ในช่องข้อความ บอทจะแทนด้วยข้อมูลจริงตอนส่ง') }}</p>
                <div class="mt-sm grid gap-xs tablet:grid-cols-2 desktop:grid-cols-3 wide:grid-cols-2">
                  <div
                  v-for="variable in slot.availableVariables"
                  :key="variable"
                  class="rounded-md border border-border-subtle bg-bg-surface p-xs"
                  ><code class="text-xs font-semibold text-text-primary">{{ variableToken(variable) }}</code>
                    <p class="mt-xxs text-xs leading-snug text-text-secondary">{{ variableDescription(variable) }}</p>
                  </div>
                </div>
              </div>

              <div class="mt-lg grid gap-lg wide:grid-cols-2">
                <div
                  v-if="!advancedSlots.has(slot.key)"
                  class="grid content-start gap-md desktop:grid-cols-2 wide:grid-cols-1"
                >
                  <label class="text-sm font-medium"
                    >Title<input
                      :value="String(visualDefinition(slot.key).title ?? '')"
                      class="field-control mt-xs h-11"
                      @input="
                        updatePresentation(
                          slot.key,
                          'title',
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                  /></label>
                  <label class="text-sm font-medium desktop:col-span-2 wide:col-span-1"
                    >Description<textarea
                      :value="String(visualDefinition(slot.key).description ?? '')"
                      rows="5"
                      class="field-control mt-xs resize-y py-sm"
                      @input="
                        updatePresentation(
                          slot.key,
                          'description',
                          ($event.target as HTMLTextAreaElement).value,
                        )
                      "
                    />
                  </label>
                  <label class="text-sm font-medium"
                    >Image URL<input
                      :value="String(visualDefinition(slot.key).image_url ?? '')"
                      type="url"
                      class="field-control mt-xs h-11"
                      @input="
                        updatePresentation(
                          slot.key,
                          'image_url',
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                  /></label>
                  <label class="text-sm font-medium"
                    >Thumbnail URL<input
                      :value="String(visualDefinition(slot.key).thumbnail_url ?? '')"
                      type="url"
                      class="field-control mt-xs h-11"
                      @input="
                        updatePresentation(
                          slot.key,
                          'thumbnail_url',
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                  /></label>
                  <label class="text-sm font-medium desktop:col-span-2 wide:col-span-1"
                    >Footer<input
                      :value="String(visualDefinition(slot.key).footer ?? '')"
                      class="field-control mt-xs h-11"
                      @input="
                        updatePresentation(
                          slot.key,
                          'footer',
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                  /></label>
                  <div
                    v-if="presentationMode === 'EMBED'"
                    class="space-y-md desktop:col-span-2 wide:col-span-1"
                  >
                    <div class="builder-section">
                      <div class="builder-heading">
                        <div>
                          <strong>Embed Fields</strong>
                          <p>
                            {{
                              text(
                                'Add title and detail fields (up to 25)',
                                'เพิ่มข้อมูลแบบชื่อและรายละเอียดได้สูงสุด 25 ช่อง',
                              )
                            }}
                          </p>
                        </div>
                        <button type="button" @click="addEmbedField(slot.key)">
                          {{ text('+ Add Field', '+ เพิ่ม Field') }}
                        </button>
                      </div>
                      <div
                        v-for="(field, fieldIndex) in visualArray(slot.key, 'fields')"
                        :key="fieldIndex"
                        class="builder-item"
                      >
                        <div class="grid gap-xs tablet:grid-cols-2">
                          <input
                            :value="String(field.name ?? '')"
                            class="field-control h-10"
                            :placeholder="text('Field name', 'ชื่อ Field')"
                            @input="
                              updateEmbedField(
                                slot.key,
                                fieldIndex,
                                'name',
                                ($event.target as HTMLInputElement).value,
                              )
                            "
                          /><input
                            :value="String(field.value ?? '')"
                            class="field-control h-10"
                            :placeholder="text('Details', 'รายละเอียด')"
                            @input="
                              updateEmbedField(
                                slot.key,
                                fieldIndex,
                                'value',
                                ($event.target as HTMLInputElement).value,
                              )
                            "
                          />
                        </div>
                        <div class="builder-actions">
                          <label
                            ><input
                              :checked="Boolean(field.inline)"
                              type="checkbox"
                              @change="
                                updateEmbedField(
                                  slot.key,
                                  fieldIndex,
                                  'inline',
                                  ($event.target as HTMLInputElement).checked,
                                )
                              "
                            />
                            Inline</label
                          ><button type="button" @click="removeEmbedField(slot.key, fieldIndex)">
                            {{ text('Delete', 'ลบ') }}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="builder-section">
                      <div class="builder-heading">
                        <div>
                          <strong>Link Buttons</strong>
                          <p>
                            {{
                              text(
                                'Add website buttons without affecting system actions',
                                'เพิ่มปุ่มที่เปิดเว็บไซต์ โดยไม่กระทบปุ่มระบบของ Feature',
                              )
                            }}
                          </p>
                        </div>
                        <button type="button" @click="addLink(slot.key)">
                          {{ text('+ Add Link', '+ เพิ่ม Link') }}
                        </button>
                      </div>
                      <div
                        v-for="(link, linkIndex) in visualArray(slot.key, 'links')"
                        :key="linkIndex"
                        class="builder-item grid gap-xs tablet:grid-cols-[1fr_5rem_2fr_auto]"
                      >
                        <input
                          :value="String(link.label ?? '')"
                          class="field-control h-10"
                          :placeholder="text('Button label', 'ข้อความปุ่ม')"
                          @input="
                            updateLink(
                              slot.key,
                              linkIndex,
                              'label',
                              ($event.target as HTMLInputElement).value,
                            )
                          "
                        /><input
                          :value="String(link.emoji ?? '')"
                          class="field-control h-10"
                          :placeholder="text('Emoji', 'Emoji')"
                          @input="
                            updateLink(
                              slot.key,
                              linkIndex,
                              'emoji',
                              ($event.target as HTMLInputElement).value,
                            )
                          "
                        /><input
                          :value="String(link.url ?? '')"
                          type="url"
                          class="field-control h-10"
                          placeholder="https://"
                          @input="
                            updateLink(
                              slot.key,
                              linkIndex,
                              'url',
                              ($event.target as HTMLInputElement).value,
                            )
                          "
                        /><button
                          type="button"
                          class="builder-delete"
                          @click="removeLink(slot.key, linkIndex)"
                        >
                          {{ text('Delete', 'ลบ') }}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="builder-section desktop:col-span-2 wide:col-span-1">
                    <template v-if="supportsBlockBuilder(slot.key)">
                      <div class="builder-heading">
                        <div>
                          <strong>Components V2 Layout</strong>
                          <p>
                            {{
                              text(
                                'Add, remove, and reorder blocks',
                                'เพิ่ม ลบ และเรียงบล็อกได้เหมือน editor ตัวเก่า',
                              )
                            }}
                          </p>
                        </div>
                      </div>
                      <div
                        v-for="(block, blockIndex) in componentBlocks(slot.key)"
                        :key="blockIndex"
                        class="builder-item"
                      >
                        <div class="flex items-center gap-xs">
                          <strong class="min-w-0 flex-1 truncate text-sm">{{
                            blockSummary(block)
                          }}</strong
                          ><button
                            type="button"
                            :disabled="blockIndex === 0"
                            @click="moveComponentBlock(slot.key, blockIndex, -1)"
                          >
                            ↑</button
                          ><button
                            type="button"
                            :disabled="blockIndex === componentBlocks(slot.key).length - 1"
                            @click="moveComponentBlock(slot.key, blockIndex, 1)"
                          >
                            ↓</button
                          ><button
                            type="button"
                            class="builder-delete"
                            @click="removeComponentBlock(slot.key, blockIndex)"
                          >
                            {{ text('Delete', 'ลบ') }}
                          </button>
                        </div>
                        <textarea
                          v-if="block.type === 10"
                          :value="String(block.content ?? '')"
                          rows="3"
                          class="field-control mt-xs resize-y py-sm"
                          :placeholder="
                            text(
                              'Message content supports {{variables}}',
                              'ข้อความ รองรับ {{variables}}',
                            )
                          "
                          @input="
                            updateComponentBlock(
                              slot.key,
                              blockIndex,
                              'content',
                              ($event.target as HTMLTextAreaElement).value,
                            )
                          "
                        />
                        <input
                          v-if="block.type === 12"
                          :value="componentBlockValue(block, 'mediaUrl')"
                          class="field-control mt-xs h-10"
                          :placeholder="
                            text('Media URL or {{image_url}}', 'Media URL หรือ {{image_url}}')
                          "
                          @input="
                            updateComponentBlock(
                              slot.key,
                              blockIndex,
                              'mediaUrl',
                              ($event.target as HTMLInputElement).value,
                            )
                          "
                        />
                        <div v-if="block.type === 1" class="mt-xs grid gap-xs tablet:grid-cols-[1fr_5rem_2fr]">
                          <input
                            :value="componentBlockValue(block, 'label')"
                            class="field-control h-10"
                            :placeholder="text('Button label', 'ข้อความปุ่ม')"
                            @input="
                              updateComponentBlock(
                                slot.key,
                                blockIndex,
                                'label',
                                ($event.target as HTMLInputElement).value,
                              )
                            "
                          /><input
                            :value="componentBlockValue(block, 'emoji')"
                            class="field-control h-10"
                            placeholder="Emoji"
                            @input="
                              updateComponentBlock(
                                slot.key,
                                blockIndex,
                                'emoji',
                                ($event.target as HTMLInputElement).value,
                              )
                            "
                          /><input
                            :value="componentBlockValue(block, 'url')"
                            class="field-control h-10"
                            placeholder="https://"
                            @input="
                              updateComponentBlock(
                                slot.key,
                                blockIndex,
                                'url',
                                ($event.target as HTMLInputElement).value,
                              )
                            "
                          />
                        </div>
                      </div>
                      <div class="mt-sm flex flex-wrap gap-xs">
                        <button
                          type="button"
                          class="builder-add"
                          @click="addComponentBlock(slot.key, 'text')"
                        >
                          + Content</button
                        ><button
                          type="button"
                          class="builder-add"
                          @click="addComponentBlock(slot.key, 'media')"
                        >
                          + Media</button
                        ><button
                          type="button"
                          class="builder-add"
                          @click="addComponentBlock(slot.key, 'separator')"
                        >
                          + Separator</button
                        ><button
                          type="button"
                          class="builder-add"
                          @click="addComponentBlock(slot.key, 'link')"
                        >
                          + Link Button
                        </button>
                      </div>
                    </template>
                    <template v-else>
                      <div class="builder-heading">
                        <div>
                          <strong>{{ text('Feature components', 'Component ของ Feature') }}</strong>
                          <p>
                            {{
                              text(
                                'Customize fixed buttons and selections without changing their action IDs.',
                                'แก้ข้อความ สี และ emoji โดยไม่เปลี่ยน Action ID ของระบบ',
                              )
                            }}
                          </p>
                        </div>
                      </div>
                      <div
                        v-for="item in systemComponents(slot.key)"
                        :key="item.role"
                        class="builder-item"
                      >
                        <div class="component-role">
                          <strong>{{ item.role }}</strong>
                          <span>{{
                            item.role.includes('select')
                              ? text('Selection', 'เมนูตัวเลือก')
                              : text('Button', 'ปุ่ม')
                          }}</span>
                        </div>
                        <div class="component-editor-grid">
                          <label class="component-field">
                            <span>{{
                              item.role.includes('select') ? 'Placeholder' : 'Label'
                            }}</span>
                            <input
                              :value="String(item.config.label ?? item.config.placeholder ?? '')"
                              class="field-control h-10"
                              :placeholder="
                                item.role.includes('select') ? 'เลือกตัวเลือก…' : 'ข้อความบนปุ่ม'
                              "
                              @input="
                                updateSystemComponent(
                                  slot.key,
                                  item.role,
                                  item.role.includes('select') ? 'placeholder' : 'label',
                                  ($event.target as HTMLInputElement).value,
                                )
                              "
                            />
                          </label>
                          <AppTextField
                            v-if="!item.role.includes('select')"
                            :model-value="String(item.config.style ?? 'secondary')"
                            variant="dropdown"
                            label="Style"
                            :options="componentStyleOptions"
                            @update:model-value="
                              (val) =>
                                updateSystemComponent(slot.key, item.role, 'style', String(val))
                            "
                          />
                          <label class="component-field">
                            <span>Emoji</span>
                            <input
                              :value="String(item.config.emoji ?? '')"
                              class="field-control h-10"
                              placeholder="💰 หรือ <:name:id>"
                              @input="
                                updateSystemComponent(
                                  slot.key,
                                  item.role,
                                  'emoji',
                                  ($event.target as HTMLInputElement).value,
                                )
                              "
                            />
                          </label>
                        </div>
                      </div>
                    </template>
                    <div class="mt-md border-t border-border-subtle pt-md">
                      <div class="builder-heading">
                        <div>
                          <strong>{{ text('Link buttons', 'ปุ่มลิงก์') }}</strong>
                          <p>{{ text('Customize the label, emoji, and destination URL.', 'แก้ข้อความ Emoji และ URL ปลายทางของปุ่ม') }}</p>
                        </div>
                        <button type="button" class="builder-add" @click="addLink(slot.key)">
                          {{ text('+ Add Link', '+ เพิ่มปุ่มลิงก์') }}
                        </button>
                      </div>
                      <div
                        v-for="(link, linkIndex) in visualArray(slot.key, 'links')"
                        :key="`component-link-${linkIndex}`"
                        class="builder-item"
                      >
                        <div class="component-role">
                          <strong>{{ text('Link button', 'ปุ่มลิงก์') }} {{ linkIndex + 1 }}</strong>
                          <button type="button" class="builder-delete" @click="removeLink(slot.key, linkIndex)">
                            {{ text('Delete', 'ลบ') }}
                          </button>
                        </div>
                        <div class="grid gap-xs tablet:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.5fr)]">
                          <label class="component-field"><span>Label</span><input
                            :value="String(link.label ?? '')"
                            class="field-control h-10"
                            placeholder="สั่งซื้อคลิก"
                            @input="updateLink(slot.key, linkIndex, 'label', ($event.target as HTMLInputElement).value)"
                          /></label>
                          <label class="component-field"><span>Emoji</span><input
                            :value="String(link.emoji ?? '')"
                            class="field-control h-10"
                            placeholder="🍃"
                            @input="updateLink(slot.key, linkIndex, 'emoji', ($event.target as HTMLInputElement).value)"
                          /></label>
                          <label class="component-field"><span>URL</span><input
                            :value="String(link.url ?? '')"
                            type="url"
                            class="field-control h-10"
                            placeholder="https:// หรือ {{order_url}}"
                            @input="updateLink(slot.key, linkIndex, 'url', ($event.target as HTMLInputElement).value)"
                          /></label>
                        </div>
                      </div>
                    </div>
                    <div class="mt-md border-t border-border-subtle pt-md">
                      <div class="builder-heading">
                        <div>
                          <strong>Co-Feature</strong>
                          <p>
                            {{
                              text(
                                'Reuse actions only from Features installed on this bot.',
                                'นำปุ่มจาก Feature ที่ติดตั้งอยู่ในบอทนี้มาใช้ร่วมกัน',
                              )
                            }}
                          </p>
                        </div>
                      </div>
                      <div
                        v-for="item in coFeatureComponents(slot.key)"
                        :key="String(item.action)"
                        class="builder-item"
                      >
                        <div class="flex items-center gap-xs">
                          <strong class="min-w-0 flex-1 text-sm">{{ item.label }}</strong>
                          <button
                            type="button"
                            class="builder-delete"
                            @click="removeCoFeature(slot.key, String(item.action))"
                          >
                            {{ text('Remove', 'นำออก') }}
                          </button>
                        </div>
                        <div class="component-editor-grid">
                          <label class="component-field"
                            ><span>Label</span
                            ><input
                              :value="String(item.label ?? '')"
                              class="field-control h-10"
                              @input="
                                updateCoFeature(
                                  slot.key,
                                  String(item.action),
                                  'label',
                                  ($event.target as HTMLInputElement).value,
                                )
                              "
                          /></label>
                          <AppTextField
                            :model-value="String(item.style ?? 'secondary')"
                            variant="dropdown"
                            label="Style"
                            :options="componentStyleOptions"
                            @update:model-value="
                              (val) =>
                                updateCoFeature(slot.key, String(item.action), 'style', String(val))
                            "
                          />
                          <label class="component-field"
                            ><span>Emoji</span
                            ><input
                              :value="String(item.emoji ?? '')"
                              class="field-control h-10"
                              placeholder="💰 หรือ <:name:id>"
                              @input="
                                updateCoFeature(
                                  slot.key,
                                  String(item.action),
                                  'emoji',
                                  ($event.target as HTMLInputElement).value,
                                )
                              "
                          /></label>
                        </div>
                      </div>
                      <AppTextField
                        v-if="availableCoFeatureOptions(slot.key).length"
                        :model-value="''"
                        variant="dropdown"
                        :label="text('Add Co-Feature', 'เพิ่ม Co-Feature')"
                        :options="availableCoFeatureOptions(slot.key)"
                        :placeholder="
                          '+ ' +
                          text(
                            'Add action from installed Feature',
                            'เพิ่ม Action จาก Feature ที่ติดตั้ง',
                          )
                        "
                        class="mt-xs"
                        @update:model-value="(val) => val && addCoFeature(slot.key, String(val))"
                      />
                      <p
                        v-else-if="!availableCoFeatures.length"
                        class="mt-xs text-xs text-text-muted"
                      >
                        {{
                          text(
                            'No compatible Co-Feature is installed on this bot.',
                            'บอทนี้ยังไม่มี Co-Feature ที่รองรับติดตั้งอยู่',
                          )
                        }}
                      </p>
                    </div>
                  </div>
                </div>
                <label v-else class="block text-sm font-medium"
                  >Presentation JSON<textarea
                    v-model="presentationJson[slot.key]"
                    rows="20"
                    class="field-control mt-xs resize-y py-sm font-mono text-xs"
                    @input="previewAdvancedJson(slot.key)"
                  /><small class="mt-xs block text-text-secondary">{{
                    text(
                      'Supports all actions, components, and custom structures. Must be a valid JSON object.',
                      'รองรับ actions, components และโครงสร้างเพิ่มเติมทั้งหมด ต้องเป็น JSON object',
                    )
                  }}</small></label
                >
                <DiscordPresentationPreview
                  :definition="presentations[slot.key] ?? {}"
                  :variables="slot.availableVariables"
                  :bot-name="previewBot?.discordUsername || previewBot?.name"
                  :bot-avatar-url="previewBot?.discordAvatarUrl"
                  :sample-values="presentationSampleValues(slot.key)"
                />
              </div>
            </article>
          </div>
          <div
            v-else
            class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-muted"
          >
            {{
              text(
                'No messages currently use this presentation mode. Select a mode from Presentation settings first.',
                'ยังไม่มีข้อความที่ใช้รูปแบบนี้ กรุณาเลือกชนิดจากหน้า Presentation settings ก่อน',
              )
            }}
          </div>
        </section>
      </template>
      <AppSectionIndicator :sections="pageSections" aria-label="Feature settings sections" />
    </div>
  </section>
</template>

<style scoped>
.bot-flow-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
  view-transition-name: bot-settings-hero;
}
.bot-flow-hero h1 {
  font-size: clamp(2.25rem, 5vw, 3rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.04em;
}
.bot-flow-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface);
  view-transition-name: bot-settings-summary;
}
.bot-flow-identity,
.bot-flow-controls {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}
.bot-flow-avatar {
  width: 6rem;
  height: 6rem;
  flex: none;
  border-radius: var(--radius-lg);
  object-fit: cover;
}
.bot-flow-avatar--fallback {
  display: grid;
  place-items: center;
  background: var(--semantic-color-background-bg-elevated);
  font-size: 2rem;
  font-weight: var(--typography-font-weight-bold);
}
.bot-flow-identity h2 {
  font-size: var(--font-size-heading-small);
  font-weight: var(--typography-font-weight-bold);
}
.bot-flow-identity p {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
  color: var(--semantic-color-text-text-muted);
}
.bot-flow-online {
  color: var(--semantic-color-success-success-text);
}
.bot-flow-offline {
  color: var(--semantic-color-error-error-text);
}
.bot-flow-hug {
  width: auto;
}
.feature-flow-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-label-large);
  font-weight: var(--typography-font-weight-semibold);
  animation: feature-flow-reveal 280ms ease-out both;
  view-transition-name: bot-settings-breadcrumb;
}
@media (max-width: 47.99rem) {
  .bot-flow-summary,
  .bot-flow-controls {
    align-items: stretch;
    flex-direction: column;
  }
  .bot-flow-controls > * {
    width: 100%;
  }
}
.feature-flow-breadcrumb button {
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: none;
}
.feature-flow-breadcrumb button:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
@keyframes feature-flow-reveal {
  from {
    opacity: 0;
    transform: translateX(var(--space-xl));
  }
}
.presentation-menu {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-lg);
}
.presentation-card {
  display: flex;
  min-height: 14rem;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  gap: var(--space-xs);
  padding: var(--space-lg);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  background: var(--semantic-color-background-bg-surface);
  color: var(--semantic-color-text-text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}
.presentation-slot-list {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface);
}
.presentation-slot-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(12rem, 18rem) auto;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
}
.presentation-slot-row + .presentation-slot-row {
  border-top: 1px solid var(--semantic-color-border-border-subtle);
}
.presentation-slot-edit {
  width: auto;
}
.presentation-card span:last-child {
  color: var(--semantic-color-text-text-secondary);
}
.presentation-card:hover {
  transform: translateY(-2px);
  border-color: var(--semantic-color-border-border-strong);
  background: var(--semantic-color-background-bg-surface-hover);
}
.presentation-card:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 3px;
}
.field-control {
  width: 100%;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  padding-inline: var(--space-md);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
  outline: none;
}
.field-control:focus {
  border-color: var(--semantic-color-action-borders-border-focus);
  box-shadow: 0 0 0 1px var(--semantic-color-action-borders-border-focus);
}
.builder-section {
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-md);
  padding: var(--space-md);
  background: var(--semantic-color-background-bg-elevated);
}
.builder-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}
.builder-heading p {
  margin-top: var(--space-xxs);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
}
.builder-heading button,
.builder-add,
.builder-item button {
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  padding: var(--space-xs) var(--space-sm);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
  cursor: pointer;
  font-size: var(--font-size-label-small);
}
.builder-item {
  margin-top: var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-md);
  padding: var(--space-sm);
  background: var(--semantic-color-background-bg-surface);
  container-type: inline-size;
}
.component-role {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
.component-role strong {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-small);
}
.component-role span {
  border-radius: 999px;
  padding: var(--space-xxs) var(--space-xs);
  background: var(--semantic-color-background-bg-elevated);
  color: var(--semantic-color-text-text-muted);
  font-size: 0.625rem;
}
.component-editor-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}
.component-field {
  display: grid;
  min-width: 0;
  gap: var(--space-xxs);
}
.component-field > span {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-semibold);
}
@container (min-width: 34rem) {
  .component-editor-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (min-width: 52rem) {
  .component-editor-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.builder-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-xs);
  font-size: var(--font-size-label-small);
}
.builder-actions label {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
}
.builder-delete {
  color: var(--semantic-color-error-error-text) !important;
}
.builder-item button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
@media (max-width: 47.99rem) {
  .presentation-menu {
    grid-template-columns: 1fr;
  }
  .presentation-slot-row {
    grid-template-columns: 1fr;
  }
  .presentation-slot-edit {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .presentation-card {
    transition: none;
  }
}
</style>
