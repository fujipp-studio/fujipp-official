<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Layers, RefreshCw, Pencil, Image as ImageIcon, Plus, Send } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import {
  AppButton,
  AppFileField,
  AppModal,
  AppSectionIndicator,
  AppTextArea,
  AppTextField,
  AppToast,
  AppToggle,
} from '../../../shared/ui'
import { useAuthStore } from '../../../stores'
import {
  deleteAdminFeatureImage,
  createAdminFeatureOffer,
  fetchAdminFeatures,
  publishAdminFeature,
  updateAdminFeature,
  updateAdminFeatureOffer,
  updateAdminFeatureTutorial,
  uploadAdminFeatureImage,
  type AdminFeature,
  type AdminFeatureOffer,
} from '@/features/admin/api/features'
import { AdminLayout, AdminPageHeader, AdminPanel, AdminStatusBadge } from '../components'
const auth = useAuthStore()
const { session } = storeToRefs(auth)
const items = ref<AdminFeature[]>([]),
  loading = ref(false),
  error = ref(''),
  query = ref('')
const { t } = useI18n()
const standardCategories = ['COMMUNITY', 'DISCORD_UTILITY', 'PAYMENTS', 'ROBLOX', 'UTILITY']
const standardIconKeys = [
  'activity',
  'gamepad-2',
  'headphones',
  'image-search',
  'message-circle-heart',
  'server',
  'wallet-cards',
]
const sections = computed(() => [
  { id: 'admin-feature-catalog', label: t('admin.sections.catalog') },
])
const selected = ref<AdminFeature | null>(null),
  offer = ref<AdminFeatureOffer | null>(null),
  creatingOffer = ref(false),
  saving = ref(false),
  publishingId = ref<string | null>(null),
  toastOpen = ref(false),
  toastMessage = ref(''),
  toastVariant = ref<'info' | 'success' | 'error'>('info'),
  file = ref<File | null>(null)
const form = ref({
  name: '',
  description: '',
  category: '',
  iconKey: '',
  status: 'ACTIVE',
  featured: false,
  sortOrder: '0',
  tutorialUrl: '',
  altText: '',
})
const offerForm = ref({
  code: '',
  name: '',
  kind: 'ONE_TIME',
  price: '',
  limit: '1',
  billingDays: '',
  active: true,
})
const filtered = computed(() =>
  items.value.filter((x) =>
    `${x.name} ${x.code} ${x.category}`.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
const categoryOptions = computed(() =>
  [...new Set([...standardCategories, ...items.value.map((item) => item.category)])]
    .filter(Boolean)
    .sort()
    .map((value) => ({ value, label: value.replaceAll('_', ' ') })),
)
const iconKeyOptions = computed(() =>
  [
    ...new Set([
      ...standardIconKeys,
      ...items.value.flatMap((item) => (item.iconKey ? [item.iconKey] : [])),
    ]),
  ]
    .sort()
    .map((value) => ({ value, label: value })),
)
async function load() {
  if (!session.value) return
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchAdminFeatures(session.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.loadError')
  } finally {
    loading.value = false
  }
}
function edit(x: AdminFeature) {
  selected.value = x
  form.value = {
    name: x.name,
    description: x.description,
    category: x.category,
    iconKey: x.iconKey ?? '',
    status: x.status,
    featured: x.featured,
    sortOrder: String(x.sortOrder),
    tutorialUrl: x.tutorialUrl ?? '',
    altText: x.imageAltText ?? '',
  }
  file.value = null
}
function editOffer(x: AdminFeature, o: AdminFeatureOffer) {
  selected.value = x
  offer.value = o
  creatingOffer.value = false
  offerForm.value = {
    code: o.code,
    name: o.name,
    kind: o.kind,
    price: String(o.priceSatang / 100),
    limit: String(o.installationLimit),
    billingDays: o.billingPeriodDays ? String(o.billingPeriodDays) : '',
    active: o.active,
  }
}
function addOffer(x: AdminFeature) {
  selected.value = x
  offer.value = null
  creatingOffer.value = true
  offerForm.value = {
    code: '',
    name: '',
    kind: 'ONE_TIME',
    price: '',
    limit: '1',
    billingDays: '',
    active: true,
  }
}
function closeOfferModal() {
  offer.value = null
  creatingOffer.value = false
  selected.value = null
}
async function save() {
  if (!session.value || !selected.value) return
  saving.value = true
  try {
    await updateAdminFeature(
      selected.value.id,
      {
        name: form.value.name,
        description: form.value.description,
        category: form.value.category,
        iconKey: form.value.iconKey || null,
        status: form.value.status as AdminFeature['status'],
        featured: form.value.featured,
        sortOrder: Number(form.value.sortOrder),
      },
      session.value,
    )
    await updateAdminFeatureTutorial(
      selected.value.id,
      form.value.tutorialUrl || null,
      session.value,
    )
    if (file.value)
      await uploadAdminFeatureImage(
        selected.value.id,
        file.value,
        form.value.altText,
        session.value,
      )
    selected.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function saveOffer() {
  if (!session.value || !selected.value || (!offer.value && !creatingOffer.value)) return
  saving.value = true
  try {
    const input = {
      name: offerForm.value.name,
      priceSatang: Math.round(Number(offerForm.value.price) * 100),
      installationLimit: Number(offerForm.value.limit),
      active: offerForm.value.active,
    }
    if (creatingOffer.value) {
      await createAdminFeatureOffer(
        selected.value.id,
        {
          ...input,
          code: offerForm.value.code.trim(),
          kind: offerForm.value.kind as 'ONE_TIME' | 'SUBSCRIPTION',
          billingPeriodDays:
            offerForm.value.kind === 'SUBSCRIPTION' ? Number(offerForm.value.billingDays) : null,
        },
        session.value,
      )
    } else if (offer.value) {
      await updateAdminFeatureOffer(
        selected.value.id,
        offer.value.id,
        {
          ...input,
          startsAt: offer.value.startsAt,
          endsAt: offer.value.endsAt,
        },
        session.value,
      )
    }
    offer.value = null
    creatingOffer.value = false
    selected.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function publishFeature(x: AdminFeature) {
  if (!session.value) return
  publishingId.value = x.id
  error.value = ''
  try {
    const published = await publishAdminFeature(x.id, session.value)
    const index = items.value.findIndex((item) => item.id === x.id)
    if (index >= 0) items.value[index] = published
    showToast(t('admin.page.publishSuccess', { version: published.latestVersion ?? '' }), 'success')
  } catch (e) {
    const message = e instanceof Error ? e.message : t('admin.page.publishError')
    error.value = message
    showToast(message, 'error')
  } finally {
    publishingId.value = null
  }
}
function showToast(message: string, variant: 'info' | 'success' | 'error') {
  toastMessage.value = message
  toastVariant.value = variant
  toastOpen.value = false
  requestAnimationFrame(() => (toastOpen.value = true))
}
async function removeImage() {
  if (!session.value || !selected.value) return
  saving.value = true
  try {
    await deleteAdminFeatureImage(selected.value.id, session.value)
    selected.value = null
    await load()
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<template>
  <AdminLayout
    ><div class="space-y-3xl">
      <AdminPageHeader
        :title="t('admin.page.featureTitle')"
        :description="t('admin.page.featureDescription')"
        :icon="Layers"
        ><template #actions
          ><div class="w-full tablet:w-80">
            <AppTextField v-model="query" label="" :placeholder="t('admin.page.featureSearch')" />
          </div>
          <AppButton class="!w-auto" variant="secondary" :disabled="loading" @click="load"
            ><RefreshCw class="size-4" />{{ t('admin.common.refresh') }}</AppButton
          ></template
        ></AdminPageHeader
      >
      <div
        v-if="error"
        class="rounded-xl border border-error-border bg-error-bg p-md text-error-text"
      >
        {{ error }}
      </div>
      <section id="admin-feature-catalog">
        <AdminPanel>
          <div v-if="loading" class="py-xl text-center text-text-muted">
            {{ t('admin.common.loading') }}
          </div>
          <div v-else class="grid gap-md desktop:grid-cols-2">
            <article
              v-for="x in filtered"
              :key="x.id"
              class="rounded-xl border border-border-subtle bg-bg-elevated p-md"
            >
              <div class="flex gap-md">
                <img
                  v-if="x.imageUrl"
                  :src="x.imageUrl"
                  :alt="x.imageAltText ?? x.name"
                  class="size-20 rounded-lg object-cover"
                />
                <div
                  v-else
                  class="grid size-20 place-items-center rounded-lg border border-border-subtle bg-bg-surface"
                >
                  <ImageIcon class="size-5 text-text-muted" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex justify-between gap-sm">
                    <div>
                      <h3 class="font-bold text-text-primary">{{ x.name }}</h3>
                      <p class="text-xs text-text-muted">{{ x.code }} · {{ x.category }}</p>
                      <div v-if="x.latestVersion" class="mt-xs flex items-center gap-xs text-xs">
                        <span class="text-text-muted">v{{ x.latestVersion }}</span>
                        <AdminStatusBadge
                          appearance="indicator"
                          :value="x.versionStatus ?? 'DRAFT'"
                          :label="
                            x.versionStatus === 'PUBLISHED'
                              ? t('admin.page.published')
                              : t('admin.page.unpublished')
                          "
                        />
                      </div>
                    </div>
                    <AdminStatusBadge :value="x.status" />
                  </div>
                  <p class="mt-sm line-clamp-2 text-sm text-text-secondary">{{ x.description }}</p>
                </div>
              </div>
              <div class="mt-md space-y-xs border-t border-border-subtle pt-md">
                <div
                  v-if="!x.offers.length"
                  class="rounded-lg border border-dashed border-border-default bg-bg-surface p-md"
                >
                  <p class="text-sm font-semibold text-text-primary">
                    {{ t('admin.page.noFeatureOffers') }}
                  </p>
                  <p class="mt-xxs text-xs text-text-muted">
                    {{ t('admin.page.noFeatureOffersDescription') }}
                  </p>
                  <AppButton class="mt-sm !w-auto" @click="addOffer(x)">
                    <Plus class="size-4" />{{ t('admin.page.addOffer') }}
                  </AppButton>
                </div>
                <div
                  v-for="o in x.offers"
                  :key="o.id"
                  class="flex items-center justify-between rounded-lg bg-bg-surface p-sm text-sm"
                >
                  <div>
                    <b class="text-text-primary">{{ o.name }}</b>
                    <p class="text-xs text-text-muted">
                      {{ o.kind }} · {{ t('admin.page.limit') }} {{ o.installationLimit }}
                    </p>
                  </div>
                  <div class="flex items-center gap-sm">
                    <AdminStatusBadge
                      appearance="indicator"
                      :value="o.active ? 'ACTIVE' : 'DISABLED'"
                      :label="o.active ? t('admin.common.onSale') : t('admin.common.notOnSale')"
                    />
                    <b class="text-text-accent">฿{{ (o.priceSatang / 100).toLocaleString() }}</b
                    ><button
                      class="rounded-md p-xs text-text-secondary hover:bg-bg-surface-hover"
                      :aria-label="t('admin.page.editOffer')"
                      @click="editOffer(x, o)"
                    >
                      <Pencil class="size-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div class="mt-md flex flex-wrap gap-xs">
                <AppButton class="!w-auto" @click="edit(x)"
                  ><Pencil class="size-4" />{{ t('admin.page.editFeature') }}</AppButton
                >
                <AppButton v-if="x.offers.length" class="!w-auto" @click="addOffer(x)"
                  ><Plus class="size-4" />{{ t('admin.page.addOffer') }}</AppButton
                >
                <AppButton
                  class="!w-auto"
                  variant="secondary"
                  :disabled="publishingId === x.id || x.versionStatus === 'PUBLISHED'"
                  @click="publishFeature(x)"
                  ><Send class="size-4" />{{
                    publishingId === x.id
                      ? t('admin.page.publishing')
                      : x.versionStatus === 'PUBLISHED'
                        ? t('admin.page.published')
                        : t('admin.page.publishVersion')
                  }}</AppButton
                >
              </div>
            </article>
          </div></AdminPanel
        >
      </section>
      <AppSectionIndicator :sections="sections" :aria-label="t('admin.sections.navigation')" />
      <AppModal
        :open="Boolean(selected) && !offer && !creatingOffer"
        :title="t('admin.page.editFeature')"
        size="lg"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) selected = null
          }
        "
        ><div class="grid gap-md tablet:grid-cols-2">
          <AppTextField v-model="form.name" :label="t('admin.page.feature')" /><AppTextField
            v-model="form.category"
            variant="dropdown"
            :label="t('admin.page.category')"
            :options="categoryOptions"
            searchable
            :search-placeholder="t('admin.page.searchCategory')"
            :empty-text="t('admin.page.noCategorySuggestions')"
          /><AppTextField
            v-model="form.iconKey"
            variant="dropdown"
            :label="t('admin.page.iconKey')"
            :options="iconKeyOptions"
            searchable
            :search-placeholder="t('admin.page.searchIconKey')"
            :empty-text="t('admin.page.noIconSuggestions')"
          /><AppTextField
            v-model="form.sortOrder"
            input-type="number"
            :label="t('admin.page.sortOrder')"
          /><AppTextField
            v-model="form.status"
            variant="dropdown"
            :label="t('admin.common.status')"
            :options="[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]"
          /><AppToggle :model-value="form.featured" @change="(v) => (form.featured = v)">{{
            t('admin.page.featured')
          }}</AppToggle>
          <div class="tablet:col-span-2">
            <AppTextArea v-model="form.description" :label="t('admin.page.description')" />
          </div>
          <div class="tablet:col-span-2">
            <AppTextField
              v-model="form.tutorialUrl"
              :label="t('admin.page.tutorialUrl')"
              input-type="url"
            />
          </div>
          <AppFileField
            v-model="file"
            :label="t('admin.page.featureImage')"
            accept="image/jpeg,image/png,image/webp"
          /><AppTextField v-model="form.altText" :label="t('admin.page.altText')" />
        </div>
        <template #actions
          ><AppButton
            v-if="selected?.imageUrl"
            variant="primary"
            :disabled="saving"
            @click="removeImage"
            >{{ t('admin.page.deleteImage') }}</AppButton
          ><AppButton variant="primary" :disabled="saving" @click="selected = null">{{
            t('admin.common.cancel')
          }}</AppButton
          ><AppButton variant="secondary" :disabled="saving" @click="save">{{
            t('admin.common.save')
          }}</AppButton></template
        ></AppModal
      >
      <AppModal
        :open="Boolean(offer) || creatingOffer"
        :title="creatingOffer ? t('admin.page.addOffer') : t('admin.page.editOffer')"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) {
              offer = null
              creatingOffer = false
              selected = null
            }
          }
        "
        ><div class="grid gap-md tablet:grid-cols-2">
          <AppTextField
            v-if="creatingOffer"
            v-model="offerForm.code"
            :label="t('admin.page.offerCode')"
            placeholder="monthly-plan"
          />
          <AppTextField v-model="offerForm.name" :label="t('admin.page.offerName')" />
          <AppTextField
            v-if="creatingOffer"
            v-model="offerForm.kind"
            variant="dropdown"
            :label="t('admin.page.offerKind')"
            :options="[
              { value: 'ONE_TIME', label: t('admin.page.oneTime') },
              { value: 'SUBSCRIPTION', label: t('admin.page.subscription') },
            ]"
          />
          <AppTextField
            v-model="offerForm.price"
            :label="t('admin.page.price')"
            input-type="number"
            unit="฿"
          /><AppTextField
            v-model="offerForm.limit"
            :label="t('admin.page.installationLimit')"
            input-type="number"
          /><AppTextField
            v-if="creatingOffer && offerForm.kind === 'SUBSCRIPTION'"
            v-model="offerForm.billingDays"
            :label="t('admin.page.billingDays')"
            input-type="number"
          /><AppToggle :model-value="offerForm.active" @change="(v) => (offerForm.active = v)">{{
            t('admin.page.onSale')
          }}</AppToggle>
        </div>
        <template #actions
          ><AppButton variant="primary" :disabled="saving" @click="closeOfferModal">{{
            t('admin.common.cancel')
          }}</AppButton
          ><AppButton variant="secondary" :disabled="saving" @click="saveOffer">{{
            t('admin.page.savePrice')
          }}</AppButton></template
        ></AppModal
      >
      <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" /></div
  ></AdminLayout>
</template>
