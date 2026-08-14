<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Braces, Check, ChevronDown, Save, Settings2 } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'

import {
  fetchFeatureConfiguration,
  fetchFeatureLicenses,
  fetchBots,
  fetchAdminBotLicenses,
  fetchAdminBotSettings,
  fetchAdminFeatureConfiguration,
  updateFeatureConfiguration,
  updateAdminFeatureConfiguration,
  type FeatureConfiguration,
  type FeatureConfigValue,
  type FeatureLicense,
  type UserBot,
} from '../../../services/backend'
import { useAuthStore } from '../../../stores'
import { AppButton, AppModal, AppSectionIndicator, AppTextField, AppToggle } from '../../../shared/ui'
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
const adminMode=computed(()=>route.path.startsWith('/admin/bots/'))

const isRobloxPayoutFeature = computed(() => {
  const code = license.value?.featureCode
  return code === 'roblox-robux-payout' || 'ROBLOX_GROUPS' in values.value
})
const isRobloxPayoutV2 = computed(() => isRobloxPayoutFeature.value && license.value?.version === '2.0.0')
const isWalletTopupFeature = computed(() => license.value?.featureCode === 'wallet-topup')
const isPriceReaderFeature = computed(() => license.value?.featureCode === 'price-reader')
const usesPresentationDesigner = computed(
  () => isWalletTopupFeature.value || isRobloxPayoutFeature.value || isPriceReaderFeature.value,
)
const isWalletPanelCommand = (key: string) => isWalletTopupFeature.value && key === 'PANEL_COMMAND_NAME'
const walletConfigCopy: Record<string, { label: [string, string]; description: [string, string] }> = {
  PANEL_COMMAND_NAME: { label: ['Panel command', 'คำสั่งแผงเติมเงิน'], description: ['Administrator command used to post the wallet panel.', 'คำสั่งสำหรับผู้ดูแลเพื่อส่งแผงเติมเงิน'] },
  MIN_TOPUP_SATANG: { label: ['PromptPay minimum top-up', 'ยอดเติมขั้นต่ำผ่านพร้อมเพย์'], description: ['Minimum PromptPay amount accepted, in satang.', 'ยอดเงินขั้นต่ำที่รับผ่านพร้อมเพย์ หน่วยเป็นสตางค์'] },
  TRUEMONEY_FEE_SATANG: { label: ['TrueMoney fee', 'ค่าธรรมเนียม TrueMoney'], description: ['Fixed fee deducted from a successful voucher, in satang.', 'ค่าธรรมเนียมคงที่ที่หักจากซองสำเร็จ หน่วยเป็นสตางค์'] },
  TRUEMONEY_FEE_MODE: { label: ['TrueMoney fee mode', 'รูปแบบค่าธรรมเนียม TrueMoney'], description: ['Choose a fixed fee or a percentage of the voucher amount.', 'เลือกค่าธรรมเนียมคงที่หรือคิดเป็นเปอร์เซ็นต์จากยอดซอง'] },
  TRUEMONEY_FEE_PERCENT: { label: ['TrueMoney percentage fee', 'ค่าธรรมเนียม TrueMoney แบบเปอร์เซ็นต์'], description: ['Percentage deducted when percentage mode is selected.', 'เปอร์เซ็นต์ที่หักเมื่อเลือกรูปแบบเปอร์เซ็นต์'] },
  TRUEMONEY_PHONE: { label: ['TrueMoney phone', 'เบอร์โทร TrueMoney'], description: ['Recipient phone number used by the Voucher API.', 'เบอร์โทรผู้รับที่ใช้กับระบบซองของขวัญ TrueMoney'] },
  PROMPTPAY_ID: { label: ['PromptPay ID', 'หมายเลขพร้อมเพย์'], description: ['Phone number or national ID used to generate the QR.', 'เบอร์โทรหรือเลขบัตรประชาชนที่ใช้สร้าง QR พร้อมเพย์'] },
  PROMPTPAY_ACCOUNT_NAME: { label: ['PromptPay account name', 'ชื่อบัญชีพร้อมเพย์'], description: ['Account name displayed beside the QR.', 'ชื่อบัญชีที่แสดงคู่กับ QR พร้อมเพย์'] },
  SLIPOK_BRANCH_ID: { label: ['SlipOK branch ID', 'รหัสสาขา SlipOK'], description: ['Branch ID supplied by SlipOK.', 'รหัสสาขาที่ได้รับจาก SlipOK'] },
  SLIPOK_API_KEY: { label: ['SlipOK API key', 'คีย์ API ของ SlipOK'], description: ['API key used to verify payment slips.', 'คีย์ API สำหรับตรวจสอบสลิปการชำระเงิน'] },
  SLIP_CHANNEL_ID: { label: ['Slip submission channel', 'ช่องส่งสลิป'], description: ['Channel where members submit PromptPay slips.', 'ช่องที่สมาชิกใช้ส่งสลิปพร้อมเพย์'] },
  SLIP_SUBMITTER_ROLE_ID: { label: ['Slip submitter role', 'ยศผู้ส่งสลิป'], description: ['Temporary role allowed to submit payment slips.', 'ยศชั่วคราวสำหรับสมาชิกที่ได้รับอนุญาตให้ส่งสลิป'] },
  TOPUP_NOTIFICATION_CHANNEL_ID: { label: ['Top-up notification channel', 'ช่องแจ้งเตือนการเติมเงิน'], description: ['Private channel receiving successful top-up notifications.', 'ช่องส่วนตัวที่รับการแจ้งเตือนเมื่อเติมเงินสำเร็จ'] },
  WALLET_ADMIN_ROLE_ID: { label: ['Wallet administrator role', 'ยศผู้ดูแลกระเป๋าเงิน'], description: ['Optional role allowed to inspect and adjust member balances.', 'ยศเสริมที่สามารถตรวจสอบและปรับยอดเงินสมาชิกได้'] },
  TOPUP_MEMBER_ROLE_ID: { label: ['Top-up member role', 'ยศสมาชิกที่เติมเงิน'], description: ['Optional permanent role granted after a successful top-up.', 'ยศถาวรเสริมที่มอบให้หลังเติมเงินสำเร็จ'] },
  WALLET_HISTORY_DEFAULT_LIMIT: { label: ['History default limit', 'จำนวนประวัติเริ่มต้น'], description: ['Default number of wallet history entries shown.', 'จำนวนรายการประวัติกระเป๋าเงินที่แสดงเริ่มต้น'] },
  TOP_SPENDER_TOP1_ROLE_ID: { label: ['Top spender #1 role', 'ยศผู้เติมเงินอันดับ 1'], description: ['Optional role for the lifetime top-up leader.', 'ยศเสริมสำหรับผู้เติมเงินสะสมอันดับหนึ่ง'] },
  TOP_SPENDER_TOP10_ROLE_ID: { label: ['Top spender top 10 role', 'ยศผู้เติมเงิน 10 อันดับแรก'], description: ['Optional role for lifetime ranks 1–10.', 'ยศเสริมสำหรับผู้เติมเงินสะสมอันดับ 1–10'] },
  TOP_SPENDER_MILESTONE_ROLES: { label: ['Top spender milestones', 'ยศตามยอดเติมสะสม'], description: ['Roles granted when lifetime top-up thresholds are reached.', 'ยศที่มอบเมื่อยอดเติมเงินสะสมถึงเกณฑ์'] },
  TOP_SPENDER_LEADERBOARD_CHANNEL_ID: { label: ['Leaderboard channel', 'ช่องตารางอันดับ'], description: ['Optional channel receiving the public Top 10 leaderboard.', 'ช่องเสริมสำหรับแสดงตารางผู้เติมเงิน 10 อันดับแรก'] },
}
const robloxConfigCopy: Record<string, { label: [string, string]; description: [string, string] }> = {
  PANEL_COMMAND_NAME: { label: ['Panel command', 'คำสั่งแผงขาย Robux'], description: ['Administrator command used to post the Robux shop panel.', 'คำสั่งสำหรับผู้ดูแลเพื่อส่งแผงขาย Robux'] },
  ROBUX_ENABLED: { label: ['Sales enabled', 'เปิดระบบขาย Robux'], description: ['Allow members to start new Robux purchases.', 'อนุญาตให้สมาชิกเริ่มซื้อ Robux รายการใหม่'] },
  ROBUX_RATE: { label: ['Robux rate', 'อัตรา Robux'], description: ['Robux received per one baht when packages are not configured.', 'จำนวน Robux ที่ได้รับต่อหนึ่งบาทเมื่อไม่ได้กำหนดแพ็กเกจ'] },
  ROBUX_PACKAGES: { label: ['Robux packages', 'แพ็กเกจ Robux'], description: ['Configure the Robux amounts available for purchase.', 'กำหนดจำนวน Robux ที่สมาชิกสามารถเลือกซื้อได้'] },
  ROBUX_PAYOUT_COOLDOWN_SECONDS: { label: ['Payout cooldown', 'ระยะพักระหว่างการโอน'], description: ['Delay between queued payouts, in seconds.', 'ระยะเวลารอระหว่างรายการโอนในคิว หน่วยเป็นวินาที'] },
  ROBUX_NOTIFICATION_CHANNEL_ID: { label: ['Notification channel', 'ช่องแจ้งเตือน'], description: ['Channel receiving payout results.', 'ช่องที่รับผลการทำรายการโอน Robux'] },
}
const priceReaderConfigCopy: Record<string, { label: [string, string]; description: [string, string] }> = {
  PRICE_READER_CHANNEL_ID: { label: ['Reader channel', 'ช่องอ่านราคา'], description: ['Channel where the bot reads Discord Shop screenshots.', 'ช่องที่บอทใช้รับภาพหน้าจอ Discord Shop เพื่ออ่านราคา'] },
  PRICE_READER_ORDER_CHANNEL_ID: { label: ['Order channel', 'ช่องสั่งซื้อ'], description: ['Optional destination for the order button.', 'ช่องปลายทางสำหรับปุ่มสั่งซื้อ สามารถเว้นว่างได้'] },
  PRICE_READER_PRICE_MAP: { label: ['Price map', 'ตารางราคา'], description: ['Map Discord prices to your shop prices, in THB.', 'จับคู่ราคา Discord กับราคาขายของร้าน หน่วยเป็นบาท'] },
  PRICE_READER_NO_NITRO_MARKUP_SATANG: { label: ['Non-Nitro markup', 'ค่าบวกเมื่อไม่มี Nitro'], description: ['Additional amount per item for buyers without Nitro, in satang.', 'จำนวนเงินที่บวกต่อชิ้นเมื่อผู้ซื้อไม่มี Nitro หน่วยเป็นสตางค์'] },
  PRICE_READER_RESULTS_ITEM_TEMPLATE: { label: ['Result item template', 'รูปแบบผลลัพธ์ต่อรูป'], description: ['Customize the text generated for each processed image.', 'ปรับข้อความผลลัพธ์ที่สร้างสำหรับแต่ละรูป'] },
}
const robloxPresentationCopy: Record<string, { label: [string, string]; description: [string, string] }> = {
  panel: { label: ['Robux shop panel', 'แผงร้าน Robux'], description: ['Public shop panel with live group stock.', 'แผงร้านสาธารณะที่แสดง Robux คงเหลือของกลุ่ม'] },
  eligibility: { label: ['Eligibility result', 'ผลตรวจสอบสิทธิ์'], description: ['Result after checking a Roblox username.', 'ผลหลังตรวจสอบชื่อผู้ใช้ Roblox'] },
  membership_result: { label: ['Group membership result', 'ผลตรวจสอบวันที่เข้ากลุ่ม'], description: ['Shows the current group join date and membership age.', 'แสดงวันที่เข้ากลุ่มรอบปัจจุบันและจำนวนวันที่อยู่ในกลุ่ม'] },
  package_selector: { label: ['Package selector', 'เลือกแพ็กเกจ'], description: ['Available packages based on wallet balance and group stock.', 'แพ็กเกจที่ซื้อได้ตามยอดเงินและ Robux ในกลุ่ม'] },
  confirmation: { label: ['Purchase confirmation', 'ยืนยันการซื้อ'], description: ['Confirmation before deducting the wallet balance.', 'ข้อความยืนยันก่อนหักยอดเงินในกระเป๋า'] },
  processing: { label: ['Payout processing', 'กำลังดำเนินการโอน'], description: ['Shown while processing the Roblox payout.', 'แสดงระหว่างประมวลผลการโอน Robux'] },
  queued: { label: ['Payout queued', 'เข้าคิวโอน Robux'], description: ['Shown after payment while waiting in the payout queue.', 'แสดงหลังชำระเงินระหว่างรอคิวโอน'] },
  succeeded: { label: ['Payout succeeded', 'โอน Robux สำเร็จ'], description: ['Successful payout receipt.', 'ใบยืนยันการโอน Robux สำเร็จ'] },
  failed: { label: ['Payout failed', 'โอน Robux ไม่สำเร็จ'], description: ['Failure and refund receipt.', 'ข้อความข้อผิดพลาดและการคืนเงิน'] },
  notification: { label: ['Payout notification', 'แจ้งเตือนการโอน'], description: ['Private payout audit notification.', 'ข้อความแจ้งเตือนผลการโอนสำหรับผู้ดูแล'] },
  notification_success: { label: ['Success notification', 'แจ้งเตือนรายการสำเร็จ'], description: ['Notification sent after a successful payout.', 'ข้อความแจ้งเตือนหลังโอนสำเร็จ'] },
  notification_error: { label: ['Error notification', 'แจ้งเตือนข้อผิดพลาด'], description: ['Notification sent when a payout fails.', 'ข้อความแจ้งเตือนเมื่อการโอนไม่สำเร็จ'] },
}
const priceReaderPresentationCopy: Record<string, { label: [string, string]; description: [string, string] }> = {
  processing: { label: ['Reading images', 'กำลังอ่านรูป'], description: ['Shown while OCR is processing uploaded images.', 'แสดงระหว่างระบบ OCR กำลังอ่านรูปที่ส่งมา'] },
  result: { label: ['Price reading result', 'ผลการอ่านราคา'], description: ['Result returned after OCR completes.', 'ผลลัพธ์ที่ส่งหลังจาก OCR อ่านราคาเสร็จ'] },
}
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
  if (route.name === 'feature-embed-settings' || route.name === 'bot-feature-embed-settings' || route.name==='admin-bot-feature-embed-settings')
    return 'EMBED'
  if (
    route.name === 'feature-components-v2-settings' ||
    route.name === 'bot-feature-components-v2-settings' || route.name==='admin-bot-feature-components-v2-settings'
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
const walletExpandedSlots = ref(new Set<string>())
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
const componentStyles = ['primary', 'secondary', 'success', 'danger'] as const
const valueLength = (value: unknown) => String(value ?? '').length
const walletActionDefaults: Record<string, { label: [string, string]; emoji: string; style: string }> = {
  'wallet.topup': { label: ['Top up', 'เติมเงิน'], emoji: '💰', style: 'success' },
  'wallet.balance': { label: ['Check balance', 'เช็คยอดเงินคงเหลือ'], emoji: '💳', style: 'secondary' },
  'wallet.promptpay': { label: ['PromptPay', 'พร้อมเพย์ธนาคาร'], emoji: '🏦', style: 'primary' },
  'wallet.truemoney': { label: ['TrueMoney gift', 'ซองอั่งเปาทรูมันนี่'], emoji: '🧧', style: 'danger' },
}
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
const saveConfirmationOpen = ref(false)
const walletPreviewScope = ref<'all' | 'current'>('all')
const walletActiveSlotKey = ref('')
const draggedComponent = ref<{ slotKey: string; index: number } | null>(null)
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
          ? text('Fixed amount', 'ค่าคงที่')
          : option.value === 'PERCENT'
            ? text('Percentage', 'เปอร์เซ็นต์')
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
            name: adminMode.value?'admin-bot-feature-settings':'bot-feature-settings',
            params: { botId: flowBotId.value, licenseId: licenseId.value },
          }
        : { name: 'feature-settings', params: { licenseId: licenseId.value } },
    )
    return
  }
  void router.push(
    inBotSettingsFlow.value
      ? { name: adminMode.value?'admin-bot-package-settings':'bot-package-settings', params: { botId: flowBotId.value } }
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
  const normalized = mode === 'COMPONENTS_V2' ? 'COMPONENTS_V2' : 'EMBED'
  presentations.value[slotKey] = { ...presentations.value[slotKey], mode: normalized }
  presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
}

const visiblePresentationSlots = computed(() =>
  (configuration.value?.presentations ?? []).filter(
    (slot) =>
      !presentationMode.value ||
      usesPresentationDesigner.value ||
      slotMode(slot.key) === presentationMode.value,
  ),
)

function presentationPreviewDefinition(slotKey: string) {
  const definition = presentations.value[slotKey] ?? {}
  return presentationMode.value ? { ...definition, mode: presentationMode.value } : definition
}

function toggleWalletMessage(slotKey: string) {
  walletActiveSlotKey.value = slotKey
  const next = new Set(walletExpandedSlots.value)
  if (next.has(slotKey)) next.delete(slotKey)
  else next.add(slotKey)
  walletExpandedSlots.value = next
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
    error.value = text(
      'Please sign in before opening Feature Settings',
      'กรุณาเข้าสู่ระบบก่อนเปิด Feature Settings',
    )
    loading.value = false
    return
  }
  try {
    const [allLicenses,config,bots]=adminMode.value
      ? await Promise.all([
          fetchAdminBotLicenses(flowBotId.value,session.value),
          fetchAdminFeatureConfiguration(flowBotId.value,licenseId.value,session.value),
          fetchAdminBotSettings(flowBotId.value,session.value).then((bot)=>[bot]),
        ])
      : await Promise.all([
          fetchFeatureLicenses(session.value),fetchFeatureConfiguration(licenseId.value,session.value),fetchBots(session.value),
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
  const nested = definition[nestedKey]
  if (presentationMode.value || (nested && typeof nested === 'object')) {
    definition[nestedKey] = {
      ...(nested && typeof nested === 'object' && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : {}),
      [key]: value,
    }
    presentations.value[slotKey] = { ...definition }
  } else presentations.value[slotKey] = { ...definition, [key]: value }
  presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
}

function embedColor(slotKey: string) {
  const value = visualDefinition(slotKey).color
  if (typeof value === 'number' && Number.isInteger(value))
    return `#${value.toString(16).padStart(6, '0').slice(-6)}`
  const normalized = String(value ?? '').trim()
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : '#5865f2'
}

function updateEmbedColor(slotKey: string, value: string) {
  const normalized = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(normalized)) updatePresentation(slotKey, 'color', normalized)
}

function embedObject(slotKey: string, key: 'author' | 'footer') {
  const value = visualDefinition(slotKey)[key]
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>
  return key === 'footer' && typeof value === 'string' ? { text: value } : {}
}

function updateEmbedObject(slotKey: string, key: 'author' | 'footer', field: string, value: string) {
  updatePresentation(slotKey, key, { ...embedObject(slotKey, key), [field]: value })
}

function fixedActions(slotKey: string) {
  const definition = visualDefinition(slotKey)
  const actions = Array.isArray(definition.actions) ? definition.actions.map(String) : []
  const overrides =
    definition.action_overrides &&
    typeof definition.action_overrides === 'object' &&
    !Array.isArray(definition.action_overrides)
      ? (definition.action_overrides as Record<string, Record<string, unknown>>)
      : {}
  return actions.flatMap((action) => {
    const defaults = walletActionDefaults[action]
    if (!defaults) return []
    return [{ action, defaults, override: overrides[action] ?? {} }]
  })
}
const defaultActionLabel = (labels: [string, string]) => text(labels[0], labels[1])

function updateActionOverride(slotKey: string, action: string, key: string, value: string) {
  const definition = visualDefinition(slotKey)
  const current =
    definition.action_overrides &&
    typeof definition.action_overrides === 'object' &&
    !Array.isArray(definition.action_overrides)
      ? clone(definition.action_overrides as Record<string, unknown>)
      : {}
  const override =
    current[action] && typeof current[action] === 'object' && !Array.isArray(current[action])
      ? (current[action] as Record<string, unknown>)
      : {}
  current[action] = { ...override, [key]: value }
  updatePresentation(slotKey, 'action_overrides', current)
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
  return raw as Array<Record<string, unknown>>
}

function supportsBlockBuilder(slotKey: string) {
  if (presentationMode.value === 'COMPONENTS_V2') return true
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
  updatePresentation(slotKey, 'components', blocks)
}

function containerChildren(block: Record<string, unknown>) {
  return Array.isArray(block.components)
    ? block.components.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object' && !Array.isArray(item)),
      )
    : []
}

function updateContainerBlock(
  slotKey: string,
  blockIndex: number,
  key: 'spoiler' | 'accent_color',
  value: unknown,
) {
  const blocks = componentBlocks(slotKey).map((block) => clone(block))
  if (blocks[blockIndex]) blocks[blockIndex][key] = value
  setComponentBlocks(slotKey, blocks)
}

function createComponentBlock(type: 'text' | 'container' | 'section' | 'media' | 'separator' | 'link') {
  if (type === 'text') return { type: 10, content: text('New content', 'ข้อความใหม่') }
  if (type === 'container')
    return { type: 17, accent_color: '#5865f2', spoiler: false, components: [] }
  if (type === 'section')
    return {
      type: 9,
      components: [{ type: 10, content: text('Section content', 'ข้อความใน Section') }],
      accessory: {
        type: 11,
        media: { url: 'https://example.com/image.png' },
        description: text('Accessory image', 'รูปประกอบ'),
      },
    }
  if (type === 'media')
    return {
      type: 12,
      items: [
        {
          media: { url: 'https://example.com/image.png' },
          description: text('Accessory image', 'รูปประกอบ'),
        },
      ],
    }
  if (type === 'separator') return { type: 14, divider: true, spacing: 1 }
  return {
    type: 1,
    components: [
      { type: 2, style: 5, label: text('Open link', 'เปิดลิงก์'), url: 'https://example.com' },
    ],
  }
}

function mediaItems(block: Record<string, unknown>) {
  return Array.isArray(block.items) ? block.items.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>> : []
}

function mediaItemUrl(item: Record<string, unknown>) {
  return item.media && typeof item.media === 'object' && 'url' in item.media
    ? String(item.media.url ?? '')
    : ''
}

function updateMediaItem(slotKey: string, blockIndex: number, itemIndex: number, value: string) {
  const blocks = componentBlocks(slotKey).map((block) => clone(block))
  const block = blocks[blockIndex]
  if (!block) return
  const items = mediaItems(block).map((item) => clone(item))
  items[itemIndex] = { ...items[itemIndex], media: { url: value } }
  block.items = items
  setComponentBlocks(slotKey, blocks)
}

function addMediaItem(slotKey: string, blockIndex: number) {
  const blocks = componentBlocks(slotKey).map((block) => clone(block))
  const block = blocks[blockIndex]
  if (!block) return
  block.items = [...mediaItems(block), { media: { url: 'https://example.com/image.png' } }]
  setComponentBlocks(slotKey, blocks)
}

function updateSeparator(slotKey: string, blockIndex: number, key: 'divider' | 'spacing', value: boolean | number) {
  const blocks = componentBlocks(slotKey).map((block) => clone(block))
  if (blocks[blockIndex]) blocks[blockIndex][key] = value
  setComponentBlocks(slotKey, blocks)
}

function addComponentBlock(
  slotKey: string,
  type: 'text' | 'container' | 'section' | 'media' | 'separator' | 'link',
) {
  const blocks = [...componentBlocks(slotKey)]
  if (blocks.length >= 40) return
  blocks.push(createComponentBlock(type))
  setComponentBlocks(slotKey, blocks)
}

function addContainerChild(
  slotKey: string,
  blockIndex: number,
  type: 'text' | 'section' | 'media' | 'separator' | 'link',
) {
  const blocks = componentBlocks(slotKey).map((block) => clone(block))
  const container = blocks[blockIndex]
  if (!container || container.type !== 17) return
  const children = containerChildren(container)
  if (children.length >= 39) return
  container.components = [...children, createComponentBlock(type)]
  setComponentBlocks(slotKey, blocks)
}

function removeContainerChild(slotKey: string, blockIndex: number, childIndex: number) {
  const blocks = componentBlocks(slotKey).map((block) => clone(block))
  const container = blocks[blockIndex]
  if (!container || container.type !== 17) return
  container.components = containerChildren(container).filter((_, index) => index !== childIndex)
  setComponentBlocks(slotKey, blocks)
}

function moveContainerChild(slotKey: string, blockIndex: number, childIndex: number, direction: -1 | 1) {
  const blocks = componentBlocks(slotKey).map((block) => clone(block))
  const container = blocks[blockIndex]
  if (!container || container.type !== 17) return
  const children = containerChildren(container)
  const target = childIndex + direction
  if (target < 0 || target >= children.length) return
  ;[children[childIndex], children[target]] = [children[target]!, children[childIndex]!]
  container.components = children
  setComponentBlocks(slotKey, blocks)
}

function updateContainerChildContent(slotKey: string, blockIndex: number, childIndex: number, value: string) {
  const blocks = componentBlocks(slotKey).map((block) => clone(block))
  const container = blocks[blockIndex]
  if (!container || container.type !== 17) return
  const children = containerChildren(container)
  const child = children[childIndex]
  if (!child) return
  if (child.type === 10) child.content = value
  else if (child.type === 9) child.components = [{ type: 10, content: value }]
  container.components = children
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

function dropComponentBlock(slotKey: string, targetIndex: number) {
  const source = draggedComponent.value
  draggedComponent.value = null
  if (!source || source.slotKey !== slotKey || source.index === targetIndex) return
  const blocks = [...componentBlocks(slotKey)]
  const [moved] = blocks.splice(source.index, 1)
  if (!moved) return
  blocks.splice(targetIndex, 0, moved)
  setComponentBlocks(slotKey, blocks)
}

function blockSummary(block: Record<string, unknown>) {
  if (block.type === 10) return `Content · ${String(block.content ?? '').slice(0, 60)}`
  if (block.type === 9) return 'Section with accessory'
  if (block.type === 12) return 'Media gallery'
  if (block.type === 14) return 'Separator'
  if (block.type === 1) return 'Link button row'
  if (block.type === 17) return `Container · ${containerChildren(block).length} components`
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
    const input={values:normalValues,secrets:changedSecrets,presentations:presentations.value}
    const updated=adminMode.value
      ? await updateAdminFeatureConfiguration(flowBotId.value,licenseId.value,input,session.value)
      : await updateFeatureConfiguration(licenseId.value,input,session.value)
    configuration.value = updated
    hydrate(updated)
    notice.value = text(
      `Saved · Version ${updated.revision}`,
      `บันทึกแล้ว · Version ${updated.revision}`,
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
            · Version
            {{ configuration?.revision ?? '—' }}
          </p>
        </div>
        <AppButton
          v-if="configuration"
          class="tablet:!w-auto"
          variant="secondary"
          :disabled="saving"
          @click="saveConfirmationOpen = true"
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
                      configFieldDescription(field)
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
                    :label="configFieldLabel(field)"
                    :options="fieldOptions(field)"
                    :required="field.required"
                    @update:model-value="(value) => (values[field.key] = value)"
                  />
                  <label v-else>
                    {{ configFieldLabel(field) }}<span v-if="field.required && field.key !== 'COMMAND_PERMISSION_RULES'" class="text-error-text"> *</span>
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
                    <template v-else-if="isThresholdRoleField(field.key)">
                      <p class="mt-xs text-xs text-text-secondary">{{ configFieldDescription(field) }}</p>
                      <ThresholdRoleEditor
                        :model-value="String(values[field.key] ?? '[]')"
                        :threshold-key="field.key === 'SPENDING_UPGRADE_TIERS' ? 'amount' : 'thresholdBaht'"
                        @update:model-value="(value) => (values[field.key] = value)"
                      />
                    </template>
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
                <p v-if="field.key !== 'COMMAND_PERMISSION_RULES' && !isWalletPanelCommand(field.key) && !isThresholdRoleField(field.key)" class="mt-xs text-xs text-text-secondary">
                    {{ configFieldDescription(field)
                  }}<span v-if="field.type === 'STRING_LIST'">
                    · {{ text('One item per line', 'หนึ่งรายการต่อบรรทัด') }}</span
                  >
                </p>
                <p v-if="field.key !== 'COMMAND_PERMISSION_RULES' && !usesPresentationDesigner" class="mt-sm font-mono text-xs text-text-muted">
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
            :show-membership-lookup="isRobloxPayoutV2"
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
          <div class="mb-md">
            <h2 class="text-2xl font-semibold">{{ text('Message design', 'ออกแบบข้อความ') }}</h2>
            <p class="text-sm text-text-secondary">
              {{ text('Open a designer without changing the format currently used by each message.', 'เปิดหน้าออกแบบโดยไม่เปลี่ยนรูปแบบที่แต่ละข้อความกำลังใช้งาน') }}
            </p>
          </div>
          <div v-if="configuration.presentations.length" class="space-y-md">
            <div class="presentation-menu">
              <button class="presentation-card" type="button" @click="openPresentation('EMBED')">
                <span class="text-2xl font-bold">{{ text('Design Embed', 'ออกแบบ Embed') }}</span>
                <span>{{
                  text(
                    'Open the Embed designer',
                    'เปิดหน้าออกแบบ Embed',
                  )
                }}</span>
              </button>
              <button
                class="presentation-card"
                type="button"
                @click="openPresentation('COMPONENTS_V2')"
              >
                <span class="text-2xl font-bold">{{ text('Design Components V2', 'ออกแบบ Components V2') }}</span>
                <span>{{
                  text(
                    'Open the Components V2 designer',
                    'เปิดหน้าออกแบบ Components V2',
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
                  <strong class="block truncate">{{ presentationSlotLabel(slot) }}</strong>
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
          <div
            v-if="visiblePresentationSlots.length"
            :class="usesPresentationDesigner ? 'wallet-builder-layout' : 'space-y-md'"
          >
            <div :class="usesPresentationDesigner ? 'wallet-builder-messages' : 'contents'">
              <div v-if="usesPresentationDesigner" class="wallet-builder-toolbar">
                <div>
                  <strong>{{ isRobloxPayoutFeature ? text('Roblox Payout message builder', 'ตัวสร้างข้อความ Roblox Payout') : isPriceReaderFeature ? text('Price Reader message builder', 'ตัวสร้างข้อความ Price Reader') : text('Wallet message builder', 'ตัวสร้างข้อความ Wallet') }}</strong>
                  <p>{{ text('Open a fixed message to customize its appearance.', 'เปิดข้อความที่ระบบกำหนดไว้เพื่อปรับแต่งรูปแบบ') }}</p>
                </div>
                <span>{{ visiblePresentationSlots.length }} {{ text('messages', 'ข้อความ') }}</span>
              </div>
            <article
              v-for="(slot, slotIndex) in visiblePresentationSlots"
              :key="slot.slotId"
              :class="['rounded-lg border border-border-subtle bg-bg-surface', usesPresentationDesigner ? 'wallet-message-card' : 'p-lg']"
            >
              <button
                v-if="usesPresentationDesigner"
                type="button"
                class="wallet-message-header"
                :aria-expanded="walletExpandedSlots.has(slot.key)"
                @click="toggleWalletMessage(slot.key)"
              >
                <ChevronDown :size="20" :class="['wallet-message-chevron', { 'wallet-message-chevron--open': walletExpandedSlots.has(slot.key) }]" />
                <span class="min-w-0 flex-1 text-left">
                  <strong>{{ text('Message', 'ข้อความ') }} {{ slotIndex + 1 }} · {{ presentationSlotLabel(slot) }}</strong>
                  <small>{{ slot.key }}</small>
                </span>
                <span class="wallet-fixed-badge">{{ presentationMode ?? slotMode(slot.key) }} · {{ text('design', 'ออกแบบ') }}</span>
              </button>
              <div v-show="!usesPresentationDesigner || walletExpandedSlots.has(slot.key)" :class="{ 'wallet-message-body': usesPresentationDesigner }">
              <div
                v-if="!usesPresentationDesigner"
                class="flex flex-col gap-sm tablet:flex-row tablet:items-start tablet:justify-between"
              >
                <div>
                  <div class="flex flex-wrap items-center gap-xs">
                    <h3 class="text-lg font-semibold">{{ presentationSlotLabel(slot) }}</h3>
                    <span class="rounded-full border border-border-default px-xs py-xxs text-xs">{{
                      slot.type
                    }}</span
                    ><span
                      v-if="slot.overrideDefinition"
                      class="rounded-full border border-info-border bg-info-bg px-xs py-xxs text-xs text-info-text"
                      >{{ text('Customized', 'ปรับแต่งแล้ว') }}</span
                    >
                  </div>
                  <p class="mt-xs text-sm text-text-secondary">{{ presentationSlotDescription(slot) }}</p>
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

              <div :class="['mt-lg grid gap-lg', { 'wide:grid-cols-2': !usesPresentationDesigner }]">
                <div
                  v-if="!advancedSlots.has(slot.key)"
                  :class="[
                    'grid content-start gap-md desktop:grid-cols-2 wide:grid-cols-1',
                    { 'wallet-fixed-structure': usesPresentationDesigner },
                  ]"
                >
                  <div v-if="usesPresentationDesigner" class="wallet-structure-heading desktop:col-span-2 wide:col-span-1">
                    <span>{{ presentationMode === 'EMBED' ? 'Embed 1' : 'Components V2' }}</span>
                    <small>{{ isRobloxPayoutFeature ? text('Actions are fixed by Roblox Payout', 'Action กำหนดโดย Roblox Payout') : isPriceReaderFeature ? text('Result flow is fixed by Price Reader', 'ลำดับผลลัพธ์กำหนดโดย Price Reader') : text('Structure fixed by Wallet Top-up', 'โครงสร้างกำหนดโดย Wallet Top-up') }}</small>
                  </div>
                  <label
                    v-if="presentationMode === 'EMBED'"
                    class="text-sm font-medium desktop:col-span-2 wide:col-span-1"
                    >{{ text('Content', 'ข้อความ') }} <i class="field-counter">{{ valueLength(visualDefinition(slot.key).content) }}/2000</i><textarea
                      :value="String(visualDefinition(slot.key).content ?? '')"
                      rows="3"
                      maxlength="2000"
                      class="field-control mt-xs resize-y py-sm"
                      :placeholder="text('Optional text outside the embed', 'ข้อความเสริมภายนอก Embed (ไม่บังคับ)')"
                      @input="updatePresentation(slot.key, 'content', ($event.target as HTMLTextAreaElement).value)"
                    />
                  </label>
                  <details
                    v-if="presentationMode === 'EMBED'"
                    open
                    class="builder-section builder-accordion desktop:col-span-2 wide:col-span-1"
                  >
                    <summary>{{ text('Author', 'ผู้เขียน') }}</summary>
                    <div class="mt-sm grid gap-xs tablet:grid-cols-2">
                      <label class="component-field tablet:col-span-2"><span>{{ text('Name', 'ชื่อ') }} <i>{{ valueLength(embedObject(slot.key, 'author').name) }}/256</i></span><input
                        :value="String(embedObject(slot.key, 'author').name ?? '')"
                        class="field-control h-10"
                        maxlength="256"
                        :placeholder="text('Author name', 'ชื่อผู้เขียน')"
                        @input="updateEmbedObject(slot.key, 'author', 'name', ($event.target as HTMLInputElement).value)"
                      /></label>
                      <label class="component-field"><span>{{ text('Icon URL', 'URL ไอคอน') }}</span><input
                        :value="String(embedObject(slot.key, 'author').icon_url ?? '')"
                        type="url"
                        class="field-control h-10"
                        :placeholder="text('Author icon URL', 'URL ไอคอนผู้เขียน')"
                        @input="updateEmbedObject(slot.key, 'author', 'icon_url', ($event.target as HTMLInputElement).value)"
                      /></label>
                      <label class="component-field"><span>{{ text('Author URL', 'URL ผู้เขียน') }}</span><input
                        :value="String(embedObject(slot.key, 'author').url ?? '')"
                        type="url"
                        class="field-control h-10"
                        :placeholder="text('Author link URL', 'URL ลิงก์ผู้เขียน')"
                        @input="updateEmbedObject(slot.key, 'author', 'url', ($event.target as HTMLInputElement).value)"
                      /></label>
                    </div>
                  </details>
                  <template v-if="presentationMode === 'COMPONENTS_V2'">
                    <label class="text-sm font-medium">{{ text('Title', 'หัวข้อ') }} <i class="field-counter">{{ valueLength(visualDefinition(slot.key).title) }}/256</i><input
                      :value="String(visualDefinition(slot.key).title ?? '')"
                      maxlength="256"
                      class="field-control mt-xs h-11"
                      @input="updatePresentation(slot.key, 'title', ($event.target as HTMLInputElement).value)"
                    /></label>
                    <label class="text-sm font-medium desktop:col-span-2 wide:col-span-1">{{ text('Description', 'รายละเอียด') }} <i class="field-counter">{{ valueLength(visualDefinition(slot.key).description) }}/4000</i><textarea
                      :value="String(visualDefinition(slot.key).description ?? '')"
                      maxlength="4000"
                      rows="5"
                      class="field-control mt-xs resize-y py-sm"
                      @input="updatePresentation(slot.key, 'description', ($event.target as HTMLTextAreaElement).value)"
                    /></label>
                  </template>
                  <details v-if="presentationMode === 'EMBED'" open class="builder-section builder-accordion desktop:col-span-2 wide:col-span-1">
                    <summary>{{ text('Body', 'เนื้อหา') }}</summary>
                    <div class="mt-sm grid gap-sm tablet:grid-cols-2">
                  <label class="text-sm font-medium"
                    >{{ text('Title', 'หัวข้อ') }} <i class="field-counter">{{ valueLength(visualDefinition(slot.key).title) }}/256</i><input
                      :value="String(visualDefinition(slot.key).title ?? '')"
                      class="field-control mt-xs h-11"
                      maxlength="256"
                      @input="
                        updatePresentation(
                          slot.key,
                          'title',
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                  /></label>
                  <label v-if="presentationMode === 'EMBED'" class="text-sm font-medium"
                    >{{ text('Title URL', 'URL ของหัวข้อ') }}<input
                      :value="String(visualDefinition(slot.key).url ?? '')"
                      type="url"
                      class="field-control mt-xs h-11"
                      placeholder="https://"
                      @input="updatePresentation(slot.key, 'url', ($event.target as HTMLInputElement).value)"
                  /></label>
                  <label class="text-sm font-medium desktop:col-span-2 wide:col-span-1"
                    >{{ text('Description', 'รายละเอียด') }} <i class="field-counter">{{ valueLength(visualDefinition(slot.key).description) }}/4096</i><textarea
                      :value="String(visualDefinition(slot.key).description ?? '')"
                      rows="5"
                      maxlength="4096"
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
                  <div
                    v-if="presentationMode === 'EMBED'"
                    class="tablet:col-span-2"
                  >
                    <span class="text-sm font-medium">{{ text('Embed color', 'สีของ Embed') }}</span>
                    <div class="mt-xs grid grid-cols-[3.5rem_1fr] gap-xs">
                      <input
                        :value="embedColor(slot.key)"
                        type="color"
                        class="field-control h-11 cursor-pointer p-1"
                        :aria-label="text('Choose embed color', 'เลือกสี Embed')"
                        @input="updateEmbedColor(slot.key, ($event.target as HTMLInputElement).value)"
                      />
                      <input
                        :value="embedColor(slot.key)"
                        class="field-control h-11 font-mono uppercase"
                        maxlength="7"
                        placeholder="#5865F2"
                        @change="updateEmbedColor(slot.key, ($event.target as HTMLInputElement).value)"
                      />
                    </div>
                    <p class="mt-xs text-xs text-text-secondary">
                      {{ text('Choose a color or enter a six-digit HEX value.', 'เลือกสีหรือกรอกรหัส HEX จำนวน 6 หลัก') }}
                    </p>
                  </div>
                    </div>
                  </details>
                  <details v-if="presentationMode === 'EMBED'" open class="builder-section builder-accordion desktop:col-span-2 wide:col-span-1">
                    <summary>{{ text('Images', 'รูปภาพ') }}</summary>
                    <div class="mt-sm grid gap-sm tablet:grid-cols-2">
                  <label class="text-sm font-medium"
                    >{{ text('Image URL', 'URL รูปภาพ') }}<input
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
                    >{{ text('Thumbnail URL', 'URL รูปขนาดย่อ') }}<input
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
                    </div>
                  </details>
                  <details v-if="presentationMode === 'EMBED'" open class="builder-section builder-accordion desktop:col-span-2 wide:col-span-1">
                    <summary>{{ text('Footer', 'ส่วนท้าย') }}</summary>
                    <div class="mt-sm grid gap-sm tablet:grid-cols-2">
                  <label class="text-sm font-medium tablet:col-span-2"
                    >{{ text('Footer', 'ข้อความส่วนท้าย') }} <i class="field-counter">{{ valueLength(embedObject(slot.key, 'footer').text) }}/2048</i><input
                      :value="String(embedObject(slot.key, 'footer').text ?? '')"
                      class="field-control mt-xs h-11"
                      maxlength="2048"
                      @input="
                        updateEmbedObject(slot.key, 'footer', 'text', ($event.target as HTMLInputElement).value)
                      "
                  /></label>
                  <label class="text-sm font-medium"
                    >{{ text('Footer icon URL', 'URL ไอคอนส่วนท้าย') }}<input
                      :value="String(embedObject(slot.key, 'footer').icon_url ?? '')"
                      type="url"
                      class="field-control mt-xs h-11"
                      placeholder="https://"
                      @input="updateEmbedObject(slot.key, 'footer', 'icon_url', ($event.target as HTMLInputElement).value)"
                  /></label>
                  <label
                    class="flex items-center gap-sm self-end rounded-md border border-border-subtle p-sm text-sm font-medium"
                  >
                    <input
                      :checked="visualDefinition(slot.key).timestamp === true"
                      type="checkbox"
                      @change="updatePresentation(slot.key, 'timestamp', ($event.target as HTMLInputElement).checked)"
                    />
                    {{ text('Show sent timestamp', 'แสดงเวลาที่ส่งข้อความ') }}
                  </label>
                    </div>
                  </details>
                  <div
                    v-if="fixedActions(slot.key).length"
                    class="builder-section desktop:col-span-2 wide:col-span-1"
                  >
                    <div class="builder-heading">
                      <div>
                        <strong>{{ text('System actions', 'ปุ่มคำสั่งของระบบ') }}</strong>
                        <p>
                          {{ text('The Action ID is locked, but its text, emoji, and color can be customized.', 'ล็อก Action ID ไว้ แต่แก้ข้อความ Emoji และสีของปุ่มได้') }}
                        </p>
                      </div>
                    </div>
                    <div v-for="item in fixedActions(slot.key)" :key="item.action" class="builder-item">
                      <div class="component-role">
                        <strong>{{ item.action }}</strong>
                        <span>{{ text('Action ID · locked', 'Action ID · ล็อกไว้') }}</span>
                      </div>
                      <div class="component-editor-grid">
                        <label class="component-field">
                          <span>{{ text('Text', 'ข้อความ') }}</span>
                          <input
                            :value="String(item.override.label ?? defaultActionLabel(item.defaults.label))"
                            class="field-control h-10"
                            maxlength="80"
                            @input="updateActionOverride(slot.key, item.action, 'label', ($event.target as HTMLInputElement).value)"
                          />
                        </label>
                        <fieldset class="component-field component-style-field">
                          <legend>{{ text('Color', 'สี') }}</legend>
                          <div class="component-style-picker">
                            <button
                              v-for="style in componentStyles"
                              :key="style"
                              type="button"
                              :class="[`component-style--${style}`, { 'component-style--selected': String(item.override.style ?? item.defaults.style) === style }]"
                              :aria-label="style"
                              :aria-pressed="String(item.override.style ?? item.defaults.style) === style"
                              @click="updateActionOverride(slot.key, item.action, 'style', style)"
                            ><Check v-if="String(item.override.style ?? item.defaults.style) === style" :size="16" /></button>
                          </div>
                        </fieldset>
                        <label class="component-field">
                          <span>Emoji</span>
                          <input
                            :value="String(item.override.emoji ?? item.defaults.emoji)"
                            class="field-control h-10"
                            placeholder="💰 หรือ <:name:id>"
                            @input="updateActionOverride(slot.key, item.action, 'emoji', ($event.target as HTMLInputElement).value)"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="presentationMode === 'EMBED'"
                    class="space-y-md desktop:col-span-2 wide:col-span-1"
                  >
                    <details open class="builder-section builder-accordion">
                      <summary>Fields · {{ visualArray(slot.key, 'fields').length }}/25</summary>
                      <div class="builder-heading mt-sm">
                        <p>{{ text('Add title and detail fields (up to 25)', 'เพิ่มข้อมูลแบบชื่อและรายละเอียดได้สูงสุด 25 ช่อง') }}</p>
                        <button type="button" @click="addEmbedField(slot.key)">
                          {{ text('+ Add Field', '+ เพิ่ม Field') }}
                        </button>
                      </div>
                      <details
                        v-for="(field, fieldIndex) in visualArray(slot.key, 'fields')"
                        :key="fieldIndex"
                        open
                        class="builder-item builder-accordion builder-field"
                      >
                        <summary>{{ text('Field', 'ฟิลด์') }} {{ fieldIndex + 1 }}</summary>
                        <div class="mt-sm grid gap-xs">
                          <label class="component-field"><span>{{ text('Name', 'ชื่อ') }} · <b>{{ text('Required', 'จำเป็น') }}</b> · {{ valueLength(field.name) }}/256</span><input
                            :value="String(field.name ?? '')"
                            class="field-control h-10"
                            required
                            maxlength="256"
                            :placeholder="text('Field name', 'ชื่อ Field')"
                            @input="
                              updateEmbedField(
                                slot.key,
                                fieldIndex,
                                'name',
                                ($event.target as HTMLInputElement).value,
                              )
                            "
                          /></label><label class="component-field"><span>{{ text('Value', 'รายละเอียด') }} · <b>{{ text('Required', 'จำเป็น') }}</b> · {{ valueLength(field.value) }}/1024</span><textarea
                            :value="String(field.value ?? '')"
                            rows="3"
                            required
                            maxlength="1024"
                            class="field-control resize-y py-sm"
                            :placeholder="text('Details', 'รายละเอียด')"
                            @input="
                              updateEmbedField(
                                slot.key,
                                fieldIndex,
                                'value',
                                ($event.target as HTMLInputElement).value,
                              )
                            "
                          /></label>
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
                      </details>
                    </details>
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
                      <div class="component-container-caption">
                        <span>{{ text('Message blocks', 'บล็อกในข้อความ') }}</span>
                        <small>{{ componentBlocks(slot.key).length }}/40</small>
                      </div>
                      <div
                        v-for="(block, blockIndex) in componentBlocks(slot.key)"
                        :key="blockIndex"
                        class="builder-item"
                        draggable="true"
                        @dragstart="draggedComponent = { slotKey: slot.key, index: blockIndex }"
                        @dragend="draggedComponent = null"
                        @dragover.prevent
                        @drop.prevent="dropComponentBlock(slot.key, blockIndex)"
                      >
                        <div class="flex items-center gap-xs">
                          <span class="component-drag-handle" :title="text('Drag to reorder', 'ลากเพื่อเรียงลำดับ')">⠿</span>
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
                        <div v-if="block.type === 9" class="mt-xs grid gap-xs tablet:grid-cols-2">
                          <textarea
                            :value="componentBlockValue(block, 'sectionContent')"
                            rows="3"
                            maxlength="4000"
                            class="field-control resize-y py-sm"
                            :placeholder="text('Section content', 'ข้อความ Section')"
                            @input="updateComponentBlock(slot.key, blockIndex, 'sectionContent', ($event.target as HTMLTextAreaElement).value)"
                          />
                          <input
                            :value="componentBlockValue(block, 'accessoryUrl')"
                            class="field-control h-10"
                            placeholder="https://"
                            @input="updateComponentBlock(slot.key, blockIndex, 'accessoryUrl', ($event.target as HTMLInputElement).value)"
                          />
                        </div>
                        <div v-if="block.type === 12" class="mt-xs grid gap-xs">
                          <label v-for="(item, itemIndex) in mediaItems(block)" :key="itemIndex" class="component-field">
                            <span>{{ text('Media', 'สื่อ') }} {{ itemIndex + 1 }}</span>
                            <input
                              :value="mediaItemUrl(item)"
                              class="field-control h-10"
                              placeholder="https://"
                              @input="updateMediaItem(slot.key, blockIndex, itemIndex, ($event.target as HTMLInputElement).value)"
                            />
                          </label>
                          <button type="button" class="builder-add" @click="addMediaItem(slot.key, blockIndex)">+ {{ text('Add media', 'เพิ่ม Media') }}</button>
                        </div>
                        <div v-if="block.type === 14" class="mt-xs grid gap-sm tablet:grid-cols-2">
                          <label class="component-field"><span>{{ text('Size', 'ขนาด') }}</span><select
                            class="field-control h-10"
                            :value="Number(block.spacing ?? 1)"
                            @change="updateSeparator(slot.key, blockIndex, 'spacing', Number(($event.target as HTMLSelectElement).value))"
                          ><option :value="1">{{ text('Small', 'เล็ก') }}</option><option :value="2">{{ text('Large', 'ใหญ่') }}</option></select></label>
                          <label class="flex items-center gap-xs self-end rounded-md border border-border-subtle p-sm text-sm font-medium"><input
                            type="checkbox"
                            :checked="block.divider !== false"
                            @change="updateSeparator(slot.key, blockIndex, 'divider', ($event.target as HTMLInputElement).checked)"
                          />{{ text('Divider line', 'เส้นคั่น') }}</label>
                        </div>
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
                        <div v-if="block.type === 17" class="mt-sm grid gap-sm">
                          <div class="grid gap-sm tablet:grid-cols-[auto_minmax(0,1fr)] tablet:items-end">
                            <label class="flex items-center gap-xs text-sm font-medium">
                              <input
                                type="checkbox"
                                :checked="block.spoiler === true"
                                @change="updateContainerBlock(slot.key, blockIndex, 'spoiler', ($event.target as HTMLInputElement).checked)"
                              />
                              {{ text('Mark as spoiler', 'ทำเครื่องหมายเป็นสปอยล์') }}
                            </label>
                            <label class="component-field">
                              <span>{{ text('Sidebar color', 'สีแถบด้านข้าง') }}</span>
                              <div class="grid grid-cols-[1fr_3rem] gap-xs">
                                <input
                                  :value="String(block.accent_color ?? '#5865f2')"
                                  class="field-control h-10 font-mono"
                                  maxlength="7"
                                  @change="updateContainerBlock(slot.key, blockIndex, 'accent_color', ($event.target as HTMLInputElement).value)"
                                />
                                <input
                                  :value="String(block.accent_color ?? '#5865f2')"
                                  type="color"
                                  class="field-control h-10 cursor-pointer p-1"
                                  @input="updateContainerBlock(slot.key, blockIndex, 'accent_color', ($event.target as HTMLInputElement).value)"
                                />
                              </div>
                            </label>
                          </div>
                          <div class="component-container-children">
                            <div class="component-container-caption">
                              <span>{{ text('Container children', 'Component ภายใน Container') }}</span>
                              <small>{{ containerChildren(block).length }}</small>
                            </div>
                            <div
                              v-for="(child, childIndex) in containerChildren(block)"
                              :key="childIndex"
                              class="builder-item"
                            >
                              <div class="flex items-center gap-xs">
                                <strong class="min-w-0 flex-1 truncate text-sm">{{ blockSummary(child) }}</strong>
                                <button type="button" :disabled="childIndex === 0" @click="moveContainerChild(slot.key, blockIndex, childIndex, -1)">↑</button>
                                <button type="button" :disabled="childIndex === containerChildren(block).length - 1" @click="moveContainerChild(slot.key, blockIndex, childIndex, 1)">↓</button>
                                <button type="button" class="builder-delete" @click="removeContainerChild(slot.key, blockIndex, childIndex)">{{ text('Delete', 'ลบ') }}</button>
                              </div>
                              <textarea
                                v-if="child.type === 10 || child.type === 9"
                                :value="child.type === 10 ? String(child.content ?? '') : componentBlockValue(child, 'sectionContent')"
                                rows="3"
                                class="field-control mt-xs resize-y py-sm"
                                :placeholder="text('Content', 'ข้อความ')"
                                @input="updateContainerChildContent(slot.key, blockIndex, childIndex, ($event.target as HTMLTextAreaElement).value)"
                              />
                              <p v-else class="mt-xs text-xs text-text-muted">
                                {{ text('This child keeps its configured media or button data.', 'บล็อกนี้จะเก็บข้อมูล Media หรือปุ่มที่ตั้งค่าไว้') }}
                              </p>
                            </div>
                            <div class="mt-xs flex flex-wrap gap-xs">
                              <button type="button" class="builder-add" @click="addContainerChild(slot.key, blockIndex, 'text')">+ Content</button>
                              <button type="button" class="builder-add" @click="addContainerChild(slot.key, blockIndex, 'section')">+ Section</button>
                              <button type="button" class="builder-add" @click="addContainerChild(slot.key, blockIndex, 'media')">+ Media</button>
                              <button type="button" class="builder-add" @click="addContainerChild(slot.key, blockIndex, 'separator')">+ Separator</button>
                              <button type="button" class="builder-add" @click="addContainerChild(slot.key, blockIndex, 'link')">+ Link Button</button>
                            </div>
                          </div>
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
                          @click="addComponentBlock(slot.key, 'container')"
                        >
                          + Container</button
                        ><button
                          type="button"
                          class="builder-add"
                          @click="addComponentBlock(slot.key, 'section')"
                        >
                          + {{ text('Section', 'Section') }}</button
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
                    <template v-if="systemComponents(slot.key).length">
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
                  v-if="!usesPresentationDesigner"
                  :definition="presentationPreviewDefinition(slot.key)"
                  :variables="slot.availableVariables"
                  :bot-name="previewBot?.discordUsername || previewBot?.name"
                  :bot-avatar-url="previewBot?.discordAvatarUrl"
                  :sample-values="presentationSampleValues(slot.key)"
                />
              </div>
              </div>
            </article>
            </div>
            <aside v-if="usesPresentationDesigner" class="wallet-builder-preview">
              <div class="wallet-preview-toolbar">
                <span><i /> {{ text('Live preview', 'ตัวอย่างแบบสด') }}</span>
                <div class="wallet-preview-controls">
                  <button
                    type="button"
                    :class="{ 'wallet-preview-scope--active': walletPreviewScope === 'all' }"
                    @click="walletPreviewScope = 'all'"
                  >{{ text('All', 'ทั้งหมด') }}</button>
                  <button
                    type="button"
                    :class="{ 'wallet-preview-scope--active': walletPreviewScope === 'current' }"
                    @click="walletPreviewScope = 'current'"
                  >{{ text('Current', 'ที่กำลังแก้') }}</button>
                  <small>{{ presentationMode === 'EMBED' ? 'Discord Embed' : 'Discord Components V2' }}</small>
                </div>
              </div>
              <div class="wallet-preview-stack">
                <DiscordPresentationPreview
                  v-for="slot in walletPreviewSlots"
                  :key="`preview-${slot.slotId}`"
                  :definition="presentationPreviewDefinition(slot.key)"
                  :variables="slot.availableVariables"
                  :bot-name="previewBot?.discordUsername || previewBot?.name"
                  :bot-avatar-url="previewBot?.discordAvatarUrl"
                  :sample-values="presentationSampleValues(slot.key)"
                  compact
                />
              </div>
            </aside>
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
      <AppModal
        v-model:open="saveConfirmationOpen"
        size="sm"
        :disabled="saving"
        :title="text('Confirm save', 'ยืนยันการบันทึก')"
        :subtitle="text('The new configuration will be used by the bot after saving.', 'บอทจะเริ่มใช้การตั้งค่าใหม่หลังจากบันทึก')"
      >
        <p class="text-sm text-text-secondary">
          {{ text('Save all configuration and message presentation changes?', 'ต้องการบันทึก Config และรูปแบบข้อความที่แก้ไขทั้งหมดหรือไม่?') }}
        </p>
        <template #actions>
          <AppButton variant="secondary" :disabled="saving" @click="saveConfirmationOpen = false">
            {{ text('Cancel', 'ยกเลิก') }}
          </AppButton>
          <AppButton :disabled="saving" @click="confirmSave">
            <Save :size="18" />
            {{ saving ? text('Saving…', 'กำลังบันทึก…') : text('Confirm save', 'ยืนยันบันทึก') }}
          </AppButton>
        </template>
      </AppModal>
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
.wallet-builder-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(22rem, 0.92fr);
  align-items: start;
  gap: var(--space-lg);
}
.wallet-builder-messages {
  display: grid;
  gap: var(--space-sm);
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-elevated);
  padding: var(--space-sm);
}
.wallet-builder-toolbar,
.wallet-preview-toolbar,
.wallet-message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.wallet-builder-toolbar {
  padding: var(--space-sm);
}
.wallet-builder-toolbar p {
  margin-top: var(--space-xxs);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
}
.wallet-builder-toolbar > span,
.wallet-fixed-badge {
  flex: none;
  border-radius: 999px;
  padding: var(--space-xxs) var(--space-xs);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-muted);
  font-size: 0.6875rem;
}
.wallet-message-card {
  overflow: hidden;
  padding: 0;
}
.wallet-message-header {
  width: 100%;
  border: 0;
  padding: var(--space-md);
  background: var(--semantic-color-background-bg-surface);
  color: var(--semantic-color-text-text-primary);
  cursor: pointer;
  font: inherit;
}
.wallet-message-header:hover {
  background: var(--semantic-color-background-bg-surface-hover);
}
.wallet-message-header small {
  display: block;
  overflow: hidden;
  margin-top: var(--space-xxs);
  color: var(--semantic-color-text-text-muted);
  font-family: var(--font-family-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wallet-message-chevron {
  flex: none;
  transition: transform 160ms ease;
}
.wallet-message-chevron--open {
  transform: rotate(180deg);
}
.wallet-message-body {
  padding: var(--space-lg);
  border-top: 1px solid var(--semantic-color-border-border-subtle);
}
.wallet-fixed-structure {
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  padding: var(--space-md);
  background: var(--semantic-color-background-bg-elevated);
}
.wallet-structure-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--semantic-color-border-border-subtle);
  font-weight: var(--typography-font-weight-semibold);
}
.wallet-structure-heading small {
  color: var(--semantic-color-text-text-muted);
  font-weight: var(--typography-font-weight-regular);
}
.wallet-builder-preview {
  position: sticky;
  top: var(--space-md);
  overflow: hidden;
  max-height: calc(100vh - 2rem);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-elevated);
}
.wallet-preview-toolbar {
  padding: var(--space-md);
  border-bottom: 1px solid var(--semantic-color-border-border-subtle);
}
.wallet-preview-toolbar span {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: var(--typography-font-weight-semibold);
}
.wallet-preview-toolbar i {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 999px;
  background: var(--semantic-color-success-success-text);
}
.wallet-preview-toolbar small {
  color: var(--semantic-color-text-text-muted);
}
.wallet-preview-controls {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
.wallet-preview-controls button {
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: 999px;
  padding: var(--space-xxs) var(--space-xs);
  background: var(--semantic-color-background-bg-surface);
  color: var(--semantic-color-text-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-label-small);
}
.wallet-preview-controls button:hover {
  background: var(--semantic-color-background-bg-surface-hover);
}
.wallet-preview-controls .wallet-preview-scope--active {
  border-color: var(--semantic-color-action-borders-border-focus);
  background: var(--semantic-color-action-backgrounds-bg-accent);
  color: var(--semantic-color-action-text-text-on-secondary);
}
.wallet-preview-stack {
  display: grid;
  gap: var(--space-md);
  overflow: auto;
  max-height: calc(100vh - 6rem);
  padding: var(--space-md);
}
.builder-section {
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-md);
  padding: var(--space-md);
  background: var(--semantic-color-background-bg-elevated);
}
.builder-accordion > summary {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  font-size: var(--font-size-label-large);
  font-weight: var(--typography-font-weight-bold);
  list-style: none;
}
.builder-accordion > summary::-webkit-details-marker {
  display: none;
}
.builder-accordion > summary::before {
  content: '›';
  color: var(--semantic-color-text-text-muted);
  font-size: 1.35em;
  transform: rotate(0deg);
  transition: transform 160ms ease;
}
.builder-accordion[open] > summary::before {
  transform: rotate(90deg);
}
.field-counter,
.component-field i {
  color: var(--semantic-color-text-text-muted);
  font-style: normal;
  font-weight: var(--typography-font-weight-regular);
}
.component-style-field {
  min-width: 0;
  border: 0;
  padding: 0;
}
.component-style-field legend {
  margin-bottom: var(--space-xxs);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-semibold);
}
.component-style-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(2.5rem, 1fr));
  gap: var(--space-xs);
}
.component-style-picker button {
  display: grid;
  min-height: 2.5rem;
  place-items: center;
  border: 2px solid transparent;
  border-radius: var(--corner-radius-md);
  color: white;
  cursor: pointer;
}
.component-style-picker .component-style--primary { background: var(--semantic-color-action-backgrounds-bg-accent); }
.component-style-picker .component-style--secondary { background: var(--semantic-color-background-bg-surface-hover); color: var(--semantic-color-text-text-primary) !important; }
.component-style-picker .component-style--success { background: var(--semantic-color-success-success-text); }
.component-style-picker .component-style--danger { background: var(--semantic-color-error-error-text); }
.component-style-picker .component-style--selected {
  border-color: var(--semantic-color-action-borders-border-focus);
  box-shadow: 0 0 0 2px var(--semantic-color-background-bg-surface);
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
.component-container-children {
  margin-top: var(--space-xs);
  margin-left: var(--space-sm);
  border-left: 3px solid var(--semantic-color-action-borders-border-focus);
  padding-left: var(--space-sm);
}
.component-container-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-xs);
  color: var(--semantic-color-text-text-muted);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-semibold);
}
.component-drag-handle {
  flex: none;
  color: var(--semantic-color-text-text-muted);
  cursor: grab;
  font-size: 1.25rem;
  line-height: 1;
}
.builder-item[draggable='true']:active .component-drag-handle {
  cursor: grabbing;
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
  .wallet-builder-layout {
    grid-template-columns: 1fr;
  }
  .wallet-builder-preview {
    position: static;
    max-height: none;
  }
  .wallet-preview-stack {
    max-height: none;
  }
  .wallet-preview-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .wallet-preview-controls {
    width: 100%;
    flex-wrap: wrap;
  }
  .wallet-preview-controls small {
    margin-left: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .presentation-card {
    transition: none;
  }
}
</style>
