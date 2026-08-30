<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImageIcon } from 'lucide-vue-next'

const props = defineProps<{
  definition: Record<string, unknown>
  variables: string[]
  botName?: string | null
  botAvatarUrl?: string | null
  sampleValues?: Record<string, string>
  compact?: boolean
}>()

const { locale, t } = useI18n()
const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)
const activeInteraction = ref('')

function simulateInteraction(action: string, label: string) {
  activeInteraction.value = action
    ? text(`Previewed action: ${label}`, `จำลองคำสั่ง: ${label}`)
    : text(`Previewed component: ${label}`, `จำลอง Component: ${label}`)
}

const mode = computed(() => String(props.definition.mode ?? 'EMBED'))
const content = computed<Record<string, unknown>>(() => {
  if (mode.value === 'EMBED' && isObject(props.definition.embed))
    return { ...props.definition, ...props.definition.embed }
  if (mode.value === 'COMPONENTS_V2' && isObject(props.definition.components_v2))
    return { ...props.definition, ...props.definition.components_v2 }
  return props.definition
})
const actions = computed(() =>
  Array.isArray(props.definition.actions) ? props.definition.actions.map(String) : [],
)
const actionDefaults: Record<string, { label: [string, string]; emoji: string; style: string }> = {
  'wallet.topup': { label: ['Top up', 'เติมเงิน'], emoji: '💰', style: 'success' },
  'wallet.balance': {
    label: ['Check balance', 'เช็คยอดเงินคงเหลือ'],
    emoji: '💳',
    style: 'secondary',
  },
  'wallet.promptpay': { label: ['PromptPay', 'พร้อมเพย์ธนาคาร'], emoji: '🏦', style: 'primary' },
  'wallet.truemoney': {
    label: ['TrueMoney gift', 'ซองอั่งเปาทรูมันนี่'],
    emoji: '🧧',
    style: 'danger',
  },
}
const actionButtons = computed(() => {
  const value = content.value.action_overrides
  const overrides = isObject(value) ? value : {}
  return actions.value.map((action) => {
    const defaults = actionDefaults[action] ?? {
      label: [actionLabel(action), actionLabel(action)] as [string, string],
      emoji: '',
      style: 'secondary',
    }
    const override = isObject(overrides[action]) ? overrides[action] : {}
    return {
      action,
      label: render(override.label ?? text(defaults.label[0], defaults.label[1])),
      emoji: render(override.emoji ?? defaults.emoji),
      style: String(override.style ?? defaults.style),
    }
  })
})
const coFeatures = computed(() =>
  Array.isArray(props.definition.co_features) ? props.definition.co_features.filter(isObject) : [],
)
const systemComponentEntries = computed(() =>
  isObject(props.definition.components)
    ? Object.entries(props.definition.components).flatMap(([role, config]) =>
        isObject(config) ? [{ role, config }] : [],
      )
    : [],
)
const coFeatureRoles: Record<string, string> = {
  'wallet.topup': 'btn_topup',
  'wallet.balance': 'btn_balance',
}
const buttons = computed(() => {
  const delegatedRoles = new Set(
    coFeatures.value.map((item) => coFeatureRoles[String(item.action ?? '')]).filter(Boolean),
  )
  return systemComponentEntries.value
    .filter(({ role, config }) => !delegatedRoles.has(role) && config.label)
    .map(({ config }) => config)
    .slice(0, 5)
})
const selectMenus = computed(() =>
  systemComponentEntries.value
    .filter(({ config }) => config.placeholder && !config.label)
    .map(({ role, config }) => ({ role, config })),
)
const buttonStyles: Record<number, string> = {
  1: 'preview-button--primary',
  2: 'preview-button--secondary',
  3: 'preview-button--success',
  4: 'preview-button--danger',
  5: 'preview-button--link',
}
const links = computed(() =>
  Array.isArray(props.definition.links) ? props.definition.links.filter(isObject) : [],
)
const rawBlocks = computed(() => {
  if (!Array.isArray(content.value.components)) return [] as Array<Record<string, unknown>>
  return content.value.components.filter(isObject)
})
function containerAccentColor(block: Record<string, unknown>) {
  const value = block.accent_color
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#5865f2'
}
function containerChildren(block: Record<string, unknown>) {
  return Array.isArray(block.components) ? block.components.filter(isObject) : []
}
const imageUrl = computed(() => readUrl(content.value.image_url ?? content.value.image))
const thumbnailUrl = computed(() => readUrl(content.value.thumbnail_url ?? content.value.thumbnail))
const embedAccentColor = computed(() => {
  const value = content.value.color
  if (typeof value === 'number' && Number.isInteger(value))
    return `#${value.toString(16).padStart(6, '0').slice(-6)}`
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : '#5865f2'
})
const footerText = computed(() => {
  const footer = content.value.footer
  return isObject(footer) ? render(footer.text) : render(footer)
})
const author = computed(() => (isObject(content.value.author) ? content.value.author : {}))
const footerIconUrl = computed(() => {
  const footer = content.value.footer
  return isObject(footer) ? readUrl(footer.icon_url) : ''
})
const sampleByVariable: Record<string, string> = {
  member_mention: '@Fujipp',
  actor_mention: '@Admin',
  amount: '100.00',
  total: '1,250.00',
  balance: '350.00',
  balance_after: '230.00',
  currency: 'THB',
  minimum_amount: '10.00',
  robux: '400',
  refund: '120.00',
  price: '120.00',
  rate: '3.5',
  status: 'สำเร็จ',
  username: 'FujippPlayer',
  usernameRoblox: 'FujippPlayer',
  roblox_username: 'FujippPlayer',
  roblox_id: '123456789',
  idRoblox: '123456789',
  group_name: 'Fujipp Community',
  group_id: '987654321',
  group_robux: '24,580',
  group_stock: '24,580',
  remaining_time: '04:32',
  payment_method: 'PromptPay (SlipOK)',
  transaction_time: '5 ส.ค. 2569 14:30',
  datetime: '5 ส.ค. 2569 14:30',
  failure_reason: 'ยอดเงินไม่เพียงพอ',
  failure_code: 'INSUFFICIENT_BALANCE',
  reason: 'เติมเครดิตกิจกรรม',
  operation: 'เติมเงิน',
  account_name: 'FUJIPP COMPANY',
  truemoney_fee: '5.00',
  session_id: 'TOPUP-A8F2K9',
  entry_count: '3',
  member_count: '128',
  updated_count: '3',
  image_count: '3',
  message: 'ตรวจสอบข้อมูลเรียบร้อยแล้ว',
  detail: 'ระบบกำลังโอน Robux กรุณารอสักครู่',
  content: 'ตัวอย่างเนื้อหาที่บอทจะส่ง',
  queue: '2',
  stock_lines: 'Fujipp Main Group — 24,580 R$\nFujipp Reserve — 8,420 R$',
  history_lines:
    '• +100.00 THB · PromptPay · วันนี้ 14:30\n• +50.00 THB · TrueMoney · เมื่อวาน 19:45\n• −20.00 THB · ซื้อสินค้า · 3 ส.ค. 12:10',
  leaderboard_lines:
    '🥇 @Minnie — 5,240.00 THB\n🥈 @Nont — 3,890.00 THB\n🥉 @Fujipp — 2,750.00 THB',
  results_text:
    '**iPhone 16 Pro Max 256GB**\nราคา: 39,900 บาท\nจำนวน: 1 ชิ้น\nสถานะ: ✅ พบข้อมูลครบถ้วน\n\n---\n\n**AirPods Pro**\nราคา: 8,990 บาท\nจำนวน: 2 ชิ้น',
  error_lines: 'ไม่พบข้อผิดพลาด',
  error: 'ไม่พบข้อผิดพลาด',
  avatar: '/images/profile/avatar-placeholder.png',
  member_avatar_url: '/images/profile/avatar-placeholder.png',
  qr_url: 'ตัวอย่างรูป QR PromptPay',
  slip_channel_url: '#ตรวจสอบสลิป',
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function readUrl(value: unknown) {
  if (typeof value === 'string') return render(value)
  if (isObject(value) && typeof value.url === 'string') return render(value.url)
  return ''
}
function isPreviewImageUrl(value: string) {
  return /^(https?:\/\/|\/)/.test(value)
}
function render(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\{\{([^}]+)}}/g, (_, key: string) => sampleValue(key))
}
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
function renderDiscordEmoji(value: unknown) {
  return escapeHtml(render(value)).replace(
    /&lt;(a?):([\w~]+):(\d+)&gt;/g,
    (_, animated: string, name: string, id: string) =>
      `<img class="discord-custom-emoji" src="https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=48&amp;quality=lossless" alt=":${name}:" title=":${name}:" />`,
  )
}
function renderInlineMarkdown(value: string) {
  return renderDiscordEmoji(value)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<u>$1</u>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
}
function renderMarkdown(value: unknown) {
  return render(value)
    .split('\n')
    .map((line) => {
      const subtext = line.match(/^-#\s+(.+)$/)
      if (subtext)
        return `<div class="discord-subtext">${renderInlineMarkdown(subtext[1] ?? '')}</div>`
      const heading = line.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        const level = heading[1]?.length ?? 1
        return `<h${level}>${renderInlineMarkdown(heading[2] ?? '')}</h${level}>`
      }
      const quote = line.match(/^>\s?(.*)$/)
      if (quote) return `<blockquote>${renderInlineMarkdown(quote[1] ?? '')}</blockquote>`
      const listItem = line.match(/^[-*]\s+(.+)$/)
      if (listItem)
        return `<div class="discord-list-item">${renderInlineMarkdown(listItem[1] ?? '')}</div>`
      if (!line.trim()) return '<div class="discord-line-break"></div>'
      return `<div>${renderInlineMarkdown(line)}</div>`
    })
    .join('')
}
function sampleValue(key: string) {
  if (props.sampleValues?.[key] !== undefined) return props.sampleValues[key]
  if (sampleByVariable[key]) return sampleByVariable[key]
  if (key.endsWith('_count')) return '3'
  if (key.endsWith('_amount') || key.includes('balance') || key.includes('price')) return '100.00'
  if (key.endsWith('_url')) return `ตัวอย่าง ${key.replace(/_/g, ' ')}`
  if (key.endsWith('_lines') || key.endsWith('_text'))
    return `ตัวอย่างข้อมูล ${key.replace(/_/g, ' ')}`
  if (key.includes('name') || key.includes('username')) return 'Fujipp Example'
  if (key.includes('time') || key.includes('date')) return '5 ส.ค. 2569 14:30'
  return `ตัวอย่าง ${key.replace(/_/g, ' ')}`
}
function actionLabel(value: string) {
  const parts = value.split('.')
  return (parts[parts.length - 1] ?? value).replace(/-/g, ' ')
}
function blockMediaUrls(block: Record<string, unknown>) {
  if (!Array.isArray(block.items)) return []
  return block.items.flatMap((item) => {
    if (!isObject(item) || !isObject(item.media) || typeof item.media.url !== 'string') return []
    return [render(item.media.url)]
  })
}
function sectionContent(block: Record<string, unknown>) {
  const first = Array.isArray(block.components) ? block.components[0] : null
  return isObject(first) ? first.content : ''
}
function sectionAccessoryUrl(block: Record<string, unknown>) {
  return isObject(block.accessory) && isObject(block.accessory.media)
    ? readUrl(block.accessory.media.url)
    : ''
}
function blockButtons(block: Record<string, unknown>) {
  return Array.isArray(block.components) ? block.components.filter(isObject) : []
}
function buttonClass(button: Record<string, unknown>) {
  const namedStyles: Record<string, number> = {
    primary: 1,
    secondary: 2,
    success: 3,
    danger: 4,
    link: 5,
  }
  const raw = button.style ?? 2
  const style =
    typeof raw === 'string' ? (namedStyles[raw.toLowerCase()] ?? Number(raw)) : Number(raw)
  return buttonStyles[style] ?? buttonStyles[2]
}
function buttonEmoji(button: Record<string, unknown>) {
  const emoji = button.emoji
  if (typeof emoji === 'string') return render(emoji)
  if (isObject(emoji)) return render(emoji.name ?? '')
  return ''
}
function coFeatureButtonClass(item: Record<string, unknown>) {
  const styles: Record<string, number> = { primary: 1, secondary: 2, success: 3, danger: 4 }
  return buttonStyles[styles[String(item.style ?? 'secondary')] ?? 2]
}
function actionButtonClass(style: string) {
  const styles: Record<string, number> = { primary: 1, secondary: 2, success: 3, danger: 4 }
  return buttonStyles[styles[style.toLowerCase()] ?? 2]
}
</script>

<template>
  <div :class="['preview-shell', { 'preview-shell--compact': compact }]">
    <div v-if="!compact" class="preview-toolbar">
      <span class="preview-dot" /><strong>Live preview</strong
      ><span>{{ mode === 'EMBED' ? 'Discord Embed' : 'Discord Components V2' }}</span>
    </div>
    <div class="preview-chat">
      <div class="preview-avatar">
        <img v-if="botAvatarUrl" :src="botAvatarUrl" :alt="`${botName ?? 'Bot'} avatar`" />
        <span v-else>{{ (botName ?? 'F').slice(0, 1).toUpperCase() }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="preview-author">
          {{ botName || 'Fujipp Bot' }} <span>APP</span> <time>วันนี้ เวลา 14:30</time>
        </p>
        <div
          v-if="mode === 'EMBED' && content.content"
          class="preview-message-content discord-markdown"
          v-html="renderMarkdown(content.content)"
        />
        <div
          v-if="mode === 'EMBED'"
          class="preview-embed"
          :style="{ borderLeftColor: embedAccentColor }"
        >
          <div class="min-w-0">
            <div v-if="author.name" class="preview-embed-author">
              <img v-if="readUrl(author.icon_url)" :src="readUrl(author.icon_url)" alt="" />
              <span v-html="renderDiscordEmoji(author.name)" />
            </div>
            <h4 v-if="content.title">
              <a
                v-if="readUrl(content.url)"
                :href="readUrl(content.url)"
                target="_blank"
                rel="noreferrer"
                v-html="renderDiscordEmoji(content.title)"
              />
              <span v-else v-html="renderDiscordEmoji(content.title)" />
            </h4>
            <div
              v-if="content.description"
              class="preview-copy discord-markdown"
              v-html="renderMarkdown(content.description)"
            />
            <div v-if="Array.isArray(content.fields)" class="preview-fields">
              <div v-for="(field, index) in content.fields" :key="index">
                <strong v-html="renderDiscordEmoji(isObject(field) ? field.name : '')" />
                <div
                  class="discord-markdown"
                  v-html="renderMarkdown(isObject(field) ? field.value : '')"
                />
              </div>
            </div>
            <img
              v-if="imageUrl && isPreviewImageUrl(imageUrl)"
              :src="imageUrl"
              alt=""
              class="preview-image"
            />
            <div v-else-if="imageUrl" class="preview-image-placeholder">
              <ImageIcon :size="24" /> {{ imageUrl }}
            </div>
            <p v-if="footerText || content.timestamp" class="preview-footer">
              <img v-if="footerIconUrl" :src="footerIconUrl" alt="" />
              <span v-if="footerText" v-html="renderDiscordEmoji(footerText)" />
              <span v-if="footerText && content.timestamp"> • </span>
              <span v-if="content.timestamp">{{ t('botSettings.todayAt1430') }}</span>
            </p>
          </div>
          <img
            v-if="thumbnailUrl && isPreviewImageUrl(thumbnailUrl)"
            :src="thumbnailUrl"
            alt=""
            class="preview-thumbnail"
          />
        </div>
        <div v-else class="preview-components">
          <h4 v-if="content.title" v-html="renderDiscordEmoji(content.title)" />
          <div
            v-if="content.description"
            class="preview-copy discord-markdown"
            v-html="renderMarkdown(content.description)"
          />
          <template v-for="(block, index) in rawBlocks" :key="index">
            <div
              v-if="block.type === 10"
              class="preview-copy discord-markdown"
              v-html="renderMarkdown(block.content)"
            />
            <div v-else-if="block.type === 9" class="preview-section">
              <div
                class="preview-copy discord-markdown"
                v-html="renderMarkdown(sectionContent(block))"
              />
              <img
                v-if="isPreviewImageUrl(sectionAccessoryUrl(block))"
                :src="sectionAccessoryUrl(block)"
                alt=""
              />
            </div>
            <hr
              v-else-if="block.type === 14 && block.divider !== false"
              class="preview-separator"
            />
            <div v-else-if="block.type === 14" class="preview-space" />
            <div v-else-if="block.type === 12" class="preview-gallery">
              <template v-for="(url, mediaIndex) in blockMediaUrls(block)" :key="mediaIndex">
                <img v-if="isPreviewImageUrl(url)" :src="url" alt="" />
                <div v-else class="preview-image-placeholder">
                  <ImageIcon :size="24" /> {{ url || 'Media' }}
                </div>
              </template>
            </div>
            <div v-else-if="block.type === 1" class="preview-actions">
              <button
                v-for="(button, buttonIndex) in blockButtons(block)"
                :key="buttonIndex"
                type="button"
                :class="buttonClass(button)"
                @click="
                  simulateInteraction(
                    String(button.custom_id ?? ''),
                    render(button.label ?? t('botSettings.action')),
                  )
                "
              >
                <span v-if="buttonEmoji(button)" v-html="renderDiscordEmoji(buttonEmoji(button))" />
                <span
                  v-html="
                    renderDiscordEmoji(
                      button.label ?? button.placeholder ?? t('botSettings.openLink'),
                    )
                  "
                />
              </button>
            </div>
            <div
              v-else-if="block.type === 17"
              :class="[
                'preview-container',
                { 'preview-components--spoiler': block.spoiler === true },
              ]"
              :style="{ borderLeftColor: containerAccentColor(block) }"
            >
              <template v-for="(child, childIndex) in containerChildren(block)" :key="childIndex">
                <div
                  v-if="child.type === 10"
                  class="preview-copy discord-markdown"
                  v-html="renderMarkdown(child.content)"
                />
                <div v-else-if="child.type === 9" class="preview-section">
                  <div
                    class="preview-copy discord-markdown"
                    v-html="renderMarkdown(sectionContent(child))"
                  />
                  <img
                    v-if="isPreviewImageUrl(sectionAccessoryUrl(child))"
                    :src="sectionAccessoryUrl(child)"
                    alt=""
                  />
                </div>
                <hr
                  v-else-if="child.type === 14 && child.divider !== false"
                  class="preview-separator"
                />
                <div v-else-if="child.type === 14" class="preview-space" />
                <div v-else-if="child.type === 12" class="preview-gallery">
                  <template v-for="(url, mediaIndex) in blockMediaUrls(child)" :key="mediaIndex">
                    <img v-if="isPreviewImageUrl(url)" :src="url" alt="" />
                    <div v-else class="preview-image-placeholder">
                      <ImageIcon :size="24" /> {{ url || 'Media' }}
                    </div>
                  </template>
                </div>
                <div v-else-if="child.type === 1" class="preview-actions">
                  <button
                    v-for="(button, buttonIndex) in blockButtons(child)"
                    :key="buttonIndex"
                    type="button"
                    :class="buttonClass(button)"
                    @click="
                      simulateInteraction(
                        String(button.custom_id ?? ''),
                        render(button.label ?? t('botSettings.action')),
                      )
                    "
                  >
                    <span
                      v-if="buttonEmoji(button)"
                      v-html="renderDiscordEmoji(buttonEmoji(button))"
                    />
                    <span
                      v-html="
                        renderDiscordEmoji(
                          button.label ?? button.placeholder ?? t('botSettings.openLink'),
                        )
                      "
                    />
                  </button>
                </div>
              </template>
            </div>
          </template>
          <img
            v-if="imageUrl && isPreviewImageUrl(imageUrl)"
            :src="imageUrl"
            alt=""
            class="preview-image"
          />
          <div v-else-if="imageUrl" class="preview-image-placeholder">
            <ImageIcon :size="24" /> {{ imageUrl }}
          </div>
          <p v-if="content.footer" class="preview-footer">{{ render(content.footer) }}</p>
          <div
            v-if="
              actions.length ||
              buttons.length ||
              selectMenus.length ||
              links.length ||
              coFeatures.length
            "
            class="preview-actions"
          >
            <button
              v-for="action in actionButtons"
              :key="action.action"
              type="button"
              :class="actionButtonClass(action.style)"
              @click="simulateInteraction(action.action, action.label)"
            >
              <span v-if="action.emoji" v-html="renderDiscordEmoji(action.emoji)" /><span
                v-html="renderDiscordEmoji(action.label)"
              />
            </button>
            <button
              v-for="(button, index) in buttons"
              :key="`component-button-${index}`"
              type="button"
              :class="buttonClass(button)"
              @click="
                simulateInteraction(
                  String(button.custom_id ?? ''),
                  render(button.label ?? button.placeholder ?? 'Action'),
                )
              "
            >
              <span
                v-if="buttonEmoji(button)"
                v-html="renderDiscordEmoji(buttonEmoji(button))"
              /><span v-html="renderDiscordEmoji(button.label ?? button.placeholder ?? 'Action')" />
            </button>
            <button
              v-for="item in selectMenus"
              :key="`component-select-${item.role}`"
              type="button"
              class="preview-select-menu"
              @click="simulateInteraction(item.role, render(item.config.placeholder))"
            >
              <span v-html="renderDiscordEmoji(item.config.placeholder)" /><span aria-hidden="true"
                >⌄</span
              >
            </button>
            <a
              v-for="(link, index) in links"
              :key="`component-link-${index}`"
              :href="readUrl(link.url) || undefined"
              target="_blank"
              rel="noreferrer"
              class="preview-button--link"
              ><span v-if="link.emoji" v-html="renderDiscordEmoji(link.emoji)" /><span
                v-html="renderDiscordEmoji(link.label ?? t('botSettings.openLink'))"
            /></a>
            <button
              v-for="item in coFeatures"
              :key="`component-co-${String(item.action)}`"
              type="button"
              :class="coFeatureButtonClass(item)"
              @click="simulateInteraction(String(item.action), render(item.label ?? item.action))"
            >
              <span v-if="item.emoji" v-html="renderDiscordEmoji(item.emoji)" /><span
                v-html="renderDiscordEmoji(item.label ?? item.action)"
              />
            </button>
          </div>
        </div>
        <div
          v-if="
            mode === 'EMBED' &&
            (actions.length ||
              buttons.length ||
              selectMenus.length ||
              links.length ||
              coFeatures.length)
          "
          class="preview-actions"
        >
          <button
            v-for="action in actionButtons"
            :key="action.action"
            type="button"
            :class="actionButtonClass(action.style)"
            @click="simulateInteraction(action.action, action.label)"
          >
            <span v-if="action.emoji" v-html="renderDiscordEmoji(action.emoji)" />
            <span v-html="renderDiscordEmoji(action.label)" /></button
          ><button
            v-for="(button, index) in buttons"
            :key="index"
            type="button"
            :class="buttonClass(button)"
            @click="
              simulateInteraction(
                String(button.custom_id ?? ''),
                render(button.label ?? button.placeholder ?? 'Action'),
              )
            "
          >
            <span v-if="buttonEmoji(button)" v-html="renderDiscordEmoji(buttonEmoji(button))" />
            <span v-html="renderDiscordEmoji(button.label ?? button.placeholder ?? 'Action')" />
          </button>
          <button
            v-for="item in selectMenus"
            :key="`select-${item.role}`"
            type="button"
            class="preview-select-menu"
            @click="simulateInteraction(item.role, render(item.config.placeholder))"
          >
            <span v-html="renderDiscordEmoji(item.config.placeholder)" /><span aria-hidden="true"
              >⌄</span
            >
          </button>
          <a
            v-for="(link, index) in links"
            :key="`link-${index}`"
            :href="readUrl(link.url) || undefined"
            target="_blank"
            rel="noreferrer"
            class="preview-button--link"
            @click="
              !readUrl(link.url) &&
              simulateInteraction('', render(link.label ?? t('botSettings.openLink')))
            "
          >
            <span v-if="link.emoji" v-html="renderDiscordEmoji(link.emoji)" />
            <span v-html="renderDiscordEmoji(link.label ?? t('botSettings.openLink'))" />
          </a>
          <button
            v-for="item in coFeatures"
            :key="String(item.action)"
            type="button"
            :class="coFeatureButtonClass(item)"
            @click="simulateInteraction(String(item.action), render(item.label ?? item.action))"
          >
            <span v-if="item.emoji" v-html="renderDiscordEmoji(item.emoji)" />
            <span v-html="renderDiscordEmoji(item.label ?? item.action)" />
          </button>
        </div>
        <p v-if="activeInteraction" class="preview-interaction" role="status">
          {{ activeInteraction }}
        </p>
      </div>
    </div>
    <p v-if="!compact" class="preview-note">
      {{ t('botSettings.liveSampleGeneratedFromTheCurrentSettings') }}
    </p>
  </div>
</template>

<style scoped>
.preview-shell {
  --discord-canvas: #ffffff;
  --discord-surface: #f2f3f5;
  --discord-surface-strong: #e3e5e8;
  --discord-text: #060607;
  --discord-muted: #5c5e66;
  --discord-border: #d5d8dc;
  --discord-code: #e3e5e8;
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  background: var(--discord-canvas);
  color: var(--discord-text);
}
:global([data-theme='dark'] .preview-shell),
:global(.dark .preview-shell) {
  --discord-canvas: #313338;
  --discord-surface: #2b2d31;
  --discord-surface-strong: #232428;
  --discord-text: #dbdee1;
  --discord-muted: #949ba4;
  --discord-border: #3f4147;
  --discord-code: #1e1f22;
}
@media (prefers-color-scheme: dark) {
  :global([data-theme='system'] .preview-shell) {
    --discord-canvas: #313338;
    --discord-surface: #2b2d31;
    --discord-surface-strong: #232428;
    --discord-text: #dbdee1;
    --discord-muted: #949ba4;
    --discord-border: #3f4147;
    --discord-code: #1e1f22;
  }
}
.preview-shell--compact {
  border: 0;
  border-radius: 0;
  background: transparent;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--discord-surface-strong);
  background: var(--discord-surface);
  font-size: 0.75rem;
}
.preview-toolbar span:last-child {
  margin-left: auto;
  color: var(--discord-muted);
}
.preview-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: #23a559;
}
.preview-chat {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-lg);
}
.preview-shell--compact .preview-chat {
  padding: var(--space-sm);
}
.preview-avatar {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: #5865f2;
  color: white;
  font-weight: 700;
}
.preview-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-author {
  margin-bottom: 0.25rem;
  color: var(--discord-text);
  font-weight: 600;
}
.preview-author span {
  margin-left: 0.25rem;
  border-radius: 0.2rem;
  padding: 0.1rem 0.25rem;
  background: #5865f2;
  color: white;
  font-size: 0.6rem;
}
.preview-author time {
  color: var(--discord-muted);
  font-size: 0.7rem;
  font-weight: 400;
}
.preview-embed {
  display: grid;
  max-width: 32rem;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  border-left: 4px solid #5865f2;
  border-radius: 0.25rem;
  padding: 0.75rem 1rem;
  background: var(--discord-surface);
}
.preview-message-content {
  max-width: 40rem;
  margin-bottom: 0.35rem;
}
.preview-embed-author {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
  color: var(--discord-text);
  font-size: 0.75rem;
  font-weight: 600;
}
.preview-embed-author img,
.preview-footer img {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  object-fit: cover;
}
.preview-embed h4 a {
  color: #00a8fc;
  text-decoration: none;
}
.preview-components {
  max-width: 32rem;
  display: grid;
  gap: 0.5rem;
}
.preview-container {
  border: 1px solid var(--discord-border);
  border-radius: 0.5rem;
  padding: 1rem;
  background: var(--discord-surface);
  border-left: 4px solid #5865f2;
}
.preview-components--spoiler > * {
  filter: blur(0.25rem);
}
.preview-components--spoiler:hover > * {
  filter: none;
}
.preview-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
}
.preview-section img {
  width: 5rem;
  height: 5rem;
  border-radius: 0.25rem;
  object-fit: cover;
}
.preview-gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  margin-top: 0.75rem;
}
.preview-gallery > img {
  width: 100%;
  height: 8rem;
  border-radius: 0.25rem;
  object-fit: cover;
}
h4 {
  color: var(--discord-text);
  font-weight: 700;
}
.preview-copy {
  margin-top: 0.35rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  line-height: 1.35rem;
}
:deep(.discord-markdown h1),
:deep(.discord-markdown h2),
:deep(.discord-markdown h3) {
  margin: 0.5rem 0 0;
  color: var(--discord-text);
  font-weight: 700;
  line-height: 1.25;
}
:deep(.discord-markdown h1:first-child),
:deep(.discord-markdown h2:first-child),
:deep(.discord-markdown h3:first-child) {
  margin-top: 0;
}
:deep(.discord-markdown h1) {
  font-size: 1.5rem;
}
:deep(.discord-markdown h2) {
  font-size: 1.25rem;
}
:deep(.discord-markdown h3) {
  font-size: 1rem;
}
:deep(.discord-markdown code) {
  border-radius: 0.2rem;
  padding: 0.1rem 0.25rem;
  background: var(--discord-code);
  font-family: var(--font-family-mono);
  font-size: 0.85em;
}
:deep(.discord-markdown blockquote) {
  margin: 0.25rem 0;
  border-left: 4px solid var(--discord-muted);
  padding-left: 0.75rem;
}
:deep(.discord-markdown .discord-list-item) {
  position: relative;
  padding-left: 1rem;
}
:deep(.discord-markdown .discord-list-item)::before {
  position: absolute;
  left: 0.25rem;
  content: '•';
}
:deep(.discord-markdown .discord-subtext) {
  color: var(--discord-muted);
  font-size: 0.6875rem;
  font-weight: 400;
  line-height: 0.9375rem;
}
:deep(.discord-markdown .discord-line-break) {
  height: 0.5rem;
}
.preview-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.8rem;
}
.preview-fields p {
  white-space: pre-wrap;
}
.preview-image {
  max-width: 100%;
  max-height: 18rem;
  margin-top: 0.75rem;
  border-radius: 0.25rem;
  object-fit: cover;
}
.preview-thumbnail {
  width: 5rem;
  height: 5rem;
  border-radius: 0.25rem;
  object-fit: cover;
}
.preview-image-placeholder {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.75rem;
  border: 1px dashed var(--discord-border);
  border-radius: 0.25rem;
  padding: 0.75rem;
  color: var(--discord-muted);
  font-size: 0.75rem;
}
.preview-footer {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.75rem;
  color: var(--discord-muted);
  font-size: 0.7rem;
}
.preview-separator {
  margin-block: 0.75rem;
  border: 0;
  border-top: 1px solid var(--discord-border);
}
.preview-space {
  height: 0.75rem;
}
.preview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
:deep(.discord-custom-emoji) {
  display: inline-block;
  width: 1.375em;
  height: 1.375em;
  margin-inline: 0.05em;
  vertical-align: -0.32em;
  object-fit: contain;
}
.preview-actions :deep(.discord-custom-emoji) {
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  vertical-align: middle;
}
.preview-actions button,
.preview-actions a {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 0;
  border-radius: 0.2rem;
  padding: 0.45rem 0.8rem;
  background: var(--discord-surface-strong);
  color: var(--discord-text);
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: none;
  transition:
    filter 120ms ease,
    transform 120ms ease;
}
.preview-actions .preview-select-menu {
  min-width: min(25rem, 100%);
  justify-content: space-between;
  border: 1px solid var(--discord-border);
  background: var(--discord-canvas);
}
.preview-actions button:hover,
.preview-actions a:hover {
  filter: brightness(1.12);
}
.preview-actions button:active,
.preview-actions a:active {
  transform: translateY(1px);
}
.preview-actions button:focus-visible,
.preview-actions a:focus-visible {
  outline: 2px solid #00a8fc;
  outline-offset: 2px;
}
.preview-actions .preview-button--primary {
  background: #5865f2;
  color: white;
}
.preview-actions .preview-button--secondary {
  background: var(--discord-surface-strong);
  color: var(--discord-text);
}
.preview-actions .preview-button--success {
  background: #248046;
  color: white;
}
.preview-actions .preview-button--danger {
  background: #da373c;
  color: white;
}
.preview-actions .preview-button--link {
  background: var(--discord-surface-strong);
  color: var(--discord-text);
}
.preview-interaction {
  width: fit-content;
  margin-top: 0.6rem;
  border-radius: 0.25rem;
  padding: 0.35rem 0.55rem;
  background: var(--discord-code);
  color: var(--discord-muted);
  font-size: 0.7rem;
}
.preview-note {
  padding: 0 var(--space-md) var(--space-md);
  color: var(--discord-muted);
  font-size: 0.7rem;
}
</style>
