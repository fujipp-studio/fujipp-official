<script setup lang="ts">
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import PaymentBackButtonAppearance from './PaymentBackButtonAppearance.vue'
import { useI18n } from 'vue-i18n'
import { useFeatureEditor } from '../composables/featureEditorContext'
import FeatureButtonPicker from './FeatureButtonPicker.vue'
import PaymentResponseModeField from './PaymentResponseModeField.vue'

withDefaults(
  defineProps<{
    buttons: Record<string, unknown>[]
    componentCount: number
    componentEmoji: (value: unknown) => string
    featureButtons?: Array<{ value: string; label: string; responseModes?: boolean }>
  }>(),
  { featureButtons: () => [] },
)
const emit = defineEmits<{
  add: []
  update: [
    index: number,
    key: 'label' | 'emoji' | 'url' | 'action' | 'style' | 'response_mode' | 'display_mode',
    value: string,
  ]
  addFeature: [action: string]
  remove: [index: number]
  move: [index: number, direction: -1 | 1]
}>()
const { t } = useI18n()
const { text } = useFeatureEditor()
</script>

<template>
  <div
    v-if="buttons.every((button) => button.type === 2)"
    class="component-button-row-editor mt-xs grid min-w-0 gap-xs"
  >
    <p class="text-xs text-text-muted">
      {{ t('botSettings.buttonsInRow', { count: buttons.length }) }}
    </p>
    <div
      v-for="(button, index) in buttons"
      :key="index"
      class="builder-subitem min-w-0"
      :data-feature-action="button.action"
    >
      <div class="builder-subitem-heading flex-wrap">
        <strong>
          {{ t(Number(button.style) === 5 ? 'botSettings.linkButton' : 'botSettings.button') }}
          {{ index + 1 }}
        </strong>
        <div class="flex flex-wrap items-center gap-xs">
          <button
            type="button"
            :disabled="index === 0"
            :aria-label="t('botSettings.moveButtonLeft', { number: index + 1 })"
            @click="emit('move', index, -1)"
          >
            ←
          </button>
          <button
            type="button"
            :disabled="index === buttons.length - 1"
            :aria-label="t('botSettings.moveButtonRight', { number: index + 1 })"
            @click="emit('move', index, 1)"
          >
            →
          </button>
          <button type="button" class="builder-delete" @click="emit('remove', index)">
            {{ t('botSettings.delete') }}
          </button>
        </div>
      </div>
      <div v-if="featureButtons.length" class="mb-xs grid min-w-0 gap-xs tablet:grid-cols-2">
        <AppTextField
          variant="dropdown"
          :model-value="String(button.action ?? 'link')"
          :label="text('Button action', 'การทำงานของปุ่ม')"
          :options="[{ value: 'link', label: t('botSettings.linkButton') }, ...featureButtons]"
          @update:model-value="emit('update', index, 'action', $event)"
        />
        <AppTextField
          v-if="button.action"
          variant="dropdown"
          :model-value="String(button.style ?? 1)"
          :label="text('Button color', 'สีปุ่ม')"
          :options="[
            { value: '1', label: 'Primary · Blurple' },
            { value: '2', label: 'Secondary · Gray' },
            { value: '3', label: 'Success · Green' },
            { value: '4', label: 'Danger · Red' },
          ]"
          @update:model-value="emit('update', index, 'style', $event)"
        />
      </div>
      <PaymentBackButtonAppearance
        v-if="button.action === 'payment.back'"
        :model-value="String(button.display_mode ?? 'TEXT')"
        @update:model-value="emit('update', index, 'display_mode', $event)"
      />
      <PaymentResponseModeField
        v-if="
          featureButtons.some((option) => option.value === button.action && option.responseModes)
        "
        :model-value="
          String(
            button.response_mode ??
              (button.action === 'payment.voucher' ? 'NEW_MESSAGE' : 'UPDATE'),
          )
        "
        @update:model-value="emit('update', index, 'response_mode', $event)"
      />
      <div
        class="grid min-w-0 grid-cols-1 gap-xs tablet:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.5fr)]"
      >
        <label v-if="button.display_mode !== 'EMOJI_ONLY'" class="component-field">
          <span>{{ t('botSettings.buttonLabel') }}</span>
          <input
            :value="String(button.label ?? '')"
            maxlength="80"
            class="field-control h-10"
            @input="emit('update', index, 'label', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="component-field">
          <span>{{ t('botSettings.buttonEmoji') }}</span>
          <input
            :value="componentEmoji(button.emoji)"
            class="field-control h-10"
            @input="emit('update', index, 'emoji', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label v-if="Number(button.style) === 5" class="component-field">
          <span>{{ t('botSettings.buttonUrl') }}</span>
          <input
            :value="String(button.url ?? '')"
            type="url"
            maxlength="512"
            class="field-control h-10"
            placeholder="https://"
            @input="emit('update', index, 'url', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </div>
    <button
      type="button"
      class="builder-add"
      :disabled="buttons.length >= 5 || componentCount >= 40"
      @click="emit('add')"
    >
      + {{ t('botSettings.addButtonInRow') }}
    </button>
    <FeatureButtonPicker
      data-feature-picker-location="row"
      :options="featureButtons"
      :disabled="buttons.length >= 5 || componentCount >= 40"
      @select="emit('addFeature', $event)"
    />
  </div>
</template>
