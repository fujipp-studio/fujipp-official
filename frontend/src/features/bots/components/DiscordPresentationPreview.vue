<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImageIcon } from 'lucide-vue-next'

const props = defineProps<{
  definition: Record<string, unknown>
  variables: string[]
  botName?: string | null
  botAvatarUrl?: string | null
  sampleValues?: Record<string, string>
}>()

const { locale } = useI18n()
const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)

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
const components = computed(() =>
  isObject(props.definition.components) ? Object.values(props.definition.components) : [],
)
const buttons = computed(() => components.value.filter(isObject).slice(0, 5))
const coFeatures = computed(() =>
  Array.isArray(props.definition.co_features) ? props.definition.co_features.filter(isObject) : [],
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
  if (!Array.isArray(props.definition.components)) return [] as Array<Record<string, unknown>>
  const first = props.definition.components[0]
  if (
    props.definition.components.length === 1 &&
    isObject(first) &&
    first.type === 17 &&
    Array.isArray(first.components)
  )
    return first.components.filter(isObject)
  return props.definition.components.filter(isObject)
})
const imageUrl = computed(() => readUrl(content.value.image_url ?? content.value.image))
const thumbnailUrl = computed(() => readUrl(content.value.thumbnail_url ?? content.value.thumbnail))
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
function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
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
function blockMediaUrl(block: Record<string, unknown>) {
  if (!Array.isArray(block.items) || !isObject(block.items[0])) return ''
  const media = block.items[0].media
  return isObject(media) && typeof media.url === 'string' ? render(media.url) : ''
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
</script>

<template>
  <div class="preview-shell">
    <div class="preview-toolbar">
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
        <div v-if="mode === 'EMBED'" class="preview-embed">
          <div class="min-w-0">
            <h4 v-if="content.title">{{ render(content.title) }}</h4>
            <div
              v-if="content.description"
              class="preview-copy discord-markdown"
              v-html="renderMarkdown(content.description)"
            />
            <div v-if="Array.isArray(content.fields)" class="preview-fields">
              <div v-for="(field, index) in content.fields" :key="index">
                <strong>{{ render(isObject(field) ? field.name : '') }}</strong>
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
            <p v-if="content.footer" class="preview-footer">{{ render(content.footer) }}</p>
          </div>
          <img
            v-if="thumbnailUrl && isPreviewImageUrl(thumbnailUrl)"
            :src="thumbnailUrl"
            alt=""
            class="preview-thumbnail"
          />
        </div>
        <div v-else class="preview-components">
          <h4 v-if="content.title">{{ render(content.title) }}</h4>
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
            <hr
              v-else-if="block.type === 14 && block.divider !== false"
              class="preview-separator"
            />
            <div v-else-if="block.type === 14" class="preview-space" />
            <img
              v-else-if="block.type === 12 && isPreviewImageUrl(blockMediaUrl(block))"
              :src="blockMediaUrl(block)"
              alt=""
              class="preview-image"
            />
            <div v-else-if="block.type === 12" class="preview-image-placeholder">
              <ImageIcon :size="24" /> {{ blockMediaUrl(block) || 'Media' }}
            </div>
            <div v-else-if="block.type === 1" class="preview-actions">
              <button
                v-for="(button, buttonIndex) in blockButtons(block)"
                :key="buttonIndex"
                :class="buttonClass(button)"
              >
                <span v-if="buttonEmoji(button)">{{ buttonEmoji(button) }}</span>
                {{ render(button.label ?? button.placeholder ?? text('Open link', 'เปิดลิงก์')) }}
              </button>
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
        </div>
        <div
          v-if="actions.length || buttons.length || links.length || coFeatures.length"
          class="preview-actions"
        >
          <button v-for="action in actions" :key="action">{{ actionLabel(action) }}</button
          ><button v-for="(button, index) in buttons" :key="index" :class="buttonClass(button)">
            <span v-if="buttonEmoji(button)">{{ buttonEmoji(button) }}</span>
            {{ render(button.label ?? button.placeholder ?? 'Action') }}
          </button>
          <button v-for="(link, index) in links" :key="`link-${index}`">
            {{ render(link.emoji) }} {{ render(link.label ?? text('Open link', 'เปิดลิงก์')) }}
          </button>
          <button
            v-for="item in coFeatures"
            :key="String(item.action)"
            :class="coFeatureButtonClass(item)"
          >
            {{ render(item.emoji) }} {{ render(item.label ?? item.action) }}
          </button>
        </div>
      </div>
    </div>
    <p class="preview-note">
      {{
        text(
          'Live sample generated from the current settings',
          'ตัวอย่างแบบเรียลไทม์จากค่าที่กำลังตั้ง',
        )
      }}
    </p>
  </div>
</template>

<style scoped>
.preview-shell {
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  background: #313338;
  color: #dbdee1;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid #232428;
  background: #2b2d31;
  font-size: 0.75rem;
}
.preview-toolbar span:last-child {
  margin-left: auto;
  color: #949ba4;
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
  color: #f2f3f5;
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
  color: #949ba4;
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
  background: #2b2d31;
}
.preview-components {
  max-width: 32rem;
  border: 1px solid #3f4147;
  border-radius: 0.5rem;
  padding: 1rem;
  background: #2b2d31;
}
h4 {
  color: #f2f3f5;
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
  color: #f2f3f5;
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
  background: #1e1f22;
  font-family: var(--font-family-mono);
  font-size: 0.85em;
}
:deep(.discord-markdown blockquote) {
  margin: 0.25rem 0;
  border-left: 4px solid #4e5058;
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
  color: #949ba4;
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
  border: 1px dashed #4e5058;
  border-radius: 0.25rem;
  padding: 0.75rem;
  color: #949ba4;
  font-size: 0.75rem;
}
.preview-footer {
  margin-top: 0.75rem;
  color: #b5bac1;
  font-size: 0.7rem;
}
.preview-separator {
  margin-block: 0.75rem;
  border: 0;
  border-top: 1px solid #4e5058;
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
.preview-actions button {
  border: 0;
  border-radius: 0.2rem;
  padding: 0.45rem 0.8rem;
  background: #4e5058;
  color: white;
  font-size: 0.8rem;
}
.preview-actions .preview-button--primary {
  background: #5865f2;
}
.preview-actions .preview-button--secondary {
  background: #4e5058;
}
.preview-actions .preview-button--success {
  background: #248046;
}
.preview-actions .preview-button--danger {
  background: #da373c;
}
.preview-actions .preview-button--link {
  background: #4e5058;
}
.preview-note {
  padding: 0 var(--space-md) var(--space-md);
  color: #949ba4;
  font-size: 0.7rem;
}
</style>
