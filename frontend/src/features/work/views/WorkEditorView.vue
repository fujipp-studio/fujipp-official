<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createAdminWork,
  createAdminTechnology,
  deleteAdminWorkMedia,
  fetchAdminWork,
  fetchAdminWorkCatalog,
  fetchAdminWorkContent,
  fetchAdminWorkLinks,
  fetchAdminWorkMedia,
  publishAdminWork,
  saveAdminWorkDraft,
  unpublishAdminWork,
  uploadAdminWorkMedia,
  type AdminWorkContent,
  type AdminWorkCatalog,
  type AdminWorkInput,
  type AdminWorkLink,
  type AdminWorkMedia,
  type AdminWorkStatus,
  type AdminWorkTranslation,
  type WorkLocale,
} from '../../../services/backend'
import { AppFooter } from '../../../shared/layout'
import { AppButton, AppFileField, AppImageLightbox, AppModal, AppMultiSelect, AppSectionIndicator, AppTextArea, AppTextField, AppToast } from '../../../shared/ui'
import { useAuthStore } from '../../../stores'

type TranslationInput = Omit<AdminWorkTranslation, 'locale'>
type EditorContent = Omit<AdminWorkContent, 'id' | 'translations'> & {
  id?: string
  translations: Record<WorkLocale, { title: string; description: string }>
}
type EditorLink = Omit<AdminWorkLink, 'id'> & { id?: string }

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isEdit = computed(() => route.name === 'work-edit')
const workId = computed(() => String(route.params.id ?? ''))
const canEdit = computed(() => ['EDITOR', 'ADMIN'].includes(authStore.currentUser?.role ?? ''))
const loading = ref(isEdit.value)
const saving = ref(false)
const error = ref('')
const toastOpen = ref(false)
const toastMessage = ref('')
const catalog = ref<AdminWorkCatalog>({ categories: [], positions: [], technologyGroups: [], technologies: [] })
const simpleIcons = ref<Array<{ title: string; slug: string; source: string }>>([])
const technologySearch = ref('')
const technologyModalOpen = ref(false)
const creatingTechnology = ref(false)
const pendingTechnology = reactive({ name: '', slug: '', groupCode: '', officialUrl: '', fromSimpleIcons: false })
const contentItems = ref<EditorContent[]>([])
const links = ref<EditorLink[]>([])
const media = ref<AdminWorkMedia[]>([])
const removedContentIds = ref<string[]>([])
const removedLinkIds = ref<string[]>([])
const uploading = ref(false)
const publishing = ref(false)
const publicationStatus = ref<'DRAFT' | 'PUBLISHED'>('DRAFT')
const featured = ref(false)
const featuredOrder = ref('')
const mediaLightboxOpen = ref(false)
const previewMedia = ref<AdminWorkMedia>()
const mediaInput = reactive<{ type: AdminWorkMedia['type']; altText: string; file: File | null }>({
  type: 'GALLERY',
  altText: '',
  file: null,
})

const form = reactive({
  slug: '',
  categoryCode: '',
  status: 'PLANNED' as AdminWorkStatus,
  startedOn: '',
  completedOn: '',
  positions: [] as string[],
  technologies: [] as string[],
})

function emptyTranslation(): TranslationInput {
  return { name: '', shortDescription: '', overview: '', feasibility: '', targetUsers: '' }
}

const translations = reactive<Record<WorkLocale, TranslationInput>>({
  en: emptyTranslation(),
  th: emptyTranslation(),
})

const statuses: AdminWorkStatus[] = ['PLANNED', 'IN_PROGRESS', 'ACTIVE', 'COMPLETED', 'ARCHIVED']
const statusOptions = statuses.map((status) => ({ label: status.replaceAll('_', ' '), value: status }))
const contentGroups: Array<{
  type: AdminWorkContent['type']
  title: string
  description: string
}> = [
  { type: 'FEATURE', title: 'Features', description: 'The capabilities and experiences delivered by the project.' },
  { type: 'CHALLENGE', title: 'Challenges', description: 'The technical or product problems solved during development.' },
  { type: 'LEARNING', title: 'Learnings', description: 'The knowledge and practices gained from building the project.' },
]
const linkTypeOptions = ['FIGMA', 'GITHUB', 'WEBSITE', 'YOUTUBE', 'CERTIFICATE', 'LIVE', 'OTHER'].map((type) => ({ label: type, value: type }))
const mediaTypeOptions = [
  { label: 'Gallery', value: 'GALLERY' },
  { label: 'Architecture', value: 'ARCHITECTURE' },
]
const editorSections = [
  { id: 'editor-project-setup', label: 'Project setup' },
  { id: 'editor-content', label: 'Content' },
  { id: 'editor-taxonomy', label: 'Roles and technology' },
  { id: 'editor-project-sections', label: 'Project sections' },
  { id: 'editor-links', label: 'Project links' },
  { id: 'editor-images', label: 'Images' },
  { id: 'editor-publication', label: 'Publication' },
] as const
const categoryOptions = computed(() => catalog.value.categories.map((item) => ({ label: item.name, value: item.code })))
const positionOptions = computed(() => catalog.value.positions.map((item) => ({ label: item.name, value: item.code })))
const technologyGroupOptions = computed(() => catalog.value.technologyGroups.map((item) => ({ label: item.name, value: item.code })))
const technologyOptions = computed(() => {
  const existing = catalog.value.technologies.map((item) => ({ label: item.name, value: item.slug, group: item.groupName }))
  const query = technologySearch.value.trim().toLowerCase()
  if (query.length < 2) return existing
  const existingSlugs = new Set(catalog.value.technologies.map((item) => item.slug))
  const matches = simpleIcons.value
    .filter((item) => !existingSlugs.has(item.slug) && `${item.title} ${item.slug}`.toLowerCase().includes(query))
    .slice(0, 50)
    .map((item) => ({ label: item.title, value: item.slug, group: 'Simple Icons · add to catalog' }))
  return [...existing, ...matches]
})

function openTechnologyModal(icon?: { title: string; slug: string; source: string }) {
  Object.assign(pendingTechnology, {
    name: icon?.title ?? '',
    slug: icon?.slug ?? '',
    groupCode: catalog.value.technologyGroups[0]?.code ?? '',
    officialUrl: icon?.source ?? '',
    fromSimpleIcons: Boolean(icon),
  })
  technologyModalOpen.value = true
}

function updateTechnologies(next: string[]) {
  const newSlug = next.find((slug) => !form.technologies.includes(slug))
  if (!newSlug || catalog.value.technologies.some((item) => item.slug === newSlug)) {
    form.technologies = next
    return
  }
  const icon = simpleIcons.value.find((item) => item.slug === newSlug)
  if (icon) openTechnologyModal(icon)
}

async function confirmTechnology() {
  if (!authStore.session || !pendingTechnology.name.trim() || !pendingTechnology.slug.trim() || !pendingTechnology.groupCode) return
  creatingTechnology.value = true
  try {
    const technology = await createAdminTechnology({
      name: pendingTechnology.name.trim(),
      slug: pendingTechnology.slug.trim().toLowerCase(),
      groupCode: pendingTechnology.groupCode,
      officialUrl: pendingTechnology.officialUrl.trim() || null,
      iconUrl: pendingTechnology.fromSimpleIcons ? `https://cdn.simpleicons.org/${pendingTechnology.slug.trim().toLowerCase()}` : null,
    }, authStore.session)
    catalog.value.technologies.push(technology)
    if (!form.technologies.includes(technology.slug)) form.technologies.push(technology.slug)
    technologyModalOpen.value = false
    technologySearch.value = ''
  } catch (reason) {
    toastMessage.value = reason instanceof Error ? reason.message : 'Unable to create the technology.'
    toastOpen.value = true
  } finally {
    creatingTechnology.value = false
  }
}

function applyTranslation(locale: WorkLocale, translation?: AdminWorkTranslation) {
  if (!translation) return
  Object.assign(translations[locale], {
    name: translation.name,
    shortDescription: translation.shortDescription,
    overview: translation.overview,
    feasibility: translation.feasibility,
    targetUsers: translation.targetUsers,
  })
}

async function loadEditor() {
  if (!isEdit.value || !authStore.session) return
  loading.value = true
  error.value = ''
  try {
    const [work, savedContent, savedLinks, savedMedia] = await Promise.all([
      fetchAdminWork(workId.value, authStore.session),
      fetchAdminWorkContent(workId.value, authStore.session),
      fetchAdminWorkLinks(workId.value, authStore.session),
      fetchAdminWorkMedia(workId.value, authStore.session),
    ])
    Object.assign(form, {
      slug: work.slug,
      categoryCode: work.categoryCode,
      status: work.status,
      startedOn: work.startedOn ?? '',
      completedOn: work.completedOn ?? '',
      positions: work.positions,
      technologies: work.technologies,
    })
    applyTranslation('en', work.translations.find((translation) => translation.locale === 'en'))
    applyTranslation('th', work.translations.find((translation) => translation.locale === 'th'))
    contentItems.value = savedContent.map((item) => ({
      id: item.id,
      type: item.type,
      sortOrder: item.sortOrder,
      translations: {
        en: item.translations.find((translation) => translation.locale === 'en') ?? { title: '', description: '' },
        th: item.translations.find((translation) => translation.locale === 'th') ?? { title: '', description: '' },
      },
    }))
    links.value = savedLinks
    media.value = savedMedia
    publicationStatus.value = work.publicationStatus
    featured.value = work.featured
    featuredOrder.value = work.featuredOrder === null ? '' : String(work.featuredOrder)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load this work.'
  } finally {
    loading.value = false
  }
}

async function saveWork() {
  if (!authStore.session || !canEdit.value) return
  const incompleteLocale = (['en', 'th'] as const).find((locale) =>
    Object.values(translations[locale]).some((value) => !value.trim()),
  )
  if (incompleteLocale) {
    error.value = `Complete every ${incompleteLocale.toUpperCase()} content field before saving.`
    toastMessage.value = error.value
    toastOpen.value = true
    return
  }
  const incompleteContent = contentItems.value.find((item) =>
    (['en', 'th'] as const).some((locale) =>
      !item.translations[locale].title.trim() || !item.translations[locale].description.trim(),
    ),
  )
  if (incompleteContent) {
    error.value = 'Complete the EN and TH title and description for every content item.'
    toastMessage.value = error.value
    toastOpen.value = true
    return
  }

  saving.value = true
  error.value = ''
  try {
    const creating = !isEdit.value
    const input: AdminWorkInput = {
      slug: form.slug.trim(),
      categoryCode: form.categoryCode.trim(),
      status: form.status,
      startedOn: form.startedOn || null,
      completedOn: form.completedOn || null,
    }
    const saved = creating
      ? await createAdminWork(input, authStore.session)
      : { id: workId.value }

    if (creating) await router.replace({ name: 'work-edit', params: { id: saved.id } })
    normalizeContentOrder()
    links.value.forEach((link, index) => { link.sortOrder = index + 1 })
    const result = await saveAdminWorkDraft(saved.id, {
      work: input,
      en: translations.en,
      th: translations.th,
      positions: { codes: form.positions },
      technologies: { codes: form.technologies },
      content: contentItems.value.map((item) => ({
        id: item.id,
        type: item.type,
        sortOrder: item.sortOrder,
        en: item.translations.en,
        th: item.translations.th,
      })),
      links: links.value.map((link) => ({
        id: link.id,
        value: {
          type: link.type,
          label: link.label,
          url: link.url,
          sortOrder: link.sortOrder,
        },
      })),
    }, authStore.session)
    contentItems.value = result.content.map((item) => ({
      id: item.id,
      type: item.type,
      sortOrder: item.sortOrder,
      translations: {
        en: item.translations.find((translation) => translation.locale === 'en') ?? { title: '', description: '' },
        th: item.translations.find((translation) => translation.locale === 'th') ?? { title: '', description: '' },
      },
    }))
    links.value = result.links
    removedContentIds.value = []
    removedLinkIds.value = []

    toastMessage.value = creating ? 'Work created successfully.' : 'Work updated successfully.'
    toastOpen.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to save this work.'
    toastMessage.value = error.value
    toastOpen.value = true
  } finally {
    saving.value = false
  }
}

function contentForType(type: AdminWorkContent['type']) {
  return contentItems.value.filter((item) => item.type === type)
}

function normalizeContentOrder() {
  contentGroups.forEach(({ type }) => {
    contentForType(type).forEach((item, index) => { item.sortOrder = index + 1 })
  })
}

function addContent(type: AdminWorkContent['type']) {
  contentItems.value.push({
    type,
    sortOrder: contentForType(type).length + 1,
    translations: { en: { title: '', description: '' }, th: { title: '', description: '' } },
  })
}

function removeContent(item: EditorContent) {
  const index = contentItems.value.indexOf(item)
  if (index < 0) return
  const [removed] = contentItems.value.splice(index, 1)
  if (removed?.id) removedContentIds.value.push(removed.id)
  normalizeContentOrder()
}

function addLink() {
  links.value.push({ type: 'WEBSITE', label: '', url: '', sortOrder: links.value.length + 1 })
}

function removeLink(index: number) {
  const [removed] = links.value.splice(index, 1)
  if (removed?.id) removedLinkIds.value.push(removed.id)
}

async function uploadMedia() {
  if (!authStore.session || !workId.value || !mediaInput.file) return
  uploading.value = true
  error.value = ''
  try {
    const sameType = media.value.filter((item) => item.type === mediaInput.type)
    const uploaded = await uploadAdminWorkMedia(workId.value, {
      type: mediaInput.type,
      sortOrder: mediaInput.type === 'ARCHITECTURE' ? 1 : sameType.length + 1,
      altText: mediaInput.altText,
      file: mediaInput.file,
    }, authStore.session)
    media.value.push(uploaded)
    mediaInput.altText = ''
    mediaInput.file = null
    toastMessage.value = 'Image uploaded successfully.'
    toastOpen.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to upload image.'
    toastMessage.value = error.value
    toastOpen.value = true
  } finally {
    uploading.value = false
  }
}

async function removeMedia(item: AdminWorkMedia) {
  if (!authStore.session) return
  try {
    await deleteAdminWorkMedia(workId.value, item.id, authStore.session)
    media.value = media.value.filter((mediaItem) => mediaItem.id !== item.id)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to delete image.'
    toastMessage.value = error.value
    toastOpen.value = true
  }
}

function viewMedia(item: AdminWorkMedia) {
  previewMedia.value = item
  mediaLightboxOpen.value = true
}

async function togglePublication() {
  if (!authStore.session || !isEdit.value) return
  publishing.value = true
  error.value = ''
  try {
    const updated = publicationStatus.value === 'PUBLISHED'
      ? await unpublishAdminWork(workId.value, authStore.session)
      : await publishAdminWork(workId.value, {
          featured: featured.value,
          featuredOrder: featuredOrder.value ? Number(featuredOrder.value) : null,
        }, authStore.session)
    publicationStatus.value = updated.publicationStatus
    featured.value = updated.featured
    featuredOrder.value = updated.featuredOrder === null ? '' : String(updated.featuredOrder)
    toastMessage.value = updated.publicationStatus === 'PUBLISHED' ? 'Work published.' : 'Work returned to draft.'
    toastOpen.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to change publication status.'
    toastMessage.value = error.value
    toastOpen.value = true
  } finally {
    publishing.value = false
  }
}

onMounted(async () => {
  void fetch('/data/simple-icons.json')
    .then((response) => response.ok ? response.json() : [])
    .then((items) => { simpleIcons.value = items })
    .catch(() => { simpleIcons.value = [] })
  await authStore.initialize()
  if (canEdit.value && authStore.session) {
    try {
      catalog.value = await fetchAdminWorkCatalog(authStore.session)
      await loadEditor()
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'Unable to load the work editor.'
      loading.value = false
    }
  }
  else loading.value = false
})
</script>

<template>
  <div class="work-editor-page">
    <main class="work-editor page-container">
      <RouterLink class="editor-back" :to="{ name: 'work' }">
        <ArrowLeft :size="17" aria-hidden="true" />
        Back to work
      </RouterLink>

      <section v-if="!authStore.initialized || loading" class="editor-state" aria-busy="true">
        <p>Loading editor…</p>
      </section>
      <section v-else-if="!authStore.session" class="editor-state">
        <p class="editor-eyebrow">Restricted page</p>
        <h1>Sign in to continue.</h1>
        <p>Use the Sign in action in the navigation bar, then return to this path.</p>
      </section>
      <section v-else-if="!canEdit" class="editor-state">
        <p class="editor-eyebrow">Access denied</p>
        <h1>Editor access is required.</h1>
        <p>This page is available to Editor and Admin accounts only.</p>
      </section>
      <section v-else-if="error && isEdit && !form.slug" class="editor-state">
        <p class="editor-eyebrow">Could not load work</p>
        <h1>{{ error }}</h1>
      </section>

      <form v-else class="editor-form" @submit.prevent="saveWork">
        <header class="editor-header">
          <div>
            <!-- <p class="editor-eyebrow">Work editor</p> -->
            <h1>{{ isEdit ? 'Edit work' : 'Add work' }}</h1>
          </div>
          <AppButton class="editor-save" type="submit" variant="primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save draft' }}
          </AppButton>
        </header>

        <section id="editor-project-setup" class="editor-section" aria-labelledby="project-setup-heading">
          <div class="editor-section__heading">
            <span>01</span>
            <div>
              <h2 id="project-setup-heading">Project setup</h2>
              <p>Core information used to identify and organize this work.</p>
            </div>
          </div>
          <div class="editor-grid">
            <AppTextField v-model="form.slug" label="Slug" required :maxlength="100" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="my-project" />
            <AppTextField v-model="form.categoryCode" label="Category" variant="dropdown" required :options="categoryOptions" placeholder="Select category" />
            <AppTextField v-model="form.status" label="Status" variant="dropdown" required :options="statusOptions" placeholder="Select status" />
            <AppTextField v-model="form.startedOn" label="Started on" input-type="date" placeholder="" />
            <AppTextField v-model="form.completedOn" label="Completed on" input-type="date" placeholder="" :required="form.status === 'COMPLETED'" />
          </div>
        </section>

        <section id="editor-content" class="editor-section" aria-labelledby="translations-heading">
          <div class="editor-section__heading">
            <span>02</span>
            <div>
              <h2 id="translations-heading">Content</h2>
              <p>Write the public project content in both supported languages.</p>
            </div>
          </div>
          <div class="content-languages content-languages--project">
            <fieldset>
              <legend>English</legend>
              <AppTextField v-model="translations.en.name" label="Name" required :maxlength="100" />
              <AppTextField v-model="translations.en.shortDescription" label="Short description" required :maxlength="120" />
              <AppTextArea v-model="translations.en.overview" label="Overview" required :maxlength="2000" :rows="5" />
              <AppTextArea v-model="translations.en.feasibility" label="Approach & feasibility" required :maxlength="2000" />
              <AppTextArea v-model="translations.en.targetUsers" label="Target users" required :maxlength="2000" />
            </fieldset>
            <fieldset>
              <legend>ภาษาไทย</legend>
              <AppTextField v-model="translations.th.name" label="ชื่อโปรเจกต์" required :maxlength="100" />
              <AppTextField v-model="translations.th.shortDescription" label="คำอธิบายสั้น" required :maxlength="120" />
              <AppTextArea v-model="translations.th.overview" label="ภาพรวม" required :maxlength="2000" :rows="5" />
              <AppTextArea v-model="translations.th.feasibility" label="แนวทางและความเป็นไปได้" required :maxlength="2000" />
              <AppTextArea v-model="translations.th.targetUsers" label="ผู้ใช้งานเป้าหมาย" required :maxlength="2000" />
            </fieldset>
          </div>
        </section>

        <section id="editor-taxonomy" class="editor-section" aria-labelledby="taxonomy-heading">
          <div class="editor-section__heading">
            <span>03</span>
            <div>
              <h2 id="taxonomy-heading">Roles & technology</h2>
              <p>Enter existing codes separated by commas. Their order controls display order.</p>
            </div>
          </div>
          <div class="editor-grid">
            <AppMultiSelect v-model="form.positions" label="Positions" :options="positionOptions" placeholder="Search positions…" support-text="Selection order controls display order." />
            <div class="technology-picker">
              <AppMultiSelect
                :model-value="form.technologies"
                label="Technologies"
                :options="technologyOptions"
                placeholder="Search technologies…"
                support-text="Search the saved catalog or Simple Icons. Type at least 2 characters."
                @search="technologySearch = $event"
                @update:model-value="updateTechnologies"
              />
              <AppButton type="button" variant="secondary" @click="openTechnologyModal()">Add custom technology</AppButton>
            </div>
          </div>
        </section>

        <section id="editor-project-sections" class="editor-section" aria-labelledby="content-blocks-heading">
          <div class="editor-section__heading">
            <span>04</span>
            <div>
              <h2 id="content-blocks-heading">Project sections</h2>
              <p>Add features, challenges, and learnings shown on the detail page.</p>
            </div>
          </div>
          <div class="content-groups">
            <section v-for="group in contentGroups" :key="group.type" class="content-group">
              <header class="content-group__header">
                <div>
                  <h3>{{ group.title }}</h3>
                  <p>{{ group.description }}</p>
                </div>
                <AppButton class="editor-small-button" type="button" variant="primary" @click="addContent(group.type)">
                  Add {{ group.title.toLowerCase().replace(/s$/, '') }}
                </AppButton>
              </header>
              <div class="editor-collection editor-collection--content">
                <article v-for="(item, index) in contentForType(group.type)" :key="item.id ?? `${group.type}-${index}`" class="editor-card editor-card--content">
                  <div class="editor-card__header">
                    <strong>{{ group.title.replace(/s$/, '') }} {{ index + 1 }}</strong>
                    <button type="button" @click="removeContent(item)">Remove</button>
                  </div>
                  <div class="content-languages">
                    <fieldset>
                      <legend>English</legend>
                      <AppTextField v-model="item.translations.en.title" label="Title" required :maxlength="200" />
                      <AppTextArea v-model="item.translations.en.description" label="Description" required :maxlength="4000" />
                    </fieldset>
                    <fieldset>
                      <legend>ภาษาไทย</legend>
                      <AppTextField v-model="item.translations.th.title" label="ชื่อหัวข้อ" required :maxlength="200" />
                      <AppTextArea v-model="item.translations.th.description" label="รายละเอียด" required :maxlength="4000" />
                    </fieldset>
                  </div>
                </article>
                <p v-if="!contentForType(group.type).length" class="editor-empty">No {{ group.title.toLowerCase() }} yet.</p>
              </div>
            </section>
          </div>
        </section>

        <section id="editor-links" class="editor-section" aria-labelledby="links-heading">
          <div class="editor-section__heading editor-section__heading--action">
            <span>05</span>
            <div>
              <h2 id="links-heading">Project links</h2>
              <p>Add GitHub, website, certificate, design, or live project links.</p>
            </div>
            <AppButton class="editor-small-button" type="button" variant="primary" @click="addLink">Add link</AppButton>
          </div>
          <div class="editor-collection">
            <article v-for="(link, index) in links" :key="link.id ?? `link-${index}`" class="editor-card editor-card--link">
              <div class="editor-card__header">
                <strong>Link {{ index + 1 }}</strong>
                <button type="button" @click="removeLink(index)">Remove</button>
              </div>
              <AppTextField v-model="link.type" label="Type" variant="dropdown" :options="linkTypeOptions" />
              <AppTextField v-model="link.label" label="Label" required :maxlength="100" />
              <AppTextField v-model="link.url" label="HTTPS URL" input-type="url" required placeholder="https://" />
            </article>
            <p v-if="!links.length" class="editor-empty">No project links yet.</p>
          </div>
        </section>

        <section id="editor-images" class="editor-section" aria-labelledby="media-heading">
          <div class="editor-section__heading">
            <span>06</span>
            <div>
              <h2 id="media-heading">Images</h2>
              <p>Upload up to five Gallery images and one Architecture image.</p>
            </div>
          </div>
          <div v-if="!isEdit" class="editor-locked">Save the project first before uploading images.</div>
          <template v-else>
            <div class="media-upload">
              <AppTextField v-model="mediaInput.type" label="Image type" variant="dropdown" :options="mediaTypeOptions" />
              <AppTextField v-model="mediaInput.altText" label="Alternative text" :maxlength="255" placeholder="Describe the image" />
              <AppFileField v-model="mediaInput.file" label="Image file" accept="image/jpeg,image/png,image/webp" support-text="JPEG, PNG, or WebP up to 8 MiB" />
              <AppButton class="editor-small-button" type="button" variant="primary" :disabled="uploading || !mediaInput.file" @click="uploadMedia">
                {{ uploading ? 'Uploading…' : 'Upload image' }}
              </AppButton>
            </div>
            <div class="media-grid">
              <article v-for="item in media" :key="item.id" class="media-card">
                <button type="button" class="media-card__preview" :aria-label="`View ${item.altText || item.type} full screen`" @click="viewMedia(item)">
                  <img :src="item.url" :alt="item.altText ?? ''" />
                </button>
                <div>
                  <strong>{{ item.type }}</strong>
                  <span>{{ item.altText || 'No alternative text' }}</span>
                </div>
                <button type="button" class="media-card__remove" @click="removeMedia(item)">Remove</button>
              </article>
              <p v-if="!media.length" class="editor-empty">No images uploaded yet.</p>
            </div>
          </template>
        </section>

        <section id="editor-publication" class="editor-section" aria-labelledby="publication-heading">
          <div class="editor-section__heading">
            <span>07</span>
            <div>
              <h2 id="publication-heading">Publication</h2>
              <p>Publish the finished project or return it to draft.</p>
            </div>
          </div>
          <div v-if="!isEdit" class="editor-locked">Save the project and complete its content before publishing.</div>
          <div v-else class="publication-panel">
            <div>
              <span class="publication-status">{{ publicationStatus }}</span>
              <label class="featured-control">
                <input v-model="featured" type="checkbox" :disabled="publicationStatus === 'PUBLISHED'" />
                Feature this work
              </label>
              <AppTextField v-if="featured" v-model="featuredOrder" label="Featured order" input-type="number" placeholder="1" :disabled="publicationStatus === 'PUBLISHED'" />
            </div>
            <AppButton class="editor-small-button" type="button" :variant="publicationStatus === 'PUBLISHED' ? 'secondary' : 'primary'" :disabled="publishing" @click="togglePublication">
              {{ publishing ? 'Updating…' : publicationStatus === 'PUBLISHED' ? 'Unpublish' : 'Publish work' }}
            </AppButton>
          </div>
        </section>

        <div class="editor-actions">
          <AppButton class="editor-save" type="submit" variant="primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save draft' }}
          </AppButton>
        </div>
      </form>
    </main>
    <AppSectionIndicator v-if="canEdit && !loading" :sections="editorSections" aria-label="Work editor sections" />
    <AppFooter />
    <AppModal
      v-model:open="technologyModalOpen"
      title="Add technology"
      subtitle="Choose a group before saving this technology to the reusable catalog."
      :disabled="creatingTechnology"
    >
      <div class="technology-modal-fields">
        <AppTextField v-model="pendingTechnology.name" label="Name" required :maxlength="100" />
        <AppTextField v-model="pendingTechnology.slug" label="Slug" required placeholder="spring-boot" />
        <AppTextField v-model="pendingTechnology.groupCode" label="Group" variant="dropdown" :options="technologyGroupOptions" required />
        <AppTextField v-model="pendingTechnology.officialUrl" label="Official URL" input-type="url" placeholder="https://" />
      </div>
      <template #actions>
        <AppButton type="button" variant="secondary" :disabled="creatingTechnology" @click="technologyModalOpen = false">Cancel</AppButton>
        <AppButton type="button" :loading="creatingTechnology" @click="confirmTechnology">Add technology</AppButton>
      </template>
    </AppModal>
    <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="error ? 'error' : 'success'" />
    <AppImageLightbox v-if="previewMedia" v-model:open="mediaLightboxOpen" :src="previewMedia.url" :alt="previewMedia.altText ?? ''" :caption="previewMedia.altText ?? previewMedia.type" />
  </div>
</template>

<style scoped>
.work-editor-page { min-height: 100dvh; background: var(--semantic-color-background-bg-default); color: var(--semantic-color-text-text-primary); }
.work-editor { padding-block: var(--space-2xl) var(--space-4xl); }
.editor-back { display: inline-flex; align-items: center; gap: var(--space-xs); color: var(--semantic-color-text-text-secondary); text-decoration: none; }
.editor-state { display: grid; min-height: 65dvh; align-content: center; justify-items: start; max-width: 48rem; }
.editor-state h1 { margin: 0 0 var(--space-md); font-size: clamp(2.75rem, 7vw, 6rem); line-height: 0.95; letter-spacing: -0.055em; }
.editor-state > p:last-child { color: var(--semantic-color-text-text-secondary); }
.editor-form { padding-top: var(--space-3xl); }
.editor-header { display: flex; align-items: end; justify-content: space-between; gap: var(--space-xl); padding-bottom: var(--space-3xl); }
.editor-header h1 { margin: 0; font-size: clamp(3.5rem, 9vw, 7.5rem); line-height: 0.9; letter-spacing: -0.065em; }
.editor-eyebrow { margin: 0 0 var(--space-sm); font-size: var(--font-size-body-small); font-weight: var(--typography-font-weight-bold); letter-spacing: 0.08em; text-transform: uppercase; }
.editor-save { width: auto; min-width: 9rem; }
.editor-section { padding-block: var(--space-3xl); border-top: 1px solid var(--semantic-color-border-border-default); scroll-margin-top: 4rem; }
.editor-section__heading { display: grid; grid-template-columns: 3rem minmax(0, 1fr); gap: var(--space-md); margin-bottom: var(--space-2xl); }
.editor-section__heading--action { grid-template-columns: 3rem minmax(0, 1fr) auto; align-items: end; }
.editor-section__heading > span { color: var(--semantic-color-text-text-secondary); font-family: var(--font-family-mono); }
.editor-section__heading h2 { margin: 0; font-size: clamp(2rem, 4vw, 3.5rem); letter-spacing: -0.04em; }
.editor-section__heading p { margin: var(--space-xs) 0 0; color: var(--semantic-color-text-text-secondary); }
.editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-lg); padding-left: calc(3rem + var(--space-md)); }
.technology-picker { display: grid; align-content: start; gap: var(--space-sm); }
.technology-picker > :last-child { width: 100%; }
.technology-modal-fields { display: grid; gap: var(--space-md); }
.editor-small-button { width: auto; }
.editor-collection { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-lg); padding-left: calc(3rem + var(--space-md)); }
.content-groups { display: grid; gap: var(--space-3xl); padding-left: calc(3rem + var(--space-md)); }
.content-group { display: grid; gap: var(--space-lg); }
.content-group + .content-group { padding-top: var(--space-2xl); border-top: 1px solid var(--semantic-color-border-border-default); }
.content-group__header { display: flex; align-items: end; justify-content: space-between; gap: var(--space-xl); }
.content-group__header h3 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.25rem); letter-spacing: -0.025em; }
.content-group__header p { max-width: 42rem; margin: var(--space-xs) 0 0; color: var(--semantic-color-text-text-secondary); }
.editor-collection--content { grid-template-columns: 1fr; padding-left: 0; }
.editor-card { display: grid; gap: var(--space-md); padding: var(--space-lg); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-lg); background: var(--semantic-color-background-bg-surface); }
.editor-card--content { gap: var(--space-lg); }
.editor-card__header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); }
.content-languages { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-xl); }
.content-languages--project { padding-left: calc(3rem + var(--space-md)); }
.content-languages fieldset { display: grid; min-width: 0; gap: var(--space-md); margin: 0; padding: 0; border: 0; }
.content-languages legend { margin-bottom: var(--space-md); font-size: var(--font-size-body-small); font-weight: var(--typography-font-weight-bold); letter-spacing: 0.08em; text-transform: uppercase; }
.editor-card__header button, .media-card__remove { padding: 0; border: 0; background: transparent; color: var(--semantic-color-error-error-text); cursor: pointer; font: inherit; }
.editor-empty { margin: 0; color: var(--semantic-color-text-text-secondary); }
.editor-locked { margin-left: calc(3rem + var(--space-md)); padding: var(--space-xl); border: 1px dashed var(--semantic-color-border-border-default); border-radius: var(--radius-lg); color: var(--semantic-color-text-text-secondary); }
.media-upload { display: grid; grid-template-columns: minmax(10rem, 0.6fr) minmax(14rem, 1fr) minmax(14rem, 1fr) auto; align-items: start; gap: var(--space-md); padding-left: calc(3rem + var(--space-md)); }
.media-upload > .editor-small-button { margin-top: 1.75rem; }
.media-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-lg); margin-top: var(--space-xl); padding-left: calc(3rem + var(--space-md)); }
.media-card { overflow: hidden; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-lg); background: var(--semantic-color-background-bg-surface); }
.media-card__preview { display: block; width: 100%; overflow: hidden; border: 0; padding: 0; background: transparent; cursor: zoom-in; }
.media-card img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; transition: transform 180ms ease; }
.media-card__preview:hover img { transform: scale(1.025); }
.media-card > div { display: grid; gap: var(--space-2xs); padding: var(--space-md); }
.media-card > div span { overflow: hidden; color: var(--semantic-color-text-text-secondary); text-overflow: ellipsis; white-space: nowrap; }
.media-card__remove { margin: 0 var(--space-md) var(--space-md); }
.publication-panel { display: flex; align-items: end; justify-content: space-between; gap: var(--space-xl); padding-left: calc(3rem + var(--space-md)); }
.publication-panel > div { display: grid; gap: var(--space-md); min-width: min(100%, 20rem); }
.publication-status { width: fit-content; padding: var(--space-xs) var(--space-sm); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-full); font-size: var(--font-size-body-small); font-weight: var(--typography-font-weight-bold); }
.featured-control { display: flex; align-items: center; gap: var(--space-sm); font-weight: var(--typography-font-weight-medium); }
.featured-control input { width: 1.125rem; height: 1.125rem; accent-color: var(--semantic-color-text-text-primary); }
.editor-actions { display: flex; justify-content: flex-end; padding-top: var(--space-xl); border-top: 1px solid var(--semantic-color-border-border-default); }
@media (max-width: 47.99rem) {
  .work-editor { padding-block: var(--space-xl) var(--space-3xl); }
  .editor-header { align-items: start; flex-direction: column; }
  .editor-header .editor-save { display: none; }
  .editor-grid { grid-template-columns: 1fr; padding-left: 0; }
  .editor-section__heading--action { grid-template-columns: 2rem minmax(0, 1fr); }
  .editor-section__heading--action .editor-small-button { grid-column: 2; }
  .editor-section__heading { grid-template-columns: 2rem minmax(0, 1fr); }
  .editor-collection, .media-grid { grid-template-columns: 1fr; padding-left: 0; }
  .content-groups { padding-left: 0; }
  .content-group__header { align-items: stretch; flex-direction: column; }
  .content-group__header .editor-small-button { width: 100%; }
  .content-languages { grid-template-columns: 1fr; }
  .content-languages--project { padding-left: 0; }
  .editor-locked { margin-left: 0; }
  .media-upload { grid-template-columns: 1fr; padding-left: 0; }
  .media-upload .editor-small-button { width: 100%; margin-top: 0; }
  .publication-panel { align-items: stretch; flex-direction: column; padding-left: 0; }
  .publication-panel .editor-small-button { width: 100%; }
  .editor-actions .editor-save { width: 100%; }
}
</style>
