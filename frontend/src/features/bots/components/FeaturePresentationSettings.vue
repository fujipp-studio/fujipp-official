<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureMessageDesign from './FeatureMessageDesign.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { t } = useI18n()
const {
  isMemberSpendingFeature,
  isRuntimeAlertFeature,
  isPriceReaderFeature,
  isRobloxPayoutFeature,
  text,
  configuration,
  license,
  visiblePresentationSlots,
  openPresentation,
  presentationSlotLabel,
  slotMode,
  presentationModeOptions,
  availablePresentationModes,
  canSwitchPresentationMode,
  setPresentationMode,
} = useFeatureEditor()
const isWalletTopup = computed(() => license.value?.featureCode === 'wallet-topup')
const isMessageTriggers = computed(() => license.value?.featureCode === 'channel-message-triggers')
const isPaymentTrigger = computed(() => license.value?.featureCode === 'payment-trigger')
</script>
<template>
  <FeatureMessageDesign
    v-if="
      (isMemberSpendingFeature ||
        isRuntimeAlertFeature ||
        isWalletTopup ||
        isRobloxPayoutFeature ||
        isMessageTriggers ||
        isPaymentTrigger ||
        isPriceReaderFeature) &&
      configuration
    "
    :description="
      isRuntimeAlertFeature
        ? text(
            'Preview the alert your recipients will receive.',
            'ดูตัวอย่างข้อความที่ผู้รับจะได้รับ',
          )
        : isMessageTriggers
          ? text(
              'Design reusable templates for your channel and administrator triggers.',
              'ออกแบบ Template ที่ใช้ร่วมกันได้กับกฎสร้างห้องและข้อความแอดมิน',
            )
          : isPaymentTrigger
            ? text(
                'Preview and edit each step of the payment flow.',
                'ดูตัวอย่างและแก้ไขข้อความแต่ละขั้นตอนของการชำระเงิน',
              )
            : isPriceReaderFeature
              ? text(
                  'Preview and edit the reading progress and price results.',
                  'ดูตัวอย่างและแก้ไขข้อความกำลังอ่านรูปและผลการอ่านราคา',
                )
              : undefined
    "
  />
  <section v-else-if="configuration" id="feature-presentations" class="mt-2xl">
    <div class="mb-md">
      <h2 class="text-2xl font-semibold">{{ t('botSettings.messageDesign') }}</h2>
      <p class="text-sm text-text-secondary">
        {{ t('botSettings.openADesignerWithoutChangingTheFormat') }}
      </p>
    </div>
    <div v-if="visiblePresentationSlots.length" class="space-y-md">
      <div class="presentation-menu">
        <button
          v-for="mode in availablePresentationModes"
          :key="mode.value"
          class="presentation-card"
          type="button"
          @click="openPresentation(mode.value as 'EMBED' | 'COMPONENTS_V2')"
        >
          <span class="text-2xl font-bold">{{
            mode.value === 'EMBED'
              ? t('botSettings.designEmbed')
              : t('botSettings.designComponentsV2')
          }}</span>
          <span>{{
            mode.value === 'EMBED'
              ? t('botSettings.openTheEmbedDesigner')
              : t('botSettings.openTheComponentsV2Designer')
          }}</span>
        </button>
      </div>
      <div class="presentation-slot-list">
        <article
          v-for="slot in visiblePresentationSlots"
          :key="slot.slotId"
          class="presentation-slot-row"
        >
          <div class="min-w-0">
            <strong class="block truncate">{{ presentationSlotLabel(slot) }}</strong>
            <span class="font-mono text-xs text-text-muted">{{ slot.key }}</span>
          </div>
          <AppTextField
            v-if="canSwitchPresentationMode"
            :model-value="slotMode(slot.key)"
            variant="dropdown"
            label=""
            :options="presentationModeOptions"
            @update:model-value="(mode) => setPresentationMode(slot.key, mode)"
          />
          <span v-else class="presentation-mode-badge">{{ slotMode(slot.key) }}</span>
          <AppButton
            class="presentation-slot-edit"
            variant="secondary"
            @click="openPresentation(slotMode(slot.key))"
          >
            {{ t('botSettings.edit') }}
          </AppButton>
        </article>
      </div>
    </div>
    <div
      v-else
      class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-muted"
    >
      {{ t('botSettings.thisFeatureHasNoEmbedOrComponents') }}
    </div>
  </section>
</template>
