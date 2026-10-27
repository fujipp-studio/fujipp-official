<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { BadgeCheck, Plus, Trash2, Wallet } from 'lucide-vue-next'
import { AppButton, AppTextField } from '@/shared/ui'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { parseRolePrice, roleShopProductsValid } from '../models/role-shop'

const { values, text } = useFeatureEditor()
const id = useId()
type Draft = {
  key: string
  name: string
  roleId: string
  price: string
  source: Record<string, unknown>
}
const rows = ref<Draft[]>([])
let emitted = ''
const raw = computed(() => String(values.value.ROLE_SHOP_PRODUCTS ?? '[]'))
watch(
  raw,
  (value) => {
    if (value === emitted) return
    try {
      const parsed = JSON.parse(value)
      rows.value = Array.isArray(parsed)
        ? parsed.map((item) => ({
            key: String(item.key ?? ''),
            name: String(item.name ?? ''),
            roleId: String(item.roleId ?? ''),
            price: Number.isSafeInteger(item.priceSatang)
              ? (item.priceSatang / 100).toFixed(2)
              : '',
            source: item,
          }))
        : []
    } catch {
      rows.value = []
    }
  },
  { immediate: true },
)
function commit() {
  emitted = JSON.stringify(
    rows.value.map((row) => ({
      ...row.source,
      key: row.key,
      name: row.name,
      roleId: row.roleId,
      priceSatang: parseRolePrice(row.price),
    })),
    null,
    2,
  )
  values.value.ROLE_SHOP_PRODUCTS = emitted
}
function add() {
  rows.value.push({ key: crypto.randomUUID(), name: '', roleId: '', price: '', source: {} })
  commit()
}
function remove(index: number) {
  rows.value.splice(index, 1)
  commit()
}
const valid = computed(() => roleShopProductsValid(raw.value))
</script>

<template>
  <FeatureSettingsLayout data-role-shop-config>
    <FeatureSettingsCard
      :heading-id="id + '-products'"
      :title="text('Roles for sale', 'ยศที่ขาย')"
      :icon="BadgeCheck"
    >
      <p class="mb-lg text-sm text-text-secondary">
        {{
          text(
            'Sell permanent Discord roles using this bot’s Wallet balance. Install Wallet Top-up on the same bot.',
            'ขายยศ Discord แบบถาวร โดยใช้ยอด Wallet ของบอท ติดตั้ง Wallet Top-up บนบอทเดียวกันก่อนใช้งาน',
          )
        }}
      </p>
      <div class="space-y-md">
        <div
          v-for="(row, index) in rows"
          :key="row.key"
          data-role-product
          class="space-y-md rounded-lg border border-border-subtle p-md"
        >
          <div class="flex items-center justify-between gap-md">
            <strong class="text-sm">{{ text(`Role ${index + 1}`, `ยศที่ ${index + 1}`) }}</strong>
            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-error-border text-error-text hover:bg-error-bg"
              :aria-label="text(`Delete role ${index + 1}`, `ลบยศที่ ${index + 1}`)"
              @click="remove(index)"
            >
              <Trash2 :size="18" />
            </button>
          </div>
          <AppTextField
            v-model="row.name"
            :label="text('Display name', 'ชื่อที่แสดง')"
            :maxlength="100"
            required
            @update:model-value="commit"
          />
          <div class="grid gap-md tablet:grid-cols-2">
            <AppTextField
              v-model="row.roleId"
              label="Discord Role ID"
              required
              @update:model-value="commit"
            />
            <AppTextField
              v-model="row.price"
              :label="text('Price (THB)', 'ราคา (บาท)')"
              input-type="number"
              :min="0.01"
              :step="0.01"
              required
              @update:model-value="commit"
            />
          </div>
        </div>
        <p v-if="!rows.length" class="text-sm text-text-muted">
          {{ text('Add the first role to start selling.', 'เพิ่มยศแรกเพื่อเริ่มขาย') }}
        </p>
        <p v-if="!valid" role="status" class="text-sm text-error-text">
          {{
            text(
              'Enter a name, a unique Role ID and a positive price with up to 2 decimal places for every role.',
              'กรอกชื่อ Role ID ที่ไม่ซ้ำ และราคามากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่งให้ครบทุกยศ',
            )
          }}
        </p>
        <AppButton variant="secondary" :disabled="rows.length >= 25" @click="add"
          ><Plus :size="18" />{{ text('Add role', 'เพิ่มยศ') }}</AppButton
        >
      </div>
    </FeatureSettingsCard>
    <FeatureSettingsCard
      :heading-id="id + '-settings'"
      :title="text('Commands and receipts', 'คำสั่งและใบเสร็จ')"
    >
      <div class="space-y-md">
        <AppTextField
          :model-value="String(values.ROLE_SHOP_COMMAND_NAME ?? 'role-shop-panel')"
          :label="text('Panel command', 'คำสั่งส่งแผงขายยศ')"
          @update:model-value="values.ROLE_SHOP_COMMAND_NAME = $event"
        />
        <AppTextField
          :model-value="String(values.ROLE_SHOP_NOTIFICATION_CHANNEL_ID ?? '')"
          :label="text('Receipt channel ID (optional)', 'Channel ID ห้องใบเสร็จ (ไม่บังคับ)')"
          :placeholder="text('Optional channel ID', 'เว้นว่างได้')"
          @update:model-value="values.ROLE_SHOP_NOTIFICATION_CHANNEL_ID = $event"
        />
      </div>
    </FeatureSettingsCard>
    <template #summary>
      <FeatureSettingsCard
        as="aside"
        compact
        :heading-id="id + '-wallet'"
        :title="text('Shared Wallet', 'ใช้ Wallet ร่วมกัน')"
        :icon="Wallet"
      >
        <p class="text-sm text-text-secondary">
          {{
            text(
              'Top-ups, Roblox Payout and role purchases use the same balance. Members confirm the price before purchase. The bot needs Manage Roles and a role above every role for sale.',
              'ยอดเติมเงิน Roblox Payout และการซื้อยศใช้กระเป๋าเดียวกัน สมาชิกยืนยันราคาก่อนซื้อ บอทต้องมี Manage Roles และมียศสูงกว่ายศที่ขาย',
            )
          }}
        </p>
      </FeatureSettingsCard>
    </template>
  </FeatureSettingsLayout>
</template>
