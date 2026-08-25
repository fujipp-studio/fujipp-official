<script setup lang="ts">
import { computed, ref } from 'vue'

import { icons, type IconSource } from '../config'
import { AppFooter, AppNavbar } from '../shared/layout'
import {
  AppAuthDialog,
  AppAuthLoadingOverlay,
  AppButton,
  AppFileField,
  AppIcon,
  AppImageLightbox,
  AppModal,
  AppMultiSelect,
  AppProgressiveImage,
  AppSectionIndicator,
  AppTextArea,
  AppTextField,
  AppToast,
  AppToggle,
} from '../shared/ui'
import AuthMark from '../shared/ui/dialogs/AuthMark.vue'
import AppTurnstile from '../shared/ui/security/AppTurnstile.vue'
import ComponentCard from './components/ComponentCatalogCard.vue'

const textValue = ref('Example value')
const emptyValue = ref('')
const dropdownValue = ref('thb')
const secretValue = ref('fujipp-secret')
const textareaValue = ref('A longer description helps reviewers inspect spacing and readability.')
const multiSelectValue = ref(['vue', 'typescript'])
const fileValue = ref<File | null>(null)
const toggleValue = ref(true)
const modalOpen = ref(false)
const lightboxOpen = ref(false)
const authOpen = ref(false)
const loadingOpen = ref(false)
const toast = ref<{ open: boolean; variant: 'info' | 'success' | 'error'; message: string }>({ open: false, variant: 'info', message: '' })
const fieldOptions = [
  { label: 'Thai Baht', value: 'thb' }, { label: 'US Dollar', value: 'usd' }, { label: 'Japanese Yen', value: 'jpy' },
] as const
const multiSelectOptions = [
  { label: 'Vue.js', value: 'vue', group: 'Frontend' }, { label: 'TypeScript', value: 'typescript', group: 'Language' },
  { label: 'Bun', value: 'bun', group: 'Runtime' }, { label: 'Supabase', value: 'supabase', group: 'Backend' },
] as const
const sections = [
  { id: 'layout', label: 'Layout' }, { id: 'actions', label: 'Actions' }, { id: 'fields', label: 'Fields' },
  { id: 'feedback', label: 'Dialogs and feedback' }, { id: 'media', label: 'Icons and images' }, { id: 'navigation', label: 'Navigation' },
] as const
const iconEntries = computed(() => Object.entries(icons).flatMap(([category, items]) =>
  Object.entries(items).map(([name, source]) => ({ category, name, source: source as IconSource })),
))
function showToast(variant: 'info' | 'success' | 'error') {
  toast.value = { open: true, variant, message: `${variant[0]?.toUpperCase()}${variant.slice(1)} notification preview` }
}
function showLoading() {
  loadingOpen.value = true
  window.setTimeout(() => (loadingOpen.value = false), 1200)
}
</script>

<template>
  <main class="component-catalog">
    <header class="catalog-hero">
      <p class="catalog-eyebrow">Fujipp interface inventory</p>
      <h1>Components</h1>
      <p>Shared components and their primary states, collected for UI/UX review.</p>
      <span>{{ iconEntries.length }} icons · 18 shared components</span>
    </header>
    <AppSectionIndicator :sections="sections" aria-label="Component groups" />

    <section id="layout" class="catalog-section" aria-labelledby="layout-title">
      <div class="section-heading"><p>Layout</p><h2 id="layout-title">Navigation and footer</h2></div>
      <ComponentCard name="AppNavbar" note="Guest state" allow-overflow><AppNavbar /></ComponentCard>
      <ComponentCard name="AppNavbar" note="Authenticated state" allow-overflow><AppNavbar authenticated /></ComponentCard>
      <ComponentCard name="AppFooter" note="Default content"><AppFooter /></ComponentCard>
    </section>

    <section id="actions" class="catalog-section" aria-labelledby="actions-title">
      <div class="section-heading"><p>Actions</p><h2 id="actions-title">Buttons and toggles</h2></div>
      <ComponentCard name="AppButton" note="Variants, icons and states" padded>
        <div class="preview-grid preview-grid--compact">
          <AppButton :left-icon="icons.base.add">Primary</AppButton>
          <AppButton variant="secondary" :right-icon="icons.base.arrowRight">Secondary</AppButton>
          <AppButton loading>Loading</AppButton><AppButton disabled>Disabled</AppButton>
          <AppButton href="#fields" variant="secondary">Anchor button</AppButton>
        </div>
      </ComponentCard>
      <ComponentCard name="AppToggle" note="On, off and disabled" padded>
        <div class="preview-row">
          <AppToggle :model-value="toggleValue" label="Notifications" @change="toggleValue = $event" />
          <AppToggle :model-value="false" label="Off" /><AppToggle :model-value="true" label="Disabled" disabled />
        </div>
      </ComponentCard>
    </section>

    <section id="fields" class="catalog-section" aria-labelledby="fields-title">
      <div class="section-heading"><p>Forms</p><h2 id="fields-title">Fields and input states</h2></div>
      <ComponentCard name="AppTextField" note="Text, dropdown, secret and validation states" padded>
        <div class="preview-grid">
          <AppTextField v-model="textValue" label="Filled" support-text="Support text" />
          <AppTextField v-model="emptyValue" label="Empty" placeholder="Placeholder" />
          <AppTextField v-model="textValue" state="focused" label="Focused" />
          <AppTextField v-model="textValue" state="error" label="Error" support-text="Check this value" />
          <AppTextField v-model="dropdownValue" variant="dropdown" label="Dropdown" :options="fieldOptions" searchable />
          <AppTextField v-model="secretValue" variant="secret" label="Secret" support-text="Show and hide interaction" />
          <AppTextField v-model="textValue" label="Disabled" disabled />
        </div>
      </ComponentCard>
      <ComponentCard name="AppTextArea" note="Default, error and disabled" padded>
        <div class="preview-grid">
          <AppTextArea v-model="textareaValue" label="Description" support-text="Supporting guidance" />
          <AppTextArea v-model="emptyValue" state="error" label="Error" support-text="Description is required" />
          <AppTextArea v-model="textareaValue" label="Disabled" disabled />
        </div>
      </ComponentCard>
      <ComponentCard name="AppMultiSelect" note="Grouped searchable options" padded>
        <div class="field-limit"><AppMultiSelect v-model="multiSelectValue" label="Technology" :options="multiSelectOptions" support-text="Select and reorder technologies" /></div>
      </ComponentCard>
      <ComponentCard name="AppFileField" note="Empty, error and disabled" padded>
        <div class="preview-grid">
          <AppFileField v-model="fileValue" label="Project image" accept="image/*" support-text="PNG, WebP or AVIF" />
          <AppFileField label="Required image" state="error" support-text="Choose an image" required />
          <AppFileField label="Disabled" disabled />
        </div>
      </ComponentCard>
    </section>

    <section id="feedback" class="catalog-section" aria-labelledby="feedback-title">
      <div class="section-heading"><p>Dialogs and feedback</p><h2 id="feedback-title">Overlays, modal and toast</h2></div>
      <ComponentCard name="AppModal · AppImageLightbox · AppAuthDialog" note="Open each overlay to inspect interaction" padded>
        <div class="preview-grid preview-grid--compact">
          <AppButton @click="modalOpen = true">Open modal</AppButton>
          <AppButton variant="secondary" @click="lightboxOpen = true">Open lightbox</AppButton>
          <AppButton variant="secondary" @click="authOpen = true">Open auth dialog</AppButton>
          <AppButton variant="secondary" @click="showLoading">Show loading overlay</AppButton>
        </div>
      </ComponentCard>
      <ComponentCard name="AppToast" note="Info, success and error" padded>
        <div class="preview-grid preview-grid--compact">
          <AppButton variant="secondary" @click="showToast('info')">Info toast</AppButton>
          <AppButton variant="secondary" @click="showToast('success')">Success toast</AppButton>
          <AppButton variant="secondary" @click="showToast('error')">Error toast</AppButton>
        </div>
      </ComponentCard>
      <ComponentCard name="AuthMark" note="Authentication brand mark" padded><AuthMark class="auth-mark-preview" /></ComponentCard>
      <ComponentCard name="AppTurnstile" note="Inactive catalog state — no external challenge is loaded" padded><AppTurnstile site-key="" /></ComponentCard>
    </section>

    <section id="media" class="catalog-section" aria-labelledby="media-title">
      <div class="section-heading"><p>Media</p><h2 id="media-title">Icons and progressive images</h2></div>
      <ComponentCard name="AppIcon" :note="`${iconEntries.length} registered assets`" padded>
        <div class="icon-grid"><div v-for="icon in iconEntries" :key="`${icon.category}-${icon.name}`" class="icon-item"><AppIcon :source="icon.source" /><span>{{ icon.category }}/{{ icon.name }}</span></div></div>
      </ComponentCard>
      <ComponentCard name="AppProgressiveImage" note="Placeholder to responsive WebP" padded>
        <AppProgressiveImage class="image-preview" src="/images/home/developer-portal-display-640.webp" placeholder-src="/images/home/developer-portal-display-lqip.webp" alt="Developer portal interface preview" width="640" height="659" loading="eager" fit="contain" />
      </ComponentCard>
    </section>

    <section id="navigation" class="catalog-section" aria-labelledby="navigation-title">
      <div class="section-heading"><p>Navigation</p><h2 id="navigation-title">Section indicator</h2></div>
      <ComponentCard name="AppSectionIndicator" note="Visible at the right edge and linked to every catalog group" padded><p class="component-copy">Scroll this page or use the indicator to move between sections.</p></ComponentCard>
    </section>

    <AppModal v-model:open="modalOpen" title="AppModal" subtitle="Modal preview with header, body and actions">
      <p class="component-copy">Use Escape, the close button, or the backdrop to dismiss this dialog.</p>
      <template #actions><AppButton variant="secondary" @click="modalOpen = false">Close</AppButton></template>
    </AppModal>
    <AppImageLightbox v-model:open="lightboxOpen" src="/images/home/developer-portal-display-1024.webp" alt="Developer portal interface" caption="AppImageLightbox preview" />
    <AppAuthDialog v-model:open="authOpen" />
    <AppAuthLoadingOverlay :open="loadingOpen" message="Loading component preview…" />
    <AppToast v-model:open="toast.open" :variant="toast.variant" :message="toast.message" :duration="4000" />
  </main>
</template>

<style scoped>
.component-catalog { min-height: 100vh; padding: var(--space-xl) var(--layout-page-gutter) var(--space-3xl); background: var(--semantic-color-background-bg-surface); color: var(--semantic-color-text-text-primary); }
.catalog-hero, .catalog-section { width: min(100%, 80rem); margin-inline: auto; }
.catalog-hero { display: grid; gap: var(--space-xs); padding-block: var(--space-xl) var(--space-2xl); }
.catalog-hero h1 { font-size: clamp(2.75rem, 8vw, 6rem); font-weight: var(--typography-font-weight-bold); line-height: .95; }
.catalog-hero > p:last-of-type { max-width: 42rem; color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-body-large); }
.catalog-hero span, .catalog-eyebrow { color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); font-weight: var(--typography-font-weight-medium); letter-spacing: .08em; text-transform: uppercase; }
.catalog-section { display: grid; gap: var(--space-lg); padding-block: var(--space-2xl); scroll-margin-top: var(--space-lg); }
.section-heading { display: grid; gap: var(--space-xxs); }
.section-heading p { color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); letter-spacing: .08em; text-transform: uppercase; }
.section-heading h2 { font-size: var(--font-size-heading-h2); font-weight: var(--typography-font-weight-bold); }
:deep(.component-card) { display: grid; gap: var(--space-xs); }
:deep(.component-card > header) { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-xs); }
:deep(.component-card > header code) { font-family: var(--font-family-mono); font-weight: var(--typography-font-weight-bold); }
:deep(.component-card > header span) { color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); }
:deep(.component-preview) { overflow: hidden; border: 1px solid var(--semantic-color-border-border-subtle); border-radius: var(--corner-radius-md); background: var(--semantic-color-background-bg-default); }
:deep(.component-preview--allow-overflow) { overflow: visible; }
:deep(.component-preview .navbar--at-top .desktop-navbar > .brand .brand__lockup) { transform: none; }
:deep(.component-preview--padded) { padding: var(--space-lg); }
.preview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: var(--space-lg); }
.preview-grid--compact { grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); }
.preview-row { display: flex; flex-wrap: wrap; gap: var(--space-lg); }
.field-limit { max-width: 38rem; }
.auth-mark-preview { width: 5rem; height: 5rem; }
.icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr)); gap: var(--space-sm); }
.icon-item { display: grid; min-width: 0; justify-items: center; gap: var(--space-xs); padding: var(--space-sm); border: 1px solid var(--semantic-color-border-border-subtle); border-radius: var(--corner-radius-sm); background: var(--semantic-color-background-bg-surface); text-align: center; }
.icon-item :deep(.app-icon) { width: var(--icon-size-32); height: var(--icon-size-32); }
.icon-item span { overflow-wrap: anywhere; color: var(--semantic-color-text-text-secondary); font-family: var(--font-family-mono); font-size: .6875rem; }
.image-preview { display: block; width: min(100%, 32rem); aspect-ratio: 640 / 659; }
.component-copy { color: var(--semantic-color-text-text-secondary); line-height: var(--line-height-body); }
@media (max-width: 47.99rem) { .component-catalog { padding-top: var(--space-md); } :deep(.component-preview--padded) { padding: var(--space-md); } }
</style>
