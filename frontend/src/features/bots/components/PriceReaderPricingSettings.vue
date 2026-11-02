<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import PriceMapEditor from './PriceMapEditor.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { priceReaderPricePairs } from '../config/price-reader'
import { validPriceRules } from '@price-reader/classified-pricing'

const { values, text } = useFeatureEditor()
const mode = computed({
  get: () => String(values.value.PRICE_READER_PRICING_MODE ?? 'STANDARD'),
  set: (value) => {
    values.value.PRICE_READER_PRICING_MODE = value
  },
})
const selected = ref(`${mode.value}/SINGLE`)
watch(mode, (value) => {
  selected.value = `${value}/${selected.value.split('/')[1] ?? 'SINGLE'}`
})
const options = computed(() => [
  { value: 'STANDARD/SINGLE', label: text('Single · without Nitro', 'ชิ้นเดียว · ไม่มี Nitro') },
  { value: 'STANDARD/BUNDLE', label: text('Bundle · without Nitro', 'บันเดิล · ไม่มี Nitro') },
  { value: 'NITRO/SINGLE', label: text('Single · with Nitro', 'ชิ้นเดียว · มี Nitro') },
  { value: 'NITRO/BUNDLE', label: text('Bundle · with Nitro', 'บันเดิล · มี Nitro') },
])
const parsed = computed<unknown>(() => {
  try {
    return JSON.parse(String(values.value.PRICE_READER_PRICE_RULES ?? '[]'))
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
        !['SINGLE', 'BUNDLE'].includes(String(row.itemType)) ||
        !['STANDARD', 'NITRO'].includes(String(row.pricingMode)),
    ),
)
const group = computed(() =>
  rows.value.filter((row) => `${row.pricingMode}/${row.itemType}` === selected.value),
)
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
    null,
    2,
  ),
)
function write(next: Record<string, unknown>[]) {
  values.value.PRICE_READER_PRICE_RULES = JSON.stringify(next)
}
function update(raw: string) {
  const list = JSON.parse(raw) as Array<Record<string, unknown>>
  const [pricingMode, itemType] = selected.value.split('/')
  const satang = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return value
    const amount = value * 100
    return Math.abs(amount - Math.round(amount)) < 1e-7 ? Math.round(amount) : amount
  }
  write([
    ...rows.value.filter((row) => `${row.pricingMode}/${row.itemType}` !== selected.value),
    ...list.map(({ discordPrice, shopPrice, ...source }) => ({
      ...source,
      pricingMode,
      itemType,
      discordPriceSatang: satang(discordPrice),
      shopPriceSatang: satang(shopPrice),
    })),
  ])
}
const legacy = computed(() => priceReaderPricePairs(values.value.PRICE_READER_PRICE_MAP))
function importLegacy() {
  if (group.value.length || repair.value) return
  const [pricingMode, itemType] = selected.value.split('/')
  write([
    ...rows.value,
    ...legacy.value.map((pair) => ({
      pricingMode,
      itemType,
      discordPriceSatang: pair.discord,
      shopPriceSatang: pair.shop,
    })),
  ])
}
</script>

<template>
  <div class="space-y-lg" data-price-reader-pricing>
    <FeatureSettingsCard :title="text('Shop pricing mode', 'โหมดราคาร้าน')">
      <AppTextField
        v-model="mode"
        :label="text('Price used by the bot', 'ราคาที่บอทใช้')"
        variant="dropdown"
        :options="[
          {
            value: 'STANDARD',
            label: text(
              'Without Nitro · standard Discord price',
              'ไม่มี Nitro · ใช้ราคาปกติ Discord',
            ),
          },
          {
            value: 'NITRO',
            label: text('With Nitro · visible Nitro price', 'มี Nitro · ใช้ราคา Nitro ในรูป'),
          },
        ]"
      />
      <p class="mt-sm text-sm text-text-secondary">
        {{
          text(
            'Both prices are read independently. A missing selected price is reported; the bot never substitutes another price or product type.',
            'อ่านราคาทั้งสองแบบแยกกัน หากไม่พบราคาของโหมดที่เลือก บอทจะแจ้งแทนการใช้ราคาอีกแบบหรือข้ามประเภทสินค้า',
          )
        }}
      </p>
    </FeatureSettingsCard>
    <FeatureSettingsCard :title="text('Prices by product type', 'ราคารับกดแยกประเภท')">
      <div class="space-y-lg">
        <AppTextField
          v-model="selected"
          :label="text('Table being edited', 'ตารางที่กำลังแก้ไข')"
          variant="dropdown"
          :options="options"
        />
        <template v-if="!repair">
          <PriceMapEditor
            :key="selected"
            :model-value="editorValue"
            :minimum-discord-price="0.01"
            @update:model-value="update"
          />
          <p v-if="!group.length" class="text-sm text-text-secondary">
            {{
              text(
                'No price pairs in this table. Images in this category will have no matching shop price.',
                'หมวดนี้ยังไม่มีคู่ราคา รูปในหมวดนี้จะยังไม่มีราคารับกดที่ตรงกัน',
              )
            }}
          </p>
          <AppButton
            v-if="legacy.length"
            type="button"
            variant="secondary"
            class="!w-auto"
            :disabled="Boolean(group.length)"
            @click="importLegacy"
            >{{ text('Import old prices into this table', 'นำเข้าตารางเดิมสู่หมวดนี้') }}</AppButton
          >
          <p v-if="legacy.length" class="text-xs text-text-muted">
            {{
              text(
                'Old prices are preserved. Choose the correct category before importing, then review each price before saving.',
                'ตารางเดิมยังเก็บไว้ เลือกหมวดให้ตรงก่อนนำเข้า แล้วตรวจราคารับกดแต่ละคู่ก่อนบันทึก',
              )
            }}
          </p>
        </template>
        <label v-else class="block text-sm"
          >{{ text('Repair price rules JSON', 'แก้ไข JSON ตารางราคารับกด')
          }}<textarea
            :value="String(values.PRICE_READER_PRICE_RULES)"
            rows="8"
            class="field-control mt-sm w-full"
            @input="values.PRICE_READER_PRICE_RULES = ($event.target as HTMLTextAreaElement).value"
          />
        </label>
        <p v-if="!validPriceRules(parsed)" role="alert" class="text-sm text-error-text">
          {{
            text(
              'Check all four tables: use valid prices with at most two decimals, no duplicate Discord prices within a category, and at most 400 rows.',
              'ตรวจทั้ง 4 ตาราง: กรอกราคาไม่เกิน 2 ตำแหน่งทศนิยม ห้ามราคา Discord ซ้ำในหมวดเดียวกัน และรวมไม่เกิน 400 แถว',
            )
          }}
        </p>
      </div>
    </FeatureSettingsCard>
  </div>
</template>
