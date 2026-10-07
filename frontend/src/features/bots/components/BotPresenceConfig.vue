<script setup lang="ts">
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureSettingsHeading from './FeatureSettingsHeading.vue'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { Activity, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-vue-next'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { configuration, values, previewBot, fieldOptions, text } = useFeatureEditor()
const id = useId()
const textList = ref<HTMLElement>()
const selectedText = ref(0)
const items = ref<string[]>([])
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
watch(
  () => String(values.value.PRESENCE_TEXTS ?? ''),
  (value) => {
    if (value !== items.value.join('\n')) items.value = value ? value.split('\n') : []
    selectedText.value = Math.min(
      selectedText.value,
      Math.max(0, items.value.filter((item) => item.trim()).length - 1),
    )
  },
  { immediate: true },
)
const activityTexts = computed(() => items.value.map((item) => item.trim()).filter(Boolean))
const activeIndex = computed(() =>
  Math.min(selectedText.value, Math.max(0, activityTexts.value.length - 1)),
)
const status = computed(() => String(values.value.PRESENCE_STATUS ?? 'online'))
const statusLabels = computed<Record<string, string>>(() => ({
  online: text('Online', 'ออนไลน์'),
  idle: text('Idle', 'ไม่อยู่'),
  dnd: text('Do not disturb', 'ห้ามรบกวน'),
  invisible: text('Invisible', 'ซ่อนตัว'),
}))
const activityLabels = computed<Record<string, string>>(() => ({
  WATCHING: text('Watching', 'กำลังดู'),
  PLAYING: text('Playing', 'กำลังเล่น'),
  LISTENING: text('Listening to', 'กำลังฟัง'),
  COMPETING: text('Competing in', 'กำลังแข่งขัน'),
}))
function options(key: string, labels: Record<string, string>) {
  const definition = field(key)
  return definition
    ? fieldOptions(definition).map((option) => ({
        ...option,
        label: labels[option.value] ?? option.label,
      }))
    : []
}
const botName = computed(() => previewBot.value?.discordUsername || previewBot.value?.name || 'Bot')
const visibleActivity = computed(() =>
  status.value !== 'invisible' && activityTexts.value.length
    ? `${activityLabels.value[String(values.value.PRESENCE_ACTIVITY_TYPE)] ?? ''} ${activityTexts.value[activeIndex.value]}`.trim()
    : '',
)
const statusClass = computed(
  () =>
    ({
      online: 'text-success-text',
      idle: 'text-warning-text',
      dnd: 'text-error-text',
      invisible: 'text-text-muted',
    })[status.value] ?? 'text-text-muted',
)
function commit(next: string[]) {
  items.value = next
  values.value.PRESENCE_TEXTS = next.join('\n')
  selectedText.value = Math.min(
    selectedText.value,
    Math.max(0, next.filter((item) => item.trim()).length - 1),
  )
}
function update(index: number, value: string) {
  const next = [...items.value]
  next[index] = value
  commit(next)
}
async function add() {
  if (items.value.length >= 20) return
  commit([...items.value, ''])
  await nextTick()
  textList.value
    ?.querySelectorAll('input')
    .item(items.value.length - 1)
    ?.focus()
}
async function remove(index: number) {
  commit(items.value.filter((_, current) => current !== index))
  await nextTick()
  const inputs = textList.value?.querySelectorAll('input')
  if (inputs?.length) inputs.item(Math.min(index, inputs.length - 1))?.focus()
  else textList.value?.querySelector<HTMLButtonElement>('[data-add-text]')?.focus()
}
function cycle(direction: number) {
  const count = activityTexts.value.length
  if (count) selectedText.value = (activeIndex.value + direction + count) % count
}
</script>

<template>
  <FeatureSettingsLayout>
    <FeatureSettingsCard as="div">
      <section :aria-labelledby="id + '-status'">
        <FeatureSettingsHeading
          :title="text('Status & activity', 'สถานะและกิจกรรม')"
          :heading-id="id + '-status'"
          :description="
            text('Choose how your bot appears in Discord.', 'เลือกสถานะและกิจกรรมที่แสดงบน Discord')
          "
        />
        <div class="mt-lg grid gap-md tablet:grid-cols-2">
          <AppTextField
            v-if="field('PRESENCE_STATUS')"
            variant="dropdown"
            :model-value="status"
            :label="text('Bot status', 'สถานะบอท')"
            :required="field('PRESENCE_STATUS')?.required"
            :options="options('PRESENCE_STATUS', statusLabels)"
            @update:model-value="values.PRESENCE_STATUS = $event"
          />
          <AppTextField
            v-if="field('PRESENCE_ACTIVITY_TYPE')"
            variant="dropdown"
            :model-value="String(values.PRESENCE_ACTIVITY_TYPE ?? '')"
            :label="text('Activity type', 'ประเภทกิจกรรม')"
            :required="field('PRESENCE_ACTIVITY_TYPE')?.required"
            :options="options('PRESENCE_ACTIVITY_TYPE', activityLabels)"
            @update:model-value="values.PRESENCE_ACTIVITY_TYPE = $event"
          />
        </div>
      </section>
      <section
        v-if="field('PRESENCE_TEXTS')"
        class="mt-lg border-t border-border-subtle pt-lg"
        :aria-labelledby="id + '-texts'"
      >
        <FeatureSettingsHeading
          :title="text('Activity texts', 'ข้อความกิจกรรม')"
          :heading-id="id + '-texts'"
          :description="
            text(
              'One text stays fixed. Multiple texts rotate in order.',
              'ข้อความเดียวจะแสดงคงที่ หลายข้อความจะสลับตามลำดับ',
            )
          "
          class="mb-lg"
        >
          <template #actions>{{ items.length }} / 20</template>
        </FeatureSettingsHeading>
        <div ref="textList" class="space-y-sm">
          <div v-for="(item, index) in items" :key="index">
            <label :for="`${id}-text-${index}`" class="mb-xxs block text-xs text-text-secondary"
              >{{ text('Text', 'ข้อความ') }} {{ index + 1 }}</label
            >
            <div class="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-xs">
              <input
                :id="`${id}-text-${index}`"
                :value="item"
                class="field-control h-11 min-w-0"
                maxlength="128"
                :placeholder="text('e.g. Welcome to our store', 'เช่น ยินดีต้อนรับสู่ร้านค้า')"
                :aria-describedby="`${id}-length-${index}`"
                :aria-invalid="item.length > 128 || undefined"
                @input="update(index, ($event.target as HTMLInputElement).value)"
              />
              <button
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:bg-error-bg hover:text-error-text"
                :aria-label="`${text('Delete text', 'ลบข้อความ')} ${index + 1}`"
                @click="remove(index)"
              >
                <Trash2 :size="16" aria-hidden="true" />
              </button>
            </div>
            <p
              :id="`${id}-length-${index}`"
              class="mt-xxs text-right text-xs"
              :class="item.length > 128 ? 'text-error-text' : 'text-text-muted'"
            >
              {{ item.length }} / 128
            </p>
          </div>
          <p
            v-if="!items.length"
            class="rounded-lg border border-dashed border-border-default px-md py-lg text-sm text-text-muted"
          >
            {{
              text(
                'No activity text. Only the bot status will be shown.',
                'ยังไม่มีข้อความ จะแสดงเฉพาะสถานะบอท',
              )
            }}
          </p>
          <p v-if="items.length > 20" class="text-sm text-error-text">
            {{ text('Keep at most 20 texts.', 'รองรับได้สูงสุด 20 ข้อความ') }}
          </p>
          <button
            type="button"
            data-add-text
            :disabled="items.length >= 20"
            class="inline-flex items-center gap-xs rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            @click="add"
          >
            <Plus :size="16" aria-hidden="true" />{{ text('Add text', 'เพิ่มข้อความ') }}
          </button>
        </div>
        <div
          v-if="field('PRESENCE_ROTATE_SECONDS') && activityTexts.length > 1"
          class="mt-lg border-t border-border-subtle pt-md"
        >
          <label :for="id + '-interval'" class="block text-sm font-medium">{{
            text('Switch text every', 'สลับข้อความทุก')
          }}</label>
          <div class="mt-xs flex items-center gap-sm">
            <input
              :id="id + '-interval'"
              v-model="values.PRESENCE_ROTATE_SECONDS"
              type="number"
              min="20"
              max="86400"
              step="1"
              :required="field('PRESENCE_ROTATE_SECONDS')?.required"
              class="field-control h-11 w-full max-w-40"
              :aria-describedby="id + '-interval-help'"
            />
            <span class="text-sm text-text-secondary">{{ text('seconds', 'วินาที') }}</span>
          </div>
          <p :id="id + '-interval-help'" class="mt-xs text-xs text-text-muted">
            {{ text('20–86,400 seconds', '20–86,400 วินาที') }}
          </p>
        </div>
      </section>
    </FeatureSettingsCard>
    <template #summary>
      <FeatureSettingsCard
        as="aside"
        :title="text('Preview', 'ตัวอย่าง')"
        :heading-id="id + '-preview'"
        :icon="Activity"
        compact
      >
        <div
          class="mt-md flex items-center gap-sm rounded-lg border border-border-subtle bg-bg-default p-md"
          data-presence-preview
        >
          <div class="relative shrink-0">
            <div
              class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-bg-inverse text-text-inverse"
            >
              <img
                v-if="previewBot?.discordAvatarUrl"
                :src="previewBot.discordAvatarUrl"
                alt=""
                class="h-full w-full object-cover"
              />
              <span v-else class="text-sm font-semibold">{{ botName.slice(0, 1) }}</span>
            </div>
            <span
              class="presence-indicator absolute -right-xxs -bottom-xxs flex h-4 w-4 items-center justify-center rounded-full border-2 border-bg-default bg-bg-default"
              :class="statusClass"
              aria-hidden="true"
            >
              <span v-if="status === 'idle'" class="presence-moon" />
              <span v-else-if="status === 'dnd'" class="presence-dnd" />
              <span
                v-else
                class="h-full w-full rounded-full"
                :class="status === 'invisible' ? 'border-2 border-current' : 'bg-current'"
              />
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-xs">
              <strong class="truncate text-sm font-medium">{{ botName }}</strong
              ><span class="shrink-0 rounded bg-bg-inverse px-xxs text-xs text-text-inverse"
                >APP</span
              >
            </div>
            <p
              v-if="visibleActivity"
              class="mt-xxs text-xs text-text-secondary [overflow-wrap:anywhere]"
              data-activity-preview
            >
              {{ visibleActivity }}
            </p>
            <p class="mt-xxs text-xs text-text-muted">
              {{
                status === 'invisible'
                  ? text('Offline', 'ออฟไลน์')
                  : (statusLabels[status] ?? status)
              }}
            </p>
          </div>
        </div>
        <div v-if="activityTexts.length > 1" class="mt-sm flex items-center justify-between gap-sm">
          <span class="text-xs text-text-muted"
            >{{ activeIndex + 1 }} / {{ activityTexts.length }}</span
          >
          <div class="flex gap-xs">
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle hover:bg-bg-surface-hover"
              :aria-label="text('Previous text', 'ข้อความก่อนหน้า')"
              @click="cycle(-1)"
            >
              <ChevronLeft :size="16" />
            </button>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle hover:bg-bg-surface-hover"
              :aria-label="text('Next text', 'ข้อความถัดไป')"
              @click="cycle(1)"
            >
              <ChevronRight :size="16" />
            </button>
          </div>
        </div>
        <p class="mt-md text-xs text-text-muted">
          {{
            status === 'invisible'
              ? text(
                  'Your bot appears offline. Activity texts are kept for when it is visible again.',
                  'บอทจะแสดงเป็นออฟไลน์ ข้อความกิจกรรมยังเก็บไว้ใช้เมื่อเปลี่ยนสถานะ',
                )
              : text(
                  'Preview of your settings. Save to apply them to the bot.',
                  'ตัวอย่างจากการตั้งค่า กดบันทึกเพื่อใช้งานกับบอท',
                )
          }}
        </p>
      </FeatureSettingsCard>
    </template>
  </FeatureSettingsLayout>
</template>

<style scoped>
.presence-moon {
  width: 100%;
  height: 100%;
  border-radius: var(--corner-radius-full);
  background: currentColor;
  mask-image: radial-gradient(circle at 80% 20%, transparent 45%, black 47%);
}
.presence-dnd {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  border-radius: var(--corner-radius-full);
  background: currentColor;
}
.presence-dnd::after {
  content: '';
  position: absolute;
  width: var(--space-xs);
  height: 2px;
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-background-bg-default);
}
button:focus-visible {
  outline: 2px solid var(--semantic-color-border-border-default);
  outline-offset: 2px;
}
</style>
