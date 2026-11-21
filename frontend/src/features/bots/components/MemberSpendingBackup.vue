<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import {
  readBackupDownload,
  readBackupQuota,
  spendingBackupRequest,
  type BackupQuota,
} from '../member-spending-backup-api'

const { text, license } = useFeatureEditor()
const route = useRoute()
const auth = useAuthStore()
const botId = computed(() =>
  String(route.params.botId ?? license.value?.installations[0]?.botId ?? ''),
)
const admin = computed(() => route.path.startsWith('/admin/bots/'))
const quota = ref<BackupQuota | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const success = ref(false)
let controller: AbortController | undefined
let resetTimer: ReturnType<typeof setTimeout> | undefined
async function loadQuota(signal: AbortSignal) {
  if (!auth.session || !license.value || !botId.value) return
  quota.value = await readBackupQuota(
    await spendingBackupRequest(
      botId.value,
      license.value.id,
      admin.value,
      auth.session,
      false,
      signal,
    ),
  )
  clearTimeout(resetTimer)
  const delay = Date.parse(quota.value.resetsAt) - Date.now()
  if (delay > 0 && delay < 86_400_001) resetTimer = setTimeout(refresh, delay + 100)
}
async function refresh() {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  quota.value = null
  loading.value = true
  error.value = ''
  try {
    await loadQuota(signal)
  } catch {
    if (!signal.aborted)
      error.value = text(
        'Unable to load backup quota. Please retry.',
        'โหลดโควต้าไม่สำเร็จ กรุณาลองอีกครั้ง',
      )
  } finally {
    if (!signal.aborted) loading.value = false
  }
}
watch([botId, () => license.value?.id, () => auth.session?.access_token], refresh, {
  immediate: true,
})
onBeforeUnmount(() => {
  controller?.abort()
  clearTimeout(resetTimer)
})
async function download() {
  if (busy.value || !quota.value?.remaining || !auth.session || !license.value) return
  const signal = controller!.signal
  busy.value = true
  error.value = ''
  success.value = false
  try {
    const response = await spendingBackupRequest(
      botId.value,
      license.value.id,
      admin.value,
      auth.session,
      true,
      signal,
    )
    const file = await readBackupDownload(response)
    if (signal.aborted) return
    const url = URL.createObjectURL(file.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
    success.value = true
  } catch {
    if (!signal.aborted)
      error.value = text(
        'Backup failed. Check your connection and try again.',
        'ดาวน์โหลดไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
      )
  } finally {
    if (!signal.aborted) {
      try {
        await loadQuota(signal)
      } catch {
        quota.value = null
      }
    }
    busy.value = false
  }
}
</script>

<template>
  <div class="mt-lg space-y-md border-t border-border-subtle pt-lg" data-spending-backup>
    <h3 class="font-medium">{{ text('Download Data', 'ดาวน์โหลดข้อมูลสำรอง') }}</h3>
    <p class="text-sm text-text-secondary">
      {{
        text(
          'ZIP with member totals, all saved monthly balances, CSV and JSON. Amounts are in satang. Automatic restore is not available yet.',
          'ไฟล์ ZIP รวมยอดสมาชิกและยอดรายเดือนทั้งหมดที่บันทึกไว้ ในรูปแบบ CSV และ JSON โดยยอดเงินเป็นสตางค์ ยังไม่มีระบบนำไฟล์กลับเข้าระบบอัตโนมัติ',
        )
      }}
    </p>
    <p v-if="quota" role="status" class="text-sm text-text-secondary">
      {{
        text(
          `${quota.remaining}/${quota.limit} downloads remaining today · Resets at 00:00 Thailand time`,
          `ดาวน์โหลดได้อีก ${quota.remaining}/${quota.limit} ครั้งวันนี้ · รีเซ็ต 00:00 น. เวลาไทย`,
        )
      }}
    </p>
    <p v-else-if="loading" role="status" class="text-sm text-text-secondary">
      {{ text('Loading quota…', 'กำลังโหลดโควต้า…') }}
    </p>
    <AppButton
      variant="secondary"
      :loading="busy"
      :disabled="loading || !quota?.remaining"
      @click="download"
    >
      {{ text('Download Backup', 'ดาวน์โหลดไฟล์สำรอง') }}
    </AppButton>
    <AppButton v-if="!loading && !quota" variant="secondary" @click="refresh">{{
      text('Retry', 'ลองอีกครั้ง')
    }}</AppButton>
    <p v-if="error" role="alert" class="text-sm text-error-text">{{ error }}</p>
    <p v-if="success" role="status" class="text-sm text-text-secondary">
      {{
        text(
          'Backup created. Check your browser downloads.',
          'สร้างไฟล์สำรองแล้ว ตรวจสอบรายการดาวน์โหลดของเบราว์เซอร์',
        )
      }}
    </p>
  </div>
</template>
