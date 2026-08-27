<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { CheckCircle2, Clock3, ImagePlus, Upload } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import {
  createWalletTopup,
  fetchWalletTopup,
  verifyWalletTopupSlip,
  type WalletTopupInvoice,
} from '../../../services/backend'
import { useAuthStore } from '../../../stores'
import { AppButton, AppToast } from '../../../shared/ui'

const presets = [50, 100, 300, 500, 1000]
const authStore = useAuthStore()
const { session, currentUser } = storeToRefs(authStore)
const { locale, t } = useI18n()
const selectedAmount = ref(100)
const customAmount = ref<string | number>('')
const invoice = ref<WalletTopupInvoice | null>(null)
const slip = ref<File | null>(null)
const slipPreview = ref('')
const draggingSlip = ref(false)
const creating = ref(false)
const verifying = ref(false)
const now = ref(Date.now())
const toastOpen = ref(false)
const toastMessage = ref('')
const toastVariant = ref<'info' | 'success' | 'error'>('info')
let timer: number | undefined

const amountBaht = computed(() => {
  const custom = Number(customAmount.value)
  return String(customAmount.value).trim() && Number.isFinite(custom) ? custom : selectedAmount.value
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
  () => Boolean(invoice.value) && (remainingSeconds.value === 0 || invoice.value?.status === 'EXPIRED'),
)
const balance = computed(() => currentUser.value?.walletBalanceSatang ?? 0)

function money(satang: number) {
  return new Intl.NumberFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(satang / 100)
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
  slip.value = file
}

function pickSlip(event: Event) {
  setSlip((event.target as HTMLInputElement).files?.[0] ?? null)
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
    slip.value = null
    startTimer()
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : t('topup.createError'), 'error')
  } finally {
    creating.value = false
  }
}

async function submitSlip() {
  if (!session.value || !invoice.value || !slip.value || verifying.value || expired.value) return
  verifying.value = true
  try {
    invoice.value = await verifyWalletTopupSlip(invoice.value.invoiceId, slip.value, session.value)
    await authStore.reloadCurrentUser()
    stopTimer()
    notify(t('topup.successToast'), 'success')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : t('topup.verifyError'), 'error')
    await refreshInvoice()
  } finally {
    verifying.value = false
  }
}

async function refreshInvoice() {
  if (!session.value || !invoice.value) return
  try {
    invoice.value = await fetchWalletTopup(invoice.value.invoiceId, session.value)
  } catch {
    // Keep the last known state; the next explicit action will surface an actionable error.
  }
}

function startOver() {
  stopTimer()
  invoice.value = null
  slip.value = null
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
</script>

<template>
  <main class="topup-page min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container pb-5xl">
      <section class="topup-desk">
      <header class="topup-header">
        <div>
          <p class="topup-eyebrow">{{ t('topup.design.wallet') }}</p>
          <h1>{{ t('topup.title') }}</h1>
        </div>
        <div class="balance-card">
          <span>{{ t('topup.currentBalance') }}</span>
          <strong>{{ money(balance) }}</strong>
        </div>
      </header>

      <section v-if="!invoice" class="topup-panel" aria-labelledby="amount-heading">
        <h2 id="amount-heading" class="section-label"><span>01</span>{{ t('topup.design.amountStep') }}</h2>

        <div class="amount-grid" role="group" :aria-label="t('topup.presetAmounts')">
          <button
            v-for="amount in presets"
            :key="amount"
            type="button"
            :class="{ 'amount-option--active': !customAmount && selectedAmount === amount }"
            @click="choosePreset(amount)"
          >
            <span>฿</span>{{ amount.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US') }}
          </button>
        </div>

        <label class="custom-amount">
          <span>{{ t('topup.design.customAmount') }}</span>
          <span class="custom-amount__control">
            <span aria-hidden="true">฿</span>
            <input
              :value="customAmount"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              :placeholder="t('topup.customPlaceholder')"
              @input="updateCustomAmount"
            />
          </span>
          <small :class="{ 'text-error-text': customAmount && !validAmount }">{{ t('topup.amountRange') }}</small>
        </label>

        <AppButton :disabled="!validAmount" :loading="creating" @click="createInvoice">
          {{ creating ? t('topup.creating') : t('topup.continue') }}
        </AppButton>
      </section>

      <section v-else-if="invoice.status === 'SUCCESS'" class="topup-panel success-panel" aria-live="polite">
        <CheckCircle2 :size="64" aria-hidden="true" />
        <p class="topup-eyebrow">{{ invoice.invoiceNumber }}</p>
        <h2>{{ t('topup.successTitle') }}</h2>
        <p>{{ t('topup.successDescription', { amount: money(invoice.amountSatang) }) }}</p>
        <div class="success-balance">
          <span>{{ t('topup.newBalance') }}</span>
          <strong>{{ money(invoice.balanceSatang) }}</strong>
        </div>
        <AppButton class="tablet:!w-auto" @click="startOver">{{ t('topup.topupAgain') }}</AppButton>
      </section>

      <div v-else class="payment-layout">
        <section class="topup-panel qr-panel" aria-labelledby="qr-heading">
          <h2 id="qr-heading" class="section-label"><span>02</span>{{ t('topup.design.scanStep') }}</h2>

          <div class="qr-frame" :class="{ 'qr-frame--expired': expired }">
            <img :src="invoice.qrImageUrl" :alt="t('topup.qrAlt')" />
            <div v-if="expired" class="qr-expired">
              <Clock3 :size="32" aria-hidden="true" />
              <strong>{{ t('topup.expired') }}</strong>
            </div>
          </div>

          <dl class="payment-details">
            <div><dt>{{ t('topup.amount') }}</dt><dd>{{ money(invoice.amountSatang) }}</dd></div>
            <div><dt>{{ t('topup.receiver') }}</dt><dd>{{ invoice.promptPayAccountName }}</dd></div>
          </dl>

          <div class="expiry" :class="{ 'expiry--expired': expired }">
            <Clock3 :size="18" aria-hidden="true" />
            <span>{{ expired ? t('topup.expired') : t('topup.expiresIn', { time: remainingTime }) }}</span>
          </div>
        </section>

        <section class="topup-panel slip-panel" aria-labelledby="slip-heading">
          <h2 id="slip-heading" class="section-label"><span>03</span>{{ t('topup.design.slipStep') }}</h2>

          <label
            class="slip-drop"
            :class="{ 'slip-drop--filled': slipPreview, 'slip-drop--dragging': draggingSlip }"
            @dragenter.prevent="draggingSlip = true"
            @dragover.prevent="draggingSlip = true"
            @dragleave.prevent="draggingSlip = false"
            @drop.prevent="dropSlip"
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jfif"
              :disabled="expired || verifying"
              @change="pickSlip"
            />
            <img v-if="slipPreview" :src="slipPreview" :alt="t('topup.design.slipPreviewAlt')" />
            <span v-else>
              <ImagePlus :size="30" aria-hidden="true" />
              <strong>{{ t('topup.design.dropSlip') }}</strong>
              <small>{{ t('topup.fileHint') }}</small>
            </span>
          </label>
          <p v-if="slip" class="slip-name">{{ slip.name }}</p>

          <AppButton :disabled="!slip || expired" :loading="verifying" @click="submitSlip">
            <Upload :size="18" aria-hidden="true" />
            {{ verifying ? t('topup.verifying') : t('topup.verifySlip') }}
          </AppButton>
          <AppButton v-if="expired" variant="secondary" @click="startOver">{{ t('topup.createNew') }}</AppButton>
        </section>
      </div>
      <footer v-if="invoice && invoice.status !== 'SUCCESS'" class="desk-footer">
        <code>{{ invoice.invoiceNumber }}</code>
        <span>PromptPay · SlipOK</span>
      </footer>
      </section>
    </div>

    <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" />
  </main>
</template>

<style scoped>
.topup-page { min-height: calc(100vh - 4.25rem); }
.topup-desk { overflow:hidden; border:1px solid var(--color-border-default); border-radius:1.5rem; background:var(--color-bg-surface); box-shadow:var(--effect-shadow-sm); }
.topup-header { display:flex; align-items:end; justify-content:space-between; gap:2rem; padding:clamp(1.5rem,4vw,3.5rem); border-bottom:1px solid var(--color-border-default); }
.topup-header h1 { margin-top:.35rem; font-size:clamp(2.7rem,7vw,5.75rem); font-weight:800; line-height:.88; letter-spacing:-.06em; }
.topup-eyebrow,.section-label { color:var(--color-text-muted); font-size:.72rem; font-weight:700; letter-spacing:.13em; text-transform:uppercase; }
.balance-card { display:grid; flex:none; gap:.25rem; text-align:right; }
.balance-card span { color:var(--color-text-muted); font-size:.75rem; }
.balance-card strong { font-size:clamp(1.2rem,3vw,2rem); }
.topup-panel { display:grid; width:100%; gap:1.5rem; padding:clamp(1.5rem,3vw,2.5rem); background:transparent; }
.topup-desk > .topup-panel:not(.success-panel) { max-width:42rem; }
.section-label { display:flex; gap:.6rem; margin:0; }.section-label span { color:var(--color-text-primary); }
.amount-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.65rem; }
.amount-grid button { display:flex; height:3.6rem; align-items:baseline; justify-content:center; gap:.15rem; padding-inline:.35rem; border:1px solid var(--color-border-default); border-radius:.7rem; background:transparent; color:var(--color-text-primary); cursor:pointer; font:800 clamp(.95rem,1.4vw,1.15rem)/1 inherit; transition:150ms ease; }
.amount-grid button > span { color:var(--color-text-muted); font-size:.7rem; }
.amount-grid button:hover { border-color: var(--color-border-strong); transform: translateY(-1px); }
.amount-grid .amount-option--active { border-color:var(--color-text-primary); background:var(--color-text-primary); color:var(--color-bg-surface); }
.amount-grid .amount-option--active > span { color:inherit; opacity:.65; }
.amount-grid button:focus-visible { outline:2px solid var(--color-border-accent); outline-offset:2px; }
.custom-amount { display:grid; gap:.45rem; color:var(--color-text-muted); font-size:.75rem; }
.custom-amount__control { display:flex; min-height:3.6rem; align-items:center; gap:.5rem; padding:0 1rem; border:1px solid var(--color-border-default); border-radius:.7rem; color:var(--color-text-primary); font-size:var(--font-size-lg); transition:border-color 150ms ease,box-shadow 150ms ease; }
.custom-amount__control:focus-within { border-color:var(--color-text-primary); box-shadow:0 0 0 1px var(--color-text-primary); }
.custom-amount input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; }
.custom-amount small { color: var(--color-text-muted); font-weight: 400; }
.payment-layout { display:grid; grid-template-columns:1.1fr 1fr; }
.qr-panel,.slip-panel { min-width:0; }
.slip-panel { border-left:1px solid var(--color-border-default); }
.qr-frame { position: relative; width: min(100%,18rem); aspect-ratio: 1; justify-self: center; overflow: hidden; padding: var(--spacing-sm); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: white; }
.qr-frame img { width: 100%; height: 100%; object-fit: contain; }
.qr-frame--expired img { opacity: .18; filter: grayscale(1); }
.qr-expired { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: var(--spacing-xs); color: #111827; }
.payment-details { display:grid; gap:var(--spacing-xs); }
.payment-details div { display: flex; justify-content: space-between; gap: var(--spacing-md); padding-bottom: var(--spacing-xs); border-bottom: 1px solid var(--color-border-subtle); }
.payment-details dt { color: var(--color-text-secondary); }
.payment-details dd { overflow-wrap: anywhere; text-align: right; font-weight: 700; }
.expiry { display:flex; align-items:center; justify-content:center; gap:var(--spacing-xs); color:var(--color-text-secondary); font-size:var(--font-size-sm); font-weight:600; }
.expiry--expired { color: var(--color-error-text); }
.slip-drop { position:relative; display:grid; min-height:20rem; place-items:center; overflow:hidden; border:1px dashed var(--color-border-default); border-radius:.8rem; cursor:pointer; transition:border-color 150ms ease,background 150ms ease; }
.slip-drop:hover,.slip-drop--dragging { border-color:var(--color-text-primary); background:var(--color-bg-elevated); }
.slip-drop input { position:absolute; width:1px; height:1px; opacity:0; }
.slip-drop > span { display:grid; justify-items:center; gap:.7rem; padding:1.5rem; color:var(--color-text-muted); text-align:center; }
.slip-drop > span strong { color:var(--color-text-secondary); font-size:var(--font-size-sm); }
.slip-drop > span small { max-width:18rem; font-size:var(--font-size-xs); font-weight:400; }
.slip-drop img { width:100%; height:100%; max-height:28rem; object-fit:contain; background:var(--color-bg-default); }
.slip-name { overflow:hidden; margin-top:-.75rem; color:var(--color-text-muted); font-size:var(--font-size-xs); text-overflow:ellipsis; white-space:nowrap; }
.success-panel { max-width:38rem; justify-items:center; margin-inline:auto; text-align:center; }
.success-panel h2 { font-size:var(--font-size-heading-h3); font-weight:800; }
.success-panel > p { color:var(--color-text-secondary); font-size:var(--font-size-sm); }
.success-panel > svg { color: var(--color-success-text); }
.success-balance { display: grid; width: 100%; gap: var(--spacing-xxs); padding: var(--spacing-md); border-radius: var(--radius-lg); background: var(--color-bg-elevated); }
.success-balance span { color: var(--color-text-secondary); font-size: var(--font-size-sm); }
.success-balance strong { font-size: var(--font-size-heading-h2); }
.desk-footer { display:flex; justify-content:space-between; gap:1rem; padding:1rem clamp(1.5rem,3vw,2.5rem); border-top:1px solid var(--color-border-default); color:var(--color-text-muted); font-size:.68rem; letter-spacing:.04em; }
@media (max-width: 48rem) {
  .topup-header { align-items:start; }
  .balance-card span { display:none; }.balance-card strong { font-size:1rem; }
  .payment-layout { grid-template-columns:1fr; }.slip-panel { border-top:1px solid var(--color-border-default); border-left:0; }
  .amount-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .desk-footer { flex-direction:column; }
}
@media (prefers-reduced-motion: reduce) { .amount-grid button { transition: none; } }
</style>
