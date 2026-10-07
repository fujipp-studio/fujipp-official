<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImageIcon } from 'lucide-vue-next'
import DiscordComponentBlock from './DiscordComponentBlock.vue'
import DiscordPreviewLinkButton from './DiscordPreviewLinkButton.vue'
import DiscordPreviewButton from './DiscordPreviewButton.vue'
import DiscordPreviewImage from './DiscordPreviewImage.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import twemoji from '@twemoji/api'
import { walletActionDefaults } from '../config/feature-editor'

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
const previewTheme = ref('app')
const themeOptions = computed(() => [
  { value: 'app', label: text('Follow website', 'ตามธีมเว็บ') },
  { value: 'light', label: 'Discord Light' },
  { value: 'dark', label: 'Discord Dark' },
  { value: 'onyx', label: 'Discord Onyx' },
])
const previewThemeStyles = computed(() => {
  const palettes: Record<string, string[]> = {
    light: [
      '#ffffff',
      '#f2f3f5',
      '#e3e5e8',
      '#060607',
      '#5c5e66',
      '#d5d8dc',
      '#e3e5e8',
      '#3e489f',
      '#5865f226',
      '#97979f33',
      '#97979f3d',
    ],
    dark: [
      '#313338',
      '#2b2d31',
      '#232428',
      '#dbdee1',
      '#949ba4',
      '#3f4147',
      '#1e1f22',
      '#c9cdfb',
      '#5865f24d',
      '#97979f0a',
      '#97979f33',
    ],
    onyx: [
      '#070709',
      '#0a0a0a',
      '#121214',
      '#dbdee1',
      '#94949c',
      '#2b2b2f',
      '#171719',
      '#c9cdfb',
      '#5865f24d',
      '#97979f0a',
      '#97979f33',
    ],
  }
  const keys = [
    'canvas',
    'surface',
    'surface-strong',
    'text',
    'muted',
    'border',
    'code',
    'mention-text',
    'mention-background',
    'button-secondary-border',
    'button-secondary-active',
  ]
  const palette = palettes[previewTheme.value]
  return palette ? Object.fromEntries(keys.map((key, i) => [`--discord-${key}`, palette[i]])) : {}
})

function simulateInteraction(action: string, label: string) {
  activeInteraction.value = action
    ? text(`Previewed action: ${label}`, `จำลองคำสั่ง: ${label}`)
    : text(`Previewed component: ${label}`, `จำลอง Component: ${label}`)
}

const mode = computed(() => String(props.definition.mode ?? 'EMBED'))
const content = computed<Record<string, unknown>>(() => {
  if (mode.value === 'EMBED' && Array.isArray(props.definition.embeds)) {
    const first = props.definition.embeds[0]
    return { ...(isObject(first) ? first : {}), content: props.definition.content }
  }
  if (mode.value === 'EMBED' && isObject(props.definition.embed))
    return { ...props.definition, ...props.definition.embed }
  if (mode.value === 'COMPONENTS_V2' && isObject(props.definition.components_v2))
    return { ...props.definition, ...props.definition.components_v2 }
  return props.definition
})
const actions = computed(() =>
  Array.isArray(content.value.actions) ? content.value.actions.map(String) : [],
)
const actionButtons = computed(() => {
  const value = content.value.action_overrides
  const overrides = isObject(value) ? value : {}
  return actions.value.map((action) => {
    const defaults = walletActionDefaults[action] ?? {
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
const imageUrl = computed(() => readUrl(content.value.image_url ?? content.value.image))
const thumbnailUrl = computed(() => readUrl(content.value.thumbnail_url ?? content.value.thumbnail))
const embedFields = computed(() => {
  const fields = Array.isArray(content.value.fields) ? content.value.fields.filter(isObject) : []
  const result: Array<{ field: Record<string, unknown>; span: number }> = []
  const columns = thumbnailUrl.value ? 2 : 3
  for (let index = 0; index < fields.length;) {
    const field = fields[index]!
    if (field.inline !== true) {
      result.push({ field, span: 12 })
      index += 1
      continue
    }
    const row: Record<string, unknown>[] = []
    while (row.length < columns && fields[index]?.inline === true) {
      row.push(fields[index++]!)
    }
    result.push(...row.map((item) => ({ field: item, span: 12 / row.length })))
  }
  return result
})
const embedAccentColor = computed(() => {
  const value = content.value.color
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff)
    return `#${value.toString(16).padStart(6, '0')}`
  const hex = typeof value === 'string' ? value.trim().replace(/^#/, '') : ''
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : 'var(--discord-border)'
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
  member_mention: '<@123456789012345678>',
  actor_mention: '<@123456789012345679>',
  amount: '100.00',
  total: '1,250.00',
  balance: '350.00',
  balance_after: '230.00',
  currency: 'THB',
  minimum_amount: '10.00',
  robux: '400',
  refund: '120.00',
  package: '400 Robux',
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
  return value
    .replace(/\{\{#(\w+)}}([\s\S]*?)\{\{\/\1}}/g, (_, key: string, content: string) =>
      sampleValue(key) ? content : '',
    )
    .replace(/\{\{([^}]+)}}/g, (_, key: string) => sampleValue(key))
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
  return renderEmojiHtml(escapeHtml(render(value)))
}
function renderEmojiHtml(html: string) {
  // Parse text only: emoji inside Markdown links or generated attributes must not
  // alter the HTML. Retain Unicode as accessible text beside decorative artwork.
  let inCode = false
  return html
    .split(/(<[^>]*>)/g)
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<code\b/.test(part)) inCode = true
        if (part.startsWith('</code>')) inCode = false
        return part
      }
      if (inCode) return part
      const mentions = part.replace(/&lt;@!?(\d+)&gt;/g, (_, id: string) => {
        const memberId = sampleValue('member_mention').match(/^<@!?(\d+)>$/)?.[1]
        const actorId = sampleValue('actor_mention').match(/^<@!?(\d+)>$/)?.[1]
        const name = id === memberId ? 'Fujipp' : id === actorId ? 'Admin' : 'User'
        return `<span class="discord-mention">@${name}</span>`
      })
      const customEmoji = mentions.replace(
        /&lt;(a?):([\w~]+):(\d+)&gt;/g,
        (_, animated: string, name: string, id: string) =>
          `<img class="discord-custom-emoji" src="https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=48&amp;quality=lossless" alt=":${name}:" title=":${name}:" />`,
      )
      return twemoji
        .parse(customEmoji, {
          base: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/',
          folder: 'svg',
          ext: '.svg',
          className: 'discord-unicode-emoji',
        })
        .replace(
          /<img ([^>]*?)alt="([^"]*)"([^>]*?)>/g,
          '<span class="sr-only">$2</span><img $1alt="" aria-hidden="true"$3>',
        )
    })
    .join('')
}
function renderInlineMarkdown(value: string) {
  return renderEmojiHtml(
    escapeHtml(render(value))
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<u>$1</u>')
      .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>'),
  )
}
function renderMarkdown(value: unknown) {
  return render(value)
    .trimEnd()
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
  <div class="preview-appearance">
    <AppTextField
      variant="dropdown"
      :label="text('Preview theme', 'ธีมตัวอย่าง')"
      :model-value="previewTheme"
      :options="themeOptions"
      @update:model-value="previewTheme = $event"
    />
    <a
      class="text-xs text-text-secondary underline"
      href="https://github.com/jdecked/twemoji/blob/v17.0.3/LICENSE-GRAPHICS"
      target="_blank"
      rel="noreferrer"
      title="Twemoji graphics by Twitter and contributors · CC BY 4.0"
      >Emoji: Twemoji</a
    >
  </div>
  <div
    :class="['preview-shell', { 'preview-shell--compact': compact }]"
    :style="previewThemeStyles"
  >
    <div v-if="!compact" class="preview-toolbar">
      <span class="preview-dot" /><strong>Live preview</strong
      ><span>{{ mode === 'EMBED' ? 'Discord Embed' : 'Discord Components V2' }}</span>
    </div>
    <div class="preview-chat">
      <div class="preview-avatar" :class="{ 'preview-avatar--fallback': !botAvatarUrl }">
        <img v-if="botAvatarUrl" :src="botAvatarUrl" :alt="`${botName ?? 'Bot'} avatar`" />
        <span v-else>{{ (botName ?? 'F').slice(0, 1).toUpperCase() }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="preview-author">
          <strong>{{ botName || 'Fujipp Bot' }}</strong>
          <span>APP</span> <time datetime="14:30">14:30</time>
        </p>
        <div
          v-if="mode === 'EMBED' && content.content"
          class="preview-message-content discord-markdown"
          v-html="renderMarkdown(content.content)"
        />
        <div
          v-if="mode === 'EMBED'"
          class="preview-embed"
          :class="{ 'preview-embed--thumbnail': thumbnailUrl && isPreviewImageUrl(thumbnailUrl) }"
          :style="{ borderLeftColor: embedAccentColor }"
        >
          <div class="preview-embed-content">
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
            <div v-if="embedFields.length" class="preview-fields">
              <div
                v-for="({ field, span }, index) in embedFields"
                :key="index"
                class="preview-field"
                :style="{ gridColumn: `span ${span}` }"
              >
                <strong v-html="renderDiscordEmoji(field.name)" />
                <div class="discord-markdown" v-html="renderMarkdown(field.value)" />
              </div>
            </div>
          </div>
          <DiscordPreviewImage
            v-if="thumbnailUrl && isPreviewImageUrl(thumbnailUrl)"
            :src="thumbnailUrl"
            alt=""
            class="preview-thumbnail"
            compact
          />
          <DiscordPreviewImage
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
        <div v-else class="preview-components">
          <h4
            v-if="content.title && !rawBlocks.length"
            v-html="renderDiscordEmoji(content.title)"
          />
          <div
            v-if="content.description && !rawBlocks.length"
            class="preview-copy discord-markdown"
            v-html="renderMarkdown(content.description)"
          />
          <DiscordComponentBlock
            v-for="(block, index) in rawBlocks"
            :key="index"
            :block="block"
            :render-text="render"
            :render-markdown="renderMarkdown"
            :render-emoji="renderDiscordEmoji"
            @interact="simulateInteraction"
          />
          <DiscordPreviewImage
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
            <DiscordPreviewButton
              v-for="action in actionButtons"
              :key="action.action"
              type="button"
              :class="actionButtonClass(action.style)"
              @click="simulateInteraction(action.action, action.label)"
            >
              <span v-if="action.emoji" v-html="renderDiscordEmoji(action.emoji)" /><span
                v-html="renderDiscordEmoji(action.label)"
              />
            </DiscordPreviewButton>
            <DiscordPreviewButton
              v-for="(button, index) in buttons"
              :key="`component-button-${index}`"
              type="button"
              :class="buttonClass(button)"
              :disabled="button.disabled === true"
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
            </DiscordPreviewButton>
            <DiscordPreviewButton
              v-for="item in selectMenus"
              :key="`component-select-${item.role}`"
              type="button"
              class="preview-select-menu"
              @click="simulateInteraction(item.role, render(item.config.placeholder))"
            >
              <span v-html="renderDiscordEmoji(item.config.placeholder)" /><span aria-hidden="true"
                >⌄</span
              >
            </DiscordPreviewButton>
            <DiscordPreviewLinkButton
              v-for="(link, index) in links"
              :key="`component-link-${index}`"
              :href="readUrl(link.url) || undefined"
              :disabled="link.disabled === true"
            >
              <template v-if="link.emoji" #emoji>
                <span v-html="renderDiscordEmoji(link.emoji)" />
              </template>
              <span v-html="renderDiscordEmoji(link.label ?? t('botSettings.openLink'))" />
            </DiscordPreviewLinkButton>
            <DiscordPreviewButton
              v-for="item in coFeatures"
              :key="`component-co-${String(item.action)}`"
              type="button"
              :class="coFeatureButtonClass(item)"
              @click="simulateInteraction(String(item.action), render(item.label ?? item.action))"
            >
              <span v-if="item.emoji" v-html="renderDiscordEmoji(item.emoji)" /><span
                v-html="renderDiscordEmoji(item.label ?? item.action)"
              />
            </DiscordPreviewButton>
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
          <DiscordPreviewButton
            v-for="action in actionButtons"
            :key="action.action"
            type="button"
            :class="actionButtonClass(action.style)"
            @click="simulateInteraction(action.action, action.label)"
          >
            <span v-if="action.emoji" v-html="renderDiscordEmoji(action.emoji)" />
            <span v-html="renderDiscordEmoji(action.label)" /></DiscordPreviewButton
          ><DiscordPreviewButton
            v-for="(button, index) in buttons"
            :key="index"
            type="button"
            :class="buttonClass(button)"
            :disabled="button.disabled === true"
            @click="
              simulateInteraction(
                String(button.custom_id ?? ''),
                render(button.label ?? button.placeholder ?? 'Action'),
              )
            "
          >
            <span v-if="buttonEmoji(button)" v-html="renderDiscordEmoji(buttonEmoji(button))" />
            <span v-html="renderDiscordEmoji(button.label ?? button.placeholder ?? 'Action')" />
          </DiscordPreviewButton>
          <DiscordPreviewButton
            v-for="item in selectMenus"
            :key="`select-${item.role}`"
            type="button"
            class="preview-select-menu"
            @click="simulateInteraction(item.role, render(item.config.placeholder))"
          >
            <span v-html="renderDiscordEmoji(item.config.placeholder)" /><span aria-hidden="true"
              >⌄</span
            >
          </DiscordPreviewButton>
          <DiscordPreviewLinkButton
            v-for="(link, index) in links"
            :key="`link-${index}`"
            :href="readUrl(link.url) || undefined"
            :disabled="link.disabled === true"
            @click="
              !readUrl(link.url) &&
              simulateInteraction('', render(link.label ?? t('botSettings.openLink')))
            "
          >
            <template v-if="link.emoji" #emoji>
              <span v-html="renderDiscordEmoji(link.emoji)" />
            </template>
            <span v-html="renderDiscordEmoji(link.label ?? t('botSettings.openLink'))" />
          </DiscordPreviewLinkButton>
          <DiscordPreviewButton
            v-for="item in coFeatures"
            :key="String(item.action)"
            type="button"
            :class="coFeatureButtonClass(item)"
            @click="simulateInteraction(String(item.action), render(item.label ?? item.action))"
          >
            <span v-if="item.emoji" v-html="renderDiscordEmoji(item.emoji)" />
            <span v-html="renderDiscordEmoji(item.label ?? item.action)" />
          </DiscordPreviewButton>
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
.preview-appearance {
  max-width: 14rem;
  margin-bottom: var(--space-sm);
}
.preview-shell {
  /* Fixed message metrics, independent of the settings page's responsive typography.
     Reference: https://discord.com/app (embed grid and text styles). */
  --discord-blurple: #5865f2;
  --discord-success: #248046;
  --discord-danger: #d22d39;
  --discord-button-primary: #5865f2;
  --discord-button-primary-hover: #4452bb;
  --discord-button-primary-active: #3a48a3;
  --discord-button-success: #008545;
  --discord-button-success-hover: #006c37;
  --discord-button-success-active: #005f30;
  --discord-button-danger: #d22d39;
  --discord-button-danger-hover: #a9232e;
  --discord-button-danger-active: #971d28;
  --discord-button-accent-border: #ffffff14;
  --discord-button-secondary: #97979f1f;
  --discord-button-secondary-hover: #97979f29;
  --discord-button-secondary-active: #97979f3d;
  --discord-button-secondary-border: #97979f33;
  --discord-link: #00a8fc;
  --discord-on-accent: #ffffff;
  --discord-spoiler-overlay: #000000a6;
  --discord-body-size: var(--font-size-body-medium);
  --discord-embed-size: var(--font-size-body-small);
  --discord-meta-size: var(--font-size-label-small);
  --discord-embed-width: 520px;
  container: discord-preview / inline-size;
  min-width: 0;
  width: 100%;
  --discord-canvas: #ffffff;
  --discord-surface: #f2f3f5;
  --discord-surface-strong: #e3e5e8;
  --discord-text: #060607;
  --discord-muted: #5c5e66;
  --discord-border: #d5d8dc;
  --discord-code: #e3e5e8;
  --discord-mention-text: #3e489f;
  --discord-mention-background: #5865f226;
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  background: var(--discord-canvas);
  color: var(--discord-text);
  font-family: var(--font-family-discord-preview);
  font-size: var(--discord-body-size);
  font-weight: var(--typography-font-weight-regular);
  line-height: 1.375;
  letter-spacing: normal;
  text-align: left;
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
  --discord-mention-text: #c9cdfb;
  --discord-mention-background: #5865f24d;
  --discord-button-secondary-border: #97979f0a;
  --discord-button-secondary-active: #97979f33;
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
    --discord-mention-text: #c9cdfb;
    --discord-mention-background: #5865f24d;
    --discord-button-secondary-border: #97979f0a;
    --discord-button-secondary-active: #97979f33;
  }
}
.preview-shell--compact {
  border: 0;
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
  gap: var(--space-md);
  padding: var(--space-md);
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
  overflow: hidden;
  border-radius: var(--corner-radius-full);
  font-weight: 700;
}
.preview-avatar--fallback {
  background: var(--discord-blurple);
  color: var(--discord-on-accent);
}
.preview-avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}
.preview-author {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: var(--space-xxs);
  margin-bottom: 0.25rem;
  color: var(--discord-text);
  font-weight: 600;
  font-size: var(--discord-body-size);
  line-height: 1.375;
  overflow-wrap: anywhere;
}
.preview-author strong {
  font-weight: var(--typography-font-weight-medium);
}
.preview-author span {
  border-radius: 0.2rem;
  padding: 0.1rem 0.25rem;
  background: #5865f2;
  color: white;
  font-size: 0.625rem;
  font-weight: var(--typography-font-weight-medium);
  line-height: 1;
}
.preview-author time {
  color: var(--discord-muted);
  font-size: var(--discord-meta-size);
  font-weight: 400;
}
.preview-embed {
  display: grid;
  width: fit-content;
  max-width: min(var(--discord-embed-width), 100%);
  grid-template-columns: minmax(0, 1fr);
  border: 1px solid var(--discord-border);
  border-left: 4px solid var(--discord-border);
  border-radius: 0.25rem;
  padding: 0.125rem 1rem 1rem 0.75rem;
  background: var(--discord-surface);
  font-size: var(--discord-embed-size);
  line-height: 1.285714;
}
.preview-embed--thumbnail {
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--space-md);
}
.preview-embed-content {
  min-width: 0;
  overflow-wrap: anywhere;
}
.preview-embed h4 {
  margin-top: var(--space-xs);
  font-size: var(--discord-body-size);
  font-weight: var(--typography-font-weight-semibold);
  line-height: 1.25;
}
.preview-embed .preview-copy {
  margin-top: var(--space-xs);
  font-size: var(--discord-embed-size);
  line-height: 1.285714;
}
.preview-message-content {
  max-width: 40rem;
  margin-bottom: 0.35rem;
}
.preview-embed-author {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
  color: var(--discord-text);
  font-size: var(--discord-embed-size);
  font-weight: 600;
}
.preview-embed-author img {
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  flex-shrink: 0;
  border-radius: 999px;
  object-fit: cover;
}
.preview-embed h4 a {
  color: #00a8fc;
  text-decoration: none;
}
.preview-components {
  width: fit-content;
  max-width: min(var(--discord-embed-width), 100%);
  display: grid;
  gap: 0.5rem;
}
.preview-components :deep(.preview-copy) {
  margin-top: 0;
}
h4 {
  color: var(--discord-text);
  font-weight: 700;
  font-size: var(--discord-body-size);
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.preview-copy {
  margin-top: 0.35rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--discord-body-size);
  line-height: 1.375;
}
:deep(.discord-markdown h1),
:deep(.discord-markdown h2),
:deep(.discord-markdown h3) {
  margin: 1rem 0 0.5rem;
  color: var(--discord-text);
  font-weight: 700;
  line-height: 1.375;
}
:deep(.preview-components .discord-markdown :is(h1, h2, h3):first-child) {
  margin-top: 0;
}
:deep(.preview-components .discord-markdown :is(h1, h2, h3):last-child) {
  margin-bottom: 0;
}
:deep(.discord-markdown h1:first-child),
:deep(.discord-markdown h2:first-child),
:deep(.discord-markdown h3:first-child) {
  margin-top: 0.5rem;
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
  font-family: Consolas, 'Andale Mono WT', 'Andale Mono', 'Lucida Console', monospace;
  font-size: 0.85em;
}
:deep(.discord-mention) {
  padding: 0 0.125rem;
  border-radius: 0.1875rem;
  background: var(--discord-mention-background);
  color: var(--discord-mention-text);
  font-weight: var(--typography-font-weight-medium);
  white-space: nowrap;
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
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--space-xs);
  margin-top: var(--space-xs);
  font-size: var(--discord-embed-size);
}
.preview-field {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.preview-field > strong {
  display: block;
  margin-bottom: 2px;
  font-weight: var(--typography-font-weight-semibold);
}
.preview-image {
  grid-column: 1 / -1;
  display: block;
  max-width: 100%;
  max-height: 350px;
  margin-top: var(--space-md);
  border-radius: 0.25rem;
  object-fit: contain;
}
.preview-thumbnail {
  grid-column: 2;
  grid-row: 1;
  align-self: start;
  justify-self: end;
  display: block;
  width: auto;
  height: auto;
  max-width: 80px;
  max-height: 80px;
  border-radius: 0.25rem;
  object-fit: contain;
}
.preview-image-placeholder {
  grid-column: 1 / -1;
  min-width: 0;
  overflow-wrap: anywhere;
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
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: var(--space-xs);
  color: var(--discord-muted);
  font-size: var(--discord-meta-size);
  line-height: 1.333333;
  overflow-wrap: anywhere;
}
.preview-footer img {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: var(--corner-radius-full);
  object-fit: contain;
}
@container discord-preview (max-width: 420px) {
  .preview-chat,
  .preview-shell--compact .preview-chat {
    gap: var(--space-xs);
    padding: var(--space-xs);
  }

  .preview-field {
    grid-column: 1 / -1 !important;
  }
}
@container discord-preview (max-width: 360px) {
  .preview-embed {
    column-gap: var(--space-xs);
  }

  .preview-thumbnail {
    max-width: 48px;
    max-height: 48px;
  }
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
:deep(.discord-unicode-emoji) {
  display: inline-block;
  width: 1.125rem;
  height: 1.125rem;
  vertical-align: -0.25em;
  object-fit: contain;
}
:deep(.discord-markdown :is(h1, h2, h3) .discord-unicode-emoji) {
  width: 1.375em;
  height: 1.375em;
}
.preview-actions .preview-select-menu {
  min-width: min(25rem, 100%);
  justify-content: space-between;
  border: 1px solid var(--discord-border);
  background: var(--discord-canvas);
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
