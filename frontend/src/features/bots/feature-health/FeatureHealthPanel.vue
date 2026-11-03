<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores'
import { useVisibilityPolling } from '@/shared/api/useVisibilityPolling'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppModal from '@/shared/ui/dialogs/AppModal.vue'
import { fetchFeatureHealth, retryFeature, type FeatureHealth } from './api'

const props = defineProps<{ botId: string; admin: boolean }>()
const emit = defineEmits<{ configure: [licenseId: string] }>()
const auth = useAuthStore()
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const rows = ref<FeatureHealth[]>([])
const error = ref('')
const loading = ref(false)
const showAll = ref(false)
const target = ref<FeatureHealth | null>(null)
const busy = ref(false)
const notice = ref('')
let generation = 0
let readController: AbortController | undefined
let writeController: AbortController | undefined
const healthy = computed(
  () => rows.value.filter((row) => row.status === 'ACTIVE' && !row.errorCode).length,
)
const needsAttention = computed(
  () =>
    rows.value.filter((row) => row.status === 'ERROR' || (row.status === 'ACTIVE' && row.errorCode))
      .length,
)
const summary = computed(() => {
  const starting = rows.value.filter((row) => row.status === 'INSTALLING').length
  const disabled = rows.value.filter((row) => row.status === 'DISABLED').length
  return [
    text(`${healthy.value} healthy`, `ทำงานปกติ ${healthy.value}`),
    ...(needsAttention.value
      ? [text(`${needsAttention.value} need attention`, `ต้องตรวจสอบ ${needsAttention.value}`)]
      : []),
    ...(starting ? [text(`${starting} starting`, `กำลังเริ่ม ${starting}`)] : []),
    ...(disabled ? [text(`${disabled} disabled`, `ปิดใช้งาน ${disabled}`)] : []),
  ].join(' · ')
})
const visible = computed(() =>
  showAll.value
    ? rows.value
    : rows.value.filter(
        (row) =>
          row.status === 'ERROR' ||
          row.status === 'INSTALLING' ||
          (row.status === 'ACTIVE' && row.errorCode),
      ),
)
const polling = useVisibilityPolling(async (signal) => {
  if (!loading.value && !busy.value) await load(signal)
})
async function load(signal?: AbortSignal) {
  const session = auth.session
  if (!session) return
  const version = generation
  if (!signal) {
    readController?.abort()
    readController = new AbortController()
    signal = readController.signal
  }
  loading.value = true
  try {
    const result = await fetchFeatureHealth(props.botId, props.admin, session, signal)
    if (!signal.aborted && version === generation) {
      rows.value = result
      error.value = ''
    }
  } catch (cause) {
    if (!signal.aborted && version === generation)
      error.value =
        cause instanceof Error
          ? cause.message
          : text('Unable to load feature status.', 'โหลดสถานะฟีเจอร์ไม่สำเร็จ')
  } finally {
    if (version === generation) loading.value = false
  }
}
watch(
  () => [props.botId, props.admin, auth.session?.user.id],
  () => {
    generation++
    readController?.abort()
    writeController?.abort()
    rows.value = []
    target.value = null
    busy.value = false
    loading.value = false
    notice.value = ''
    error.value = ''
    void load()
    polling.start()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
  readController?.abort()
  writeController?.abort()
})
function label(row: FeatureHealth) {
  if (row.status === 'INSTALLING') return text('Starting', 'กำลังเริ่ม')
  if (row.status === 'DISABLED') return text('Disabled', 'ปิดใช้งาน')
  if (row.nextRetryAt) return text('Waiting to retry', 'รอลองเริ่มใหม่')
  if (row.status === 'ACTIVE')
    return row.errorCode
      ? text('Running with an issue', 'ทำงานอยู่ · มีข้อขัดข้อง')
      : text('Healthy', 'ทำงานปกติ')
  if (row.errorCategory === 'CONFIGURATION') return text('Needs configuration', 'ต้องแก้การตั้งค่า')
  if (row.errorCategory === 'PERMISSION') return text('Needs permissions', 'ต้องแก้สิทธิ์')
  return text('Needs attention', 'ต้องตรวจสอบ')
}
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(locale.value === 'th' ? 'th-TH' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'
}
function openRetry(row: FeatureHealth) {
  target.value = row
  error.value = ''
}
async function retry() {
  if (!target.value || !auth.session || busy.value) return
  const session = auth.session,
    item = target.value,
    version = generation
  const controller = new AbortController()
  writeController = controller
  busy.value = true
  notice.value = ''
  error.value = ''
  try {
    await retryFeature(props.botId, item.installationId, props.admin, session, controller.signal)
    if (version !== generation || controller.signal.aborted) return
    notice.value = text(
      'Settings and permissions checked. Waiting for the bot to start the feature.',
      'ตรวจค่าตั้งค่าและสิทธิ์แล้ว กำลังรอบอทเริ่มฟีเจอร์',
    )
    target.value = null
    await load()
  } catch (cause) {
    if (version === generation && !controller.signal.aborted)
      error.value =
        cause instanceof Error
          ? cause.message
          : text('Unable to restart.', 'เริ่มฟีเจอร์ใหม่ไม่สำเร็จ')
  } finally {
    if (version === generation) busy.value = false
  }
}
</script>

<template>
  <section
    class="space-y-md rounded-lg border border-border-default bg-bg-surface p-lg"
    data-feature-health
  >
    <div class="flex flex-wrap items-start justify-between gap-md">
      <div>
        <h3 class="text-xl font-bold">{{ text('Feature health', 'สถานะฟีเจอร์') }}</h3>
        <p class="mt-xs text-sm text-text-secondary">{{ summary }}</p>
      </div>
      <div class="flex flex-wrap gap-sm">
        <AppButton
          variant="secondary"
          class="!w-auto"
          :disabled="loading || busy"
          @click="load()"
          >{{ text('Refresh', 'รีเฟรช') }}</AppButton
        >
        <AppButton
          variant="secondary"
          class="!w-auto"
          :aria-pressed="showAll"
          @click="showAll = !showAll"
          >{{
            showAll ? text('Show issues', 'แสดงเฉพาะปัญหา') : text('Show all', 'แสดงทั้งหมด')
          }}</AppButton
        >
      </div>
    </div>
    <p v-if="loading && !rows.length" role="status" class="text-sm text-text-secondary">
      {{ text('Loading feature status…', 'กำลังโหลดสถานะฟีเจอร์…') }}
    </p>
    <p v-if="error" role="alert" class="break-words text-sm text-error-text">{{ error }}</p>
    <p v-if="notice" role="status" class="text-sm text-text-secondary">{{ notice }}</p>
    <p v-if="!loading && !error && !visible.length" class="text-sm text-text-secondary">
      {{ text('No feature issues found.', 'ไม่พบปัญหาของฟีเจอร์') }}
    </p>
    <article
      v-for="row in visible"
      :key="row.installationId"
      class="space-y-sm rounded-md border border-border-default p-md"
      :data-feature-health-id="row.installationId"
    >
      <div class="flex flex-wrap items-start justify-between gap-sm">
        <div>
          <h4 class="font-semibold">{{ row.featureName }}</h4>
          <p class="text-xs text-text-muted">v{{ row.version }}</p>
        </div>
        <span class="rounded-md bg-bg-default px-sm py-xs text-sm font-medium">{{
          label(row)
        }}</span>
      </div>
      <p v-if="row.errorMessage" class="break-words text-sm">{{ row.errorMessage }}</p>
      <p v-if="row.errorCode" class="break-words text-xs text-text-muted">
        {{ row.errorCode }} · {{ date(row.lastErrorAt) }}
      </p>
      <p v-if="row.errorCategory" class="text-sm text-text-secondary">
        {{
          locale === 'th'
            ? row.hint
            : text(
                row.errorCategory === 'CONFIGURATION'
                  ? 'Correct the settings, then save or retry.'
                  : row.errorCategory === 'PERMISSION'
                    ? 'Check Discord channel and role permissions, then retry.'
                    : row.errorCategory === 'TRANSIENT'
                      ? 'Temporary issue. Only safe feature startups retry automatically.'
                      : 'Review the details and contact support. Check transaction history for payment issues.',
                '',
              )
        }}
      </p>
      <p v-if="row.nextRetryAt" class="text-xs text-text-muted">
        {{ text('Next startup retry', 'ลองเริ่มใหม่ครั้งถัดไป') }}: {{ date(row.nextRetryAt) }} ·
        {{ row.recoveryAttempts }}/3
      </p>
      <p
        v-else-if="row.status === 'ERROR' && row.recoveryAttempts >= 3"
        class="text-sm text-text-secondary"
      >
        {{
          text(
            'Automatic retries stopped. Review the cause before retrying.',
            'ครบจำนวนลองใหม่อัตโนมัติแล้ว ตรวจสาเหตุก่อนลองอีกครั้ง',
          )
        }}
      </p>
      <div class="flex flex-wrap gap-sm">
        <AppButton variant="secondary" class="!w-auto" @click="emit('configure', row.licenseId)">{{
          text('Configure', 'แก้การตั้งค่า')
        }}</AppButton>
        <AppButton
          v-if="row.canRetry"
          variant="secondary"
          class="!w-auto"
          :disabled="busy"
          @click="openRetry(row)"
          >{{ text('Check and restart', 'ตรวจสอบและลองเริ่มใหม่') }}</AppButton
        >
      </div>
    </article>
    <AppModal
      :open="Boolean(target)"
      :title="text('Restart this feature?', 'ลองเริ่มฟีเจอร์นี้ใหม่?')"
      :subtitle="target?.featureName"
      :disabled="busy"
      @update:open="!$event && !busy && (target = null)"
      @close="!busy && (target = null)"
    >
      <p>
        {{
          text(
            'Checks the saved settings and Discord permissions before requesting startup.',
            'ตรวจค่าที่บันทึกและสิทธิ์ Discord ก่อนขอเริ่มฟีเจอร์ใหม่',
          )
        }}
      </p>
      <p
        v-if="
          target &&
          ['wallet-topup', 'role-shop', 'roblox-robux-payout', 'roblox-payout-test'].includes(
            target.featureCode,
          )
        "
        class="mt-md text-sm text-text-secondary"
      >
        {{
          text(
            'Review transaction history first. This retries startup, not a payment or payout request.',
            'ตรวจประวัติรายการก่อน ขั้นตอนนี้ขอเริ่มฟีเจอร์ ไม่ได้ส่งคำขอเติมเงินหรือจ่ายเงินซ้ำ',
          )
        }}
      </p>
      <p v-if="error" role="alert" class="mt-md break-words text-sm text-error-text">{{ error }}</p>
      <template #actions>
        <AppButton variant="secondary" :disabled="busy" @click="target = null">{{
          text('Cancel', 'ยกเลิก')
        }}</AppButton>
        <AppButton :loading="busy" :disabled="busy" @click="retry">{{
          text('Check and restart', 'ตรวจสอบและลองเริ่มใหม่')
        }}</AppButton>
      </template>
    </AppModal>
  </section>
</template>
