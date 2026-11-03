<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppModal from '@/shared/ui/dialogs/AppModal.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import PriceMapEditor from './PriceMapEditor.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { validCountedPriceRules, type CountedPriceRule } from '@price-reader/counted-pricing'
import { countedItemTemplate, countedErrorTemplate } from '@price-reader/counted-text'
import { priceReaderPricePairs } from '../config/price-reader-base'

const { values, text, configuration, presentations, presentationJson, advancedSlots } =
  useFeatureEditor()
const mode = computed({
  get: () => String(values.value.PRICE_READER_PRICING_MODE ?? 'STANDARD'),
  set: (value) => {
    values.value.PRICE_READER_PRICING_MODE = value
  },
})
const language = computed({
  get: () => String(values.value.PRICE_READER_LANGUAGE ?? 'TH'),
  set: (value) => {
    values.value.PRICE_READER_LANGUAGE = value
  },
})
const selected = ref('STANDARD/1')
const options = computed(() =>
  ['STANDARD', 'NITRO'].flatMap((tier) =>
    [1, 2, 3, 4, 5].map((count) => ({
      value: `${tier}/${count}`,
      label: `${count === 1 ? text('Single item', 'ชิ้นเดียว') : text(`Bundle · ${count} items`, `บันเดิล ${count} ชิ้น`)} · ${tier === 'NITRO' ? text('with Nitro', 'มี Nitro') : text('without Nitro', 'ไม่มี Nitro')}`,
    })),
  ),
)
const parsed = computed<unknown>(() => {
  try {
    return JSON.parse(String(values.value.PRICE_READER_COUNT_PRICE_RULES ?? '[]'))
  } catch {
    return null
  }
})
const rows = computed<Record<string, unknown>[]>(() =>
  Array.isArray(parsed.value) &&
  parsed.value.every((row) => row && typeof row === 'object' && !Array.isArray(row))
    ? parsed.value
    : [],
)
const repair = computed(
  () =>
    !Array.isArray(parsed.value) ||
    rows.value.length !== parsed.value.length ||
    rows.value.some(
      (row) =>
        !Number.isInteger(row.itemCount) ||
        Number(row.itemCount) < 1 ||
        Number(row.itemCount) > 5 ||
        (row.itemType === 'SINGLE') !== (row.itemCount === 1) ||
        !['STANDARD', 'NITRO'].includes(String(row.pricingMode)),
    ),
)
const groupKey = (row: { pricingMode?: unknown; itemCount?: unknown }) =>
  `${row.pricingMode}/${row.itemCount}`
const group = computed(() => rows.value.filter((row) => groupKey(row) === selected.value))
const editorValue = computed(() =>
  JSON.stringify(
    group.value.map((row) => ({
      ...row,
      discordPrice:
        typeof row.discordPriceSatang === 'number'
          ? row.discordPriceSatang / 100
          : row.discordPriceSatang,
      shopPrice:
        typeof row.shopPriceSatang === 'number' ? row.shopPriceSatang / 100 : row.shopPriceSatang,
    })),
  ),
)
function update(raw: string) {
  const [pricingMode, count] = selected.value.split('/')
  const itemCount = Number(count),
    itemType = itemCount === 1 ? 'SINGLE' : 'BUNDLE'
  const satang = (value: unknown) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
      ? Math.round(value * 100)
      : value
  values.value.PRICE_READER_COUNT_PRICE_RULES = JSON.stringify([
    ...rows.value.filter((row) => groupKey(row) !== selected.value),
    ...(JSON.parse(raw) as Array<Record<string, unknown>>).map(
      ({ discordPrice, shopPrice, ...source }) => ({
        ...source,
        itemCount,
        itemType,
        pricingMode,
        discordPriceSatang: satang(discordPrice),
        shopPriceSatang: satang(shopPrice),
      }),
    ),
  ])
}
const fileId = useId()
const fileInput = ref<HTMLInputElement>()
const file = ref<File | null>(null),
  imported = ref<CountedPriceRule[] | null>(null),
  error = ref(''),
  loading = ref(false)
const confirm = ref<'import' | 'reset' | 'legacy' | null>(null)
let generation = 0
watch(file, async (value) => {
  const version = ++generation
  imported.value = null
  error.value = ''
  loading.value = false
  if (!value) {
    if (fileInput.value) fileInput.value.value = ''
    return
  }
  if (value.size > 128 * 1024) {
    error.value = text('Choose a JSON file up to 128 KB.', 'เลือกไฟล์ JSON ไม่เกิน 128 KB')
    return
  }
  loading.value = true
  try {
    const result: unknown = JSON.parse(await value.text())
    if (!validCountedPriceRules(result) || !result.length) throw new Error()
    if (version === generation) imported.value = result
  } catch {
    if (version === generation)
      error.value = text(
        'Invalid price file: use counts 1–5, integer satang and unique prices per table.',
        'ไฟล์ราคาไม่ถูกต้อง ใช้จำนวน 1–5 ชิ้น ราคาเป็นสตางค์ ไม่ซ้ำในตารางเดียวกัน',
      )
  } finally {
    if (version === generation) loading.value = false
  }
})
onBeforeUnmount(() => {
  generation++
})
const importGroups = computed(() => new Set(imported.value?.map(groupKey)).size)
const legacy = computed(() => {
  const [tier, count] = selected.value.split('/')
  let old: unknown
  try {
    old = JSON.parse(String(values.value.PRICE_READER_PRICE_RULES ?? '[]'))
  } catch {
    old = []
  }
  if (Array.isArray(old) && old.length)
    return old
      .filter(
        (row) =>
          row &&
          typeof row === 'object' &&
          row.pricingMode === tier &&
          row.itemType === (count === '1' ? 'SINGLE' : 'BUNDLE'),
      )
      .map((row) => ({ discord: row.discordPriceSatang, shop: row.shopPriceSatang }))
  return priceReaderPricePairs(values.value.PRICE_READER_PRICE_MAP)
})
function apply() {
  if (confirm.value === 'import' && imported.value)
    values.value.PRICE_READER_COUNT_PRICE_RULES = JSON.stringify(imported.value)
  if (confirm.value === 'legacy' && !group.value.length && !repair.value) {
    const [pricingMode, count] = selected.value.split('/'),
      itemCount = Number(count)
    values.value.PRICE_READER_COUNT_PRICE_RULES = JSON.stringify([
      ...rows.value,
      ...legacy.value.map((row) => ({
        itemType: itemCount === 1 ? 'SINGLE' : 'BUNDLE',
        itemCount,
        pricingMode,
        discordPriceSatang: row.discord,
        shopPriceSatang: row.shop,
      })),
    ])
  }
  if (confirm.value === 'reset') {
    values.value.PRICE_READER_RESULTS_ITEM_TEMPLATE = countedItemTemplate
    values.value.PRICE_READER_ERROR_ITEM_TEMPLATE = countedErrorTemplate
    values.value.PRICE_READER_RESULT_MODE = 'TEMPLATE'
    for (const key of [
      'PRICE_READER_NOT_FOUND_TEXT',
      'PRICE_READER_OCR_ERROR_TEXT',
      'PRICE_READER_UNMATCHED_PRICE_TEXT',
    ])
      values.value[key] = '{{default}}'
    for (const slot of configuration.value?.presentations ?? []) {
      presentations.value[slot.key] = JSON.parse(JSON.stringify(slot.defaultDefinition))
      presentationJson.value[slot.key] = JSON.stringify(slot.defaultDefinition, null, 2)
      advancedSlots.value.delete(slot.key)
    }
  }
  confirm.value = null
}
</script>

<template>
  <div class="space-y-lg" data-price-reader-counted-pricing>
    <FeatureSettingsCard :title="text('Shop pricing and language', 'โหมดราคาและภาษา')">
      <div class="space-y-lg">
        <AppTextField
          v-model="mode"
          :label="text('Price used by the bot', 'ราคาที่บอทใช้')"
          variant="dropdown"
          :options="[
            {
              value: 'BOTH',
              label: text('Both · without and with Nitro', 'ทั้งสองแบบ · ไม่มี Nitro และมี Nitro'),
            },
            { value: 'STANDARD', label: text('Without Nitro', 'ไม่มี Nitro') },
            { value: 'NITRO', label: text('With Nitro', 'มี Nitro') },
          ]"
        />
        <AppTextField
          v-model="language"
          :label="text('Bot response language', 'ภาษาที่บอทตอบ')"
          variant="dropdown"
          :options="[
            { value: 'TH', label: 'ไทย' },
            { value: 'EN', label: 'English' },
          ]"
        />
        <p class="text-xs text-text-muted">
          {{
            text(
              'Reset messages to use the bot language. Custom wording stays unchanged.',
              'รีเซ็ตเพื่อใช้ภาษาที่เลือก ข้อความที่เขียนเองคงเดิม',
            )
          }}
        </p>
        <AppButton variant="secondary" class="!w-auto" @click="confirm = 'reset'">{{
          text('Reset standard messages', 'รีเซ็ตข้อความมาตรฐาน')
        }}</AppButton>
      </div>
    </FeatureSettingsCard>
    <FeatureSettingsCard :title="text('Ten independent price tables', 'ตารางราคาแยก 10 กลุ่ม')">
      <div class="space-y-lg">
        <AppTextField
          v-model="selected"
          :label="text('Table being edited', 'ตารางที่กำลังแก้ไข')"
          variant="dropdown"
          :options="options"
        />
        <p class="text-sm text-text-secondary">
          {{ text('Exact prices only.', 'จับคู่ตรงราคาเท่านั้น') }}
        </p>
        <PriceMapEditor
          v-if="!repair"
          :key="selected"
          :model-value="editorValue"
          :minimum-discord-price="0.01"
          @update:model-value="update"
        />
        <label v-else class="block text-sm"
          >{{ text('Repair price tables JSON', 'แก้ไข JSON ตารางราคา')
          }}<textarea
            :value="String(values.PRICE_READER_COUNT_PRICE_RULES)"
            rows="8"
            class="field-control mt-sm w-full"
            @input="
              values.PRICE_READER_COUNT_PRICE_RULES = ($event.target as HTMLTextAreaElement).value
            "
          />
        </label>
        <p v-if="!validCountedPriceRules(parsed)" role="alert" class="text-sm text-error-text">
          {{
            text(
              'Use counts 1–5 and up to 400 rows. Prices need at most two decimals and must be unique within each table.',
              'จำนวน 1–5 ชิ้น ราคาไม่เกิน 2 ทศนิยม ไม่ซ้ำในตาราง รวมไม่เกิน 400 แถว',
            )
          }}
        </p>
        <p v-if="!group.length" class="text-sm text-text-secondary">
          {{
            text(
              'No pairs in this table. The bot will report no matching shop price.',
              'ตารางว่าง: ยังไม่มีราคารับกดที่ตรงกัน',
            )
          }}
        </p>
        <AppButton
          v-if="legacy.length"
          variant="secondary"
          class="!w-auto"
          :disabled="Boolean(group.length) || repair"
          @click="confirm = 'legacy'"
          >{{ text('Import old table', 'ตรวจราคาตารางเดิมเพื่อนำเข้ากลุ่มนี้') }}</AppButton
        >
      </div>
    </FeatureSettingsCard>
    <FeatureSettingsCard :title="text('Import price tables', 'นำเข้าตารางราคา')">
      <div class="space-y-md">
        <label :for="fileId" class="block text-sm font-medium">{{
          text('Price tables JSON file', 'ไฟล์ JSON ตารางราคา')
        }}</label>
        <input
          :id="fileId"
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          hidden
          :disabled="loading"
          @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
        />
        <div class="flex flex-wrap items-center gap-sm">
          <AppButton
            variant="secondary"
            class="!w-auto"
            :disabled="loading"
            :loading="loading"
            @click="fileInput?.click()"
            >{{ text('Choose JSON file', 'เลือกไฟล์ JSON') }}</AppButton
          >
          <span v-if="file" class="order-last w-full break-all text-sm text-text-secondary">{{
            file.name
          }}</span>
          <AppButton
            v-if="file"
            variant="secondary"
            class="!w-auto"
            :disabled="loading"
            @click="file = null"
            >{{ text('Remove file', 'ลบไฟล์') }}</AppButton
          >
        </div>
        <p v-if="imported" role="status" class="text-sm">
          {{
            text(
              `${imported.length} price pairs · ${importGroups} tables ready for review`,
              `พร้อมตรวจทาน ${imported.length} คู่ราคา · ${importGroups} ตาราง`,
            )
          }}
        </p>
        <p v-if="error" role="alert" class="text-sm text-error-text">{{ error }}</p>
        <AppButton
          variant="secondary"
          class="!w-auto"
          :disabled="!imported || loading"
          @click="confirm = 'import'"
          >{{ text('Review and import', 'ตรวจทานและนำเข้า') }}</AppButton
        >
      </div>
    </FeatureSettingsCard>
    <AppModal
      :open="Boolean(confirm)"
      :title="text('Review draft changes', 'ตรวจทานการแก้ไข')"
      @update:open="!$event && (confirm = null)"
      @close="confirm = null"
    >
      <p>
        {{
          confirm === 'import'
            ? text(
                `Replace all ten price tables with ${imported?.length ?? 0} pairs? Save all to apply.`,
                `แทนที่ตารางราคาทั้ง 10 กลุ่มด้วย ${imported?.length ?? 0} คู่ราคา? บันทึกทั้งหมดเพื่อใช้จริง`,
              )
            : confirm === 'reset'
              ? text(
                  'Reset text and designs? Keys/prices stay. Save all to apply.',
                  'รีเซ็ตข้อความ/ดีไซน์? key และราคาคงเดิม ต้องบันทึกทั้งหมด',
                )
              : text(
                  'Import this table only. Check counts and prices before saving.',
                  'นำเข้าเฉพาะตารางนี้ ตรวจจำนวนชิ้นและราคาทุกคู่ก่อนบันทึก',
                )
        }}
      </p>
      <template #actions
        ><AppButton variant="secondary" @click="confirm = null">{{
          text('Cancel', 'ยกเลิก')
        }}</AppButton
        ><AppButton @click="apply">{{
          text('Apply to draft', 'ใช้กับฉบับแก้ไข')
        }}</AppButton></template
      >
    </AppModal>
  </div>
</template>
