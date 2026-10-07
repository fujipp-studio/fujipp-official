<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import type { FeatureConfiguration } from '../api'
import { useFeatureEditor } from '../composables/featureEditorContext'

const props = defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const { t } = useI18n()
const { text, license, systemComponents, updateSystemComponent, componentStyleOptions } =
  useFeatureEditor()
const items = computed(() => systemComponents(props.messageSlot.key))
const label = (role: string) =>
  license.value?.featureCode === 'payment-trigger'
    ? role === 'bank_button'
      ? text('Bank QR button', 'ปุ่ม QR ธนาคาร')
      : role === 'wallet_button'
        ? text('Wallet button', 'ปุ่ม Wallet')
        : role
    : role
</script>

<template>
  <div v-if="items.length" class="builder-section" data-system-components>
    <div class="builder-heading">
      <div>
        <strong>{{ t('botSettings.featureComponents') }}</strong>
        <p>{{ t('botSettings.customizeFixedButtonsAndSelectionsWithoutChanging') }}</p>
      </div>
    </div>
    <div
      v-for="item in items"
      :key="item.role"
      class="builder-item"
      :data-system-component="item.role"
    >
      <div class="component-role">
        <strong>{{ label(item.role) }}</strong>
        <span>{{
          item.role.includes('select') ? t('botSettings.selection') : t('botSettings.button')
        }}</span>
      </div>
      <div class="component-editor-grid">
        <AppTextField
          :model-value="String(item.config.label ?? item.config.placeholder ?? '')"
          :label="
            item.role.includes('select')
              ? text('Placeholder', 'ข้อความแนะนำ')
              : text('Button text', 'ข้อความบนปุ่ม')
          "
          :maxlength="item.role.includes('select') ? undefined : 80"
          :placeholder="
            item.role.includes('select')
              ? text('Choose an option…', 'เลือกตัวเลือก…')
              : text('Button text', 'ข้อความบนปุ่ม')
          "
          @update:model-value="
            updateSystemComponent(
              messageSlot.key,
              item.role,
              item.role.includes('select') ? 'placeholder' : 'label',
              $event,
            )
          "
        />
        <AppTextField
          v-if="!item.role.includes('select')"
          :model-value="String(item.config.style ?? 'secondary')"
          variant="dropdown"
          :label="text('Button color', 'สีปุ่ม')"
          :options="componentStyleOptions"
          @update:model-value="updateSystemComponent(messageSlot.key, item.role, 'style', $event)"
        />
        <AppTextField
          :model-value="String(item.config.emoji ?? '')"
          label="Emoji"
          placeholder="💰 หรือ <:name:id>"
          @update:model-value="updateSystemComponent(messageSlot.key, item.role, 'emoji', $event)"
        />
      </div>
    </div>
  </div>
</template>
