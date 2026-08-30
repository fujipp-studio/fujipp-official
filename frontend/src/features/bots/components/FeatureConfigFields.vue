<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import AppToggle from '@/shared/ui/buttons/AppToggle.vue'
import PriceMapEditor from '@/features/bots/components/PriceMapEditor.vue'
import RobloxGroupEditor from '@/features/bots/components/RobloxGroupEditor.vue'
import RobuxPackagesEditor from '@/features/bots/components/RobuxPackagesEditor.vue'
import StringListEditor from '@/features/bots/components/StringListEditor.vue'
import ThresholdRoleEditor from '@/features/bots/components/ThresholdRoleEditor.vue'
import CommandPermissionsEditor from '@/features/bots/components/CommandPermissionsEditor.vue'
import { Settings2 } from 'lucide-vue-next'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { t } = useI18n()
const {
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
  robloxCredentialsConfigured,
  isRobloxPayoutV2,
} = useFeatureEditor()
</script>
<template>
  <section v-if="configuration" id="feature-config" class="mt-xl">
    <div class="mb-md flex items-center gap-sm">
      <Settings2 :size="24" />
      <div>
        <h2 class="text-2xl font-semibold">Config</h2>
        <p class="text-sm text-text-secondary">
          {{ t('botSettings.featureConfigurationOptions') }}
        </p>
      </div>
    </div>
    <div v-if="configuration.fields.length" class="grid gap-md desktop:grid-cols-2">
      <template v-for="field in configuration.fields" :key="field.key">
        <div
          v-if="!isRobloxGroupField(field.key)"
          class="rounded-lg border border-border-subtle bg-bg-surface p-lg"
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

    <RobloxGroupEditor
      v-if="isRobloxPayoutFeature"
      v-model:groups-json="values['ROBLOX_GROUPS'] as string"
      v-model:credentials-json="secrets['ROBLOX_CREDENTIALS'] as string"
      :credentials-configured="robloxCredentialsConfigured"
      :show-membership-lookup="isRobloxPayoutV2"
      class="mt-lg"
    />
    <div
      v-else-if="!configuration.fields.length"
      class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-muted"
    >
      {{ t('botSettings.thisFeatureHasNoConfigFields') }}
    </div>
  </section>
</template>
