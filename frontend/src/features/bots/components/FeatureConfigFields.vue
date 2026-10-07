<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import AppToggle from '@/shared/ui/buttons/AppToggle.vue'
import PriceMapEditor from '@/features/bots/components/PriceMapEditor.vue'
import RobuxPackagesEditor from '@/features/bots/components/RobuxPackagesEditor.vue'
import StringListEditor from '@/features/bots/components/StringListEditor.vue'
import ThresholdRoleEditor from '@/features/bots/components/ThresholdRoleEditor.vue'
import CommandPermissionsEditor from '@/features/bots/components/CommandPermissionsEditor.vue'
import MessageTriggerRulesEditor from '@/features/bots/components/MessageTriggerRulesEditor.vue'
import MemberSpendingConfig from '@/features/bots/components/MemberSpendingConfig.vue'
import BotPresenceConfig from '@/features/bots/components/BotPresenceConfig.vue'
import BotPermissionsConfig from './BotPermissionsConfig.vue'
import ReviewCreditConfig from './ReviewCreditConfig.vue'
import ChannelMessageTriggersConfig from './ChannelMessageTriggersConfig.vue'
import PaymentTriggerConfig from './PaymentTriggerConfig.vue'
import PriceReaderConfig from './PriceReaderConfig.vue'
import { priceReaderConfigKeys } from '../config/price-reader'
import { paymentTriggerConfigKeys } from '../config/payment-trigger'
import { channelMessageTriggerConfigKeys } from '../config/channel-message-triggers'
import { reviewCreditConfigKeys } from '../config/review-credit'
import VoiceKeeperConfig from './VoiceKeeperConfig.vue'
import WalletTopupConfig from './WalletTopupConfig.vue'
import RobloxPayoutConfig from './RobloxPayoutConfig.vue'
import { robloxPayoutConfigKeys } from '../config/roblox-payout'
import { walletTopupConfigKeys } from '../config/wallet-topup'
import { voiceKeeperConfigKeys } from '../config/voice-keeper'
import { botPermissionsConfigKeys } from '../config/bot-permissions'
import RuntimeExpiryAlertConfig from './RuntimeExpiryAlertConfig.vue'
import { runtimeAlertConfigKeys } from '../config/runtime-expiry-alert'
import { botPresenceConfigKeys } from '../config/bot-presence'
import { memberSpendingConfigKeys } from '../config/member-spending'
import { computed } from 'vue'
import { Settings2 } from 'lucide-vue-next'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { t } = useI18n()
const {
  license,
  configuration,
  isRobloxGroupField,
  configFieldDescription,
  values,
  isDropdownField,
  configFieldLabel,
  fieldOptions,
  isThresholdRoleField,
  secrets,
  isWalletPanelCommand,
  usesPresentationDesigner,
  isRobloxPayoutFeature,
  isRobloxPayoutV3,
  isRuntimeAlertFeature,
} = useFeatureEditor()

const isMemberSpending = computed(() => license.value?.featureCode === 'member-spending')
const isBotPresence = computed(() => license.value?.featureCode === 'bot-presence')
const isBotPermissions = computed(() => license.value?.featureCode === 'bot-permissions')
const isReviewCredit = computed(() => license.value?.featureCode === 'review-credit')
const isVoiceKeeper = computed(() => license.value?.featureCode === 'voice-keeper')
const isWalletTopup = computed(() => license.value?.featureCode === 'wallet-topup')
const isMessageTriggers = computed(() => license.value?.featureCode === 'channel-message-triggers')
const isPaymentTrigger = computed(() => license.value?.featureCode === 'payment-trigger')
const isPriceReader = computed(() => license.value?.featureCode === 'price-reader')
const hasCustomConfig = computed(
  () =>
    isMemberSpending.value ||
    isBotPresence.value ||
    isRuntimeAlertFeature.value ||
    isBotPermissions.value ||
    isReviewCredit.value ||
    isVoiceKeeper.value ||
    isWalletTopup.value ||
    isRobloxPayoutFeature.value ||
    isMessageTriggers.value ||
    isPaymentTrigger.value ||
    isPriceReader.value,
)
const genericFields = computed(
  () =>
    configuration.value?.fields.filter(
      (field) =>
        (!isMemberSpending.value || !memberSpendingConfigKeys.has(field.key)) &&
        (!isBotPresence.value || !botPresenceConfigKeys.has(field.key)) &&
        (!isRuntimeAlertFeature.value || !runtimeAlertConfigKeys.has(field.key)) &&
        (!isBotPermissions.value || !botPermissionsConfigKeys.has(field.key)) &&
        (!isReviewCredit.value || !reviewCreditConfigKeys.has(field.key)) &&
        (!isVoiceKeeper.value || !voiceKeeperConfigKeys.has(field.key)) &&
        (!isWalletTopup.value || !walletTopupConfigKeys.has(field.key)) &&
        (!isRobloxPayoutFeature.value || !robloxPayoutConfigKeys.has(field.key)) &&
        (!isMessageTriggers.value || !channelMessageTriggerConfigKeys.has(field.key)) &&
        (!isPaymentTrigger.value || !paymentTriggerConfigKeys.has(field.key)) &&
        (!isPriceReader.value || !priceReaderConfigKeys.has(field.key)),
    ) ?? [],
)

function robuxGroupRates() {
  if (!isRobloxPayoutV3.value) return []
  try {
    const groups = JSON.parse(String(values.value['ROBLOX_GROUPS'] ?? '[]'))
    if (!Array.isArray(groups)) return []
    return groups.flatMap((group) => {
      const rate = group && typeof group === 'object' ? Number(Reflect.get(group, 'rate')) : 0
      return Number.isFinite(rate) && rate > 0 ? [rate] : []
    })
  } catch {
    return []
  }
}
</script>
<template>
  <section v-if="configuration" id="feature-config" class="mt-xl">
    <div v-if="!hasCustomConfig" class="mb-md flex items-center gap-sm">
      <Settings2 :size="24" />
      <div>
        <h2 class="text-2xl font-semibold">Config</h2>
        <p class="text-sm text-text-secondary">
          {{ t('botSettings.featureConfigurationOptions') }}
        </p>
      </div>
    </div>
    <MemberSpendingConfig v-if="isMemberSpending" />
    <BotPresenceConfig v-else-if="isBotPresence" />
    <RuntimeExpiryAlertConfig v-else-if="isRuntimeAlertFeature" />
    <BotPermissionsConfig v-else-if="isBotPermissions" />
    <ReviewCreditConfig v-else-if="isReviewCredit" />
    <VoiceKeeperConfig v-else-if="isVoiceKeeper" />
    <WalletTopupConfig v-else-if="isWalletTopup" />
    <RobloxPayoutConfig v-else-if="isRobloxPayoutFeature" />
    <ChannelMessageTriggersConfig v-else-if="isMessageTriggers" />
    <PaymentTriggerConfig v-else-if="isPaymentTrigger" />
    <PriceReaderConfig v-else-if="isPriceReader" />
    <div
      v-if="genericFields.length"
      class="grid gap-md desktop:grid-cols-2"
      :class="{ 'mt-lg': hasCustomConfig }"
    >
      <template v-for="field in genericFields" :key="field.key">
        <div
          v-if="!isRobloxGroupField(field.key)"
          :class="[
            'rounded-lg border border-border-subtle bg-bg-surface p-lg',
            field.ui?.control === 'message-trigger-rules' ? 'desktop:col-span-2' : '',
          ]"
        >
          <div
            v-if="field.type === 'BOOLEAN'"
            class="flex cursor-pointer items-start justify-between gap-md"
          >
            <span
              ><strong>{{ field.label }}</strong
              ><small class="mt-xs block text-text-secondary">{{
                configFieldDescription(field)
              }}</small></span
            ><AppToggle
              :model-value="Boolean(values[field.key])"
              @change="(value) => (values[field.key] = value)"
            />
          </div>
          <div v-else class="block text-sm font-medium">
            <AppTextField
              v-if="isDropdownField(field)"
              :model-value="String(values[field.key] ?? '')"
              variant="dropdown"
              :label="configFieldLabel(field)"
              :options="fieldOptions(field)"
              :required="field.required"
              @update:model-value="(value) => (values[field.key] = value)"
            />
            <label v-else>
              {{ configFieldLabel(field)
              }}<span
                v-if="field.required && field.key !== 'COMMAND_PERMISSION_RULES'"
                class="text-error-text"
              >
                *</span
              >
              <PriceMapEditor
                v-if="field.key === 'PRICE_READER_PRICE_MAP'"
                :model-value="String(values[field.key] ?? '[]')"
                @update:model-value="(value) => (values[field.key] = value)"
              />
              <RobuxPackagesEditor
                v-else-if="field.key === 'ROBUX_PACKAGES'"
                :model-value="String(values[field.key] ?? '[]')"
                :rate="Number(values['ROBUX_RATE'] ?? 3.5)"
                :rates="robuxGroupRates()"
                @update:model-value="(value) => (values[field.key] = value)"
              />
              <template v-else-if="isThresholdRoleField(field.key)">
                <p class="mt-xs text-xs text-text-secondary">{{ configFieldDescription(field) }}</p>
                <ThresholdRoleEditor
                  :model-value="String(values[field.key] ?? '[]')"
                  :threshold-key="
                    field.key === 'SPENDING_UPGRADE_TIERS' ? 'amount' : 'thresholdBaht'
                  "
                  @update:model-value="(value) => (values[field.key] = value)"
                />
              </template>
              <CommandPermissionsEditor
                v-else-if="field.key === 'COMMAND_PERMISSION_RULES'"
                :model-value="String(values[field.key] ?? '[]')"
                @update:model-value="(value) => (values[field.key] = value)"
              />
              <MessageTriggerRulesEditor
                v-else-if="field.ui?.control === 'message-trigger-rules'"
                :model-value="String(values[field.key] ?? '[]')"
                :kind="field.ui?.kind === 'channel-create' ? 'channel-create' : 'admin-message'"
                :templates="
                  configuration.presentations.map((slot) => ({
                    value: slot.key,
                    label: slot.label,
                  }))
                "
                @update:model-value="(value) => (values[field.key] = value)"
              />
              <StringListEditor
                v-else-if="field.type === 'STRING_LIST'"
                :model-value="String(values[field.key] ?? '')"
                :multiline="field.ui?.multiline === true"
                :placeholder="String(field.ui?.placeholder ?? '')"
                @update:model-value="(value) => (values[field.key] = value)"
              />
              <textarea
                v-else-if="['TEXT', 'JSON'].includes(field.type)"
                v-model="values[field.key] as string"
                class="field-control mt-xs min-h-32 resize-y py-sm"
                :rows="field.type === 'JSON' ? 8 : 4"
              />
              <input
                v-else-if="field.secret"
                v-model="secrets[field.key]"
                type="password"
                autocomplete="new-password"
                class="field-control mt-xs h-11"
                :placeholder="
                  field.configured ? t('botSettings.configured') : t('botSettings.enterSecret')
                "
              />
              <input
                v-else
                v-model="values[field.key]"
                :type="['INTEGER', 'DECIMAL'].includes(field.type) ? 'number' : 'text'"
                :pattern="
                  ['CHANNEL_ID', 'ROLE_ID', 'USER_ID'].includes(field.type)
                    ? '[0-9]{15,30}'
                    : undefined
                "
                class="field-control mt-xs h-11"
              />
            </label>
          </div>
          <p
            v-if="
              field.key !== 'COMMAND_PERMISSION_RULES' &&
              !isWalletPanelCommand(field.key) &&
              !isThresholdRoleField(field.key)
            "
            class="mt-xs text-xs text-text-secondary"
          >
            {{ configFieldDescription(field)
            }}<span v-if="field.type === 'STRING_LIST'">
              · {{ t('botSettings.oneItemPerLine') }}</span
            >
          </p>
          <p
            v-if="field.key !== 'COMMAND_PERMISSION_RULES' && !usesPresentationDesigner"
            class="mt-sm font-mono text-xs text-text-muted"
          >
            {{ field.key }} · {{ field.type }}<span v-if="field.configured"> · configured</span>
          </p>
        </div>
      </template>
    </div>

    <div
      v-if="!configuration.fields.length && !hasCustomConfig"
      class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-muted"
    >
      {{ t('botSettings.thisFeatureHasNoConfigFields') }}
    </div>
  </section>
</template>
