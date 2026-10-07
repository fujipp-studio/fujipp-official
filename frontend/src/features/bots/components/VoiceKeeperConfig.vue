<script setup lang="ts">
import { computed, useId } from 'vue'
import { Headphones, HeadphoneOff, Mic, MicOff } from 'lucide-vue-next'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureSettingToggle from './FeatureSettingToggle.vue'
import FeatureCommandsSettings from './FeatureCommandsSettings.vue'
import { voiceKeeperCommands } from '../config/feature-commands'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { values, configuration, text } = useFeatureEditor()
const id = useId()
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const commandName = computed(() => String(values.value.COMMAND_NAME ?? 'voice'))
const audioSettings = computed(() =>
  [
    {
      key: 'SELF_MUTE',
      label: text('Mute microphone', 'ปิดไมโครโฟน'),
      description: text(
        'Join with the bot’s microphone muted.',
        'ให้บอทเข้าห้องเสียงโดยปิดไมโครโฟน',
      ),
      icon: MicOff,
    },
    {
      key: 'SELF_DEAF',
      label: text('Deafen headphones', 'ปิดการรับเสียง'),
      description: text(
        'Join without receiving audio from the channel.',
        'ให้บอทเข้าห้องโดยไม่รับเสียงจากห้อง',
      ),
      icon: HeadphoneOff,
    },
  ].filter((item) => field(item.key)),
)
</script>

<template>
  <FeatureSettingsLayout>
    <FeatureSettingsCard
      v-if="audioSettings.length"
      :heading-id="id + '-audio'"
      :title="text('Audio settings', 'การตั้งค่าเสียง')"
      :icon="Headphones"
    >
      <div class="divide-y divide-border-subtle">
        <FeatureSettingToggle
          v-for="item in audioSettings"
          :key="item.key"
          class="py-md first:pt-0 last:pb-0"
          :model-value="Boolean(values[item.key])"
          :label="item.label"
          :description="item.description"
          :icon="item.icon"
          @update:model-value="values[item.key] = $event"
        />
      </div>
    </FeatureSettingsCard>
    <FeatureCommandsSettings
      v-if="field('COMMAND_NAME')"
      :model-value="commandName"
      default-name="voice"
      :required="field('COMMAND_NAME')?.required"
      :commands="voiceKeeperCommands"
      @update:model-value="values.COMMAND_NAME = $event"
    />
    <template #summary>
      <FeatureSettingsCard
        as="aside"
        compact
        :heading-id="id + '-preview'"
        :title="text('Audio settings summary', 'สรุปการตั้งค่าเสียง')"
      >
        <div
          v-if="audioSettings.length"
          class="mt-md space-y-sm text-xs text-text-secondary"
          data-voice-audio-preview
        >
          <p v-if="field('SELF_MUTE')" class="flex items-center gap-xs">
            <component :is="values.SELF_MUTE ? MicOff : Mic" :size="16" aria-hidden="true" />{{
              values.SELF_MUTE
                ? text('Microphone muted', 'ปิดไมโครโฟน')
                : text('Microphone unmuted', 'เปิดไมโครโฟน')
            }}
          </p>
          <p v-if="field('SELF_DEAF')" class="flex items-center gap-xs">
            <component
              :is="values.SELF_DEAF ? HeadphoneOff : Headphones"
              :size="16"
              aria-hidden="true"
            />{{
              values.SELF_DEAF
                ? text('Incoming audio disabled', 'ไม่รับเสียงจากห้อง')
                : text('Incoming audio enabled', 'รับเสียงจากห้อง')
            }}
          </p>
        </div>
        <p class="mt-lg border-t border-border-subtle pt-md text-xs text-text-muted">
          {{
            text(
              'These settings are used when the bot joins a voice channel.',
              'ใช้การตั้งค่านี้เมื่อบอทเข้าห้องเสียง',
            )
          }}
        </p>
      </FeatureSettingsCard>
    </template>
  </FeatureSettingsLayout>
</template>
