<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FeatureConfiguration } from '../api'
import { useFeatureEditor } from '../composables/featureEditorContext'
defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const { t } = useI18n()
const {
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
  <div class="space-y-md desktop:col-span-2 wide:col-span-1">
    <details open class="builder-section builder-accordion">
      <summary>Fields · {{ visualArray(messageSlot.key, 'fields').length }}/25</summary>
      <div class="builder-heading mt-sm">
        <p>{{ t('botSettings.addTitleAndDetailFieldsUpTo') }}</p>
        <button type="button" @click="addEmbedField(messageSlot.key)">
          {{ t('botSettings.addField') }}
        </button>
      </div>
      <details
        v-for="(field, fieldIndex) in visualArray(messageSlot.key, 'fields')"
        :key="fieldIndex"
        open
        class="builder-item builder-accordion builder-field"
      >
        <summary>{{ t('botSettings.field') }} {{ fieldIndex + 1 }}</summary>
        <div class="mt-sm grid gap-xs">
          <label class="component-field"
            ><span
              >{{ t('botSettings.name') }} · <b>{{ t('botSettings.required') }}</b> ·
              {{ valueLength(field.name) }}/256</span
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
              >{{ t('botSettings.value') }} · <b>{{ t('botSettings.required') }}</b> ·
              {{ valueLength(field.value) }}/1024</span
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
            Inline</label
          ><button type="button" @click="removeEmbedField(messageSlot.key, fieldIndex)">
            {{ t('botSettings.delete') }}
          </button>
        </div>
      </details>
    </details>
    <div class="builder-section">
      <div class="builder-heading">
        <div>
          <strong>Link Buttons</strong>
          <p>
            {{ t('botSettings.addWebsiteButtonsWithoutAffectingSystemActions') }}
          </p>
        </div>
        <button type="button" @click="addLink(messageSlot.key)">
          {{ t('botSettings.addLink') }}
        </button>
      </div>
      <div
        v-for="(link, linkIndex) in visualArray(messageSlot.key, 'links')"
        :key="linkIndex"
        class="builder-item grid gap-xs tablet:grid-cols-[1fr_5rem_2fr_auto]"
      >
        <input
          :value="String(link.label ?? '')"
          class="field-control h-10"
          :placeholder="t('botSettings.buttonLabel')"
          @input="
            updateLink(
              messageSlot.key,
              linkIndex,
              'label',
              ($event.target as HTMLInputElement).value,
            )
          "
        /><input
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
          "
        /><input
          :value="String(link.url ?? '')"
          type="url"
          class="field-control h-10"
          placeholder="https://"
          @input="
            updateLink(messageSlot.key, linkIndex, 'url', ($event.target as HTMLInputElement).value)
          "
        /><button
          type="button"
          class="builder-delete"
          @click="removeLink(messageSlot.key, linkIndex)"
        >
          {{ t('botSettings.delete') }}
        </button>
      </div>
    </div>
  </div>
</template>
