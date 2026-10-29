<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import type { FeatureConfiguration } from '../api'
import PaymentBackButtonAppearance from './PaymentBackButtonAppearance.vue'
import PaymentResponseModeField from './PaymentResponseModeField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const props = defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const { t } = useI18n()
const { text, license, systemComponents, updateSystemComponent, componentStyleOptions } =
  useFeatureEditor()
const { presentations, presentationJson } = useFeatureEditor()
const items = computed(() => {
  const saved = systemComponents(props.messageSlot.key)
  if (license.value?.featureCode !== 'payment-trigger') return saved
  const defaults = props.messageSlot.defaultDefinition.components as
    Record<string, unknown> | undefined
  const roles =
    props.messageSlot.key === 'method_selector'
      ? ['voucher_button']
      : license.value.version !== '1.0.0' &&
          ['bank_payment', 'wallet_payment'].includes(props.messageSlot.key)
        ? ['back_button']
        : []
  return [
    ...saved,
    ...roles
      .filter((role) => !saved.some((item) => item.role === role) && defaults?.[role])
      .map((role) => ({ role, config: defaults![role] as Record<string, unknown> })),
  ]
})
function updateItem(role: string, key: string, value: string) {
  if (!systemComponents(props.messageSlot.key).some((item) => item.role === role)) {
    const raw = presentations.value[props.messageSlot.key]!
    // Flat Components V2 designs store their blocks at the root. Keep those
    // blocks in the nested representation before adding system-button options.
    const configured = raw.components
    if (Array.isArray(configured)) raw.components_v2 = { components: configured }
    raw.components = {
      ...(configured && typeof configured === 'object' && !Array.isArray(configured)
        ? configured
        : {}),
      [role]: { ...items.value.find((item) => item.role === role)!.config },
    }
    presentationJson.value[props.messageSlot.key] = JSON.stringify(raw, null, 2)
  }
  updateSystemComponent(props.messageSlot.key, role, key, value)
  if (key === 'display_mode' && value === 'EMOJI_ONLY')
    updateSystemComponent(props.messageSlot.key, role, 'emoji', '◀️')
}
const label = (role: string) =>
  license.value?.featureCode === 'payment-trigger'
    ? role === 'bank_button'
      ? text('Bank QR button', 'ปุ่ม QR ธนาคาร')
      : role === 'wallet_button'
        ? text('Wallet button', 'ปุ่ม Wallet')
        : role === 'voucher_button'
          ? text('Envelope button', 'ปุ่มซองอั่งเปา')
          : role === 'back_button'
            ? text('Back button', 'ปุ่มกลับ')
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
      <PaymentBackButtonAppearance
        v-if="item.role === 'back_button'"
        :model-value="String(item.config.display_mode ?? 'TEXT')"
        @update:model-value="updateItem(item.role, 'display_mode', $event)"
      />
      <PaymentResponseModeField
        v-if="
          license?.featureCode === 'payment-trigger' &&
          license.version &&
          license.version !== '1.0.0'
        "
        :model-value="
          String(
            item.config.response_mode ??
              (item.role === 'voucher_button' ? 'NEW_MESSAGE' : 'UPDATE'),
          )
        "
        @update:model-value="updateItem(item.role, 'response_mode', $event)"
      />
      <div class="component-editor-grid">
        <AppTextField
          v-if="item.config.display_mode !== 'EMOJI_ONLY'"
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
