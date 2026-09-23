<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LayoutPanelTop, Plus, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { AppButton, AppTextField } from '../../../shared/ui'

interface PanelRow {
  id: string
  key: string
  name: string
  groupKeys: string[]
  presentationSlot: string
}

const props = defineProps<{ panelsJson: string; groupsJson: string }>()
const emit = defineEmits<{ (e: 'update:panelsJson', value: string): void }>()
const { t } = useI18n()
const panels = ref<PanelRow[]>([])
let initialized = false

const groups = computed(() => {
  try {
    const value = JSON.parse(props.groupsJson)
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const key = String(Reflect.get(item, 'key') ?? '').trim()
      if (!key) return []
      return [{ key, name: String(Reflect.get(item, 'name') ?? key).trim() || key }]
    })
  } catch {
    return []
  }
})

function newPanel(index: number): PanelRow {
  return {
    id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    key: `panel-${index}`,
    name: `Panel ${index}`,
    groupKeys: [],
    presentationSlot: `panel_${index}`,
  }
}

watch(
  () => props.panelsJson,
  (raw) => {
    if (initialized) return
    try {
      const value = JSON.parse(raw)
      if (Array.isArray(value) && value.length) {
        panels.value = value.flatMap((item, index) => {
          if (!item || typeof item !== 'object') return []
          return [
            {
              id: `panel-${Date.now()}-${index}`,
              key: String(Reflect.get(item, 'key') ?? `panel-${index + 1}`),
              name: String(Reflect.get(item, 'name') ?? `Panel ${index + 1}`),
              groupKeys: Array.isArray(Reflect.get(item, 'groupKeys'))
                ? (Reflect.get(item, 'groupKeys') as unknown[]).map(String)
                : [],
              presentationSlot: /^panel_(?:[1-9]|1\d|2[0-5])$/.test(
                String(Reflect.get(item, 'presentationSlot') ?? ''),
              )
                ? String(Reflect.get(item, 'presentationSlot'))
                : `panel_${index + 1}`,
            },
          ]
        })
      }
    } catch {
      /* Start with a safe default panel below. */
    }
    if (!panels.value.length) {
      const panel = newPanel(1)
      panel.key = 'main'
      panel.name = 'Main Panel'
      panel.groupKeys = groups.value.map((group) => group.key)
      panels.value = [panel]
    }
    initialized = true
  },
  { immediate: true },
)

watch(
  panels,
  (value) => {
    if (!initialized) return
    const known = new Set(groups.value.map((group) => group.key))
    emit(
      'update:panelsJson',
      JSON.stringify(
        value.map((panel, index) => ({
          key: (panel.key || `panel-${index + 1}`).trim(),
          name: (panel.name || `Panel ${index + 1}`).trim(),
          groupKeys: [...new Set(panel.groupKeys.filter((key) => known.has(key)))],
          presentationSlot: panel.presentationSlot,
        })),
        null,
        2,
      ),
    )
  },
  { deep: true },
)

watch(groups, (value) => {
  if (!initialized) return
  const known = new Set(value.map((group) => group.key))
  for (const panel of panels.value) {
    panel.groupKeys = panel.groupKeys.filter((key) => known.has(key))
  }
})

function addPanel() {
  const nextSlot = Array.from({ length: 25 }, (_, index) => `panel_${index + 1}`).find(
    (slot) => !panels.value.some((panel) => panel.presentationSlot === slot),
  )
  if (!nextSlot) return
  const panel = newPanel(panels.value.length + 1)
  panel.presentationSlot = nextSlot
  panels.value.push(panel)
}

function removePanel(index: number) {
  if (panels.value.length > 1) panels.value.splice(index, 1)
}

function sanitizeKey(panel: PanelRow) {
  panel.key = panel.key.toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

function toggleGroup(panel: PanelRow, key: string, enabled: boolean) {
  panel.groupKeys = enabled
    ? [...new Set([...panel.groupKeys, key])]
    : panel.groupKeys.filter((item) => item !== key)
}
</script>

<template>
  <section class="mt-lg rounded-lg border border-border-subtle bg-bg-surface p-lg">
    <header class="flex flex-wrap items-center justify-between gap-md">
      <div class="flex items-center gap-sm">
        <LayoutPanelTop class="size-5 text-text-accent" />
        <div>
          <h3 class="font-semibold">{{ t('botSettings.robuxPanels') }}</h3>
          <p class="text-sm text-text-secondary">{{ t('botSettings.assignGroupsToEachPanel') }}</p>
        </div>
      </div>
      <AppButton @click="addPanel"
        ><Plus class="size-4" /> {{ t('botSettings.addPanel') }}</AppButton
      >
    </header>

    <div class="mt-md grid gap-md">
      <article
        v-for="(panel, index) in panels"
        :key="panel.id"
        class="rounded-lg border border-border-default p-md"
      >
        <div class="grid gap-md desktop:grid-cols-2">
          <AppTextField v-model="panel.name" :label="t('botSettings.panelName')" required />
          <AppTextField
            :model-value="panel.key"
            :label="t('botSettings.panelKey')"
            required
            @update:model-value="
              (value) => {
                panel.key = value
                sanitizeKey(panel)
              }
            "
          />
        </div>
        <fieldset class="mt-md">
          <legend class="text-sm font-medium">{{ t('botSettings.groupsSoldOnThisPanel') }}</legend>
          <div class="mt-sm grid gap-sm tablet:grid-cols-2 desktop:grid-cols-3">
            <label
              v-for="group in groups"
              :key="group.key"
              class="flex cursor-pointer items-center gap-sm rounded-md border border-border-subtle p-sm"
            >
              <input
                type="checkbox"
                :checked="panel.groupKeys.includes(group.key)"
                @change="toggleGroup(panel, group.key, ($event.target as HTMLInputElement).checked)"
              />
              <span class="min-w-0"
                ><strong class="block truncate text-sm">{{ group.name }}</strong
                ><small class="text-text-muted">{{ group.key }}</small></span
              >
            </label>
          </div>
          <p v-if="!groups.length" class="mt-sm text-sm text-text-muted">
            {{ t('botSettings.addRobloxGroupsBeforeAssigningPanels') }}
          </p>
        </fieldset>
        <div class="mt-md flex justify-end">
          <AppButton v-if="panels.length > 1" variant="secondary" @click="removePanel(index)">
            <Trash2 class="size-4" /> {{ t('botSettings.deletePanel') }}
          </AppButton>
        </div>
      </article>
    </div>
  </section>
</template>
