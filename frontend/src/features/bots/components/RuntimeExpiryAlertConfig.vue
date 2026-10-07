<script setup lang="ts">
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureSettingsHeading from './FeatureSettingsHeading.vue'
import { computed, useId } from 'vue'
import { Bell, BellOff, Clock3, Hash, Mail } from 'lucide-vue-next'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingToggle from './FeatureSettingToggle.vue'
import { runtimeAlertMilestones } from '../config/runtime-expiry-alert'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { configuration, values, fieldOptions, text } = useFeatureEditor()
const id = useId()
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const delivery = computed(() => String(values.value.RUNTIME_ALERT_DELIVERY ?? 'CHANNEL'))
const disabled = computed(() => delivery.value === 'DISABLED')
const usesChannel = computed(() => ['CHANNEL', 'BOTH'].includes(delivery.value))
const usesDm = computed(() => ['DM', 'BOTH'].includes(delivery.value))
const deliveryLabels = computed<Record<string, string>>(() => ({
  CHANNEL: text('Discord Channel', 'Discord Channel'),
  DM: text('Direct Message', 'ข้อความส่วนตัว (DM)'),
  BOTH: text('Channel and DM', 'Channel และ DM'),
  DISABLED: text('Alerts off', 'ปิดการแจ้งเตือน'),
}))
const deliveryOptions = computed(() => {
  const definition = field('RUNTIME_ALERT_DELIVERY')
  return definition
    ? fieldOptions(definition).map((option) => ({
        ...option,
        label: deliveryLabels.value[option.value] ?? option.label,
      }))
    : []
})
const milestones = computed(() => runtimeAlertMilestones.filter((item) => field(item.key)))
const enabledMilestones = computed(() =>
  milestones.value.filter((item) => Boolean(values.value[item.key])),
)
const idError = (key: string) => {
  const value = String(values.value[key] ?? '')
  return value && !/^[0-9]{15,30}$/.test(value)
    ? text('Enter a Discord ID with 15–30 digits.', 'กรอก Discord ID เป็นตัวเลข 15–30 หลัก')
    : ''
}
</script>

<template>
  <FeatureSettingsLayout>
    <FeatureSettingsCard as="div">
      <section :aria-labelledby="id + '-delivery'">
        <FeatureSettingsHeading
          :title="text('Delivery & recipients', 'ช่องทางและผู้รับ')"
          :heading-id="id + '-delivery'"
          :description="
            text(
              'Choose where the bot sends expiry alerts.',
              'เลือกปลายทางสำหรับแจ้งเตือน Runtime ใกล้หมดอายุ',
            )
          "
        />
        <fieldset v-if="field('RUNTIME_ALERT_DELIVERY')" class="mt-lg min-w-0">
          <legend class="mb-xs text-sm font-medium">
            {{ text('Delivery channel', 'ช่องทางแจ้งเตือน') }}
          </legend>
          <div class="grid grid-cols-2 gap-xs">
            <label
              v-for="option in deliveryOptions"
              :key="option.value"
              class="flex cursor-pointer items-center gap-xs rounded-lg border border-border-default px-sm py-md text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-text-primary"
              :class="
                delivery === option.value
                  ? 'bg-bg-inverse text-text-inverse'
                  : 'bg-bg-default text-text-secondary hover:bg-bg-surface-hover'
              "
            >
              <input
                v-model="values.RUNTIME_ALERT_DELIVERY"
                type="radio"
                :name="id + '-delivery'"
                :value="option.value"
                :required="field('RUNTIME_ALERT_DELIVERY')?.required"
                class="h-4 w-4 shrink-0 accent-current"
              />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>
        <div
          v-if="!disabled"
          class="mt-md grid gap-md"
          :class="usesChannel && usesDm ? 'tablet:grid-cols-2' : ''"
        >
          <AppTextField
            v-if="usesChannel && field('RUNTIME_ALERT_CHANNEL_ID')"
            :label="text('Discord Channel ID', 'Discord Channel ID')"
            :model-value="String(values.RUNTIME_ALERT_CHANNEL_ID ?? '')"
            placeholder="123456789012345678"
            pattern="[0-9]{15,30}"
            required
            :state="idError('RUNTIME_ALERT_CHANNEL_ID') ? 'error' : 'default'"
            :support-text="
              idError('RUNTIME_ALERT_CHANNEL_ID') ||
              text('The channel that receives alerts.', 'ห้อง Discord ที่ใช้รับการแจ้งเตือน')
            "
            @update:model-value="values.RUNTIME_ALERT_CHANNEL_ID = $event"
          />
          <AppTextField
            v-if="usesDm && field('RUNTIME_ALERT_DM_USER_ID')"
            :label="text('DM recipient · Discord User ID', 'ผู้รับ DM · Discord User ID')"
            :model-value="String(values.RUNTIME_ALERT_DM_USER_ID ?? '')"
            placeholder="123456789012345678"
            pattern="[0-9]{15,30}"
            required
            :state="idError('RUNTIME_ALERT_DM_USER_ID') ? 'error' : 'default'"
            :support-text="
              idError('RUNTIME_ALERT_DM_USER_ID') ||
              text(
                'The user who receives direct messages.',
                'ผู้ใช้ Discord ที่จะได้รับข้อความส่วนตัว',
              )
            "
            @update:model-value="values.RUNTIME_ALERT_DM_USER_ID = $event"
          />
        </div>
        <p v-else class="mt-md rounded-lg bg-bg-default p-md text-sm text-text-secondary">
          {{
            text(
              'Alerts are off. Your recipients and timing settings are kept.',
              'ปิดการแจ้งเตือนอยู่ ระบบจะเก็บผู้รับและช่วงเวลาที่ตั้งไว้',
            )
          }}
        </p>
      </section>
      <fieldset
        v-if="milestones.length"
        class="mt-lg min-w-0 border-t border-border-subtle pt-lg"
        :disabled="disabled"
      >
        <legend class="sr-only">{{ text('Alert timing', 'ช่วงเวลาแจ้งเตือน') }}</legend>
        <FeatureSettingsHeading
          :title="text('Alert timing', 'ช่วงเวลาแจ้งเตือน')"
          :description="
            text(
              'Notify before Runtime expires at the selected intervals.',
              'เลือกช่วงเวลาที่ต้องการเตือนก่อน Runtime หมดอายุ',
            )
          "
        />
        <div class="mt-md divide-y divide-border-subtle" :class="{ 'opacity-50': disabled }">
          <FeatureSettingToggle
            v-for="milestone in milestones"
            :key="milestone.key"
            class="py-md first:pt-0 last:pb-0"
            :icon="Clock3"
            :label="`${text('Before expiry by', 'ก่อนหมดอายุ')} ${text(milestone.label[0], milestone.label[1])}`"
            :model-value="Boolean(values[milestone.key])"
            :disabled="disabled"
            :aria-label="`${text('Alert', 'แจ้งเตือนก่อน')} ${text(milestone.label[0], milestone.label[1])}`"
            @update:model-value="values[milestone.key] = $event"
          />
        </div>
        <p v-if="!disabled && !enabledMilestones.length" class="mt-sm text-sm text-warning-text">
          {{
            text(
              'Select at least one interval to receive alerts.',
              'เลือกอย่างน้อยหนึ่งช่วงเวลาเพื่อรับการแจ้งเตือน',
            )
          }}
        </p>
      </fieldset>
      <details class="mt-lg border-t border-border-subtle pt-md">
        <summary class="cursor-pointer text-sm text-text-secondary">
          {{ text('How alerts work', 'การแจ้งเตือนทำงานอย่างไร') }}
        </summary>
        <p class="mt-sm text-xs text-text-muted">
          {{
            text(
              'The bot checks every minute and does not repeat a delivered interval for the same destination in the current Runtime period.',
              'บอทตรวจสอบทุกนาที และไม่ส่งช่วงเวลาเดิมซ้ำให้ปลายทางเดิมในรอบ Runtime เดียวกัน',
            )
          }}
        </p>
      </details>
    </FeatureSettingsCard>
    <template #summary>
      <FeatureSettingsCard
        as="aside"
        :title="text('Alert summary', 'สรุปการแจ้งเตือน')"
        :heading-id="id + '-summary'"
        :icon="disabled ? BellOff : Bell"
        compact
      >
        <p class="mt-md text-lg font-semibold">{{ deliveryLabels[delivery] ?? delivery }}</p>
        <dl v-if="!disabled" class="mt-md space-y-md text-sm">
          <div v-if="usesChannel">
            <dt class="flex items-center gap-xs text-text-secondary">
              <Hash :size="14" aria-hidden="true" />{{ text('Channel', 'Channel') }}
            </dt>
            <dd
              class="mt-xxs break-all"
              :class="
                !values.RUNTIME_ALERT_CHANNEL_ID || idError('RUNTIME_ALERT_CHANNEL_ID')
                  ? 'text-warning-text'
                  : 'font-mono text-xs'
              "
            >
              {{
                idError('RUNTIME_ALERT_CHANNEL_ID')
                  ? text('Check the Channel ID', 'ตรวจสอบ Channel ID')
                  : values.RUNTIME_ALERT_CHANNEL_ID ||
                    text('Channel not set', 'ยังไม่ได้ระบุ Channel')
              }}
            </dd>
          </div>
          <div v-if="usesDm">
            <dt class="flex items-center gap-xs text-text-secondary">
              <Mail :size="14" aria-hidden="true" />{{ text('DM recipient', 'ผู้รับ DM') }}
            </dt>
            <dd
              class="mt-xxs break-all"
              :class="
                !values.RUNTIME_ALERT_DM_USER_ID || idError('RUNTIME_ALERT_DM_USER_ID')
                  ? 'text-warning-text'
                  : 'font-mono text-xs'
              "
            >
              {{
                idError('RUNTIME_ALERT_DM_USER_ID')
                  ? text('Check the User ID', 'ตรวจสอบ User ID')
                  : values.RUNTIME_ALERT_DM_USER_ID ||
                    text('Recipient not set', 'ยังไม่ได้ระบุผู้รับ')
              }}
            </dd>
          </div>
          <div>
            <dt class="text-text-secondary">{{ text('Before expiry', 'เตือนก่อนหมดอายุ') }}</dt>
            <dd class="mt-xs flex flex-wrap gap-xs">
              <span
                v-for="milestone in enabledMilestones"
                :key="milestone.key"
                class="rounded-md border border-border-subtle bg-bg-default px-xs py-xxs text-xs"
                >{{ text(milestone.label[0], milestone.label[1]) }}</span
              ><span v-if="!enabledMilestones.length" class="text-warning-text">{{
                text('No intervals selected', 'ยังไม่ได้เลือกช่วงเวลา')
              }}</span>
            </dd>
          </div>
        </dl>
        <p class="mt-md text-xs text-text-muted">
          {{
            disabled
              ? text(
                  'No alerts will be sent with this setting.',
                  'เมื่อบันทึกแล้ว บอทจะไม่ส่งการแจ้งเตือน',
                )
              : text('Save to apply these alert settings.', 'กดบันทึกเพื่อใช้การตั้งค่านี้กับบอท')
          }}
        </p>
      </FeatureSettingsCard>
    </template>
  </FeatureSettingsLayout>
</template>
