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
const { presentations, presentationJson } = useFeatureEditor()
const items = computed(() => {
  const saved = systemComponents(props.messageSlot.key)
  if (
    license.value?.featureCode !== 'payment-trigger' ||
    props.messageSlot.key !== 'method_selector' ||
    saved.some((item) => item.role === 'voucher_button')
  )
    return saved
  const defaults = props.messageSlot.defaultDefinition.components as
    Record<string, unknown> | undefined
  return defaults?.voucher_button
    ? [
        ...saved,
        { role: 'voucher_button', config: defaults.voucher_button as Record<string, unknown> },
      ]
    : saved
})
function updateItem(role: string, key: string, value: string) {
  if (
    role === 'voucher_button' &&
    !systemComponents(props.messageSlot.key).some((item) => item.role === role)
  ) {
    const raw = presentations.value[props.messageSlot.key]!
    // Flat Components V2 designs store their blocks at the root. Keep those
    // blocks in the nested representation before adding system-button options.
    const configured = raw.components
    if (Array.isArray(configured)) raw.components_v2 = { components: configured }
    raw.components = {
      ...(configured && typeof configured === 'object' && !Array.isArray(configured)
        ? configured
        : {}),
      voucher_button: { ...items.value.find((item) => item.role === role)!.config },
    }
    presentationJson.value[props.messageSlot.key] = JSON.stringify(raw, null, 2)
  }
  updateSystemComponent(props.messageSlot.key, role, key, value)
}
const label = (role: string) =>
  license.value?.featureCode === 'payment-trigger'
    ? role === 'bank_button'
      ? text('Bank QR button', 'ปุ่ม QR ธนาคาร')
      : role === 'wallet_button'
        ? text('Wallet button', 'ปุ่ม Wallet')
        : role === 'voucher_button'
          ? text('Envelope button', 'ปุ่มซองอั่งเปา')
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
            updateItem(item.role, item.role.includes('select') ? 'placeholder' : 'label', $event)
          "
        />
        <AppTextField
          v-if="!item.role.includes('select')"
          :model-value="String(item.config.style ?? 'secondary')"
          variant="dropdown"
          :label="text('Button color', 'สีปุ่ม')"
          :options="componentStyleOptions"
          @update:model-value="updateItem(item.role, 'style', $event)"
        />
        <AppTextField
          :model-value="String(item.config.emoji ?? '')"
          label="Emoji"
          placeholder="💰 หรือ <:name:id>"
          @update:model-value="updateItem(item.role, 'emoji', $event)"
        />
      </div>
    </div>
  </div>
</template>
