<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Gamepad2, Hash, LayoutPanelTop, ShoppingBag, Terminal } from 'lucide-vue-next'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureSettingToggle from './FeatureSettingToggle.vue'
import FeatureConfigField from './FeatureConfigField.vue'
import FeatureCommandsSettings from './FeatureCommandsSettings.vue'
import FeatureCommandList from './FeatureCommandList.vue'
import RobloxGroupEditor from './RobloxGroupEditor.vue'
import RobuxPanelsEditor from './RobuxPanelsEditor.vue'
import RobuxPackagesEditor from './RobuxPackagesEditor.vue'
import { robloxPayoutCommands } from '../config/feature-commands'
import { useFeatureEditor } from '../composables/featureEditorContext'

const {
  configuration,
  values,
  secrets,
  license,
  text,
  isRobloxPayoutV2,
  isRobloxPayoutV3,
  robloxCredentialsConfigured,
} = useFeatureEditor()
const id = useId()
const activeCategory = ref('sales')
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const channels = [
  'ROBUX_SUCCESS_NOTIFICATION_CHANNEL_ID',
  'ROBUX_ERROR_NOTIFICATION_CHANNEL_ID',
  'ROBUX_NOTIFICATION_CHANNEL_ID',
  'ROBUX_RECEIPT_CHANNEL_ID',
]
const categories = computed(() =>
  [
    {
      key: 'sales',
      label: text('Sales', 'การขาย'),
      icon: ShoppingBag,
      show: ['ROBUX_ENABLED', 'ROBUX_RATE', 'ROBUX_PACKAGES', 'ROBUX_PAYOUT_COOLDOWN_SECONDS'].some(
        (key) => field(key),
      ),
    },
    {
      key: 'groups',
      label: text('Roblox groups', 'กลุ่ม Roblox'),
      icon: Gamepad2,
      show: Boolean(field('ROBLOX_GROUPS')),
    },
    {
      key: 'panels',
      label: text('Panels', 'แผงร้าน'),
      icon: LayoutPanelTop,
      show: isRobloxPayoutV3.value && Boolean(field('ROBUX_PANELS')),
    },
    { key: 'discord', label: 'Discord', icon: Hash, show: channels.some((key) => field(key)) },
    {
      key: 'commands',
      label: text('Commands', 'คำสั่ง'),
      icon: Terminal,
      show: Boolean(field('PANEL_COMMAND_NAME')),
    },
  ].filter((category) => category.show),
)
watch(
  categories,
  (list) => {
    if (!list.some((category) => category.key === activeCategory.value))
      activeCategory.value = list[0]?.key ?? ''
  },
  { immediate: true },
)
const panelName = computed(() => String(values.value.PANEL_COMMAND_NAME ?? 'robux-panel'))
const commands = computed(() =>
  robloxPayoutCommands(panelName.value || 'robux-panel', license.value?.version ?? ''),
)
function rows(key: string): Record<string, unknown>[] {
  try {
    const raw: unknown = JSON.parse(String(values.value[key] ?? '[]'))
    return Array.isArray(raw)
      ? raw.filter((row) => row && typeof row === 'object' && !Array.isArray(row))
      : []
  } catch {
    return []
  }
}
const groups = computed(() => rows('ROBLOX_GROUPS'))
const panels = computed(() => rows('ROBUX_PANELS'))
const packages = computed(() => rows('ROBUX_PACKAGES'))
const groupRates = computed(() =>
  isRobloxPayoutV3.value
    ? groups.value
        .map((group) =>
          Number(group.rate) > 0 ? Number(group.rate) : Number(values.value.ROBUX_RATE ?? 3.5),
        )
        .filter((rate) => Number.isFinite(rate) && rate > 0)
    : [],
)
</script>

<template>
  <div class="space-y-lg" data-roblox-payout-config>
    <FeatureSettingsCategories
      v-model="activeCategory"
      :id-prefix="id"
      :label="text('Settings category', 'หมวดการตั้งค่า')"
      :categories="categories"
    />
    <FeatureSettingsLayout>
      <section
        v-for="category in categories"
        v-show="activeCategory === category.key"
        :id="id + '-panel-' + category.key"
        :key="category.key"
        role="tabpanel"
        :aria-labelledby="id + '-tab-' + category.key"
        class="min-w-0 space-y-lg"
      >
        <template v-if="category.key === 'sales'">
          <FeatureSettingsCard :title="text('Sales settings', 'ตั้งค่าการขาย')" :icon="ShoppingBag">
            <div class="space-y-lg">
              <FeatureSettingToggle
                v-if="field('ROBUX_ENABLED')"
                :model-value="Boolean(values.ROBUX_ENABLED)"
                :label="text('Accept new purchases', 'เปิดรับคำสั่งซื้อ')"
                :description="
                  text(
                    'Allow members to start new Robux purchases.',
                    'อนุญาตให้สมาชิกเริ่มซื้อ Robux รายการใหม่',
                  )
                "
                @update:model-value="values.ROBUX_ENABLED = $event"
              />
              <FeatureConfigField
                field-key="ROBUX_RATE"
                :label="
                  isRobloxPayoutV3
                    ? text('Default Robux rate', 'Rate เริ่มต้น')
                    : text('Robux rate', 'อัตรา Robux')
                "
                :support-text="
                  isRobloxPayoutV3
                    ? text(
                        'Fallback for groups without their own rate. Set individual rates in Roblox groups.',
                        'ใช้กับกลุ่มที่ยังไม่มี Rate ของตัวเอง ตั้งค่าแยกได้ในหมวดกลุ่ม Roblox',
                      )
                    : text('Robux received per 1 THB.', 'จำนวน Robux ที่ได้รับต่อ 1 บาท')
                "
                unit="R$ / ฿"
              />
              <FeatureConfigField
                field-key="ROBUX_PAYOUT_COOLDOWN_SECONDS"
                :unit="text('seconds', 'วินาที')"
              />
            </div>
          </FeatureSettingsCard>
          <FeatureSettingsCard
            v-if="field('ROBUX_PACKAGES')"
            :title="text('Robux packages', 'แพ็กเกจ Robux')"
            :description="
              text(
                'Set the Robux amounts members can choose. Prices are calculated from the rate.',
                'กำหนดจำนวน Robux ที่สมาชิกเลือกซื้อ ราคาแสดงตาม Rate ที่ตั้งไว้',
              )
            "
          >
            <RobuxPackagesEditor
              :model-value="String(values.ROBUX_PACKAGES ?? '[]')"
              :rate="Number(values.ROBUX_RATE ?? 3.5)"
              :rates="groupRates"
              @update:model-value="values.ROBUX_PACKAGES = $event"
            />
          </FeatureSettingsCard>
        </template>
        <RobloxGroupEditor
          v-else-if="category.key === 'groups'"
          v-model:groups-json="values.ROBLOX_GROUPS as string"
          :credentials-json="String(secrets.ROBLOX_CREDENTIALS ?? '')"
          standalone
          :credentials-configured="robloxCredentialsConfigured"
          :show-membership-lookup="isRobloxPayoutV2"
          :show-rate="isRobloxPayoutV3"
          :default-rate="Number(values.ROBUX_RATE ?? 3.5)"
          @update:credentials-json="secrets.ROBLOX_CREDENTIALS = $event"
        />
        <RobuxPanelsEditor
          v-else-if="category.key === 'panels'"
          v-model:panels-json="values.ROBUX_PANELS as string"
          :groups-json="String(values.ROBLOX_GROUPS ?? '[]')"
          standalone
        />
        <FeatureSettingsCard
          v-else-if="category.key === 'discord'"
          :title="text('Notifications & receipts', 'แจ้งเตือนและใบเสร็จ')"
          :description="
            text(
              'Choose where payout results and receipts are sent.',
              'เลือกห้องสำหรับผลการโอน Robux และใบเสร็จ',
            )
          "
          :icon="Hash"
        >
          <div class="space-y-md">
            <FeatureConfigField v-for="key in channels" :key="key" :field-key="key" />
          </div>
        </FeatureSettingsCard>
        <FeatureCommandsSettings
          v-else-if="category.key === 'commands'"
          :model-value="panelName"
          default-name="robux-panel"
          :required="field('PANEL_COMMAND_NAME')?.required"
          :commands="[]"
          :description="
            text(
              'Name the command used to post a Robux panel.',
              'ตั้งชื่อคำสั่งสำหรับส่งแผงร้าน Robux',
            )
          "
          :permission-note="
            commands.length > 1
              ? text(
                  'Panel access follows Bot Permissions. Administrators can create manual receipts by default.',
                  'สิทธิ์ส่งแผงร้านกำหนดผ่าน Bot Permissions ส่วนใบเสร็จแบบกรอกเองให้ Administrator ใช้ได้โดยค่าเริ่มต้น',
                )
              : text(
                  'Panel access follows Bot Permissions.',
                  'สิทธิ์ส่งแผงร้านกำหนดผ่าน Bot Permissions',
                )
          "
          @update:model-value="values.PANEL_COMMAND_NAME = $event"
        >
          <h3 :id="id + '-commands'" class="mt-lg text-sm font-medium">
            {{ text('Available commands', 'คำสั่งที่ใช้งานได้') }}
          </h3>
          <FeatureCommandList class="mt-sm" :commands="commands" :labelledby="id + '-commands'" />
          <p v-if="isRobloxPayoutV3 && panels.length > 1" class="mt-md text-xs text-text-secondary">
            {{
              text(
                'Choose the panel option when posting. Each panel uses its assigned groups and message design.',
                'เลือกตัวเลือก panel ตอนใช้คำสั่ง แต่ละแผงใช้กลุ่มและข้อความที่กำหนดไว้ของตัวเอง',
              )
            }}
          </p>
        </FeatureCommandsSettings>
      </section>
      <template #summary>
        <FeatureSettingsCard
          as="aside"
          compact
          :title="text('Settings summary', 'สรุปการตั้งค่า')"
          :icon="Gamepad2"
        >
          <dl class="space-y-md text-sm" data-roblox-payout-summary>
            <div v-if="field('ROBUX_ENABLED')">
              <dt class="text-xs text-text-muted">{{ text('Sales', 'การขาย') }}</dt>
              <dd class="mt-xs">
                {{ values.ROBUX_ENABLED ? text('Open', 'เปิดอยู่') : text('Paused', 'พักการขาย') }}
              </dd>
            </div>
            <div v-if="field('ROBLOX_GROUPS')">
              <dt class="text-xs text-text-muted">{{ text('Roblox groups', 'กลุ่ม Roblox') }}</dt>
              <dd class="mt-xs">{{ groups.length }} {{ text('groups', 'กลุ่ม') }}</dd>
            </div>
            <div v-if="field('ROBUX_PACKAGES')">
              <dt class="text-xs text-text-muted">{{ text('Packages', 'แพ็กเกจ') }}</dt>
              <dd class="mt-xs">{{ packages.length }} {{ text('packages', 'แพ็กเกจ') }}</dd>
            </div>
            <div v-if="isRobloxPayoutV3">
              <dt class="text-xs text-text-muted">{{ text('Panels', 'แผงร้าน') }}</dt>
              <dd class="mt-xs">{{ panels.length || 1 }} {{ text('panels', 'แผง') }}</dd>
            </div>
            <div v-if="field('PANEL_COMMAND_NAME')">
              <dt class="text-xs text-text-muted">{{ text('Panel command', 'คำสั่งแผงร้าน') }}</dt>
              <dd class="mt-xs break-all font-mono text-xs">/{{ panelName || 'robux-panel' }}</dd>
            </div>
          </dl>
          <p class="mt-lg border-t border-border-subtle pt-md text-xs text-text-muted">
            {{
              text(
                'Save all includes changes from every category.',
                'บันทึกทั้งหมดจะรวมการแก้ไขจากทุกหมวด',
              )
            }}
          </p>
        </FeatureSettingsCard>
      </template>
    </FeatureSettingsLayout>
  </div>
</template>
