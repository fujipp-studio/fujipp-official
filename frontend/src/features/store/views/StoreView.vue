<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Clock3, Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import {
  checkoutStoreOffer,
  fetchStoreFeatures,
  type StoreFeature,
  type StoreOffer,
} from '@/features/store/api'
import {
  fetchRuntimeAvailability,
  purchaseRuntime,
  type RuntimeAvailability,
} from '@/features/bots/runtime-api'
import { icons } from '../../../config'
import { useAuthStore } from '../../../stores'
import { AppButton, AppIcon, AppModal, AppToast } from '../../../shared/ui'

type StoreSection = 'menu' | 'packages' | 'runtime'

interface ProductCard {
  id: string
  feature: StoreFeature
  offer: StoreOffer
}

function deriveSection(path: string): StoreSection {
  if (path.endsWith('/packages')) return 'packages'
  if (path.endsWith('/runtime')) return 'runtime'
  return 'menu'
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { locale, t } = useI18n()
const { session, isAuthenticated } = storeToRefs(authStore)
const features = ref<StoreFeature[]>([])
const runtimeAvailability = ref<RuntimeAvailability | null>(null)
const section = ref<StoreSection>(deriveSection(route.path))
const loading = ref(true)
const error = ref('')
const runtimeError = ref('')
const notice = ref('')
const query = ref('')
const selectedCard = ref<ProductCard | null>(null)
const buyingOfferId = ref('')
const purchaseIdempotencyKey = ref('')
const transitionName = ref('store-forward')
const sectionScrollY = ref(0)
let storeRequest: AbortController | undefined

const toastOpen = ref(false)
const toastMessage = ref('')
const toastVariant = ref<'info' | 'success' | 'error'>('info')

function showToast(message: string, variant: 'info' | 'success' | 'error' = 'info') {
  toastMessage.value = message
  toastVariant.value = variant
  toastOpen.value = true
}

watch(
  () => route.path,
  (newPath) => {
    const targetSection = deriveSection(newPath)
    if (targetSection === section.value) return

    if (newPath === '/store') {
      transitionName.value = 'store-backward'
    } else {
      transitionName.value = 'store-forward'
    }
    query.value = ''
    section.value = targetSection
    window.setTimeout(restoreSectionPosition, 460)
  },
)

function isRuntime(feature: StoreFeature) {
  return feature.code.trim().toLowerCase() === 'runtime-hosting'
}

const productCards = computed<ProductCard[]>(() =>
  features.value.flatMap((feature) =>
    feature.offers
      .filter(
        (offer) =>
          offer.id.trim().length > 0 &&
          offer.name.trim().length > 0 &&
          Number.isSafeInteger(offer.priceSatang) &&
          offer.priceSatang >= 0 &&
          Number.isInteger(offer.installationLimit) &&
          offer.installationLimit > 0,
      )
      .map((offer) => ({ id: offer.id, feature, offer })),
  ),
)

const visibleCards = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return productCards.value.filter((card) => {
    const sectionMatches =
      section.value === 'runtime' ? isRuntime(card.feature) : !isRuntime(card.feature)
    const text = `${card.feature.name} ${card.feature.description} ${card.offer.name}`.toLowerCase()
    return sectionMatches && (!needle || text.includes(needle))
  })
})

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
      style: 'currency',
      currency: currency.trim().toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value / 100)
  } catch {
    return `${(value / 100).toFixed(2)} ${currency.trim().toUpperCase()}`
  }
}

function offerCaption(offer: StoreOffer) {
  if (offer.billingPeriodDays) return t('store.billingDays', { days: offer.billingPeriodDays })
  return t('store.oneTime')
}

function offerName(offer: StoreOffer) {
  if (offer.name === '7 Days') return '1 Week'
  return offer.name
}

function openSection(next: Exclude<StoreSection, 'menu'>) {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  sectionScrollY.value = window.scrollY
  query.value = ''
  transitionName.value = 'store-forward'
  section.value = next
  if (route.path !== `/store/${next}`) {
    void router.push(`/store/${next}`)
  }
  window.setTimeout(restoreSectionPosition, 460)
}

function goToMain() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  sectionScrollY.value = window.scrollY
  query.value = ''
  transitionName.value = 'store-backward'
  section.value = 'menu'
  if (route.path !== '/store') {
    void router.push('/store')
  }
  window.setTimeout(restoreSectionPosition, 460)
}

function restoreSectionPosition() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: sectionScrollY.value, behavior: 'instant' })
    })
  })
}

async function loadStore(showSkeleton = true) {
  storeRequest?.abort()
  const request = new AbortController()
  storeRequest = request
  if (showSkeleton) loading.value = true
  error.value = ''
  runtimeError.value = ''
  try {
    const [featuresResult, runtimeResult] = await Promise.allSettled([
      fetchStoreFeatures(request.signal),
      fetchRuntimeAvailability(request.signal),
    ])

    if (featuresResult.status === 'fulfilled') {
      features.value = featuresResult.value
    } else if (featuresResult.reason?.name !== 'AbortError') {
      error.value =
        featuresResult.reason instanceof Error ? featuresResult.reason.message : t('store.loadError')
    }

    if (runtimeResult.status === 'fulfilled') {
      runtimeAvailability.value = runtimeResult.value
    } else if (runtimeResult.reason?.name !== 'AbortError') {
      runtimeError.value =
        runtimeResult.reason instanceof Error
          ? runtimeResult.reason.message
          : t('store.runtimeLoadError')
    }

    if (error.value) showToast(error.value, 'error')
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return
    const msg = cause instanceof Error ? cause.message : t('store.loadError')
    error.value = msg
    showToast(msg, 'error')
  } finally {
    if (storeRequest === request) {
      loading.value = false
      if (section.value !== 'menu') void nextTick(restoreSectionPosition)
    }
  }
}

function requestBuy(card: ProductCard) {
  notice.value = ''
  if (buyingOfferId.value) return
  if (!session.value) {
    const msg = t('store.signInNotice')
    notice.value = msg
    showToast(msg, 'info')
    return
  }
  selectedCard.value = card
  purchaseIdempotencyKey.value = crypto.randomUUID()
}

async function confirmBuy() {
  if (!session.value || !selectedCard.value || buyingOfferId.value) return
  const card = selectedCard.value
  buyingOfferId.value = card.offer.id
  try {
    if (isRuntime(card.feature)) {
      if (runtimeAvailability.value && runtimeAvailability.value.availableSlots <= 0) {
        throw new Error(t('store.runtimeSoldOut'))
      }
      const runtime = await purchaseRuntime(card.offer.id, session.value)
      const msg = t('store.runtimePurchaseSuccess', { slot: runtime.slotNumber })
      notice.value = msg
      showToast(msg, 'success')
    } else {
      const order = await checkoutStoreOffer(
        card.offer.id,
        1,
        session.value,
        purchaseIdempotencyKey.value,
      )
      const msg = t('store.purchaseSuccess', {
        product: card.feature.name,
        orderNumber: order.orderNumber,
      })
      notice.value = msg
      showToast(msg, 'success')
    }
    selectedCard.value = null
    purchaseIdempotencyKey.value = ''
    void loadStore(false)
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : t('store.purchaseError')
    notice.value = msg
    showToast(msg, 'error')
  } finally {
    buyingOfferId.value = ''
  }
}

onMounted(loadStore)
onBeforeUnmount(() => storeRequest?.abort())
</script>

<template>
  <main class="store-page min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container pb-5xl">
      <header class="store-header">
        <div class="store-title-row">
          <h1 class="text-4xl font-extrabold tracking-tight desktop:text-5xl">
            {{ t('store.allProducts') }}
          </h1>
          <AppButton
            v-if="section !== 'menu'"
            class="tablet:!w-auto"
            @click="goToMain"
          >
            {{ t('store.back') }}
          </AppButton>
        </div>
        <div class="store-toolbar">
          <nav :aria-label="t('store.breadcrumbLabel')" class="store-breadcrumb">
            <button
              v-if="section !== 'menu'"
              class="store-breadcrumb-link"
              type="button"
              @click="goToMain"
            >
              {{ t('store.main') }}
            </button>
            <span v-else>{{ t('store.main') }}</span>
            <span v-if="section !== 'menu'" class="store-breadcrumb-tail">
              <span aria-hidden="true">&gt;</span>
              {{ section === 'runtime' ? 'Runtime' : 'Packages' }}
            </span>
          </nav>
          <label v-if="section !== 'menu'" class="relative block tablet:w-80">
            <Search :size="18" class="absolute left-sm top-1/2 -translate-y-1/2 text-text-muted" />
            <span class="sr-only">{{ t('store.search') }}</span>
            <input
              v-model="query"
              class="search-field"
              type="search"
              autocomplete="off"
              maxlength="100"
              :placeholder="
                section === 'runtime' ? t('store.searchRuntime') : t('store.searchPackage')
              "
            />
          </label>
        </div>
      </header>

      <Transition :name="transitionName" mode="out-in" @after-enter="restoreSectionPosition">
        <nav
          v-if="section === 'menu'"
          key="menu"
          class="store-menu-grid"
          :aria-label="t('store.categoryLabel')"
        >
          <button class="store-menu-card" type="button" @click="openSection('packages')">
            <AppIcon
              class="store-menu-icon"
              :source="icons.shop.package"
            />
            <span>Packages</span>
          </button>
          <button class="store-menu-card" type="button" @click="openSection('runtime')">
            <AppIcon
              class="store-menu-icon"
              :source="icons.shop.server"
            />
            <span>Runtime</span>
          </button>
        </nav>
        <section v-else :key="section" class="store-catalog">

          <section
            v-if="section === 'runtime' && runtimeAvailability"
            class="runtime-capacity"
            aria-labelledby="runtime-capacity-title"
          >
            <div>
              <h2 id="runtime-capacity-title" class="text-2xl font-extrabold tracking-tight">
                {{ t('store.runtimeAvailability') }}
              </h2>
              <p class="mt-xxs text-xs text-text-secondary tablet:text-sm">
                {{ t('store.runtimeOneSlotOneBot') }}
              </p>
            </div>
            <dl class="runtime-capacity-stats">
              <div>
                <dt>{{ t('store.runtimeUsed') }}</dt>
                <dd class="text-text-primary">{{ runtimeAvailability.usedSlots }}</dd>
              </div>
              <div>
                <dt>{{ t('store.runtimeAvailable') }}</dt>
                <dd class="text-success-text">{{ runtimeAvailability.availableSlots }}</dd>
              </div>
              <div>
                <dt>{{ t('store.runtimeTotal') }}</dt>
                <dd class="text-text-primary">{{ runtimeAvailability.totalSlots }}</dd>
              </div>
            </dl>
            <ol class="runtime-slot-grid" :aria-label="t('store.runtimeSlotMap')">
              <li
                v-for="slot in runtimeAvailability.slots"
                :key="slot.slotNumber"
                class="runtime-slot"
                :class="{ 'runtime-slot--occupied': slot.occupancy === 'OCCUPIED' }"
              >
                <span class="runtime-slot__label">SLOT-{{ slot.slotNumber }}</span>
                <span
                  class="runtime-slot__badge"
                  :class="
                    slot.occupancy === 'OCCUPIED'
                      ? 'runtime-slot__badge--occupied'
                      : 'runtime-slot__badge--available'
                  "
                >
                  <span class="runtime-slot__dot" aria-hidden="true" />
                  {{ slot.occupancy === 'OCCUPIED' ? t('store.runtimeOccupied') : t('store.runtimeFree') }}
                </span>
              </li>
            </ol>
          </section>

          <div v-if="section === 'runtime' && runtimeError" class="store-error" role="status">
            <p>{{ runtimeError }}</p>
            <AppButton class="tablet:!w-auto" variant="secondary" @click="() => loadStore()">
              {{ t('store.retry') }}
            </AppButton>
          </div>

          <div v-if="loading" class="mt-xl grid gap-xl tablet:grid-cols-2 desktop:grid-cols-3">
            <div
              v-for="item in 6"
              :key="item"
              class="h-[427px] animate-pulse rounded-xl bg-bg-surface"
            />
          </div>

          <div v-else-if="error" class="store-error" role="alert">
            <p>{{ error }}</p>
            <AppButton class="tablet:!w-auto" variant="secondary" @click="() => loadStore()">
              {{ t('store.retry') }}
            </AppButton>
          </div>

          <div
            v-else-if="visibleCards.length"
            class="mt-xl grid gap-xl tablet:grid-cols-2 desktop:grid-cols-3"
          >
            <article v-for="card in visibleCards" :key="card.id" class="product-card">
              <div class="product-artwork">
                <img
                  v-if="card.feature.image"
                  :src="card.feature.image.url"
                  :alt="card.feature.image.altText ?? card.feature.name"
                  class="size-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <template v-else>
                  <span class="text-xs font-semibold uppercase tracking-widest text-text-secondary">{{
                    t('store.artworkComingSoon')
                  }}</span>
                </template>
                <span
                  v-if="card.feature.featured"
                  class="absolute left-sm top-sm rounded-full bg-bg-inverse px-sm py-xs text-xs font-semibold text-text-inverse"
                  >{{ t('store.featured') }}</span
                >
              </div>
              <div class="flex flex-1 flex-col gap-md p-md">
                <div>
                  <div class="flex items-start justify-between gap-sm">
                    <h2 class="text-xl font-semibold">{{ card.feature.name }}</h2>
                    <span class="rounded-md bg-bg-elevated px-xs py-xxs text-xs text-text-secondary"
                      >v{{ card.feature.version }}</span
                    >
                  </div>
                  <p class="mt-xs line-clamp-3 text-sm leading-6 text-text-secondary">
                    {{ card.feature.description }}
                  </p>
                </div>
                <div class="mt-auto border-t border-border-subtle pt-md">
                  <div class="mb-sm flex items-end justify-between gap-sm">
                    <div>
                      <p class="font-semibold">{{ offerName(card.offer) }}</p>
                      <p class="mt-xxs flex items-center gap-xxs text-xs text-text-secondary">
                        <Clock3 :size="14" />{{ offerCaption(card.offer) }} ·
                        {{ t('store.slots', { count: card.offer.installationLimit }) }}
                      </p>
                    </div>
                    <strong>{{ money(card.offer.priceSatang, card.offer.currency) }}</strong>
                  </div>
                  <AppButton
                    :disabled="
                      Boolean(buyingOfferId) ||
                      (isRuntime(card.feature) &&
                        (!runtimeAvailability || runtimeAvailability.availableSlots <= 0))
                    "
                    @click="requestBuy(card)"
                  >
                    {{
                      buyingOfferId === card.offer.id
                        ? t('store.buying')
                        : isAuthenticated
                          ? t('store.buy')
                          : t('store.signInToBuy')
                    }}
                  </AppButton>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="py-5xl text-center text-text-secondary">
            <p>{{ section === 'runtime' ? t('store.noRuntime') : t('store.noPackage') }}</p>
          </div>
        </section>
      </Transition>
    </div>

    <AppModal
      :open="Boolean(selectedCard)"
      :disabled="Boolean(buyingOfferId)"
      :title="t('store.confirmPurchase')"
      size="sm"
      @update:open="(open) => !open && (selectedCard = null)"
    >
      <template v-if="selectedCard">
        <p class="mt-xs text-text-secondary">
          {{ selectedCard.feature.name }} · {{ offerName(selectedCard.offer) }}
        </p>
        <dl class="mt-lg space-y-sm rounded-lg bg-bg-elevated p-md">
          <div class="flex justify-between gap-md">
            <dt>{{ t('store.quantity') }}</dt>
            <dd>{{ t('store.oneItem') }}</dd>
          </div>
          <div
            class="flex justify-between gap-md border-t border-border-subtle pt-sm font-semibold"
          >
            <dt>{{ t('store.total') }}</dt>
            <dd>{{ money(selectedCard.offer.priceSatang, selectedCard.offer.currency) }}</dd>
          </div>
        </dl>
        <p class="mt-md text-sm text-text-muted">{{ t('store.purchaseNote') }}</p>
      </template>
      <template v-if="selectedCard" #actions>
        <AppButton
          variant="secondary"
          :disabled="Boolean(buyingOfferId)"
          @click="selectedCard = null"
          >{{ t('store.cancel') }}</AppButton
        >
        <AppButton :disabled="Boolean(buyingOfferId)" @click="confirmBuy">{{
          buyingOfferId ? t('store.buying') : t('store.confirmPayment')
        }}</AppButton>
      </template>
    </AppModal>

    <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" />
  </main>
</template>

<style scoped>
.store-page {
  overflow-anchor: none;
  min-height: calc(100vh - 4.25rem);
}
.store-page > .page-container {
  padding-bottom: calc(var(--spacing-5xl) - 0.25rem);
}
.store-header {
  display: grid;
  gap: var(--spacing-xl);
}
.store-title-row {
  min-height: 3.5rem;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.store-toolbar {
  min-height: 2.75rem;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.store-breadcrumb {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
.store-breadcrumb-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-decoration: none;
}
.store-breadcrumb-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.store-breadcrumb-link:focus-visible {
  border-radius: var(--radius-xs);
  outline: 2px solid var(--color-border-accent);
  outline-offset: 3px;
}
.store-breadcrumb-tail {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  animation: breadcrumb-slide 220ms ease-out both;
}
.store-menu-grid {
  display: grid;
  width: min(100%, 34rem);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: var(--spacing-xl);
  gap: var(--spacing-lg);
}
.store-catalog {
  min-height: 18rem;
}
.runtime-capacity {
  display: grid;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-xl);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-xl);
  background: var(--color-bg-surface);
}
.runtime-capacity-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-sm);
}
.runtime-capacity-stats > div {
  padding: var(--spacing-md) var(--spacing-sm);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  text-align: center;
}
.runtime-capacity-stats dt {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 500;
}
.runtime-capacity-stats dd {
  margin-top: var(--spacing-xxs);
  font-size: var(--font-size-heading-h3);
  font-weight: 800;
  line-height: 1;
}
.runtime-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xs);
}
.runtime-slot {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  padding: 0.625rem var(--spacing-sm);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    transform 150ms ease;
}
.runtime-slot:hover {
  border-color: var(--color-border-default);
  background: var(--color-bg-surface);
  transform: translateY(-1px);
}
.runtime-slot__label {
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-text-secondary);
}
.runtime-slot__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.3;
}
.runtime-slot__badge--available {
  border: 1px solid color-mix(in srgb, var(--semantic-color-success-success-text) 30%, transparent);
  background: color-mix(in srgb, var(--semantic-color-success-success-text) 12%, transparent);
  color: color-mix(
    in srgb,
    var(--semantic-color-success-success-text) 78%,
    var(--semantic-color-text-text-primary)
  );
}
.runtime-slot__badge--available .runtime-slot__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: var(--radius-full);
  background: var(--semantic-color-success-success-text);
  box-shadow: 0 0 6px var(--semantic-color-success-success-text);
}
.runtime-slot__badge--occupied {
  border: 1px solid var(--color-border-subtle);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
}
.runtime-slot__badge--occupied .runtime-slot__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  opacity: 0.6;
}
.runtime-slot--occupied {
  border-style: dashed;
}
.runtime-slot--occupied .runtime-slot__label {
  color: var(--color-text-secondary);
}
.store-menu-card {
  display: flex;
  aspect-ratio: 1;
  width: 100%;
  max-width: 16rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font: inherit;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}
.store-menu-card:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-surface-hover);
  transform: translateY(-2px);
}
.store-menu-card:focus-visible {
  outline: 2px solid var(--color-border-accent);
  outline-offset: 3px;
}
.store-menu-icon {
  width: var(--icon-size-64);
  height: var(--icon-size-64);
}
.search-field {
  width: 100%;
  height: 2.75rem;
  padding: 0 var(--spacing-sm) 0 var(--spacing-xl);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  outline: none;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
}
.search-field:focus {
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-border-accent) 20%, transparent);
}
.product-card {
  display: flex;
  min-height: 427px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
}
.product-artwork {
  position: relative;
  display: flex;
  min-height: 213px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  overflow: hidden;
  background: var(--color-bg-elevated);
}
.store-error {
  display: flex;
  margin-top: var(--spacing-xl);
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
}
.store-forward-enter-active,
.store-forward-leave-active,
.store-backward-enter-active,
.store-backward-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms ease;
}
.store-forward-enter-from,
.store-backward-leave-to {
  opacity: 0;
  transform: translateX(var(--spacing-xl));
}
.store-forward-leave-to,
.store-backward-enter-from {
  opacity: 0;
  transform: translateX(calc(var(--spacing-xl) * -1));
}
@keyframes breadcrumb-slide {
  from {
    opacity: 0;
    transform: translateX(calc(var(--spacing-sm) * -1));
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@media (min-width: 40rem) {
  .store-title-row,
  .store-toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .runtime-slot-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .store-menu-card,
  .store-forward-enter-active,
  .store-forward-leave-active,
  .store-backward-enter-active,
  .store-backward-leave-active {
    transition: none;
  }
  .store-breadcrumb-tail {
    animation: none;
  }
}
@media (max-width: 36rem) {
  .store-menu-grid {
    width: min(100%, 16rem);
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
