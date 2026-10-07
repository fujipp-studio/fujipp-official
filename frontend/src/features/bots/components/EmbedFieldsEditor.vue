<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ChevronDown, Trash2 } from 'lucide-vue-next'
import type { FeatureConfiguration } from '../api'
import { useFeatureEditor } from '../composables/featureEditorContext'
defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const { t } = useI18n()
const {
  text,
  visualArray,
  addEmbedField,
  valueLength,
  updateEmbedField,
  removeEmbedField,
  addLink,
  updateLink,
  removeLink,
} = useFeatureEditor()
</script>
<template>
  <div class="embed-fields-editor space-y-sm">
    <details
      :open="visualArray(messageSlot.key, 'fields').length > 0"
      class="builder-section builder-accordion"
      data-section="fields"
    >
      <summary>
        <span>{{ text('Fields', 'ช่องข้อมูล') }}</span
        ><small>{{ visualArray(messageSlot.key, 'fields').length }}/25</small
        ><ChevronDown :size="16" aria-hidden="true" />
      </summary>
      <div class="builder-heading mt-sm">
        <button
          type="button"
          :disabled="visualArray(messageSlot.key, 'fields').length >= 25"
          @click="addEmbedField(messageSlot.key)"
        >
          {{ t('botSettings.addField') }}
        </button>
      </div>
      <details
        v-for="(field, fieldIndex) in visualArray(messageSlot.key, 'fields')"
        :key="fieldIndex"
        open
        class="builder-item builder-accordion builder-field"
      >
        <summary>
          {{ t('botSettings.field') }} {{ fieldIndex + 1
          }}<ChevronDown :size="16" aria-hidden="true" />
        </summary>
        <div class="mt-sm grid gap-xs">
          <label class="component-field"
            ><span
              >{{ t('botSettings.name') }} <b aria-hidden="true">*</b
              ><i>{{ valueLength(field.name) }}/256</i></span
            ><input
              :value="String(field.name ?? '')"
              class="field-control h-10"
              required
              maxlength="256"
              :placeholder="t('botSettings.fieldName')"
              @input="
                updateEmbedField(
                  messageSlot.key,
                  fieldIndex,
                  'name',
                  ($event.target as HTMLInputElement).value,
                )
              " /></label
          ><label class="component-field"
            ><span
              >{{ t('botSettings.value') }} <b aria-hidden="true">*</b
              ><i>{{ valueLength(field.value) }}/1024</i></span
            ><textarea
              :value="String(field.value ?? '')"
              rows="3"
              required
              maxlength="1024"
              class="field-control resize-y py-sm"
              :placeholder="t('botSettings.details')"
              @input="
                updateEmbedField(
                  messageSlot.key,
                  fieldIndex,
                  'value',
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </label>
        </div>
        <div class="builder-actions">
          <label
            ><input
              :checked="Boolean(field.inline)"
              type="checkbox"
              @change="
                updateEmbedField(
                  messageSlot.key,
                  fieldIndex,
                  'inline',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ text('Display inline', 'แสดงในแถวเดียวกัน') }}</label
          ><button
            type="button"
            :aria-label="`${t('botSettings.delete')} ${t('botSettings.field')} ${fieldIndex + 1}`"
            @click="removeEmbedField(messageSlot.key, fieldIndex)"
          >
            <Trash2 :size="16" aria-hidden="true" />{{ t('botSettings.delete') }}
          </button>
        </div>
      </details>
    </details>
    <details
      :open="visualArray(messageSlot.key, 'links').length > 0"
      class="builder-section builder-accordion"
      data-section="links"
    >
      <summary>
        <span>{{ text('Link buttons', 'ปุ่มลิงก์') }}</span
        ><small>{{ visualArray(messageSlot.key, 'links').length }}</small
        ><ChevronDown :size="16" aria-hidden="true" />
      </summary>
      <div class="builder-heading">
        <button type="button" @click="addLink(messageSlot.key)">
          {{ t('botSettings.addLink') }}
        </button>
      </div>
      <div
        v-for="(link, linkIndex) in visualArray(messageSlot.key, 'links')"
        :key="linkIndex"
        class="builder-item grid gap-sm tablet:grid-cols-2"
      >
        <label class="component-field"
          ><span>{{ t('botSettings.buttonLabel') }}</span
          ><input
            :value="String(link.label ?? '')"
            class="field-control h-10"
            :placeholder="t('botSettings.buttonLabel')"
            maxlength="80"
            @input="
              updateLink(
                messageSlot.key,
                linkIndex,
                'label',
                ($event.target as HTMLInputElement).value,
              )
            " /></label
        ><label class="component-field"
          ><span>{{ t('botSettings.emoji') }}</span
          ><input
            :value="String(link.emoji ?? '')"
            class="field-control h-10"
            :placeholder="t('botSettings.emoji')"
            @input="
              updateLink(
                messageSlot.key,
                linkIndex,
                'emoji',
                ($event.target as HTMLInputElement).value,
              )
            " /></label
        ><label class="component-field tablet:col-span-2"
          ><span>URL</span
          ><input
            :value="String(link.url ?? '')"
            type="url"
            class="field-control h-10"
            placeholder="https://"
            @input="
              updateLink(
                messageSlot.key,
                linkIndex,
                'url',
                ($event.target as HTMLInputElement).value,
              )
            " /></label
        ><button
          type="button"
          class="builder-delete"
          :aria-label="`${t('botSettings.delete')} ${text('link', 'ลิงก์')} ${linkIndex + 1}`"
          @click="removeLink(messageSlot.key, linkIndex)"
        >
          <Trash2 :size="16" aria-hidden="true" />{{ t('botSettings.delete') }}
        </button>
      </div>
    </details>
  </div>
</template>
<style scoped>
.embed-fields-editor :deep(.builder-section) {
  padding: var(--space-sm);
  background: transparent;
}
.embed-fields-editor summary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  list-style: none;
}
.embed-fields-editor summary::-webkit-details-marker {
  display: none;
}
.embed-fields-editor .builder-accordion > summary::before {
  content: none;
}
.embed-fields-editor summary > span {
  flex: 1;
}
.embed-fields-editor summary > svg {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--semantic-color-text-text-muted);
}
.embed-fields-editor details[open] > summary > svg {
  transform: rotate(180deg);
}
.embed-fields-editor summary small,
.embed-fields-editor i {
  font-size: var(--font-size-label-small);
  font-style: normal;
  font-weight: var(--typography-font-weight-regular);
  color: var(--semantic-color-text-text-muted);
}
.embed-fields-editor .component-field > span {
  display: flex;
  gap: var(--space-xxs);
}
.embed-fields-editor .component-field i {
  margin-left: auto;
}
.embed-fields-editor button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}
.embed-fields-editor button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.embed-fields-editor summary:focus-visible,
.embed-fields-editor button:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 2px;
}
</style>
