<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  History,
  ImagePlus,
  QrCode,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import {
  createWalletTopup,
  fetchWalletTopup,
  verifyWalletTopupSlip,
  type WalletTopupInvoice,
  type WalletTopupSummary,
} from '@/features/topup/api'
import { useAuthStore } from '../../../stores'
import { AppButton, AppTextField, AppToast } from '../../../shared/ui'
import WalletBalanceCard from '../components/WalletBalanceCard.vue'

import {
  useTopupHistory,
  topupStatuses,
  topupHistoryPageSize,
} from '../composables/useTopupHistory'

const presets = [50, 100, 300, 500, 1000]
const authStore = useAuthStore()
const { session, currentUser } = storeToRefs(authStore)
const { locale, t } = useI18n()
const selectedAmount = ref(100)
const customAmount = ref<string | number>('')
const invoice = ref<WalletTopupInvoice | null>(null)
const invoiceHeading = ref<HTMLElement>()
const historyHeading = ref<HTMLElement>()
const slip = ref<File | null>(null)
const slipPreview = ref('')
const slipError = ref('')
const draggingSlip = ref(false)
const creating = ref(false)
const verifying = ref(false)
const now = ref(Date.now())
const toastOpen = ref(false)
const toastMessage = ref('')
const toastVariant = ref<'info' | 'success' | 'error'>('info')
const {
  status: historyStatus,
  period: historyPeriod,
  history,
  currentPage: historyPage,
  loading: historyLoading,
  error: historyError,
  hasPrevious: historyHasPrevious,
  hasNext: historyHasNext,
  pageNumbers: historyPages,
  filtered: historyFiltered,
  reload: reloadHistory,
  goToPage: goToHistoryPage,
  retry: retryHistory,
  clearFilters: clearHistoryFilters,
} = useTopupHistory(session)
const historyStatusOptions = computed(() => [
  { value: 'ALL', label: t('topup.historyFilters.allStatuses') },
  ...topupStatuses.map((value) => ({
    value,
    label:
      value === 'FAILED'
        ? t('topup.historyFilters.failed')
        : t(`topup.status.${value.toLowerCase()}`),
  })),
])
const historyPeriodOptions = computed(() => [
  { value: 'ALL', label: t('topup.historyFilters.allTime') },
  ...[7, 30, 90].map((days) => ({
    value: String(days),
    label: t('topup.historyFilters.lastDays', { days }),
  })),
])
const resumingId = ref<string | null>(null)
let timer: number | undefined

const amountBaht = computed(() => {
  const custom = Number(customAmount.value)
  return String(customAmount.value).trim() && Number.isFinite(custom)
    ? custom
    : selectedAmount.value
})
const validAmount = computed(
  () => Number.isInteger(amountBaht.value) && amountBaht.value >= 10 && amountBaht.value <= 100000,
)
const remainingSeconds = computed(() => {
  if (!invoice.value) return 0
  return Math.max(0, Math.ceil((new Date(invoice.value.expiresAt).getTime() - now.value) / 1000))
})
const remainingTime = computed(() => {
  const minutes = Math.floor(remainingSeconds.value / 60)
  const seconds = remainingSeconds.value % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})
const expired = computed(
  () =>
    Boolean(invoice.value) && (remainingSeconds.value === 0 || invoice.value?.status === 'EXPIRED'),
)
const balance = computed(() => currentUser.value?.walletBalanceSatang ?? 0)
const completed = computed(() => invoice.value?.status === 'SUCCESS')
const currentStep = computed(() => (completed.value ? 2 : invoice.value ? 1 : 0))
const steps = computed(() => [
  t('topup.steps.amount'),
  t('topup.steps.payment'),
  t('topup.steps.complete'),
])
const slipSize = computed(() =>
  slip.value ? `${(slip.value.size / 1024 / 1024).toFixed(2)} MiB` : '',
)

function money(satang: number) {
  return new Intl.NumberFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(satang / 100)
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function changeHistoryPage(page: number) {
  if (historyLoading.value || page === historyPage.value) return
  await goToHistoryPage(page)
  if (historyError.value || historyLoading.value || historyPage.value !== page) return
  await nextTick()
  historyHeading.value?.focus({ preventScroll: true })
  historyHeading.value?.scrollIntoView({ block: 'start', behavior: 'instant' })
}

function canResume(item: WalletTopupSummary) {
  return (
    ['PENDING', 'FAILED'].includes(item.status) && new Date(item.expiresAt).getTime() > Date.now()
  )
}

async function resumeInvoice(item: WalletTopupSummary) {
  if (!session.value || resumingId.value || creating.value || verifying.value) return
  resumingId.value = item.invoiceId
  try {
    invoice.value = await fetchWalletTopup(item.invoiceId, session.value)
    void reloadHistory()
    slip.value = null
    slipError.value = ''
    startTimer()
    await focusInvoiceStep()
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : t('topup.historyLoadError'), 'error')
  } finally {
    resumingId.value = null
  }
}

function choosePreset(amount: number) {
  selectedAmount.value = amount
  customAmount.value = ''
}

function updateCustomAmount(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '')
  input.value = digits
  customAmount.value = digits
}

function setSlip(file: File | null) {
  slipError.value = ''
  if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    slipError.value = t('topup.invalidFileType')
    return
  }
  if (file && file.size > 5 * 1024 * 1024) {
    slipError.value = t('topup.fileTooLarge')
    return
  }
  slip.value = file
}

function pickSlip(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) setSlip(input.files[0])
  input.value = ''
}

function dropSlip(event: DragEvent) {
  draggingSlip.value = false
  if (expired.value || verifying.value) return
  setSlip(event.dataTransfer?.files?.[0] ?? null)
}

function notify(message: string, variant: 'info' | 'success' | 'error') {
  toastMessage.value = message
  toastVariant.value = variant
  toastOpen.value = true
}

async function createInvoice() {
  if (!session.value || !validAmount.value || creating.value) return
  creating.value = true
  try {
    invoice.value = await createWalletTopup(
      Math.round(amountBaht.value * 100),
      session.value,
      `web-topup:${crypto.randomUUID()}`,
    )
    void reloadHistory()
    slip.value = null
    slipError.value = ''
    startTimer()
    await focusInvoiceStep()
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : t('topup.createError'), 'error')
  } finally {
    creating.value = false
  }
}

async function submitSlip() {
  if (!session.value || !invoice.value || !slip.value || verifying.value || expired.value) return
  verifying.value = true
  slipError.value = ''
  try {
    invoice.value = await verifyWalletTopupSlip(invoice.value.invoiceId, slip.value, session.value)
    void reloadHistory()
    await authStore.reloadCurrentUser()
    stopTimer()
    notify(t('topup.successToast'), 'success')
    if (completed.value) await focusInvoiceStep()
  } catch (cause) {
    slipError.value = cause instanceof Error ? cause.message : t('topup.verifyError')
    await refreshInvoice()
  } finally {
    verifying.value = false
  }
}

async function focusInvoiceStep() {
  await nextTick()
  invoiceHeading.value?.focus({ preventScroll: true })
  invoiceHeading.value?.scrollIntoView({ block: 'start', behavior: 'instant' })
}

async function refreshInvoice() {
  if (!session.value || !invoice.value) return
  try {
    const previousStatus = invoice.value.status
    invoice.value = await fetchWalletTopup(invoice.value.invoiceId, session.value)
    if (invoice.value.status !== previousStatus) void reloadHistory()
  } catch {
    // Keep the last known state; the next explicit action will surface an actionable error.
  }
}

function startOver() {
  stopTimer()
  invoice.value = null
  slip.value = null
  slipError.value = ''
  now.value = Date.now()
}

function startTimer() {
  stopTimer()
  now.value = Date.now()
  timer = window.setInterval(() => {
    now.value = Date.now()
    if (remainingSeconds.value === 0) {
      stopTimer()
      void refreshInvoice()
    }
  }, 1000)
}

function stopTimer() {
  if (timer !== undefined) window.clearInterval(timer)
  timer = undefined
}

watch(slip, (file) => {
  if (slipPreview.value) URL.revokeObjectURL(slipPreview.value)
  slipPreview.value = file ? URL.createObjectURL(file) : ''
})

onBeforeUnmount(() => {
  stopTimer()
  if (slipPreview.value) URL.revokeObjectURL(slipPreview.value)
})

onMounted(() => void reloadHistory())
</script>

<template>
  <main class="topup-page min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container grid gap-xl pb-3xl">
      <header
        class="topup-header flex flex-col gap-lg desktop:flex-row desktop:items-center desktop:justify-between"
      >
        <div class="min-w-0">
          <p class="mb-xs flex items-center gap-xs text-label-medium text-text-secondary">
            <Wallet :size="18" aria-hidden="true" />{{ t('topup.design.wallet') }}
          </p>
          <h1 class="text-heading-h1 font-bold">{{ t('topup.title') }}</h1>
          <p class="mt-xs text-body-medium text-text-secondary">{{ t('topup.description') }}</p>
        </div>
        <WalletBalanceCard
          :balance-satang="balance"
          :formatted-balance="money(balance)"
          :holder-name="currentUser?.displayName || currentUser?.username"
        />
      </header>

      <ol class="topup-steps" :aria-label="t('topup.steps.label')">
        <li
          v-for="(step, index) in steps"
          :key="index"
          :data-state="
            index < currentStep ? 'done' : index === currentStep ? 'current' : 'upcoming'
          "
          :aria-current="index === currentStep ? 'step' : undefined"
        >
          <span class="step-number" aria-hidden="true"
            ><Check v-if="index < currentStep || completed" :size="18" /><template v-else>{{
              index + 1
            }}</template></span
          >
          <span>{{ step }}</span>
        </li>
      </ol>

      <div
        v-if="!invoice"
        class="amount-layout grid items-start gap-lg desktop:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <section class="topup-panel topup-card" aria-labelledby="amount-heading">
          <div>
            <h2 id="amount-heading" class="text-heading-h3 font-semibold">
              {{ t('topup.chooseAmount') }}
            </h2>
            <p class="mt-xs text-body-small text-text-secondary">{{ t('topup.amountHint') }}</p>
          </div>
          <div class="amount-grid" role="group" :aria-label="t('topup.presetAmounts')">
            <button
              v-for="amount in presets"
              :key="amount"
              type="button"
              :aria-pressed="!customAmount && selectedAmount === amount"
              :disabled="creating"
              :class="{ 'amount-option--active': !customAmount && selectedAmount === amount }"
              @click="choosePreset(amount)"
            >
              <span aria-hidden="true">฿</span
              >{{ amount.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US') }}
            </button>
          </div>
          <div class="custom-amount grid gap-xs">
            <label for="topup-custom-amount" class="text-label-medium font-medium">{{
              t('topup.customAmount')
            }}</label>
            <div
              class="custom-amount__control"
              :class="{ 'custom-amount__control--error': customAmount && !validAmount }"
            >
              <span class="text-text-muted" aria-hidden="true">฿</span>
              <input
                id="topup-custom-amount"
                :value="customAmount"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                :disabled="creating"
                :placeholder="t('topup.customPlaceholder')"
                :aria-invalid="Boolean(customAmount && !validAmount)"
                aria-describedby="topup-amount-hint"
                @input="updateCustomAmount"
              />
              <span class="text-label-small text-text-muted" aria-hidden="true">THB</span>
            </div>
            <p
              id="topup-amount-hint"
              class="text-body-small"
              :class="customAmount && !validAmount ? 'text-error-text' : 'text-text-muted'"
            >
              {{ t('topup.amountRange') }}
            </p>
          </div>
        </section>
        <aside
          class="topup-card summary-card grid content-start gap-lg"
          aria-labelledby="summary-heading"
        >
          <h2 id="summary-heading" class="text-heading-h3 font-semibold">
            {{ t('topup.summary') }}
          </h2>
          <div class="grid gap-xs">
            <span class="text-body-small text-text-secondary">{{ t('topup.amount') }}</span>
            <strong class="text-heading-h1 tabular-nums" data-topup-total>{{
              validAmount ? money(amountBaht * 100) : '—'
            }}</strong>
          </div>
          <dl class="grid gap-md text-body-small">
            <div class="flex justify-between gap-md">
              <dt class="text-text-secondary">{{ t('topup.balanceAfter') }}</dt>
              <dd class="font-medium tabular-nums">
                {{ validAmount ? money(balance + amountBaht * 100) : '—' }}
              </dd>
            </div>
            <div class="flex justify-between gap-md">
              <dt class="text-text-secondary">{{ t('topup.paymentMethod') }}</dt>
              <dd class="flex items-center gap-xs font-medium">
                <QrCode :size="16" aria-hidden="true" />PromptPay
              </dd>
            </div>
          </dl>
          <p
            class="summary-note flex items-start gap-sm border-t border-border-subtle pt-lg text-body-small text-text-secondary"
          >
            <ShieldCheck :size="20" class="shrink-0" aria-hidden="true" /><span>{{
              t('topup.creditAfterVerification')
            }}</span>
          </p>
          <AppButton
            class="continue-button"
            variant="secondary"
            :disabled="!validAmount"
            :loading="creating"
            @click="createInvoice"
          >
            {{ creating ? t('topup.creating') : t('topup.continue')
            }}<ArrowRight :size="18" aria-hidden="true" />
          </AppButton>
        </aside>
      </div>

      <section
        v-else-if="completed"
        class="topup-card success-panel grid justify-items-center gap-lg text-center"
        aria-live="polite"
        aria-labelledby="success-heading"
      >
        <span class="success-icon"><CheckCircle2 :size="40" aria-hidden="true" /></span>
        <div class="grid gap-xs">
          <h2
            id="success-heading"
            ref="invoiceHeading"
            tabindex="-1"
            class="scroll-mt-24 text-heading-h2 font-bold"
          >
            {{ t('topup.successTitle') }}
          </h2>
          <p class="text-body-medium text-text-secondary">
            {{ t('topup.successDescription', { amount: money(invoice.amountSatang) }) }}
          </p>
        </div>
        <div class="success-balance grid w-full gap-xs rounded-lg bg-bg-elevated p-lg">
          <span class="text-body-small text-text-secondary">{{ t('topup.newBalance') }}</span>
          <strong class="text-heading-h1 tabular-nums">{{ money(invoice.balanceSatang) }}</strong>
        </div>
        <p class="text-body-small text-text-muted">
          {{ t('topup.reference') }} · {{ invoice.invoiceNumber }}
        </p>
        <AppButton variant="secondary" class="tablet:!w-auto" @click="startOver">{{
          t('topup.topupAgain')
        }}</AppButton>
      </section>

      <div v-else class="payment-layout grid items-start gap-lg desktop:grid-cols-2">
        <section class="topup-panel topup-card qr-panel" aria-labelledby="qr-heading">
          <div class="flex items-start justify-between gap-md">
            <div>
              <h2
                id="qr-heading"
                ref="invoiceHeading"
                tabindex="-1"
                class="scroll-mt-24 text-heading-h3 font-semibold"
              >
                {{ t('topup.scanQr') }}
              </h2>
              <p class="mt-xs text-body-small text-text-secondary">{{ t('topup.scanHint') }}</p>
            </div>
            <QrCode :size="24" class="shrink-0 text-text-muted" aria-hidden="true" />
          </div>
          <div class="qr-frame" :class="{ 'qr-frame--expired': expired }">
            <img :src="invoice.qrImageUrl" :alt="t('topup.qrAlt')" />
            <div v-if="expired" class="qr-expired">
              <Clock3 :size="32" aria-hidden="true" /><strong>{{ t('topup.expired') }}</strong>
            </div>
          </div>
          <div class="expiry" :class="{ 'expiry--expired': expired }">
            <Clock3 :size="16" aria-hidden="true" /><span>{{
              expired ? t('topup.expired') : t('topup.expiresIn', { time: remainingTime })
            }}</span>
          </div>
          <dl class="payment-details grid gap-md">
            <div>
              <dt>{{ t('topup.amount') }}</dt>
              <dd class="text-heading-h2 tabular-nums">{{ money(invoice.amountSatang) }}</dd>
            </div>
            <div>
              <dt>{{ t('topup.receiver') }}</dt>
              <dd>{{ invoice.promptPayAccountName }}</dd>
            </div>
            <div>
              <dt>{{ t('topup.reference') }}</dt>
              <dd class="text-body-small">{{ invoice.invoiceNumber }}</dd>
            </div>
          </dl>
          <AppButton v-if="expired" variant="secondary" @click="startOver">{{
            t('topup.createNew')
          }}</AppButton>
        </section>
        <section class="topup-panel topup-card slip-panel" aria-labelledby="slip-heading">
          <div>
            <h2 id="slip-heading" class="text-heading-h3 font-semibold">
              {{ t('topup.uploadSlip') }}
            </h2>
            <p id="topup-slip-hint" class="mt-xs text-body-small text-text-secondary">
              {{ t('topup.uploadHint') }}
            </p>
          </div>
          <label
            class="slip-drop"
            :class="{
              'slip-drop--filled': slipPreview,
              'slip-drop--dragging': draggingSlip && !expired && !verifying,
              'slip-drop--disabled': expired || verifying,
              'slip-drop--error': slipError,
            }"
            @dragenter.prevent="draggingSlip = true"
            @dragover.prevent="draggingSlip = true"
            @dragleave.prevent="draggingSlip = false"
            @drop.prevent="dropSlip"
          >
            <input
              class="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jfif"
              :aria-label="t('topup.chooseSlip')"
              :aria-invalid="Boolean(slipError)"
              :aria-describedby="
                slipError ? 'topup-slip-hint topup-slip-error' : 'topup-slip-hint topup-file-hint'
              "
              :disabled="expired || verifying"
              @change="pickSlip"
            />
            <img v-if="slipPreview" :src="slipPreview" :alt="t('topup.design.slipPreviewAlt')" />
            <span v-else class="grid justify-items-center gap-sm p-lg text-center">
              <span class="upload-icon"><ImagePlus :size="28" aria-hidden="true" /></span>
              <strong class="text-body-medium font-medium">{{ t('topup.chooseSlip') }}</strong>
              <span class="text-body-small text-text-muted">{{ t('topup.orDropSlip') }}</span>
            </span>
          </label>
          <div
            v-if="slip"
            class="slip-selected flex items-center gap-sm rounded-md bg-bg-elevated p-sm"
          >
            <CheckCircle2 :size="20" class="shrink-0 text-success-text" aria-hidden="true" />
            <div class="grid min-w-0 flex-1 gap-xxs">
              <p class="truncate text-body-small font-medium">{{ slip.name }}</p>
              <span class="text-label-small text-text-muted">{{ slipSize }}</span>
            </div>
            <AppButton
              class="slip-remove !w-10 shrink-0"
              :aria-label="t('topup.removeSlip')"
              :disabled="verifying || expired"
              @click="setSlip(null)"
              ><X :size="18" aria-hidden="true"
            /></AppButton>
          </div>
          <p id="topup-file-hint" class="text-body-small text-text-muted">
            {{ t('topup.fileHint') }}
          </p>
          <p
            v-if="slipError"
            id="topup-slip-error"
            role="alert"
            class="rounded-md bg-error-bg p-sm text-body-small text-error-text"
          >
            {{ slipError }}
          </p>
          <AppButton
            variant="secondary"
            :disabled="!slip || expired"
            :loading="verifying"
            @click="submitSlip"
            ><Upload :size="18" aria-hidden="true" />{{
              verifying ? t('topup.verifying') : t('topup.verifySlip')
            }}</AppButton
          >
          <p class="flex items-start gap-xs text-body-small text-text-secondary">
            <ShieldCheck :size="18" class="shrink-0" aria-hidden="true" /><span>{{
              t('topup.secureDescription')
            }}</span>
          </p>
        </section>
      </div>

      <section
        class="history-section topup-card grid gap-lg"
        aria-labelledby="topup-history-heading"
        :aria-busy="historyLoading"
      >
        <header class="flex items-center gap-sm">
          <History :size="22" class="text-text-secondary" aria-hidden="true" />
          <h2
            id="topup-history-heading"
            ref="historyHeading"
            tabindex="-1"
            class="scroll-mt-24 text-heading-h3 font-semibold"
          >
            {{ t('topup.historyTitle') }}
          </h2>
        </header>
        <div
          class="history-filters grid items-end gap-md tablet:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <AppTextField
            v-model="historyStatus"
            variant="dropdown"
            :label="t('topup.historyFilters.status')"
            :options="historyStatusOptions"
          />
          <AppTextField
            v-model="historyPeriod"
            variant="dropdown"
            :label="t('topup.historyFilters.period')"
            :options="historyPeriodOptions"
          />
          <AppButton v-if="historyFiltered" class="tablet:!w-auto" @click="clearHistoryFilters">{{
            t('topup.historyFilters.clear')
          }}</AppButton>
        </div>
        <div v-if="history.length" class="history-list">
          <article v-for="item in history" :key="item.invoiceId" class="history-item">
            <div class="history-reference grid min-w-0 gap-xs">
              <strong class="truncate text-body-small font-medium">{{ item.invoiceNumber }}</strong
              ><time :datetime="item.createdAt" class="text-label-small text-text-muted">{{
                dateTime(item.createdAt)
              }}</time>
            </div>
            <strong class="history-amount text-body-medium tabular-nums">{{
              money(item.amountSatang)
            }}</strong>
            <span class="history-status" :data-status="item.status">{{
              t(`topup.status.${item.status.toLowerCase()}`)
            }}</span>
            <AppButton
              v-if="canResume(item)"
              class="resume-button"
              :disabled="Boolean(resumingId) || creating || verifying"
              :loading="resumingId === item.invoiceId"
              @click="resumeInvoice(item)"
              >{{ resumingId === item.invoiceId ? t('topup.loading') : t('topup.resume')
              }}<ArrowRight :size="16" aria-hidden="true"
            /></AppButton>
          </article>
        </div>
        <p v-else-if="historyLoading" role="status" class="history-empty">
          {{ t('topup.historyLoading') }}
        </p>
        <p v-else-if="!historyError" class="history-empty">
          {{ t(historyFiltered ? 'topup.historyNoResults' : 'topup.historyEmpty') }}
        </p>
        <div v-if="historyError" class="flex flex-col items-start gap-sm text-body-small">
          <p role="alert" class="text-error-text">{{ t('topup.historyLoadError') }}</p>
          <AppButton class="tablet:!w-auto" :loading="historyLoading" @click="retryHistory">{{
            t('topup.retry')
          }}</AppButton>
        </div>
        <nav
          v-if="historyPages.length"
          class="history-pagination flex flex-col gap-md border-t border-border-subtle pt-md tablet:flex-row tablet:items-center tablet:justify-between"
          :aria-label="t('topup.historyPagination')"
        >
          <p class="text-body-small text-text-secondary" role="status">
            {{ t('topup.historyPageInfo', { page: historyPage, count: topupHistoryPageSize }) }}
          </p>
          <div class="flex items-center justify-center gap-xs">
            <AppButton
              class="history-previous !w-10 tablet:!w-auto"
              :aria-label="t('topup.historyPrevious')"
              :disabled="!historyHasPrevious || historyLoading"
              @click="changeHistoryPage(historyPage - 1)"
              ><ChevronLeft :size="18" aria-hidden="true" /><span class="hidden tablet:inline">{{
                t('topup.historyPrevious')
              }}</span></AppButton
            >
            <AppButton
              v-for="page in historyPages"
              :key="page"
              class="history-page !w-10"
              :variant="page === historyPage ? 'secondary' : 'primary'"
              :aria-label="t('topup.historyPage', { page })"
              :aria-current="page === historyPage ? 'page' : undefined"
              :disabled="historyLoading"
              @click="changeHistoryPage(page)"
              >{{ page }}</AppButton
            >
            <AppButton
              class="history-next !w-10 tablet:!w-auto"
              :aria-label="t('topup.historyNext')"
              :disabled="!historyHasNext || historyLoading"
              @click="changeHistoryPage(historyPage + 1)"
              ><span class="hidden tablet:inline">{{ t('topup.historyNext') }}</span
              ><ChevronRight :size="18" aria-hidden="true"
            /></AppButton>
          </div>
        </nav>
      </section>
    </div>
    <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" />
  </main>
</template>

<style scoped>
.topup-card {
  min-width: 0;
  padding: var(--space-lg);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
}
.topup-panel {
  display: grid;
  align-content: start;
  gap: var(--space-lg);
}
.upload-icon,
.success-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
}
.topup-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-xs);
  padding: var(--space-md);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
}
.topup-steps li {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-text-muted);
  font-size: var(--font-size-label-small);
  text-align: center;
}
.step-number {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: none;
  place-items: center;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-full);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-semibold);
}
.topup-steps li[data-state='current'] {
  color: var(--color-text-primary);
  font-weight: var(--typography-font-weight-semibold);
}
.topup-steps li[data-state='current'] .step-number {
  border-color: var(--color-action-bg-secondary);
  background: var(--color-action-bg-secondary);
  color: var(--color-action-text-on-secondary);
}
.topup-steps li[data-state='done'] .step-number {
  border-color: var(--color-success-border);
  background: var(--color-success-bg);
  color: var(--color-success-text);
}
.amount-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}
.amount-grid button {
  display: flex;
  min-height: 3rem;
  align-items: center;
  justify-content: center;
  gap: var(--space-xxs);
  padding: var(--space-sm);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-default);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-body-large);
  font-weight: var(--typography-font-weight-semibold);
}
.amount-grid button > span {
  color: var(--color-text-muted);
  font-size: var(--font-size-label-medium);
}
.amount-grid button:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-bg-surface-hover);
}
.amount-grid .amount-option--active,
.amount-grid .amount-option--active:hover:not(:disabled) {
  border-color: var(--color-action-bg-secondary);
  background: var(--color-action-bg-secondary);
  color: var(--color-action-text-on-secondary);
}
.amount-grid .amount-option--active > span {
  color: inherit;
}
.amount-grid button:focus-visible,
.slip-drop:focus-within {
  outline: 2px solid var(--color-action-border-focus);
  outline-offset: 3px;
}
.amount-grid button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.custom-amount__control {
  display: flex;
  min-height: 3rem;
  align-items: center;
  gap: var(--space-xs);
  padding-inline: var(--space-md);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-default);
}
.custom-amount__control:focus-within {
  border-color: var(--color-action-border-focus);
  box-shadow: 0 0 0 1px var(--color-action-border-focus);
}
.custom-amount__control--error {
  border-color: var(--color-error-border);
}
.custom-amount input {
  width: 100%;
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  padding-block: var(--space-sm);
  background: transparent;
  color: inherit;
  font-size: var(--font-size-body-medium);
}
.custom-amount input::placeholder {
  color: var(--color-text-muted);
}
.summary-card {
  background: var(--color-bg-elevated);
}
.qr-frame {
  position: relative;
  width: min(100%, 18rem);
  aspect-ratio: 1;
  justify-self: center;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
}
.qr-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.qr-frame--expired img {
  opacity: 0.12;
  filter: grayscale(1);
}
.qr-expired {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: color-mix(in srgb, var(--color-bg-surface) 90%, transparent);
  text-align: center;
  font-size: var(--font-size-body-medium);
}
.payment-details div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}
.payment-details dt {
  flex: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-body-small);
}
.payment-details dd {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: right;
  font-weight: var(--typography-font-weight-medium);
}
.expiry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
  font-size: var(--font-size-body-small);
  font-variant-numeric: tabular-nums;
}
.expiry--expired {
  color: var(--color-error-text);
}
.slip-drop {
  position: relative;
  display: grid;
  min-height: 16rem;
  place-items: center;
  overflow: hidden;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-bg-default);
  cursor: pointer;
}
.slip-drop:hover:not(.slip-drop--disabled),
.slip-drop--dragging {
  border-color: var(--color-action-border-focus);
  background: var(--color-bg-surface-hover);
}
.slip-drop--error {
  border-color: var(--color-error-border);
}
.slip-drop--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.slip-drop img {
  width: 100%;
  height: 16rem;
  object-fit: contain;
  padding: var(--space-sm);
}
.success-panel {
  width: 100%;
  max-width: var(--layout-reading-max-width);
  justify-self: center;
  padding-block: var(--space-xl);
}
.success-icon {
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-full);
  background: var(--color-success-bg);
  color: var(--color-success-text);
}
.history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-sm);
  padding-block: var(--space-md);
  border-top: 1px solid var(--color-border-subtle);
}
.history-amount {
  text-align: right;
}
.history-status {
  width: fit-content;
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  font-size: var(--font-size-label-small);
}
.history-status[data-status='SUCCESS'] {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}
.history-status[data-status='FAILED'] {
  background: var(--color-error-bg);
  color: var(--color-error-text);
}
.history-status[data-status='PENDING'],
.history-status[data-status='VERIFYING'] {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}
.resume-button {
  width: auto;
  grid-column: 2;
  grid-row: 2;
  justify-self: end;
}
.history-empty {
  padding-block: var(--space-lg);
  color: var(--color-text-muted);
  font-size: var(--font-size-body-small);
  text-align: center;
}
@media (min-width: 48rem) {
  .topup-steps {
    padding: var(--space-lg);
  }
  .topup-steps li {
    flex-direction: row;
    justify-content: center;
    font-size: var(--font-size-label-medium);
  }
  .amount-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .history-item {
    grid-template-columns: minmax(0, 1fr) 8rem 7rem 8rem;
    gap: var(--space-md);
  }
  .resume-button {
    grid-column: 4;
    grid-row: auto;
  }
}
@media (min-width: 64rem) {
  .topup-card {
    padding: var(--space-xl);
  }
}
</style>
