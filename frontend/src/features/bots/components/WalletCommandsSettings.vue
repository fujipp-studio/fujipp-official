<script setup lang="ts">
import { computed, useId } from 'vue'
import FeatureCommandsSettings from './FeatureCommandsSettings.vue'
import FeatureCommandList from './FeatureCommandList.vue'
import { walletTopupCommands } from '../config/feature-commands'
import { useFeatureEditor } from '../composables/featureEditorContext'
const { configuration, values, license, text } = useFeatureEditor()
const id = useId()
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const panelName = computed(() => String(values.value.PANEL_COMMAND_NAME ?? 'wallet-panel'))
const commands = computed(() =>
  walletTopupCommands(panelName.value.trim().toLowerCase() || 'wallet-panel'),
)
</script>
<template>
  <FeatureCommandsSettings
    v-if="field('PANEL_COMMAND_NAME')"
    :model-value="panelName"
    default-name="wallet-panel"
    :required="field('PANEL_COMMAND_NAME')?.required"
    :commands="[]"
    :description="
      text(
        'Name the panel command. The other wallet command names are fixed.',
        'ตั้งชื่อคำสั่งส่งแผงเติมเงิน คำสั่งกระเป๋าเงินอื่นใช้ชื่อคงที่',
      )
    "
    :permission-note="
      text(
        'Wallet administration requires Administrator or the Wallet administrator role. Bot Permissions can add restrictions.',
        'คำสั่งจัดการกระเป๋าเงินต้องมี Administrator หรือยศผู้ดูแลกระเป๋าเงิน โดย Bot Permissions ใช้จำกัดสิทธิ์เพิ่มเติมได้',
      )
    "
    @update:model-value="values.PANEL_COMMAND_NAME = $event"
  >
    <h3 :id="id + '-commands'" class="mt-lg text-sm font-medium">
      {{ text('Available commands', 'คำสั่งที่ใช้งานได้') }}
    </h3>
    <FeatureCommandList
      class="mt-sm"
      :commands="commands.slice(0, 2)"
      :labelledby="id + '-commands'"
    />
    <details class="mt-lg border-t border-border-subtle pt-md">
      <summary class="cursor-pointer text-sm font-medium">
        {{ text('Wallet administrator commands', 'คำสั่งผู้ดูแลกระเป๋าเงิน') }}
      </summary>
      <FeatureCommandList class="mt-md" :commands="commands.slice(2)" />
      <p v-if="license?.version === '2.1.0'" class="mt-sm text-xs text-text-muted">
        {{
          text(
            'For add, remove and set, choose a member and enter the amount and reason in the modal.',
            'สำหรับ add, remove และ set ให้เลือกสมาชิก แล้วกรอกจำนวนเงินและเหตุผลในหน้าต่างยืนยัน',
          )
        }}
      </p>
    </details>
  </FeatureCommandsSettings>
</template>
