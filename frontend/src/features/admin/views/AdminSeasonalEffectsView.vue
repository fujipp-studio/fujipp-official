<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Ban, Eye, RefreshCw, Save, Sparkles } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { seasonalEffects, fetchAdminSeasonalSettings, saveSeasonalSettings, type SeasonalEffect } from '@/features/seasonal-effects/api'
import SeasonalArtwork from '@/features/seasonal-effects/components/SeasonalArtwork.vue'
import SeasonalScene from '@/features/seasonal-effects/components/SeasonalScene.vue'
import { useSeasonalEnvironment } from '@/features/seasonal-effects/useSeasonalEnvironment'
import { useSeasonalEffectsStore } from '@/stores/seasonalEffects'
import { useAuthStore } from '@/stores'
import { AppButton, AppModal, AppToast } from '@/shared/ui'
import { AdminLayout, AdminPageHeader } from '../components'

const { t, locale } = useI18n()
const auth = useAuthStore()
const store = useSeasonalEffectsStore()
const { mobile, reducedMotion, hidden } = useSeasonalEnvironment()
const draft = ref<SeasonalEffect>('NONE')
const loaded = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const preview = ref(false)
const saved = ref(false)
const controller = new AbortController()
const dirty = computed(() => draft.value !== store.settings.effect)
const updatedAt = computed(() => {
  const date = new Date(store.settings.updatedAt)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date)
})

async function load() {
  if (!auth.session || loading.value || saving.value) return
  loading.value = true
  error.value = ''
  try {
    const settings = await fetchAdminSeasonalSettings(auth.session, controller.signal)
    if (controller.signal.aborted) return
    store.accept(settings)
    draft.value = settings.effect
    loaded.value = true
  } catch {
    if (!controller.signal.aborted) error.value = t('admin.seasonal.loadError')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!auth.session || !loaded.value || saving.value || loading.value || !dirty.value) return
  const session = auth.session
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    const settings = await saveSeasonalSettings(draft.value, session)
    if (controller.signal.aborted || auth.session?.access_token !== session.access_token) return
    store.accept(settings)
    draft.value = settings.effect
    saved.value = true
  } catch {
    if (!controller.signal.aborted) error.value = t('admin.seasonal.saveError')
  } finally {
    saving.value = false
  }
}

onMounted(() => void load())
onBeforeUnmount(() => controller.abort())
</script>

<template>
  <AdminLayout>
    <div class="space-y-xl">
      <AdminPageHeader :title="t('admin.seasonal.title')" :description="t('admin.seasonal.description')" :icon="Sparkles">
        <template #actions>
          <AppButton class="!w-auto" variant="secondary" :disabled="loading || saving" @click="load">
            <RefreshCw :size="16" aria-hidden="true" />{{ t('admin.common.refresh') }}
          </AppButton>
        </template>
      </AdminPageHeader>

      <div class="seasonal-status" aria-live="polite">
        <div>
          <p class="text-body-small text-text-secondary">{{ t('admin.seasonal.active') }}</p>
          <p class="mt-xs text-heading-h3">{{ loaded ? t(`admin.seasonal.names.${store.settings.effect}`) : t('admin.common.loading') }}</p>
        </div>
        <p class="text-body-small text-text-secondary">{{ t('admin.seasonal.updatedAt') }}: {{ updatedAt }}</p>
      </div>
      <p v-if="error" role="alert" class="rounded-md border border-error-border bg-error-bg p-md text-error-text">{{ error }}</p>

      <form :aria-busy="loading || saving" @submit.prevent="save">
        <fieldset :disabled="!loaded || loading || saving">
          <legend class="mb-sm text-heading-h3">{{ t('admin.seasonal.choose') }}</legend>
          <p class="mb-lg text-body-small text-text-secondary">{{ t('admin.seasonal.description') }}</p>
          <div class="seasonal-options">
            <label v-for="(effect, index) in seasonalEffects" :key="effect" class="seasonal-option" :class="{ 'seasonal-option--selected': draft === effect }">
              <span class="seasonal-option__top">
                <span class="seasonal-option__art">
                  <Ban v-if="effect === 'NONE'" class="size-icon-32 text-text-secondary" aria-hidden="true" />
                  <SeasonalArtwork v-else :effect="effect" :variant="index - 1" />
                </span>
                <input v-model="draft" type="radio" name="seasonal-effect" :value="effect" />
              </span>
              <span class="text-label-large font-medium">{{ t(`admin.seasonal.names.${effect}`) }}</span>
              <span class="text-body-small text-text-secondary">{{ t(`admin.seasonal.details.${effect}`) }}</span>
            </label>
          </div>
        </fieldset>
        <div class="mt-lg flex flex-wrap items-center gap-sm">
          <AppButton class="!w-auto" variant="secondary" :disabled="!loaded || loading || saving || draft === 'NONE'" @click="preview = true">
            <Eye :size="16" aria-hidden="true" />{{ t('admin.seasonal.preview') }}
          </AppButton>
          <AppButton class="!w-auto" type="submit" :loading="saving" :disabled="!loaded || loading || !dirty">
            <Save :size="16" aria-hidden="true" />{{ t('admin.common.save') }}
          </AppButton>
          <p class="text-body-small text-text-secondary">{{ t('admin.seasonal.saveHint') }}</p>
        </div>
      </form>

      <AppModal v-model:open="preview" size="lg" :title="t('admin.seasonal.previewTitle')" :subtitle="t('admin.seasonal.previewHint')">
        <div class="seasonal-preview">
          <div class="seasonal-preview__copy">
            <p class="text-label-small text-text-secondary">FUJIPP</p>
            <p class="text-heading-h2">{{ t(`admin.seasonal.names.${draft}`) }}</p>
            <p class="text-body-small text-text-secondary">{{ t(`admin.seasonal.details.${draft}`) }}</p>
          </div>
          <SeasonalScene v-if="preview && !hidden" :key="draft" :effect="draft" :mobile="mobile" :still="reducedMotion" />
        </div>
        <p v-if="reducedMotion" class="mt-md text-body-small text-text-secondary">{{ t('admin.seasonal.reducedMotion') }}</p>
        <template #actions>
          <AppButton class="!w-auto" variant="secondary" @click="preview = false">{{ t('admin.common.close') }}</AppButton>
        </template>
      </AppModal>
      <AppToast v-model:open="saved" variant="success" :message="t('admin.seasonal.saved')" />
    </div>
  </AdminLayout>
</template>

<style scoped>
.seasonal-status { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-md); padding: var(--space-lg); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-lg); background: var(--semantic-color-background-bg-surface); }
.seasonal-options { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-md); }
.seasonal-option { display: flex; flex-direction: column; gap: var(--space-sm); padding: var(--space-lg); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-lg); cursor: pointer; }
.seasonal-option--selected { border-color: var(--semantic-color-action-borders-border-focus); background: var(--semantic-color-background-bg-surface); }
.seasonal-option:has(input:focus-visible) { outline: 2px solid var(--semantic-color-action-borders-border-focus); outline-offset: 2px; }
fieldset:disabled .seasonal-option { cursor: default; opacity: 0.6; }
.seasonal-option__top { display: flex; align-items: start; justify-content: space-between; }
.seasonal-option__art { display: block; width: var(--icon-size-64); height: var(--icon-size-64); }
.seasonal-option input { accent-color: var(--semantic-color-text-text-primary); }
.seasonal-preview { position: relative; min-height: 22rem; overflow: hidden; container-type: size; height: 22rem; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-md); background: var(--semantic-color-background-bg-default); }
.seasonal-preview__copy { display: flex; height: 100%; flex-direction: column; justify-content: center; gap: var(--space-sm); padding: var(--space-xl); text-align: center; }
@media (min-width: 48rem) { .seasonal-options { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
