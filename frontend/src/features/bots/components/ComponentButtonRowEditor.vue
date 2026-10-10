<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  buttons: Record<string, unknown>[]
  componentCount: number
  componentEmoji: (value: unknown) => string
}>()
const emit = defineEmits<{
  add: []
  update: [index: number, key: 'label' | 'emoji' | 'url', value: string]
  remove: [index: number]
  move: [index: number, direction: -1 | 1]
}>()
const { t } = useI18n()
</script>

<template>
  <div
    v-if="buttons.every((button) => button.type === 2)"
    class="component-button-row-editor mt-xs grid min-w-0 gap-xs"
  >
    <p class="text-xs text-text-muted">
      {{ t('botSettings.buttonsInRow', { count: buttons.length }) }}
    </p>
    <div v-for="(button, index) in buttons" :key="index" class="builder-subitem min-w-0">
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
      <div
        class="grid min-w-0 grid-cols-1 gap-xs tablet:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.5fr)]"
      >
        <label class="component-field">
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
  </div>
</template>
