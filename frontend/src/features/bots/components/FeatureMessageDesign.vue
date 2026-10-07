<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { ArrowUpRight, ChevronDown, ChevronUp, MessageSquare } from 'lucide-vue-next'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureSettingsHeading from './FeatureSettingsHeading.vue'
import DiscordPresentationPreview from './DiscordPresentationPreview.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

defineProps<{ description?: string }>()

const {
  text,
  visiblePresentationSlots,
  walletActiveSlotKey,
  selectPresentationSlot,
  presentationSlotLabel,
  presentationSlotDescription,
  slotMode,
  openPresentation,
  presentationPreviewDefinition,
  presentationSampleValues,
  previewBot,
  saving,
  canSwitchPresentationMode,
  presentationModeOptions,
  setPresentationMode,
} = useFeatureEditor()
const id = useId()
const activeSlot = computed(
  () =>
    visiblePresentationSlots.value.find((slot) => slot.key === walletActiveSlotKey.value) ??
    visiblePresentationSlots.value[0],
)
const messageOptions = computed(() =>
  visiblePresentationSlots.value.map((slot) => ({
    value: slot.key,
    label: presentationSlotLabel(slot),
  })),
)
const formatLabel = (key: string) => (slotMode(key) === 'EMBED' ? 'Embed' : 'Components V2')
const hasMultipleMessages = computed(() => visiblePresentationSlots.value.length > 1)
const messageList = ref<HTMLDivElement | null>(null)
const hasOverflow = ref(false)
const canScrollUp = ref(false)
const canScrollDown = ref(false)
const scrollProgress = ref(0)
const thumbHeight = ref(100)
const scrollThumbStyle = computed(() => ({
  height: `${thumbHeight.value}%`,
  top: `${(scrollProgress.value * (100 - thumbHeight.value)) / 100}%`,
}))
let listResizeObserver: ResizeObserver | undefined

function updateScrollState() {
  const list = messageList.value
  const distance = list ? list.scrollHeight - list.clientHeight : 0
  hasOverflow.value = Boolean(list && list.clientHeight > 0 && distance > 1)
  canScrollUp.value = hasOverflow.value && (list?.scrollTop ?? 0) > 1
  canScrollDown.value = hasOverflow.value && (list?.scrollTop ?? 0) < distance - 1
  scrollProgress.value =
    distance > 0 ? Math.min(100, Math.max(0, ((list?.scrollTop ?? 0) / distance) * 100)) : 0
  thumbHeight.value =
    list && list.scrollHeight > 0
      ? Math.min(100, (list.clientHeight / list.scrollHeight) * 100)
      : 100
}
function setScrollPosition(event: Event) {
  const list = messageList.value
  if (!list) return
  list.scrollTop =
    (Number((event.target as HTMLInputElement).value) / 100) *
    (list.scrollHeight - list.clientHeight)
  updateScrollState()
}
function scrollMessages(direction: number) {
  const list = messageList.value
  if (!list) return
  list.scrollBy({ top: direction * list.clientHeight * 0.8, behavior: 'auto' })
  updateScrollState()
}
watch(
  messageList,
  (list) => {
    listResizeObserver?.disconnect()
    updateScrollState()
    if (list && typeof ResizeObserver !== 'undefined') {
      listResizeObserver = new ResizeObserver(updateScrollState)
      listResizeObserver.observe(list)
      if (list.firstElementChild) listResizeObserver.observe(list.firstElementChild)
    }
  },
  { flush: 'post' },
)
onBeforeUnmount(() => listResizeObserver?.disconnect())
</script>

<template>
  <section id="feature-presentations" class="mt-2xl" :aria-labelledby="id + '-heading'">
    <header class="mb-lg">
      <h2 :id="id + '-heading'" class="text-2xl font-semibold">
        {{ text('Message design', 'ออกแบบข้อความ') }}
      </h2>
      <p class="mt-xs text-sm text-text-secondary">
        {{
          description ||
          text('Choose a message to preview and edit.', 'เลือกข้อความเพื่อดูตัวอย่างและแก้ไข')
        }}
      </p>
    </header>

    <FeatureSettingsCard v-if="activeSlot" as="div">
      <div class="grid gap-lg" :class="{ 'desktop:grid-cols-3': hasMultipleMessages }">
        <div v-if="hasMultipleMessages" class="desktop:col-span-1">
          <div class="desktop:hidden">
            <AppTextField
              variant="dropdown"
              :model-value="activeSlot.key"
              :label="text('Message', 'ข้อความ')"
              :options="messageOptions"
              @update:model-value="selectPresentationSlot($event)"
            />
          </div>
          <div class="hidden desktop:block" data-feature-message-navigation>
            <p class="mb-sm flex items-center gap-xs text-sm font-medium">
              {{ text('Messages', 'ข้อความ') }}
              <span class="rounded-full bg-bg-surface-hover px-xs text-xs text-text-secondary">
                {{ visiblePresentationSlots.length }}
              </span>
            </p>
            <div class="relative">
              <div
                :id="id + '-message-list'"
                ref="messageList"
                class="feature-message-list max-h-96 overflow-y-auto pr-md"
                role="group"
                tabindex="0"
                :aria-label="text('Messages', 'ข้อความ')"
                :aria-describedby="hasOverflow ? id + '-scroll-help' : undefined"
                @scroll="updateScrollState"
              >
                <div class="space-y-xs">
                  <button
                    v-for="slot in visiblePresentationSlots"
                    :key="slot.key"
                    type="button"
                    class="flex w-full items-center gap-sm rounded-lg p-md text-left"
                    :class="
                      activeSlot.key === slot.key
                        ? 'bg-bg-inverse text-text-inverse'
                        : 'text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary'
                    "
                    :aria-pressed="activeSlot.key === slot.key"
                    @click="selectPresentationSlot(slot.key)"
                  >
                    <MessageSquare :size="20" class="shrink-0" aria-hidden="true" />
                    <span class="min-w-0">
                      <strong class="block text-sm font-medium">{{
                        presentationSlotLabel(slot)
                      }}</strong>
                      <span class="mt-xxs block text-xs">{{ formatLabel(slot.key) }}</span>
                    </span>
                  </button>
                </div>
              </div>
              <div v-if="hasOverflow" class="message-scroll-rail">
                <span class="message-scroll-thumb" :style="scrollThumbStyle" aria-hidden="true" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  :value="scrollProgress"
                  :aria-label="text('Message list scroll position', 'ตำแหน่งเลื่อนรายการข้อความ')"
                  :aria-controls="id + '-message-list'"
                  aria-orientation="vertical"
                  @input="setScrollPosition"
                />
              </div>
            </div>
            <div
              v-if="hasOverflow"
              class="mt-sm flex items-center justify-between gap-xs border-t border-border-subtle pt-sm"
            >
              <p :id="id + '-scroll-help'" class="text-xs text-text-secondary">
                {{
                  canScrollDown
                    ? text('Scroll for more messages', 'เลื่อนดูข้อความเพิ่มเติม')
                    : text('End of list', 'ถึงท้ายรายการแล้ว')
                }}
              </p>
              <div class="flex shrink-0 gap-xs">
                <AppButton
                  class="!w-10 !px-0"
                  :disabled="!canScrollUp"
                  :aria-label="text('Scroll messages up', 'เลื่อนรายการข้อความขึ้น')"
                  :aria-controls="id + '-message-list'"
                  @click="scrollMessages(-1)"
                  ><ChevronUp :size="18" aria-hidden="true"
                /></AppButton>
                <AppButton
                  class="!w-10 !px-0"
                  :disabled="!canScrollDown"
                  :aria-label="text('Scroll messages down', 'เลื่อนรายการข้อความลง')"
                  :aria-controls="id + '-message-list'"
                  @click="scrollMessages(1)"
                  ><ChevronDown :size="18" aria-hidden="true"
                /></AppButton>
              </div>
            </div>
          </div>
        </div>

        <div
          class="min-w-0"
          :class="{ 'desktop:col-span-2': hasMultipleMessages }"
          role="region"
          :aria-labelledby="id + '-active-message'"
        >
          <header
            class="mb-md flex flex-col gap-md tablet:flex-row tablet:items-start tablet:justify-between"
          >
            <div class="min-w-0">
              <FeatureSettingsHeading
                :heading-id="id + '-active-message'"
                :level="3"
                :title="presentationSlotLabel(activeSlot)"
                :description="presentationSlotDescription(activeSlot)"
              />
              <span
                class="mt-xs inline-block text-xs text-text-secondary"
                :class="{ 'desktop:hidden': hasMultipleMessages }"
                >{{ formatLabel(activeSlot.key) }}</span
              >
            </div>
            <AppButton
              class="tablet:!w-auto"
              variant="secondary"
              :disabled="saving"
              :aria-describedby="id + '-edit-help'"
              @click="openPresentation(slotMode(activeSlot.key), activeSlot.key)"
            >
              {{ saving ? text('Opening…', 'กำลังเปิด…') : text('Edit message', 'แก้ไขข้อความ') }}
              <ArrowUpRight :size="16" aria-hidden="true" />
            </AppButton>
          </header>

          <div v-if="canSwitchPresentationMode" class="mb-md grid gap-md tablet:grid-cols-2">
            <AppTextField
              variant="dropdown"
              :label="text('Message format', 'รูปแบบข้อความ')"
              :model-value="slotMode(activeSlot.key)"
              :options="presentationModeOptions"
              @update:model-value="setPresentationMode(activeSlot.key, $event)"
            />
          </div>

          <DiscordPresentationPreview
            :key="activeSlot.key"
            compact
            :definition="presentationPreviewDefinition(activeSlot.key)"
            :variables="activeSlot.availableVariables"
            :bot-name="previewBot?.discordUsername || previewBot?.name"
            :bot-avatar-url="previewBot?.discordAvatarUrl"
            :sample-values="presentationSampleValues(activeSlot.key)"
          />
          <p :id="id + '-edit-help'" class="mt-sm text-xs text-text-secondary">
            {{
              text(
                'Preview uses sample data. Opening the editor saves current settings.',
                'ตัวอย่างใช้ข้อมูลสมมติ การเปิดตัวแก้ไขจะบันทึกการตั้งค่าปัจจุบัน',
              )
            }}
          </p>
        </div>
      </div>
    </FeatureSettingsCard>
    <p
      v-else
      class="rounded-xl border border-dashed border-border-default p-lg text-sm text-text-secondary"
    >
      {{ text('No messages available to design.', 'ยังไม่มีข้อความให้ปรับแต่ง') }}
    </p>
  </section>
</template>

<style scoped>
.feature-message-list {
  scrollbar-width: none;
}
.feature-message-list::-webkit-scrollbar {
  display: none;
}
.message-scroll-rail {
  position: absolute;
  inset-block: 0;
  right: 0;
  width: var(--space-xs);
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-background-bg-surface-hover);
}
.message-scroll-thumb {
  position: absolute;
  width: 100%;
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-text-text-secondary);
}
.message-scroll-rail input {
  position: absolute;
  inset-block: 0;
  right: calc(-1 * var(--space-xxs));
  width: var(--space-md);
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
  writing-mode: vertical-lr;
  direction: ltr;
}
.message-scroll-rail:focus-within {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 2px;
}
</style>
