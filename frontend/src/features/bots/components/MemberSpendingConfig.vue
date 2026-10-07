<script setup lang="ts">
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureSettingsHeading from './FeatureSettingsHeading.vue'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import { computed, nextTick, ref, useId } from 'vue'
import {
  Award,
  Database,
  HelpCircle,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  Trophy,
} from 'lucide-vue-next'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingToggle from './FeatureSettingToggle.vue'
import CommandPermissionsEditor from './CommandPermissionsEditor.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { configuration, values, secrets, text } = useFeatureEditor()
const id = useId()
const tierList = ref<HTMLElement>()
const activeCategory = ref('levels')
const hasField = (key: string) => configuration.value?.fields.some((field) => field.key === key)
const ownDatabase = computed(() => Boolean(values.value.SPENDING_DB_USE_OWN))
const countEnabled = computed(() => Boolean(values.value.SPENDING_COUNT_ENABLED))
const databaseConfigured = computed(
  () => configuration.value?.fields.find((field) => field.key === 'SPENDING_DB_URL')?.configured,
)
const tierData = computed(() => {
  try {
    const parsed: unknown = JSON.parse(String(values.value.SPENDING_UPGRADE_TIERS ?? '[]'))
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => !item || typeof item !== 'object' || Array.isArray(item))
    )
      return null
    return parsed as Record<string, unknown>[]
  } catch {
    return null
  }
})
const tiers = computed(() => tierData.value ?? [])
const roleError = (value: unknown) => {
  const role = String(value ?? '')
  return role && !/^[0-9]{15,30}$/.test(role)
    ? text(
        'Enter a Discord Role ID with 15–30 digits.',
        'กรอก Discord Role ID เป็นตัวเลข 15–30 หลัก',
      )
    : ''
}
function updateTier(index: number, key: 'amount' | 'roleId', value: string) {
  const next = tiers.value.map((tier) => ({ ...tier }))
  const tier = next[index]
  if (!tier) return
  tier[key] = key === 'amount' ? (value === '' ? '' : Number(value)) : value
  values.value.SPENDING_UPGRADE_TIERS = JSON.stringify(next)
}
async function addTier() {
  values.value.SPENDING_UPGRADE_TIERS = JSON.stringify([
    ...tiers.value,
    { amount: 1000, roleId: '' },
  ])
  await nextTick()
  tierList.value
    ?.querySelectorAll<HTMLInputElement>('input[type="number"]')
    .item(tiers.value.length - 1)
    ?.focus()
}
async function removeTier(index: number) {
  values.value.SPENDING_UPGRADE_TIERS = JSON.stringify(tiers.value.filter((_, i) => i !== index))
  await nextTick()
  const inputs = tierList.value?.querySelectorAll<HTMLInputElement>('input[type="number"]')
  if (inputs?.length) inputs.item(Math.min(index, inputs.length - 1))?.focus()
  else tierList.value?.querySelector<HTMLButtonElement>('[data-add-tier]')?.focus()
}
const rankingRoles = computed(() =>
  [
    { key: 'SPENDING_TOP1_ROLE_ID', label: text('Top 1 role', 'ยศอันดับ 1') },
    { key: 'SPENDING_TOP5_ROLE_ID', label: text('Top 2–5 role', 'ยศอันดับ 2–5') },
  ].filter((field) => hasField(field.key)),
)
const categories = computed(() =>
  [
    {
      key: 'levels',
      label: text('Member levels', 'ระดับสมาชิก'),
      icon: Award,
      visible: hasField('SPENDING_UPGRADE_TIERS') || hasField('SPENDING_FIRST_ROLE_ID'),
    },
    {
      key: 'rules',
      label: text('Role rules', 'เงื่อนไขยศ'),
      icon: Settings2,
      visible: hasField('SPENDING_TIER_STACK') || hasField('SPENDING_COUNT_ENABLED'),
    },
    {
      key: 'ranking',
      label: text('Leaderboard', 'อันดับ'),
      icon: Trophy,
      visible: rankingRoles.value.length > 0,
    },
    {
      key: 'storage',
      label: text('Database', 'ฐานข้อมูล'),
      icon: Database,
      visible: hasField('SPENDING_DB_USE_OWN'),
    },
    {
      key: 'permissions',
      label: text('Permissions', 'สิทธิ์คำสั่ง'),
      icon: ShieldCheck,
      visible: hasField('COMMAND_PERMISSION_RULES'),
    },
  ].filter((category) => category.visible),
)
</script>

<template>
  <div class="space-y-lg">
    <FeatureSettingsCategories
      v-model="activeCategory"
      :id-prefix="id"
      :label="text('Configuration category', 'หมวดการตั้งค่า')"
      :categories="categories"
    />

    <FeatureSettingsCard as="div">
      <section
        v-show="activeCategory === 'levels'"
        :id="id + '-panel-levels'"
        role="tabpanel"
        :aria-labelledby="id + '-tab-levels'"
        tabindex="0"
      >
        <FeatureSettingsHeading
          :title="text('Member levels', 'ระดับสมาชิก')"
          :description="
            text(
              'Set the spending amount and role for each level.',
              'กำหนดยอดสะสมและยศที่ได้รับในแต่ละระดับ',
            )
          "
          class="mb-lg"
        />

        <div v-if="hasField('SPENDING_FIRST_ROLE_ID')" class="mb-lg max-w-reading">
          <AppTextField
            :model-value="String(values.SPENDING_FIRST_ROLE_ID ?? '')"
            :label="text('First purchase role (optional)', 'ยศเมื่อเพิ่มยอดครั้งแรก (ไม่บังคับ)')"
            :placeholder="text('Discord Role ID', 'กรอก Discord Role ID')"
            :state="roleError(values.SPENDING_FIRST_ROLE_ID) ? 'error' : 'default'"
            :support-text="roleError(values.SPENDING_FIRST_ROLE_ID)"
            pattern="[0-9]{15,30}"
            @update:model-value="values.SPENDING_FIRST_ROLE_ID = $event"
          />
        </div>

        <div v-if="hasField('SPENDING_UPGRADE_TIERS')" ref="tierList">
          <div class="mb-xs flex items-center justify-between gap-sm">
            <h3 class="text-sm font-semibold">{{ text('Spending levels', 'ระดับยอดสะสม') }}</h3>
            <span class="text-xs text-text-secondary">{{
              text(tiers.length + ' levels', tiers.length + ' ระดับ')
            }}</span>
          </div>
          <div
            v-if="tierData === null"
            class="rounded-lg border border-error-border bg-error-bg p-md text-sm text-error-text"
          >
            <label :for="id + '-tiers-json'">{{
              text(
                'Level data could not be read. Correct the saved JSON to continue.',
                'อ่านข้อมูลระดับไม่ได้ กรุณาแก้ไข JSON เดิมก่อนเพิ่มระดับ',
              )
            }}</label>
            <textarea
              :id="id + '-tiers-json'"
              v-model="values.SPENDING_UPGRADE_TIERS as string"
              class="field-control mt-sm min-h-32 font-mono"
            />
          </div>
          <div v-else>
            <p
              v-if="!tiers.length"
              class="border-t border-border-subtle py-xl text-center text-sm text-text-secondary"
            >
              {{ text('No spending levels yet.', 'ยังไม่มีระดับยอดสะสม') }}
            </p>
            <fieldset
              v-for="(tier, index) in tiers"
              :key="index"
              class="grid min-w-0 grid-cols-2 items-end gap-sm border-t border-border-subtle py-md tablet:grid-cols-12"
            >
              <legend class="sr-only">
                {{ text('Level ' + (index + 1), 'ระดับ ' + (index + 1)) }}
              </legend>
              <span class="order-1 self-center text-sm text-text-secondary tablet:col-span-1">{{
                String(index + 1).padStart(2, '0')
              }}</span>
              <div class="order-3 col-span-2 min-w-0 tablet:order-2 tablet:col-span-4">
                <label :for="id + '-amount-' + index" class="mb-xs block text-sm font-medium">{{
                  text('Minimum spending (THB)', 'ยอดสะสมขั้นต่ำ (บาท)')
                }}</label>
                <input
                  :id="id + '-amount-' + index"
                  :value="tier.amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  class="field-control h-12"
                  @input="updateTier(index, 'amount', ($event.target as HTMLInputElement).value)"
                />
              </div>
              <AppTextField
                class="order-4 col-span-2 min-w-0 tablet:order-3 tablet:col-span-6"
                :model-value="String(tier.roleId ?? '')"
                label="Discord Role ID"
                :placeholder="text('Role to grant', 'กรอก ID ยศที่จะมอบ')"
                pattern="[0-9]{15,30}"
                required
                :state="roleError(tier.roleId) ? 'error' : 'default'"
                :support-text="roleError(tier.roleId)"
                @update:model-value="updateTier(index, 'roleId', $event)"
              />
              <button
                type="button"
                class="order-2 flex h-12 items-center justify-center justify-self-end rounded-md px-sm text-text-secondary hover:bg-error-bg hover:text-error-text tablet:order-4 tablet:col-span-1"
                :aria-label="text('Delete level ' + (index + 1), 'ลบระดับ ' + (index + 1))"
                @click="removeTier(index)"
              >
                <Trash2 :size="18" aria-hidden="true" />
              </button>
            </fieldset>
            <button
              type="button"
              data-add-tier
              class="mt-sm inline-flex items-center justify-center gap-xs rounded-lg border border-border-default bg-bg-default px-md py-sm text-sm font-medium hover:bg-bg-surface-hover"
              @click="addTier"
            >
              <Plus :size="18" aria-hidden="true" />{{
                text('Add spending level', 'เพิ่มระดับยอดสะสม')
              }}
            </button>
          </div>
        </div>
        <details class="mt-lg border-t border-border-subtle pt-md text-sm text-text-secondary">
          <summary class="w-fit cursor-pointer rounded-sm font-medium">
            {{ text('How to find a Role ID', 'วิธีหา Role ID') }}
          </summary>
          <p class="mt-sm max-w-reading">
            {{
              text(
                'Enable Developer Mode in Discord, then right-click a role to copy its ID. Place the bot role above the roles it grants.',
                'เปิด Developer Mode ใน Discord แล้วคลิกขวาที่ยศเพื่อคัดลอก ID และวางยศบอทไว้เหนือยศที่ต้องการมอบ',
              )
            }}
          </p>
        </details>
      </section>

      <section
        v-show="activeCategory === 'rules'"
        :id="id + '-panel-rules'"
        role="tabpanel"
        :aria-labelledby="id + '-tab-rules'"
        tabindex="0"
      >
        <FeatureSettingsHeading
          :title="text('Role rules', 'เงื่อนไขยศ')"
          :description="
            text(
              'Choose how members qualify for and keep their roles.',
              'เลือกรูปแบบการรับและเก็บยศของสมาชิก',
            )
          "
          class="mb-lg"
        />
        <div class="max-w-reading">
          <FeatureSettingToggle
            v-if="hasField('SPENDING_TIER_STACK')"
            class="border-b border-border-subtle pb-lg"
            :label="text('Keep roles from previous levels', 'เก็บยศจากระดับก่อนหน้า')"
            :description="
              values.SPENDING_TIER_STACK
                ? text('Keep all qualifying roles.', 'เก็บทุกยศที่ผ่านเกณฑ์')
                : text(
                    'Keep the last qualifying level in the list.',
                    'เก็บเฉพาะระดับสุดท้ายในรายการที่ผ่านเกณฑ์',
                  )
            "
            :model-value="Boolean(values.SPENDING_TIER_STACK)"
            @update:model-value="values.SPENDING_TIER_STACK = $event"
          />
          <div v-if="hasField('SPENDING_COUNT_ENABLED')" class="pt-lg">
            <FeatureSettingToggle
              :label="text('Qualify by transaction count', 'ให้ยศตามจำนวนครั้งด้วย')"
              :model-value="countEnabled"
              @update:model-value="values.SPENDING_COUNT_ENABLED = $event"
            />
            <div v-if="countEnabled && hasField('SPENDING_UPGRADE_COUNT')" class="mt-md">
              <label :for="id + '-count'" class="mb-xs block text-sm font-medium">{{
                text('Minimum transactions', 'จำนวนครั้งขั้นต่ำ')
              }}</label>
              <input
                :id="id + '-count'"
                v-model="values.SPENDING_UPGRADE_COUNT"
                type="number"
                min="1"
                max="100000"
                step="1"
                required
                class="field-control h-12"
                :aria-describedby="id + '-count-help'"
              />
              <p :id="id + '-count-help'" class="mt-xs text-xs text-text-secondary">
                {{
                  text(
                    'Reaching this count qualifies for every level, using the role retention rule above.',
                    'ครบจำนวนครั้งจะผ่านเกณฑ์ทุกระดับ ตามรูปแบบการเก็บยศที่เลือกไว้',
                  )
                }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        v-show="activeCategory === 'ranking'"
        :id="id + '-panel-ranking'"
        role="tabpanel"
        :aria-labelledby="id + '-tab-ranking'"
        tabindex="0"
      >
        <FeatureSettingsHeading
          :title="text('Leaderboard roles', 'ยศอันดับยอดสะสม')"
          :description="
            text(
              'Leave a role blank to skip that ranking reward.',
              'เว้นว่างได้หากไม่ต้องการให้ยศอันดับนั้น',
            )
          "
          class="mb-lg"
        />
        <div class="grid max-w-reading gap-lg tablet:grid-cols-2">
          <AppTextField
            v-for="field in rankingRoles"
            :key="field.key"
            :model-value="String(values[field.key] ?? '')"
            :label="field.label"
            :placeholder="text('Discord Role ID', 'กรอก Discord Role ID')"
            pattern="[0-9]{15,30}"
            :state="roleError(values[field.key]) ? 'error' : 'default'"
            :support-text="roleError(values[field.key])"
            @update:model-value="values[field.key] = $event"
          />
        </div>
      </section>

      <section
        v-show="activeCategory === 'storage'"
        :id="id + '-panel-storage'"
        role="tabpanel"
        :aria-labelledby="id + '-tab-storage'"
        tabindex="0"
      >
        <FeatureSettingsHeading
          :title="text('Database', 'ฐานข้อมูล')"
          :description="
            text(
              'Store member spending with Fujipp or your own PostgreSQL.',
              'จัดเก็บยอดสะสมกับ Fujipp หรือ PostgreSQL ของร้าน',
            )
          "
          class="mb-lg"
        />
        <div class="max-w-reading">
          <FeatureSettingToggle
            :label="text('Use my own database', 'ใช้ฐานข้อมูลของร้าน')"
            :model-value="ownDatabase"
            @update:model-value="values.SPENDING_DB_USE_OWN = $event"
          />
          <p v-if="!ownDatabase" class="mt-md flex items-center gap-xs text-sm text-text-secondary">
            <ShieldCheck :size="18" aria-hidden="true" />{{
              text(
                'Using Fujipp. No connection required.',
                'ใช้ฐานข้อมูล Fujipp ไม่ต้องตั้งค่าการเชื่อมต่อ',
              )
            }}
          </p>
          <AppTextField
            v-else-if="hasField('SPENDING_DB_URL')"
            class="mt-lg"
            :model-value="secrets.SPENDING_DB_URL ?? ''"
            variant="secret"
            autocomplete="new-password"
            label="PostgreSQL Connection URL"
            :placeholder="
              databaseConfigured
                ? text('Saved · enter to replace', 'บันทึกไว้แล้ว · กรอกเพื่อเปลี่ยน')
                : 'postgresql://user:password@host/database'
            "
            :support-text="
              databaseConfigured
                ? text(
                    'Leave blank to keep the saved connection.',
                    'เว้นว่างเพื่อใช้การเชื่อมต่อเดิม',
                  )
                : text(
                    'Your connection URL is stored encrypted.',
                    'ระบบจัดเก็บ URL การเชื่อมต่อแบบเข้ารหัส',
                  )
            "
            @update:model-value="secrets.SPENDING_DB_URL = $event"
          />
        </div>
      </section>

      <section
        v-if="hasField('COMMAND_PERMISSION_RULES')"
        v-show="activeCategory === 'permissions'"
        :id="id + '-panel-permissions'"
        role="tabpanel"
        :aria-labelledby="id + '-tab-permissions'"
        tabindex="0"
      >
        <FeatureSettingsHeading
          :title="text('Command permissions', 'สิทธิ์การใช้คำสั่ง')"
          class="mb-lg"
        />
        <CommandPermissionsEditor
          :model-value="String(values.COMMAND_PERMISSION_RULES ?? '[]')"
          hide-summary
          @update:model-value="values.COMMAND_PERMISSION_RULES = $event"
        />
      </section>
    </FeatureSettingsCard>
    <p class="flex items-center gap-xs text-xs text-text-secondary">
      <HelpCircle :size="16" aria-hidden="true" />{{
        text(
          'Save all applies changes from every category.',
          'บันทึกทั้งหมดจะรวมการแก้ไขจากทุกหมวด',
        )
      }}
    </p>
  </div>
</template>
