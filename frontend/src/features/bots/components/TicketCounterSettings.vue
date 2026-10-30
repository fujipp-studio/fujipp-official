<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'
import { AppButton, AppTextField } from '@/shared/ui'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { ticketCounter } from '../ticket-api'
const { text } = useFeatureEditor()
const route = useRoute()
const { session } = storeToRefs(useAuthStore())
const botId = computed(() => String(route.params.botId ?? ''))
const admin = computed(() => route.path.startsWith('/admin/'))
const value = ref('0'),
  current = ref(0),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  saved = ref(false)
let request: AbortController | undefined
const valid = computed(() => /^\d{1,5}$/.test(value.value) && Number(value.value) <= 99999)
watch(
  [botId, session],
  async () => {
    request?.abort()
    const controller = new AbortController()
    request = controller
    saving.value = false
    if (!session.value || !botId.value) {
      loading.value = false
      current.value = 0
      value.value = '0'
      return
    }
    loading.value = true
    error.value = ''
    saved.value = false
    try {
      const result = await ticketCounter(
        botId.value,
        admin.value,
        session.value,
        undefined,
        controller.signal,
      )
      if (controller.signal.aborted) return
      current.value = result.nextNumber
      value.value = String(result.exhausted ? 0 : result.nextNumber)
    } catch (e) {
      if (!controller.signal.aborted) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)
async function apply(next: number) {
  if (
    !session.value ||
    loading.value ||
    saving.value ||
    !Number.isInteger(next) ||
    next < 0 ||
    next > 99999
  )
    return
  request?.abort()
  const controller = new AbortController()
  request = controller
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    const result = await ticketCounter(
      botId.value,
      admin.value,
      session.value,
      next,
      controller.signal,
    )
    if (controller.signal.aborted) return
    current.value = result.nextNumber
    value.value = String(result.nextNumber)
    saved.value = true
  } catch (e) {
    if (!controller.signal.aborted) error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (!controller.signal.aborted) saving.value = false
  }
}
onBeforeUnmount(() => request?.abort())
</script>
<template>
  <div class="space-y-md" data-ticket-counter>
    <p class="text-sm text-text-secondary">
      {{ text('Next ticket', 'เลขตั๋วถัดไป') }}:
      <strong>{{
        current > 99999
          ? text('Counter exhausted', 'เลขเต็มแล้ว')
          : String(current).padStart(5, '0')
      }}</strong>
    </p>
    <AppTextField
      v-model="value"
      input-type="number"
      :min="0"
      :max="99999"
      :step="1"
      :label="text('Next ticket number', 'เริ่มเลขตั๋วถัดไปจาก')"
      :disabled="loading || saving"
      :support-text="
        text(
          '{{id}} uses five digits from 00000–99999. Changing the counter does not rename existing rooms; resets can reuse old numbers.',
          '{{id}} เป็นเลขห้าหลัก 00000–99999 การเปลี่ยนเลขไม่เปลี่ยนชื่อห้องเก่า และรีเซ็ตแล้วอาจใช้เลขเดิมซ้ำ',
        )
      "
    />
    <div class="flex flex-wrap gap-sm">
      <AppButton :disabled="!valid || loading || saving" @click="apply(Number(value))">{{
        text('Set next number', 'ตั้งเลขถัดไป')
      }}</AppButton>
      <AppButton variant="secondary" :disabled="loading || saving" @click="apply(0)">{{
        text('Reset to 00000', 'รีเซ็ตเป็น 00000')
      }}</AppButton>
    </div>
    <p class="text-sm text-text-secondary">
      {{
        text(
          'This action saves immediately, separately from Save all. Numbers may skip when a ticket cannot be created. Reaching 99999 requires a manual reset.',
          'ปุ่มนี้บันทึกทันที แยกจากบันทึกทั้งหมด เลขอาจข้ามหากสร้างตั๋วไม่สำเร็จ เมื่อถึง 99999 ต้องรีเซ็ตเอง',
        )
      }}
    </p>
    <p v-if="error" role="alert" class="text-sm text-error-text">{{ error }}</p>
    <p v-if="saved" role="status" class="text-sm text-text-secondary">
      {{ text('Counter updated.', 'ตั้งค่าเลขตั๋วแล้ว') }}
    </p>
  </div>
</template>
