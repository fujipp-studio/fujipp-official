<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, FileIcon, ImageIcon } from 'lucide-vue-next'
import DiscordPreviewLinkButton from './DiscordPreviewLinkButton.vue'
import DiscordPreviewButton from './DiscordPreviewButton.vue'
import DiscordPreviewImage from './DiscordPreviewImage.vue'

const props = defineProps<{
  block: Record<string, unknown>
  renderText: (value: unknown) => string
  renderMarkdown: (value: unknown) => string
  renderEmoji: (value: unknown) => string
}>()
const emit = defineEmits<{ interact: [action: string, label: string] }>()
const { locale } = useI18n()
const revealed = ref(false)
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const children = computed(() =>
  Array.isArray(props.block.components) ? props.block.components.filter(isObject) : [],
)
const accessory = computed(() => (isObject(props.block.accessory) ? props.block.accessory : null))
const media = computed(() => (isObject(props.block.media) ? props.block.media : {}))
const items = computed(() =>
  Array.isArray(props.block.items) ? props.block.items.filter(isObject) : [],
)
const accent = computed(() => {
  const color = props.block.accent_color
  if (typeof color === 'number' && Number.isInteger(color) && color >= 0 && color <= 0xffffff)
    return `#${color.toString(16).padStart(6, '0')}`
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) return color
  return undefined
})
const style = computed(() => {
  const named: Record<string, number> = { primary: 1, secondary: 2, success: 3, danger: 4, link: 5 }
  return named[String(props.block.style)] ?? Number(props.block.style ?? 2)
})
const label = computed(() =>
  props.renderText(props.block.label ?? props.block.placeholder ?? text('Action', 'คำสั่ง')),
)
const emoji = computed(() => {
  const value = props.block.emoji
  if (!isObject(value)) return props.renderEmoji(value)
  if (value.id)
    return props.renderEmoji(`<${value.animated ? 'a' : ''}:${value.name ?? 'emoji'}:${value.id}>`)
  return props.renderEmoji(value.name)
})
const hidden = computed(() => props.block.spoiler === true && !revealed.value)
function url(value: unknown) {
  return props.renderText(isObject(value) ? value.url : value)
}
function isImage(value: string) {
  return /^(https?:\/\/|\/)/.test(value)
}
function interact() {
  if (props.block.disabled !== true)
    emit('interact', String(props.block.custom_id ?? ''), label.value)
}
function fileName() {
  return (
    props.renderText(props.block.name) ||
    url(props.block.file).split('/').pop() ||
    text('Attachment', 'ไฟล์แนบ')
  )
}
</script>

<template>
  <div
    v-if="block.type === 17"
    :class="['preview-container', { 'preview-container--accent': accent }]"
    :style="{ borderLeftColor: accent }"
  >
    <div
      class="preview-component-stack"
      :class="{ 'preview-spoiler-content': hidden }"
      :inert="hidden ? true : undefined"
    >
      <DiscordComponentBlock
        v-for="(child, index) in children"
        :key="index"
        :block="child"
        :render-text="renderText"
        :render-markdown="renderMarkdown"
        :render-emoji="renderEmoji"
        @interact="(action, name) => emit('interact', action, name)"
      />
    </div>
    <button v-if="hidden" class="preview-spoiler-reveal" type="button" @click="revealed = true">
      {{ text('Reveal spoiler', 'แสดงเนื้อหาที่ซ่อน') }}
    </button>
  </div>
  <div
    v-else-if="block.type === 10"
    class="preview-copy discord-markdown"
    v-html="renderMarkdown(block.content)"
  />
  <div
    v-else-if="block.type === 9"
    :class="['preview-section', { 'preview-section--button': accessory?.type === 2 }]"
  >
    <div class="preview-component-stack">
      <DiscordComponentBlock
        v-for="(child, index) in children"
        :key="index"
        :block="child"
        :render-text="renderText"
        :render-markdown="renderMarkdown"
        :render-emoji="renderEmoji"
        @interact="(action, name) => emit('interact', action, name)"
      />
    </div>
    <DiscordComponentBlock
      v-if="accessory"
      :block="accessory"
      :render-text="renderText"
      :render-markdown="renderMarkdown"
      :render-emoji="renderEmoji"
      @interact="(action, name) => emit('interact', action, name)"
    />
  </div>
  <div
    v-else-if="block.type === 14"
    :class="['preview-separator', { 'preview-separator--large': block.spacing === 2 }]"
  >
    <hr v-if="block.divider !== false" />
  </div>
  <div v-else-if="block.type === 1" class="preview-actions">
    <DiscordComponentBlock
      v-for="(child, index) in children"
      :key="index"
      :block="child"
      :render-text="renderText"
      :render-markdown="renderMarkdown"
      :render-emoji="renderEmoji"
      @interact="(action, name) => emit('interact', action, name)"
    />
  </div>
  <DiscordPreviewLinkButton
    v-else-if="block.type === 2 && style === 5"
    class="preview-component-button preview-button--5"
    :href="url(block.url) || undefined"
    :disabled="block.disabled === true"
  >
    <template v-if="emoji" #emoji><span v-html="emoji" /></template>
    <span>{{ label }}</span>
  </DiscordPreviewLinkButton>
  <DiscordPreviewButton
    v-else-if="block.type === 2"
    type="button"
    :class="['preview-component-button', `preview-button--${style}`]"
    :disabled="block.disabled === true"
    :aria-label="label"
    @click="interact"
  >
    <span v-if="emoji" v-html="emoji" /><span v-if="block.label">{{ label }}</span>
  </DiscordPreviewButton>
  <DiscordPreviewButton
    v-else-if="[3, 5, 6, 7, 8].includes(Number(block.type))"
    type="button"
    class="preview-component-button preview-select-menu"
    :disabled="block.disabled === true"
    @click="interact"
  >
    <span>{{ renderText(block.placeholder) || text('Make a selection', 'เลือกตัวเลือก') }}</span>
    <ChevronDown :size="16" aria-hidden="true" />
  </DiscordPreviewButton>
  <div v-else-if="block.type === 11" class="preview-section-thumbnail">
    <DiscordPreviewImage
      v-if="isImage(url(media))"
      :src="url(media)"
      :alt="renderText(block.description)"
      :class="{ 'preview-spoiler-content': hidden }"
      compact
    />
    <ImageIcon v-else :size="24" aria-hidden="true" />
    <button v-if="hidden" class="preview-spoiler-reveal" type="button" @click="revealed = true">
      {{ text('Reveal', 'แสดง') }}
    </button>
  </div>
  <div
    v-else-if="block.type === 12"
    class="preview-gallery"
    :class="{
      'preview-gallery--single': items.length === 1,
      'preview-gallery--three': items.length === 3 || items.length >= 5,
    }"
  >
    <DiscordComponentBlock
      v-for="(item, index) in items"
      :key="index"
      :block="{ ...item, type: 'gallery-item' }"
      :render-text="renderText"
      :render-markdown="renderMarkdown"
      :render-emoji="renderEmoji"
    />
  </div>
  <div v-else-if="block.type === 'gallery-item'" class="preview-gallery-item">
    <DiscordPreviewImage
      v-if="isImage(url(media))"
      :src="url(media)"
      :alt="renderText(block.description)"
      :class="{ 'preview-spoiler-content': hidden }"
    />
    <div v-else class="preview-media-placeholder">
      <ImageIcon :size="24" /> {{ url(media) || 'Media' }}
    </div>
    <button v-if="hidden" class="preview-spoiler-reveal" type="button" @click="revealed = true">
      {{ text('Reveal spoiler', 'แสดงเนื้อหาที่ซ่อน') }}
    </button>
  </div>
  <div v-else-if="block.type === 13" class="preview-file">
    <FileIcon :size="32" aria-hidden="true" /><span>{{ fileName() }}</span>
  </div>
</template>

<style scoped>
.preview-container {
  position: relative;
  min-width: 0;
  border: 1px solid var(--discord-border);
  border-radius: var(--corner-radius-md);
  padding: var(--space-md);
  background: var(--discord-surface);
}
.preview-container--accent {
  border-left-width: 4px;
}
.preview-component-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}
.preview-copy {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--discord-body-size);
  line-height: 1.375;
}
.preview-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-md);
  min-width: 0;
}
.preview-section-thumbnail {
  position: relative;
  display: grid;
  place-items: center;
  width: 80px;
  height: 80px;
  overflow: hidden;
  border-radius: var(--corner-radius-sm);
}
.preview-section-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-separator {
  padding-block: var(--space-xxs);
}
.preview-separator--large {
  padding-block: var(--space-sm);
}
.preview-separator hr {
  margin: 0;
  border: 0;
  border-top: 1px solid var(--discord-border);
}
.preview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  min-width: 0;
}
.preview-spoiler-reveal:focus-visible {
  outline: 2px solid var(--discord-link);
  outline-offset: 2px;
}
.preview-select-menu {
  width: min(400px, 100%);
  min-height: 40px;
  justify-content: space-between;
  background: var(--discord-canvas);
  color: var(--discord-muted);
}
.preview-gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-xxs);
  min-width: 0;
  overflow: hidden;
  border-radius: var(--corner-radius-sm);
}
.preview-gallery--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.preview-gallery--single {
  grid-template-columns: minmax(0, 1fr);
}
.preview-gallery-item {
  position: relative;
  min-width: 0;
  overflow: hidden;
  aspect-ratio: 1;
}
.preview-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-gallery--single .preview-gallery-item {
  aspect-ratio: auto;
}
.preview-gallery--single :deep(img) {
  display: block;
  width: 100%;
  height: auto;
  max-height: 350px;
  object-fit: contain;
}
.preview-media-placeholder {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm);
  overflow-wrap: anywhere;
  color: var(--discord-muted);
}
.preview-file {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  border: 1px solid var(--discord-border);
  border-radius: var(--corner-radius-sm);
  padding: var(--space-sm);
  overflow-wrap: anywhere;
  color: var(--discord-link);
}
.preview-file span {
  min-width: 0;
}
.preview-spoiler-content {
  filter: blur(8px);
  pointer-events: none;
  user-select: none;
}
.preview-spoiler-reveal {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: inherit;
  background: var(--discord-spoiler-overlay);
  color: var(--discord-on-accent);
  font-size: var(--discord-meta-size);
  cursor: pointer;
}
@container discord-preview (max-width: 360px) {
  .preview-section {
    gap: var(--space-xs);
  }
  .preview-section-thumbnail {
    width: 48px;
    height: 48px;
  }
  .preview-section--button {
    grid-template-columns: minmax(0, 1fr);
  }
  .preview-section--button > .preview-component-button {
    justify-self: start;
  }
  .preview-gallery--three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
