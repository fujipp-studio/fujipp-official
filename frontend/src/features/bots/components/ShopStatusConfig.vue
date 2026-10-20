<script setup lang="ts">
import { computed, useId } from 'vue'
import { Store, ShieldCheck, MessageSquare } from 'lucide-vue-next'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureCommandsSettings from './FeatureCommandsSettings.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import {
  parseShopRules,
  validateShopDraft,
  type ShopPermission,
  type ShopPermissionRule,
  type ShopPermissionSetting,
} from '../config/shop-status'

const { values, text } = useFeatureEditor()
const id = useId()
const rules = computed(() => parseShopRules(String(values.value.SHOP_PERMISSION_RULES ?? '[]')))
const valid = computed(() => validateShopDraft(values.value))
const states = computed(() => [
  { key: 'open' as const, prefix: 'OPEN', label: text('Open', 'เปิดร้าน') },
  { key: 'close' as const, prefix: 'CLOSE', label: text('Close', 'ปิดร้าน') },
])
const permissions = computed<{ key: ShopPermission; label: string }[]>(() => [
  { key: 'ViewChannel', label: text('View channel', 'เห็นห้อง') },
  { key: 'SendMessages', label: text('Send messages', 'ส่งข้อความ') },
  { key: 'Connect', label: text('Join voice', 'เข้าห้องเสียง') },
])
const options = computed(() => [
  { value: 'KEEP', label: text('Keep unchanged', 'ไม่เปลี่ยน') },
  { value: 'ALLOW', label: text('Allow', 'อนุญาต') },
  { value: 'DENY', label: text('Deny', 'ปฏิเสธ') },
  { value: 'INHERIT', label: text('Inherit server permissions', 'ใช้ค่าตามเซิร์ฟเวอร์') },
])
const commands = computed(() => [
  {
    name: String(values.value.SHOP_OPEN_COMMAND ?? 'open'),
    description: {
      en: 'Open the shop and apply open permissions.',
      th: 'เปิดร้านและปรับสิทธิ์ตามสถานะเปิด',
    },
  },
  {
    name: String(values.value.SHOP_CLOSE_COMMAND ?? 'close'),
    description: {
      en: 'Close the shop and apply closed permissions.',
      th: 'ปิดร้านและปรับสิทธิ์ตามสถานะปิด',
    },
  },
])
function writeRules(next: ShopPermissionRule[]) {
  values.value.SHOP_PERMISSION_RULES = JSON.stringify(next)
}
function updateRule(index: number, key: 'channelId' | 'roleId', value: string) {
  writeRules(rules.value.map((rule, i) => (i === index ? { ...rule, [key]: value } : rule)))
}
function updatePermission(
  index: number,
  state: 'open' | 'close',
  key: ShopPermission,
  value: string,
) {
  writeRules(
    rules.value.map((rule, i) =>
      i === index
        ? { ...rule, [state]: { ...rule[state], [key]: value as ShopPermissionSetting } }
        : rule,
    ),
  )
}
</script>

<template>
  <div class="space-y-lg" data-shop-status-config>
    <p v-if="!valid" role="alert" class="text-sm text-error-text">
      {{
        text(
          'Check command names, announcement text and channel/role IDs. Each channel and role pair must be unique.',
          'ตรวจสอบชื่อคำสั่ง ข้อความ และ ID ห้อง/Role โดยแต่ละคู่ห้องกับ Role ต้องไม่ซ้ำกัน',
        )
      }}
    </p>
    <FeatureSettingsLayout>
      <FeatureCommandsSettings
        :model-value="String(values.SHOP_COMMAND_NAME ?? 'shop')"
        default-name="shop"
        :commands="commands"
        @update:model-value="values.SHOP_COMMAND_NAME = $event"
      >
        <div class="mt-lg grid gap-md tablet:grid-cols-2">
          <AppTextField
            v-for="state in states"
            :key="state.key"
            :model-value="String(values[`SHOP_${state.prefix}_COMMAND`] ?? state.key)"
            :label="text(`${state.label} subcommand`, `คำสั่งย่อย${state.label}`)"
            :placeholder="state.key"
            :maxlength="32"
            pattern="[a-z0-9_-]{1,32}"
            required
            @update:model-value="values[`SHOP_${state.prefix}_COMMAND`] = $event"
          />
        </div>
      </FeatureCommandsSettings>
      <FeatureSettingsCard :title="text('Announcements', 'ประกาศสถานะร้าน')" :icon="MessageSquare">
        <AppTextField
          :model-value="String(values.SHOP_ANNOUNCEMENT_CHANNEL_ID ?? '')"
          :label="text('Announcement channel ID (optional)', 'ID ห้องประกาศ (ไม่บังคับ)')"
          placeholder="123456789012345678"
          :support-text="
            text('Leave empty to use the command channel.', 'เว้นว่างเพื่อใช้ห้องที่เรียกคำสั่ง')
          "
          @update:model-value="values.SHOP_ANNOUNCEMENT_CHANNEL_ID = $event"
        />
        <div
          v-for="state in states"
          :key="state.key"
          class="mt-lg border-t border-border-subtle pt-lg"
        >
          <AppTextField
            variant="dropdown"
            :model-value="String(values[`SHOP_${state.prefix}_MESSAGE_TYPE`] ?? 'DESIGNED')"
            :label="text(`${state.label} message`, `ข้อความ${state.label}`)"
            :options="[
              { value: 'TEXT', label: text('Plain text', 'ข้อความธรรมดา') },
              { value: 'DESIGNED', label: 'Embed / Components V2' },
            ]"
            @update:model-value="values[`SHOP_${state.prefix}_MESSAGE_TYPE`] = $event"
          />
          <div
            v-if="values[`SHOP_${state.prefix}_MESSAGE_TYPE`] === 'TEXT'"
            class="mt-md block text-sm"
          >
            <label :for="id + '-' + state.key + '-text'">{{
              text('Announcement text', 'ข้อความประกาศ')
            }}</label>
            <textarea
              :id="id + '-' + state.key + '-text'"
              :aria-describedby="id + '-' + state.key + '-help'"
              v-model="values[`SHOP_${state.prefix}_TEXT`] as string"
              class="field-control mt-xs min-h-32 w-full resize-y py-sm"
              rows="4"
              maxlength="2000"
            />
            <span
              :id="id + '-' + state.key + '-help'"
              class="mt-xs block text-xs text-text-muted"
              v-text="
                text(
                  'Up to 2000 characters · Variables: {{status}}, {{user}}, {{user_name}}, {{channel}}, {{guild_name}}',
                  'สูงสุด 2000 ตัวอักษร · ตัวแปร: {{status}}, {{user}}, {{user_name}}, {{channel}}, {{guild_name}}',
                )
              "
            />
          </div>
          <p v-else class="mt-sm text-xs text-text-secondary">
            {{
              text(
                'Choose Embed or Components V2 and edit this announcement in Message design below.',
                'เลือก Embed หรือ Components V2 และแก้ไขประกาศนี้ในส่วนออกแบบข้อความด้านล่าง',
              )
            }}
          </p>
        </div>
      </FeatureSettingsCard>
      <template #summary>
        <FeatureSettingsCard
          as="aside"
          :title="text('Shop status', 'สถานะร้าน')"
          :icon="Store"
          compact
        >
          <p class="text-sm text-text-secondary">
            {{
              text(
                'Use the open or close command to post an announcement and apply the configured permission rules.',
                'ใช้คำสั่งเปิดหรือปิดร้านเพื่อส่งประกาศและปรับสิทธิ์ตามกฎที่ตั้งไว้',
              )
            }}
          </p>
          <p class="mt-md text-xs text-text-muted">
            {{
              text(
                'No rules means announcements only. Opening applies the open settings; it does not automatically restore previous permissions.',
                'หากไม่เพิ่มกฎจะส่งประกาศอย่างเดียว เมื่อเปิดร้านจะใช้ค่าฝั่งเปิดร้านตามที่ตั้งไว้',
              )
            }}
          </p>
        </FeatureSettingsCard>
      </template>
    </FeatureSettingsLayout>
    <FeatureSettingsCard
      :title="text('Channel permissions (optional)', 'สิทธิ์ห้อง (ไม่บังคับ)')"
      :icon="ShieldCheck"
      :heading-id="id + '-rules'"
    >
      <p class="mb-md text-xs text-text-secondary">
        {{
          text(
            'Add up to 25 channel/role pairs. Use the server ID for @everyone. The bot needs Manage Roles in each channel. Inherit clears this role’s channel override for that permission; other roles and member overrides still apply.',
            'เพิ่มได้สูงสุด 25 คู่ห้อง/Role ใช้ Server ID แทน @everyone บอทต้องมี Manage Roles ในห้องนั้น “ใช้ค่าตามเซิร์ฟเวอร์” จะล้างการกำหนดสิทธิ์นี้ของ Role ในห้อง ส่วนสิทธิ์จาก Role อื่นและรายสมาชิกยังมีผล',
          )
        }}
      </p>
      <div class="space-y-md">
        <article
          v-for="(rule, index) in rules"
          :key="index"
          class="rounded-lg border border-border-subtle p-md"
        >
          <div class="mb-md flex items-center justify-between gap-sm">
            <h3 class="shrink-0 text-sm font-medium">
              {{ text(`Rule ${index + 1}`, `กฎที่ ${index + 1}`) }}
            </h3>
            <AppButton
              variant="secondary"
              :aria-label="text(`Remove rule ${index + 1}`, `ลบกฎที่ ${index + 1}`)"
              class="!w-auto shrink-0"
              @click="writeRules(rules.filter((_, i) => i !== index))"
              >{{ text('Remove', 'ลบ') }}</AppButton
            >
          </div>
          <div class="grid gap-md tablet:grid-cols-2">
            <AppTextField
              :model-value="rule.channelId"
              :label="text('Channel ID', 'ID ห้อง')"
              placeholder="123456789012345678"
              pattern="[0-9]{15,30}"
              required
              @update:model-value="updateRule(index, 'channelId', $event)"
            />
            <AppTextField
              :model-value="rule.roleId"
              :label="text('Role ID', 'ID Role')"
              placeholder="123456789012345678"
              pattern="[0-9]{15,30}"
              required
              @update:model-value="updateRule(index, 'roleId', $event)"
            />
          </div>
          <div class="mt-lg grid gap-lg tablet:grid-cols-2">
            <fieldset v-for="state in states" :key="state.key" class="min-w-0 space-y-md">
              <legend class="mb-md text-sm font-semibold">{{ state.label }}</legend>
              <AppTextField
                v-for="permission in permissions"
                :key="permission.key"
                variant="dropdown"
                :model-value="rule[state.key][permission.key] ?? 'KEEP'"
                :label="permission.label"
                :options="options"
                :support-text="
                  permission.key === 'Connect'
                    ? text('Voice channels only', 'เฉพาะห้องเสียง')
                    : undefined
                "
                @update:model-value="updatePermission(index, state.key, permission.key, $event)"
              />
            </fieldset>
          </div>
        </article>
      </div>
      <p v-if="!rules.length" class="mb-md text-sm text-text-muted">
        {{
          text(
            'No permission rules. Commands will only send announcements.',
            'ยังไม่มีกฎสิทธิ์ คำสั่งจะส่งประกาศอย่างเดียว',
          )
        }}
      </p>
      <AppButton
        class="mt-md"
        variant="secondary"
        :disabled="rules.length >= 25"
        @click="writeRules([...rules, { channelId: '', roleId: '', open: {}, close: {} }])"
        >{{ text('Add permission rule', 'เพิ่มกฎสิทธิ์') }}</AppButton
      >
    </FeatureSettingsCard>
  </div>
</template>
