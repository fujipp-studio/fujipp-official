<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureCommandsSettings from './FeatureCommandsSettings.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { parseMessageSets, validateMessageSets } from '../config/message-sets'
import { clone } from '../models/presentation'

const {
  text,
  values,
  configuration,
  presentations,
  presentationJson,
  slotMode,
  setPresentationMode,
  selectPresentationSlot,
} = useFeatureEditor()
const container = ref<HTMLElement | null>(null)
const sets = computed(() => parseMessageSets(String(values.value.MESSAGE_SETS ?? '[]')))
const invalid = computed(() => !validateMessageSets(sets.value))
function update(index: number, name: string) {
  values.value.MESSAGE_SETS = JSON.stringify(
    sets.value.map((set, i) => (i === index ? { ...set, name } : set)),
  )
}
async function add() {
  if (sets.value.length >= 20) return
  const slot = configuration.value?.presentations.find(
    (slot) => !sets.value.some((set) => set.presentationSlot === slot.key),
  )
  if (!slot) return
  let index = 1
  while (sets.value.some((set) => set.name.toLowerCase() === `set ${index}`)) index++
  presentations.value[slot.key] = clone(slot.defaultDefinition)
  presentationJson.value[slot.key] = JSON.stringify(presentations.value[slot.key], null, 2)
  values.value.MESSAGE_SETS = JSON.stringify([
    ...sets.value,
    { name: `SET ${index}`, presentationSlot: slot.key },
  ])
  selectPresentationSlot(slot.key)
  await nextTick()
  container.value?.querySelector<HTMLInputElement>(`[data-set-slot="${slot.key}"] input`)?.focus()
}
async function remove(index: number) {
  values.value.MESSAGE_SETS = JSON.stringify(sets.value.filter((_, i) => i !== index))
  await nextTick()
  const slot = sets.value[Math.min(index, sets.value.length - 1)]?.presentationSlot
  const target = slot
    ? container.value?.querySelector<HTMLInputElement>(`[data-set-slot="${slot}"] input`)
    : container.value?.querySelector<HTMLButtonElement>('[data-add-set]')
  target?.focus()
}
</script>

<template>
  <div ref="container" class="space-y-lg" data-message-sets-config>
    <FeatureCommandsSettings
      :model-value="String(values.MESSAGE_SETS_COMMAND_NAME ?? 'ec')"
      default-name="ec"
      required
      :commands="[]"
      @update:model-value="values.MESSAGE_SETS_COMMAND_NAME = $event"
    >
      <p class="mt-md text-sm text-text-secondary">
        <code
          >/{{ values.MESSAGE_SETS_COMMAND_NAME || 'ec' }} set:{{
            text('SET name', 'ชื่อ SET')
          }}</code
        >
      </p>
    </FeatureCommandsSettings>
    <FeatureSettingsCard
      :title="text('Message SETs', 'SET ข้อความ')"
      :description="
        text(
          'Up to 20 SETs per bot. Save to apply changes without restarting.',
          'สูงสุด 20 SET ต่อบอท บันทึกเพื่ออัปเดตโดยไม่ต้องรีสตาร์ต',
        )
      "
    >
      <div class="mb-md flex items-center justify-between gap-md">
        <span class="shrink-0 whitespace-nowrap text-sm text-text-secondary" role="status"
          >{{ sets.length }} / 20 SET</span
        >
        <AppButton
          class="!w-auto"
          data-add-set
          variant="secondary"
          :disabled="sets.length >= 20"
          @click="add"
        >
          <Plus :size="16" aria-hidden="true" /> {{ text('Add SET', 'เพิ่ม SET') }}
        </AppButton>
      </div>
      <p v-if="invalid" role="alert" class="mb-md text-sm text-error-text">
        {{
          text(
            'Use unique names of 1–100 characters without surrounding spaces.',
            'ชื่อ SET ต้องไม่ซ้ำกัน มี 1–100 ตัวอักษร และไม่มีช่องว่างหัวท้าย',
          )
        }}
      </p>
      <div class="space-y-md">
        <article
          v-for="(set, index) in sets"
          :key="set.presentationSlot"
          :data-set-slot="set.presentationSlot"
          class="rounded-lg border border-border-subtle p-md"
        >
          <div class="grid gap-md tablet:grid-cols-2">
            <AppTextField
              :model-value="set.name"
              :label="text(`SET ${index + 1} name`, `ชื่อ SET ${index + 1}`)"
              :maxlength="100"
              required
              @update:model-value="update(index, $event)"
            />
            <AppTextField
              variant="dropdown"
              :model-value="slotMode(set.presentationSlot)"
              :label="text(`SET ${index + 1} format`, `รูปแบบ SET ${index + 1}`)"
              :options="[
                { value: 'EMBED', label: 'Embed' },
                { value: 'COMPONENTS_V2', label: 'Components V2' },
              ]"
              @update:model-value="setPresentationMode(set.presentationSlot, $event)"
            />
          </div>
          <div class="mt-sm flex justify-end">
            <AppButton
              variant="secondary"
              class="!w-auto"
              :aria-label="text(`Delete SET ${index + 1}`, `ลบ SET ${index + 1}`)"
              @click="remove(index)"
            >
              <Trash2 :size="16" aria-hidden="true" /> {{ text('Delete SET', 'ลบ SET') }}
            </AppButton>
          </div>
        </article>
      </div>
      <p v-if="!sets.length" class="text-sm text-text-secondary">
        {{
          text(
            'Add a SET, name it, then design its message below.',
            'เพิ่ม SET ตั้งชื่อ แล้วออกแบบข้อความด้านล่าง',
          )
        }}
      </p>
      <p class="mt-md text-xs text-text-muted">
        {{
          text(
            'Saved changes normally reach the bot within 30 seconds. Previously sent messages keep their original design.',
            'หลังบันทึก โดยปกติบอทจะรับค่าใหม่ภายใน 30 วินาที ข้อความที่ส่งไปแล้วจะคงดีไซน์เดิม',
          )
        }}
      </p>
    </FeatureSettingsCard>
  </div>
</template>
