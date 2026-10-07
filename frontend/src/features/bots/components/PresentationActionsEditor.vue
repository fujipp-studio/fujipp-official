<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { ArrowDown, ArrowUp, Check } from 'lucide-vue-next'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import type { FeatureConfiguration } from '../api'
import { useFeatureEditor } from '../composables/featureEditorContext'
const props = defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const { t } = useI18n()
const {
  text,
  fixedActions,
  defaultActionLabel,
  moveFixedAction,
  updateActionOverride,
  componentStyles,
} = useFeatureEditor()
const actions = computed(() => fixedActions(props.messageSlot.key))
</script>
<template>
  <div v-if="actions.length" class="builder-section" data-system-actions>
    <div class="builder-heading">
      <div>
        <strong>{{ t('botSettings.systemActions') }}</strong>
        <p>
          {{ t('botSettings.theActionIdIsLockedButIts') }}
        </p>
      </div>
    </div>
    <div v-for="(item, index) in actions" :key="item.action" class="builder-item">
      <div class="action-heading">
        <div class="component-role">
          <strong>{{ item.action }}</strong>
          <span>{{ t('botSettings.actionIdLocked') }}</span>
        </div>
        <div
          v-if="actions.length > 1"
          class="flex gap-xxs"
          role="group"
          :aria-label="text('Button order', 'ลำดับปุ่ม')"
        >
          <AppButton
            variant="secondary"
            class="!h-9 !w-9 !px-0"
            :disabled="index === 0"
            :aria-label="text(`Move ${item.action} up`, `เลื่อน ${item.action} ขึ้น`)"
            :title="text('Move up', 'เลื่อนขึ้น')"
            @click="moveFixedAction(messageSlot.key, item.action, -1)"
            ><ArrowUp :size="16" aria-hidden="true"
          /></AppButton>
          <AppButton
            variant="secondary"
            class="!h-9 !w-9 !px-0"
            :disabled="index === actions.length - 1"
            :aria-label="text(`Move ${item.action} down`, `เลื่อน ${item.action} ลง`)"
            :title="text('Move down', 'เลื่อนลง')"
            @click="moveFixedAction(messageSlot.key, item.action, 1)"
            ><ArrowDown :size="16" aria-hidden="true"
          /></AppButton>
        </div>
      </div>
      <div class="component-editor-grid">
        <label class="component-field">
          <span>{{ t('botSettings.text') }}</span>
          <input
            :value="String(item.override.label ?? defaultActionLabel(item.defaults.label))"
            class="field-control h-10"
            maxlength="80"
            @input="
              updateActionOverride(
                messageSlot.key,
                item.action,
                'label',
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </label>
        <fieldset class="component-field component-style-field">
          <legend>{{ t('botSettings.color') }}</legend>
          <div class="component-style-picker">
            <button
              v-for="style in componentStyles"
              :key="style"
              type="button"
              :class="[
                `component-style--${style}`,
                {
                  'component-style--selected':
                    String(item.override.style ?? item.defaults.style) === style,
                },
              ]"
              :aria-label="style"
              :aria-pressed="String(item.override.style ?? item.defaults.style) === style"
              @click="updateActionOverride(messageSlot.key, item.action, 'style', style)"
            >
              <Check
                v-if="String(item.override.style ?? item.defaults.style) === style"
                :size="16"
              />
            </button>
          </div>
        </fieldset>
        <label class="component-field">
          <span>Emoji</span>
          <input
            :value="String(item.override.emoji ?? item.defaults.emoji)"
            class="field-control h-10"
            placeholder="💰 หรือ <:name:id>"
            @input="
              updateActionOverride(
                messageSlot.key,
                item.action,
                'emoji',
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.action-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.action-heading .component-role {
  min-width: 0;
  flex-wrap: wrap;
  overflow-wrap: anywhere;
}
</style>
