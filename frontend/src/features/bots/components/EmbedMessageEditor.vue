<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Braces, ChevronDown, Eye, Pencil } from 'lucide-vue-next'
import type { FeatureConfiguration } from '../api'
import { useFeatureEditor } from '../composables/featureEditorContext'
import DiscordPresentationPreview from './DiscordPresentationPreview.vue'
import EmbedColorField from './EmbedColorField.vue'
import EmbedFieldsEditor from './EmbedFieldsEditor.vue'
import PresentationActionsEditor from './PresentationActionsEditor.vue'
import PresentationSystemComponentsEditor from './PresentationSystemComponentsEditor.vue'

const props = defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const { t } = useI18n()
const {
  text,
  license,
  presentationSlotLabel,
  presentationSlotDescription,
  visualDefinition,
  updatePresentation,
  embedObject,
  updateEmbedObject,
  valueLength,
  variableToken,
  variableDescription,
  advancedSlots,
  toggleAdvanced,
  presentationJson,
  previewAdvancedJson,
  presentationPreviewDefinition,
  presentationSampleValues,
  previewBot,
  usesPresentationDesigner,
  visiblePresentationSlots,
} = useFeatureEditor()
const id = useId()
const view = ref<'edit' | 'preview'>('edit')
const previewScope = ref<'current' | 'all'>('current')
const previewSlots = computed(() =>
  previewScope.value === 'all' && usesPresentationDesigner.value
    ? visiblePresentationSlots.value
    : [props.messageSlot],
)
const definition = computed(() => visualDefinition(props.messageSlot.key))
type OptionalField = {
  key: string
  label: string
  type?: 'url' | 'textarea'
  object?: 'author' | 'footer'
  limit?: number
}
const groups: { key: string; label: string; fields: OptionalField[] }[] = [
  {
    key: 'message',
    label: 'botSettings.content',
    fields: [{ key: 'content', label: 'botSettings.content', type: 'textarea', limit: 2000 }],
  },
  {
    key: 'images',
    label: 'botSettings.images',
    fields: [
      { key: 'image_url', label: 'botSettings.imageUrl', type: 'url' },
      { key: 'thumbnail_url', label: 'botSettings.thumbnailUrl', type: 'url' },
    ],
  },
  {
    key: 'author',
    label: 'botSettings.author',
    fields: [
      { key: 'name', label: 'botSettings.name', object: 'author', limit: 256 },
      { key: 'icon_url', label: 'botSettings.iconUrl', object: 'author', type: 'url' },
      { key: 'url', label: 'botSettings.authorUrl', object: 'author', type: 'url' },
    ],
  },
  {
    key: 'footer',
    label: 'botSettings.footer',
    fields: [
      { key: 'text', label: 'botSettings.footer', object: 'footer', limit: 2048 },
      { key: 'icon_url', label: 'botSettings.footerIconUrl', object: 'footer', type: 'url' },
    ],
  },
]
function fieldValue(field: OptionalField) {
  return String(
    (field.object
      ? embedObject(props.messageSlot.key, field.object)[field.key]
      : definition.value[field.key]) ?? '',
  )
}
function updateField(field: OptionalField, event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (field.object) updateEmbedObject(props.messageSlot.key, field.object, field.key, value)
  else updatePresentation(props.messageSlot.key, field.key, value)
}
function toggleJson() {
  toggleAdvanced(props.messageSlot.key)
  view.value = 'edit'
}
function configured(group: (typeof groups)[number]) {
  return (
    group.fields.some((field) => fieldValue(field).length > 0) ||
    (group.key === 'footer' && definition.value.timestamp === true)
  )
}
</script>

<template>
  <article class="embed-message-card" :aria-labelledby="id + '-title'">
    <header class="embed-message-header">
      <div class="min-w-0">
        <h3 :id="id + '-title'" class="text-lg font-semibold">
          {{ presentationSlotLabel(messageSlot) }}
        </h3>
        <p class="mt-xs text-sm text-text-secondary">
          {{ presentationSlotDescription(messageSlot) }}
        </p>
      </div>
      <button
        type="button"
        class="embed-json-toggle"
        :aria-pressed="advancedSlots.has(messageSlot.key)"
        @click="toggleJson"
      >
        <Braces :size="16" aria-hidden="true" />{{
          advancedSlots.has(messageSlot.key) ? text('Visual editor', 'แบบฟอร์ม') : 'JSON'
        }}
      </button>
    </header>

    <div class="embed-view-switch" role="group" :aria-label="text('Editor view', 'มุมมองตัวแก้ไข')">
      <button
        type="button"
        :aria-pressed="view === 'edit'"
        :aria-controls="id + '-form'"
        @click="view = 'edit'"
      >
        <Pencil :size="16" aria-hidden="true" />{{ text('Edit', 'แก้ไข') }}
      </button>
      <button
        type="button"
        :aria-pressed="view === 'preview'"
        :aria-controls="id + '-preview'"
        @click="view = 'preview'"
      >
        <Eye :size="16" aria-hidden="true" />{{ text('Preview', 'ตัวอย่าง') }}
      </button>
    </div>

    <div class="embed-workspace" :data-view="view">
      <div :id="id + '-form'" class="embed-edit-pane">
        <details v-if="messageSlot.availableVariables.length" class="embed-section embed-variables">
          <summary>
            <span>{{ t('botSettings.availableVariables') }}</span
            ><ChevronDown :size="16" aria-hidden="true" />
          </summary>
          <p class="mt-sm text-xs text-text-secondary">
            {{ t('botSettings.insertTheseVariablesIntoTextFieldsThe') }}
          </p>
          <dl class="embed-variable-list">
            <div v-for="variable in messageSlot.availableVariables" :key="variable">
              <dt>
                <code>{{ variableToken(variable) }}</code>
              </dt>
              <dd>{{ variableDescription(variable) }}</dd>
            </div>
          </dl>
        </details>

        <label v-if="advancedSlots.has(messageSlot.key)" class="embed-field">
          <span>Presentation JSON</span>
          <textarea
            v-model="presentationJson[messageSlot.key]"
            rows="22"
            class="field-control resize-y py-sm font-mono text-xs"
            spellcheck="false"
            @input="previewAdvancedJson(messageSlot.key)"
          />
          <small class="text-xs text-text-secondary">{{
            t('botSettings.supportsAllActionsComponentsAndCustomStructures')
          }}</small>
        </label>
        <template v-else>
          <section class="embed-main-fields" :aria-labelledby="id + '-body'">
            <h4 :id="id + '-body'" class="text-sm font-semibold">{{ t('botSettings.body') }}</h4>
            <label class="embed-field">
              <span
                >{{ t('botSettings.title') }}<i>{{ valueLength(definition.title) }}/256</i></span
              >
              <input
                :value="String(definition.title ?? '')"
                :aria-label="t('botSettings.title')"
                maxlength="256"
                class="field-control h-11"
                @input="
                  updatePresentation(
                    messageSlot.key,
                    'title',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <label class="embed-field">
              <span
                >{{ t('botSettings.description')
                }}<i>{{ valueLength(definition.description) }}/4096</i></span
              >
              <textarea
                :value="String(definition.description ?? '')"
                :aria-label="t('botSettings.description')"
                maxlength="4096"
                rows="5"
                class="field-control resize-y py-sm"
                @input="
                  updatePresentation(
                    messageSlot.key,
                    'description',
                    ($event.target as HTMLTextAreaElement).value,
                  )
                "
              />
            </label>
            <EmbedColorField :message-slot="messageSlot" />
            <details class="embed-title-link">
              <summary class="text-xs text-text-secondary">{{ t('botSettings.titleUrl') }}</summary>
              <label class="embed-field mt-sm"
                ><span class="sr-only">{{ t('botSettings.titleUrl') }}</span
                ><input
                  :value="String(definition.url ?? '')"
                  type="url"
                  class="field-control h-11"
                  placeholder="https://"
                  @input="
                    updatePresentation(
                      messageSlot.key,
                      'url',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
              /></label>
            </details>
          </section>

          <div class="embed-optional-heading">{{ text('More options', 'ตัวเลือกเพิ่มเติม') }}</div>
          <details
            v-for="group in groups"
            :key="group.key"
            class="embed-section"
            :data-section="group.key"
          >
            <summary>
              <span>{{ t(group.label) }}</span>
              <small v-if="configured(group)">{{ text('Configured', 'ตั้งค่าแล้ว') }}</small>
              <ChevronDown :size="16" aria-hidden="true" />
            </summary>
            <div class="embed-section-fields">
              <p v-if="group.key === 'message'" class="text-xs text-text-secondary">
                {{ t('botSettings.optionalTextOutsideTheEmbed') }}
              </p>
              <div v-for="field in group.fields" :key="field.key" class="embed-field">
                <label :for="id + '-' + group.key + '-' + field.key"
                  >{{ t(field.label)
                  }}<i v-if="field.limit"
                    >{{ valueLength(fieldValue(field)) }}/{{ field.limit }}</i
                  ></label
                >
                <textarea
                  v-if="field.type === 'textarea'"
                  :id="id + '-' + group.key + '-' + field.key"
                  :value="fieldValue(field)"
                  :maxlength="field.limit"
                  rows="3"
                  class="field-control resize-y py-sm"
                  @input="updateField(field, $event)"
                />
                <input
                  v-else
                  :id="id + '-' + group.key + '-' + field.key"
                  :value="fieldValue(field)"
                  :type="field.type ?? 'text'"
                  :maxlength="field.limit"
                  :placeholder="field.type === 'url' ? 'https://' : undefined"
                  class="field-control h-11"
                  @input="updateField(field, $event)"
                />
              </div>
              <label v-if="group.key === 'footer'" class="flex items-center gap-sm text-sm">
                <input
                  :checked="definition.timestamp === true"
                  type="checkbox"
                  @change="
                    updatePresentation(
                      messageSlot.key,
                      'timestamp',
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />{{ t('botSettings.showSentTimestamp') }}
              </label>
            </div>
          </details>
          <EmbedFieldsEditor :message-slot="messageSlot" />
          <PresentationActionsEditor :message-slot="messageSlot" />
          <PresentationSystemComponentsEditor
            v-if="license?.featureCode === 'payment-trigger'"
            :message-slot="messageSlot"
          />
        </template>
      </div>

      <aside
        :id="id + '-preview'"
        class="embed-preview-pane"
        :aria-label="text('Message preview', 'ตัวอย่างข้อความ')"
      >
        <div class="embed-preview-header">
          <Eye :size="16" aria-hidden="true" /><strong>{{ t('botSettings.livePreview') }}</strong
          ><span>Discord Embed</span>
        </div>
        <div
          v-if="usesPresentationDesigner && visiblePresentationSlots.length > 1"
          class="embed-preview-scope"
          role="group"
          :aria-label="text('Preview messages', 'ข้อความในตัวอย่าง')"
        >
          <button
            type="button"
            :aria-pressed="previewScope === 'current'"
            @click="previewScope = 'current'"
          >
            {{ t('botSettings.current') }}
          </button>
          <button
            type="button"
            :aria-pressed="previewScope === 'all'"
            @click="previewScope = 'all'"
          >
            {{ t('botSettings.all') }}
          </button>
        </div>
        <DiscordPresentationPreview
          v-for="slot in previewSlots"
          :key="slot.slotId"
          compact
          :definition="presentationPreviewDefinition(slot.key)"
          :variables="slot.availableVariables"
          :bot-name="previewBot?.discordUsername || previewBot?.name"
          :bot-avatar-url="previewBot?.discordAvatarUrl"
          :sample-values="presentationSampleValues(slot.key)"
        />
        <p class="embed-preview-note">
          {{ text('Preview uses sample data.', 'ตัวอย่างใช้ข้อมูลสมมติ') }}
        </p>
      </aside>
    </div>
  </article>
</template>

<style scoped>
.embed-message-card {
  min-width: 0;
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-lg);
  background: var(--semantic-color-background-bg-surface);
}
.embed-message-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md);
  border-bottom: 1px solid var(--semantic-color-border-border-subtle);
}
.embed-json-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
  padding: var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  font-size: var(--font-size-label-small);
  color: var(--semantic-color-text-text-secondary);
  cursor: pointer;
}
.embed-view-switch {
  display: flex;
  gap: var(--space-xxs);
  margin: var(--space-md);
  padding: var(--space-xxs);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-elevated);
}
.embed-view-switch button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  flex: 1;
  padding: var(--space-xs);
  border-radius: var(--corner-radius-sm);
  font-size: var(--font-size-label-large);
  color: var(--semantic-color-text-text-secondary);
  cursor: pointer;
}
.embed-view-switch button[aria-pressed='true'] {
  background: var(--semantic-color-background-bg-inverse);
  color: var(--semantic-color-text-text-inverse);
}
.embed-workspace {
  display: grid;
  min-width: 0;
  gap: var(--space-lg);
  padding: var(--space-md);
}
.embed-edit-pane {
  display: grid;
  align-content: start;
  min-width: 0;
  gap: var(--space-sm);
}
.embed-main-fields {
  display: grid;
  min-width: 0;
  gap: var(--space-md);
  padding-block: var(--space-xs) var(--space-sm);
}
.embed-field {
  display: grid;
  min-width: 0;
  gap: var(--space-xs);
  font-size: var(--font-size-label-large);
  font-weight: var(--typography-font-weight-medium);
}
.embed-field > span,
.embed-field > label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-xs);
}
.embed-field i {
  flex-shrink: 0;
  font-style: normal;
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-regular);
  color: var(--semantic-color-text-text-muted);
}
.embed-optional-heading {
  margin-top: var(--space-xs);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-medium);
  color: var(--semantic-color-text-text-secondary);
}
.embed-section {
  min-width: 0;
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-md);
  padding: var(--space-sm);
}
.embed-section summary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  list-style: none;
  cursor: pointer;
  font-size: var(--font-size-label-large);
  font-weight: var(--typography-font-weight-medium);
}
.embed-section summary::-webkit-details-marker {
  display: none;
}
.embed-section summary > span {
  flex: 1;
}
.embed-section summary > small {
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-regular);
  color: var(--semantic-color-text-text-muted);
}
.embed-section summary > svg {
  flex-shrink: 0;
  color: var(--semantic-color-text-text-muted);
}
.embed-section[open] > summary > svg {
  transform: rotate(180deg);
}
.embed-section-fields {
  display: grid;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}
.embed-title-link summary {
  cursor: pointer;
}
.embed-variable-list {
  display: grid;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}
.embed-variable-list > div {
  min-width: 0;
  padding-top: var(--space-xs);
  border-top: 1px solid var(--semantic-color-border-border-subtle);
}
.embed-variable-list dt {
  overflow-wrap: anywhere;
  font-size: var(--font-size-label-small);
}
.embed-variable-list dd {
  margin-top: var(--space-xxs);
  font-size: var(--font-size-label-small);
  color: var(--semantic-color-text-text-secondary);
}
.embed-preview-pane {
  min-width: 0;
  align-self: start;
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-elevated);
}
.embed-preview-pane :deep(.preview-appearance) {
  margin-inline: var(--space-sm);
  margin-bottom: var(--space-md);
}
.embed-preview-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm);
  font-size: var(--font-size-label-large);
}
.embed-preview-header span {
  margin-left: auto;
  font-size: var(--font-size-label-small);
  color: var(--semantic-color-text-text-muted);
}
.embed-preview-note {
  padding: var(--space-sm);
  font-size: var(--font-size-label-small);
  color: var(--semantic-color-text-text-secondary);
}
.embed-preview-scope {
  display: flex;
  gap: var(--space-xs);
  padding: 0 var(--space-sm) var(--space-sm);
}
.embed-preview-scope button {
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-full);
  padding: var(--space-xxs) var(--space-xs);
  font-size: var(--font-size-label-small);
  cursor: pointer;
}
.embed-preview-scope button[aria-pressed='true'] {
  background: var(--semantic-color-background-bg-inverse);
  color: var(--semantic-color-text-text-inverse);
}
.embed-preview-scope button:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 2px;
}
.embed-workspace[data-view='edit'] .embed-preview-pane,
.embed-workspace[data-view='preview'] .embed-edit-pane {
  display: none;
}
.embed-json-toggle:focus-visible,
.embed-view-switch button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 2px;
}
@media (min-width: 64rem) {
  .embed-message-header {
    padding: var(--space-lg);
  }
  .embed-view-switch {
    display: none;
  }
  .embed-workspace {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: var(--space-lg);
  }
  .embed-workspace[data-view='edit'] .embed-preview-pane {
    display: block;
  }
  .embed-workspace[data-view='preview'] .embed-edit-pane {
    display: grid;
  }
  .embed-preview-pane {
    position: sticky;
    top: var(--space-4xl);
    max-height: calc(100dvh - var(--space-4xl) - var(--space-md));
    overflow: auto;
  }
}
</style>
