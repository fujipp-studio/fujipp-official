<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeft, Check, ImagePlus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { locale, t } = useI18n()
const presets = [50, 100, 300, 500, 1000]
const selectedAmount = ref(100)
const customAmount = ref<string | number>('')
const slip = ref<File | null>(null)
const slipPreview = ref('')
const checked = ref(false)

const amount = computed(() => {
  const custom = Number(customAmount.value)
  return String(customAmount.value).trim() && Number.isFinite(custom) ? custom : selectedAmount.value
})
const numberLocale = computed(() => (locale.value === 'th' ? 'th-TH' : 'en-US'))

function chooseAmount(value: number) {
  selectedAmount.value = value
  customAmount.value = ''
}

function pickSlip(event: Event) {
  slip.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

watch(slip, (file) => {
  if (slipPreview.value) URL.revokeObjectURL(slipPreview.value)
  slipPreview.value = file ? URL.createObjectURL(file) : ''
  checked.value = false
})

onBeforeUnmount(() => {
  if (slipPreview.value) URL.revokeObjectURL(slipPreview.value)
})
</script>

<template>
  <main class="preview-page">
    <nav class="preview-nav">
      <RouterLink to="/components"><ArrowLeft :size="17" /> Components</RouterLink>
      <span>{{ t('topup.design.previewMode') }}</span>
    </nav>

    <section class="topup-desk" aria-label="Top-up design preview">
      <header class="desk-header">
        <div>
          <p>{{ t('topup.design.wallet') }}</p>
          <h1>{{ t('topup.design.title') }}</h1>
        </div>
        <div class="balance">
          <span>{{ t('topup.design.balance') }}</span>
          <strong>฿1,250.00</strong>
        </div>
      </header>

      <div class="desk-grid">
        <article class="desk-section amount-section">
          <p class="section-label"><span>01</span> {{ t('topup.design.amountStep') }}</p>
          <div class="amount-grid">
            <button
              v-for="preset in presets"
              :key="preset"
              type="button"
              :class="{ active: !customAmount && selectedAmount === preset }"
              @click="chooseAmount(preset)"
            >
              <span>฿</span>{{ preset.toLocaleString(numberLocale) }}
            </button>
          </div>
          <label class="custom-amount">
            <span>{{ t('topup.design.customAmount') }}</span>
            <span class="custom-input"><b>฿</b><input v-model="customAmount" type="number" min="10" placeholder="0" /></span>
          </label>
        </article>

        <article class="desk-section qr-section">
          <p class="section-label"><span>02</span> {{ t('topup.design.scanStep') }}</p>
          <div class="fake-qr" :aria-label="t('topup.design.qrPreview')">
            <i class="finder finder-one" />
            <i class="finder finder-two" />
            <i class="finder finder-three" />
            <strong>PREVIEW</strong>
          </div>
          <div class="payment-total">
            <span>{{ t('topup.amount') }}</span>
            <strong>฿{{ amount.toLocaleString(numberLocale, { minimumFractionDigits: 2 }) }}</strong>
          </div>
          <p class="receiver">{{ t('topup.design.receiver') }} <span>· 14:59</span></p>
        </article>

        <article class="desk-section slip-section">
          <p class="section-label"><span>03</span> {{ t('topup.design.slipStep') }}</p>
          <label class="slip-drop" :class="{ filled: slipPreview }">
            <input type="file" accept="image/jpeg,image/png,image/webp,.jfif" @change="pickSlip" />
            <img v-if="slipPreview" :src="slipPreview" :alt="t('topup.design.slipPreviewAlt')" />
            <span v-else><ImagePlus :size="28" />{{ t('topup.design.dropSlip') }}</span>
          </label>
          <p v-if="slip" class="file-name">{{ slip.name }}</p>
          <button class="verify-button" type="button" :disabled="!slip" @click="checked = true">
            <Check v-if="checked" :size="18" />
            {{ checked ? t('topup.design.ready') : t('topup.design.verify') }}
          </button>
        </article>
      </div>

      <footer class="desk-footer">
        <code>TPU_DESIGN_PREVIEW</code>
        <span>{{ t('topup.design.noPayment') }}</span>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.preview-page { min-height:100vh; padding:clamp(1rem,4vw,3rem) var(--layout-page-gutter) 4rem; background:var(--semantic-color-background-bg-surface); color:var(--semantic-color-text-text-primary); }
.preview-nav,.topup-desk { width:min(100%,82rem); margin-inline:auto; }
.preview-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:clamp(1.5rem,4vw,3rem); font-size:var(--font-size-label-small); }
.preview-nav a { display:inline-flex; align-items:center; gap:.4rem; color:inherit; text-decoration:none; }
.preview-nav > span { color:var(--semantic-color-text-text-muted); text-transform:uppercase; letter-spacing:.12em; }
.topup-desk { overflow:hidden; border:1px solid var(--semantic-color-border-border-default); border-radius:1.5rem; background:var(--semantic-color-background-bg-default); box-shadow:var(--effect-shadow-sm); }
.desk-header { display:flex; align-items:end; justify-content:space-between; gap:2rem; padding:clamp(1.5rem,4vw,3.5rem); border-bottom:1px solid var(--semantic-color-border-border-default); }
.desk-header p,.section-label { margin:0 0 .45rem; color:var(--semantic-color-text-text-muted); font-size:.72rem; font-weight:700; letter-spacing:.13em; text-transform:uppercase; }
.desk-header h1 { margin:0; font-size:clamp(2.8rem,7vw,6rem); line-height:.85; letter-spacing:-.07em; }
.balance { display:grid; gap:.25rem; text-align:right; }.balance span { color:var(--semantic-color-text-text-muted); font-size:.75rem; }.balance strong { font-size:clamp(1.25rem,3vw,2rem); }
.desk-grid { display:grid; grid-template-columns:1fr 1.15fr 1fr; }
.desk-section { min-width:0; padding:clamp(1.5rem,3vw,2.5rem); }
.desk-section + .desk-section { border-left:1px solid var(--semantic-color-border-border-default); }
.section-label { display:flex; gap:.6rem; margin-bottom:2rem; }.section-label span { color:var(--semantic-color-text-text-primary); }
.amount-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.65rem; }
.amount-grid button { display:flex; align-items:baseline; justify-content:center; gap:.15rem; min-height:3.6rem; padding-inline:.35rem; border:1px solid var(--semantic-color-border-border-default); border-radius:.7rem; background:transparent; color:inherit; cursor:pointer; font:800 clamp(.95rem,1.4vw,1.15rem)/1 inherit; }
.amount-grid button span { color:var(--semantic-color-text-text-muted); font-size:.7rem; }
.amount-grid button.active { background:var(--semantic-color-text-text-primary); color:var(--semantic-color-background-bg-default); }.amount-grid button.active span { color:inherit; opacity:.6; }
.custom-amount { display:grid; gap:.45rem; margin-top:1.25rem; color:var(--semantic-color-text-text-muted); font-size:.75rem; }
.custom-input { display:flex; align-items:center; gap:.5rem; border-bottom:1px solid var(--semantic-color-border-border-default); padding-bottom:.65rem; color:var(--semantic-color-text-text-primary); }
.custom-input input { min-width:0; width:100%; border:0; outline:0; background:transparent; color:inherit; font:800 1.6rem/1 inherit; }
.qr-section { display:flex; flex-direction:column; align-items:center; }.qr-section .section-label { align-self:stretch; }
.fake-qr { position:relative; isolation:isolate; width:min(100%,17rem); aspect-ratio:1; overflow:hidden; border:1rem solid white; border-radius:.8rem; background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0/1.7rem 1.7rem; }
.fake-qr::after { content:""; position:absolute; inset:0; z-index:1; background:rgb(255 255 255/.42); }
.fake-qr strong { position:absolute; inset:44% 25%; z-index:3; display:grid; place-items:center; border-radius:.25rem; background:#fff; color:#111; font:800 .65rem/1 monospace; letter-spacing:.12em; }
.finder { position:absolute; z-index:2; width:27%; aspect-ratio:1; border:.48rem solid #111; background:#111; box-shadow:inset 0 0 0 .42rem #fff; }.finder-one { top:3%;left:3%; }.finder-two { top:3%;right:3%; }.finder-three { bottom:3%;left:3%; }
.payment-total { display:flex; width:100%; align-items:baseline; justify-content:space-between; gap:1rem; margin-top:1.5rem; }.payment-total span,.receiver { color:var(--semantic-color-text-text-muted); font-size:.75rem; }.payment-total strong { font-size:1.45rem; }
.receiver { margin:.45rem 0 0; text-align:center; }.receiver span { white-space:nowrap; }
.slip-section { display:flex; flex-direction:column; }
.slip-drop { position:relative; display:grid; min-height:17rem; place-items:center; overflow:hidden; border:1px dashed var(--semantic-color-border-border-default); border-radius:.8rem; cursor:pointer; }
.slip-drop input { position:absolute; width:1px; height:1px; opacity:0; }.slip-drop > span { display:grid; justify-items:center; gap:.7rem; color:var(--semantic-color-text-text-muted); font-size:.8rem; }.slip-drop img { width:100%; height:100%; object-fit:cover; }
.file-name { overflow:hidden; margin:.65rem 0 0; color:var(--semantic-color-text-text-muted); font-size:.72rem; text-overflow:ellipsis; white-space:nowrap; }
.verify-button { display:flex; min-height:3.25rem; align-items:center; justify-content:center; gap:.45rem; margin-top:auto; border:0; border-radius:.65rem; background:var(--semantic-color-text-text-primary); color:var(--semantic-color-background-bg-default); cursor:pointer; font:700 .9rem/1 inherit; }.verify-button:disabled { cursor:not-allowed; opacity:.22; }
.desk-footer { display:flex; justify-content:space-between; gap:1rem; padding:1rem clamp(1.5rem,3vw,2.5rem); border-top:1px solid var(--semantic-color-border-border-default); color:var(--semantic-color-text-text-muted); font-size:.68rem; letter-spacing:.04em; }
@media (max-width:64rem) {
  .desk-grid { grid-template-columns:1fr; }
  .desk-section + .desk-section { border-top:1px solid var(--semantic-color-border-border-default); border-left:0; }
  .slip-drop { min-height:15rem; }.verify-button { margin-top:1rem; }
}
@media (max-width:35rem) {
  .desk-header { align-items:start; }.balance span { display:none; }
  .balance strong { font-size:1rem; }.amount-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .desk-footer { flex-direction:column; }
}
</style>
