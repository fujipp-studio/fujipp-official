<script setup lang="ts">
import { computed, ref } from 'vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
const { text, values, configuration } = useFeatureEditor()
const giftEnabled = computed(() => configuration.value?.fields.some(field => field.key === 'PRICE_READER_OFFER_MODE'))
const setting = (key: string, fallback: string) => computed({ get: () => String(values.value[key] ?? fallback), set: value => { values.value[key] = value } })
const source = setting('PRICE_READER_PRICING_MODE', 'BOTH')
const offer = setting('PRICE_READER_OFFER_MODE', 'SHOP')
const language = setting('PRICE_READER_LANGUAGE', 'TH')
const selected = ref('NITRO/1')
const tables = computed(() => ['STANDARD', 'NITRO'].flatMap(tier => [1,2,3,4,5].map(count => ({
  value: `${tier}/${count}`,
  label: `${count === 1 ? text('Single item', 'ชิ้นเดียว') : text(`Bundle · ${count} items`, `บันเดิล ${count} ชิ้น`)} · ${tier === 'NITRO' ? text('with Nitro', 'มี Nitro') : text('without Nitro', 'ไม่มี Nitro')}`,
}))))
const rows = computed<Record<string, unknown>[]>(() => {
  try { const parsed: unknown = JSON.parse(String(values.value.PRICE_READER_COUNT_PRICE_RULES ?? '[]'))
    return Array.isArray(parsed) && parsed.every(row => row && typeof row === 'object' && !Array.isArray(row)) ? parsed : []
  } catch { return [] }
})
const group = computed(() => rows.value.map((row,index) => ({row,index})).filter(({row}) => `${row.pricingMode}/${row.itemCount}` === selected.value))
const invalid = (value: unknown) => value != null && !(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000)
const amount = (value: unknown) => typeof value === 'number' ? (value / 100).toFixed(2) : String(value ?? '')
function update(index: number, value: string) {
  const next = rows.value.map(row => ({...row}))
  if (!next[index]) return
  if (!value.trim()) delete next[index].giftPriceSatang
  else {
    const number = Number(value), satang = Math.round(number * 100)
    next[index].giftPriceSatang = Number.isFinite(number) && Math.abs(number * 100 - satang) < 1e-7 ? satang : value
  }
  values.value.PRICE_READER_COUNT_PRICE_RULES = JSON.stringify(next)
}
</script>
<template>
  <div class="space-y-lg" data-price-reader-offers>
    <FeatureSettingsCard :title="text('Quote options', 'รูปแบบเสนอราคา')">
      <div class="space-y-lg">
        <AppTextField v-model="source" :label="text('Price source', 'ราคาที่อ่านจากรูป')" variant="dropdown" :options="[
          ...(giftEnabled ? [{value:'AUTO',label:text('Auto · Nitro when visible', 'อัตโนมัติ · ใช้ Nitro เมื่อเห็นในรูป')}] : []),
          {value:'STANDARD',label:text('Without Nitro', 'ไม่มี Nitro')},{value:'NITRO',label:text('With Nitro', 'มี Nitro')},{value:'BOTH',label:text('Both tiers', 'ทั้งสองราคา')},
        ]" />
        <p v-if="source === 'AUTO'" class="text-sm text-text-secondary">{{ text('Uses the visible Nitro price; otherwise the standard price. Missing rules never borrow another tier.', 'ใช้ราคา Nitro ที่เห็นในรูป หากไม่มีจึงใช้ราคาปกติ หากไม่มีคู่ราคาจะไม่ยืมราคาอีกฝั่ง') }}</p>
        <AppTextField v-if="giftEnabled" v-model="offer" :label="text('Prices to show', 'ราคาที่ร้านแสดง')" variant="dropdown" :options="[
          {value:'SHOP',label:text('Shop price', 'ราคารับกด')},{value:'GIFT',label:text('Gift price', 'ราคา Gift')},{value:'BOTH',label:text('Shop and Gift', 'รับกดและ Gift')},
        ]" />
        <AppTextField v-model="language" :label="text('Bot response language', 'ภาษาที่บอทตอบ')" variant="dropdown" :options="[{value:'TH',label:'ไทย'},{value:'EN',label:'English'}]" />
        <p class="text-xs text-text-muted">{{ text('Review quotes in Test. Custom wording is editable in Status messages.', 'ดูตัวอย่างที่ทดสอบ และแต่งข้อความในข้อความแต่ละสถานะ') }}</p>
      </div>
    </FeatureSettingsCard>
    <FeatureSettingsCard v-if="giftEnabled" :title="text('Your Gift prices', 'ราคา Gift ของร้าน')">
      <div class="space-y-lg">
        <p class="text-sm text-text-secondary">{{ text('Set Gift prices for existing Discord price rows. Blank means ask for a Gift price; zero is a valid price. Add rows in Pricing.', 'กรอกราคา Gift ให้แต่ละคู่ราคา เว้นว่างเพื่อแสดงสอบถามราคา Gift ราคา 0 ใช้ได้ เพิ่มคู่ราคาใหม่ที่ตารางราคา') }}</p>
        <AppTextField v-model="selected" :label="text('Gift price table', 'ตารางราคา Gift')" variant="dropdown" :options="tables" />
        <p v-if="!group.length" class="text-sm text-text-muted">{{ text('Add Discord price rows in Pricing first.', 'เพิ่มคู่ราคา Discord ในตารางราคาก่อน') }}</p>
        <article v-for="{row,index} in group" :key="index" :data-gift-discord-price="row.discordPriceSatang" class="min-w-0 space-y-md rounded-lg border border-border-subtle bg-bg-default p-md">
          <p class="text-sm">Discord {{ amount(row.discordPriceSatang) }} · {{ text('Shop', 'รับกด') }} {{ amount(row.shopPriceSatang) }}</p>
          <AppTextField :model-value="amount(row.giftPriceSatang)" :placeholder="text('Unset · ask for price', 'เว้นว่าง · สอบถามราคา')" :label="text('Gift price (THB)', 'ราคา Gift (บาท)')" input-type="number" :state="invalid(row.giftPriceSatang) ? 'error' : 'default'" :support-text="invalid(row.giftPriceSatang) ? text('Use 0–1,000,000 THB with up to two decimals.', 'ใช้ราคา 0–1,000,000 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง') : ''" :min="0" :max="1000000" :step="0.01" @update:model-value="update(index,$event)" />
        </article>
      </div>
    </FeatureSettingsCard>
  </div>
</template>
