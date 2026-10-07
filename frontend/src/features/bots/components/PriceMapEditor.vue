<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppButton, AppTextField } from '@/shared/ui'

interface PriceRow {
  id: number
  discordPrice: string
  shopPrice: string
  source: Record<string, unknown>
}
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { locale, t } = useI18n()
const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)
const id = useId()
const editor = ref<HTMLElement>()
const rows = ref<PriceRow[]>([])
const rawMode = ref(false)
let nextId = 0
let lastEmitted: string | undefined
watch(
  () => props.modelValue,
  (value) => {
    if (value === lastEmitted) return
    try {
      const parsed: unknown = JSON.parse(value)
      if (
        !Array.isArray(parsed) ||
        parsed.some((item) => !item || typeof item !== 'object' || Array.isArray(item))
      ) {
        rawMode.value = true
        return
      }
      rawMode.value = false
      rows.value = parsed.map((source) => ({
        id: nextId++,
        source,
        discordPrice:
          typeof source.discordPriceSatang === 'number'
            ? String(Math.round(source.discordPriceSatang) / 100)
            : String(source.discordPrice ?? ''),
        shopPrice:
          typeof source.shopPriceSatang === 'number'
            ? String(Math.round(source.shopPriceSatang) / 100)
            : String(source.shopPrice ?? ''),
      }))
    } catch {
      rawMode.value = true
    }
  },
  { immediate: true },
)
function error(row: PriceRow, key: 'discordPrice' | 'shopPrice') {
  const value = row[key]
  if (!value.trim() || !Number.isFinite(Number(value))) return text('Enter a price.', 'กรอกราคา')
  if (Number(value) < (key === 'discordPrice' ? 1 : 0))
    return text(
      key === 'discordPrice' ? 'Minimum 1 THB.' : 'Minimum 0 THB.',
      key === 'discordPrice' ? 'ราคาต้องไม่น้อยกว่า 1 บาท' : 'ราคาต้องไม่น้อยกว่า 0 บาท',
    )
  return ''
}
const duplicates = computed(() =>
  rows.value.map((row, index) =>
    rows.value
      .slice(0, index)
      .some(
        (other) =>
          row.discordPrice.trim() &&
          other.discordPrice.trim() &&
          Math.round(Number(row.discordPrice) * 100) ===
            Math.round(Number(other.discordPrice) * 100),
      ),
  ),
)
function commit() {
  const mapped = rows.value.map((row) => {
    const result = { ...row.source }
    for (const key of ['discordPrice', 'shopPrice'] as const) {
      const amount =
        row[key].trim() !== '' && Number.isFinite(Number(row[key])) ? Number(row[key]) : row[key]
      result[key] = amount
      if (key + 'Satang' in row.source)
        result[key + 'Satang'] = typeof amount === 'number' ? Math.round(amount * 100) : amount
    }
    return result
  })
  lastEmitted = JSON.stringify(mapped, null, 2)
  emit('update:modelValue', lastEmitted)
}
function updateRow(index: number, key: 'discordPrice' | 'shopPrice', value: string) {
  const row = rows.value[index]
  if (!row) return
  row[key] = value
  commit()
}
async function addRow() {
  rows.value.push({ id: nextId++, discordPrice: '', shopPrice: '', source: {} })
  commit()
  await nextTick()
  editor.value?.querySelectorAll<HTMLInputElement>('input')[rows.value.length * 2 - 2]?.focus()
}
async function removeRow(index: number) {
  rows.value.splice(index, 1)
  commit()
  await nextTick()
  const inputs = editor.value?.querySelectorAll<HTMLInputElement>('input')
  if (inputs?.length) inputs[Math.min(index * 2, inputs.length - 2)]?.focus()
  else editor.value?.querySelector<HTMLButtonElement>('[data-add-price]')?.focus()
}
</script>

<template>
  <div ref="editor" class="space-y-md" data-price-map-editor>
    <div v-if="rawMode">
      <label :for="id + '-raw'" class="block text-sm font-medium">{{
        text('Price map JSON', 'JSON ตารางราคา')
      }}</label>
      <textarea
        :id="id + '-raw'"
        :value="modelValue"
        rows="8"
        class="field-control mt-sm resize-y py-sm"
        :aria-describedby="id + '-raw-help'"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
      <p :id="id + '-raw-help'" class="mt-sm text-xs text-error-text">
        {{
          text(
            'Fix the JSON array of price objects to return to the price editor. Your current data is preserved.',
            'แก้ JSON ให้เป็นรายการคู่ราคาเพื่อกลับไปใช้ช่องกรอกราคา ข้อมูลเดิมยังคงอยู่',
          )
        }}
      </p>
    </div>
    <template v-else>
      <div
        v-for="(row, index) in rows"
        :key="row.id"
        class="rounded-lg border border-border-subtle bg-bg-default p-md"
        data-price-row
      >
        <div class="mb-sm flex items-center justify-between gap-sm">
          <h4 class="text-sm font-medium">
            {{ text(`Price pair ${index + 1}`, `ราคาคู่ที่ ${index + 1}`) }}
          </h4>
          <AppButton
            variant="primary"
            class="price-map-delete"
            :aria-label="text(`Delete price pair ${index + 1}`, `ลบราคาคู่ที่ ${index + 1}`)"
            @click="removeRow(index)"
            ><Trash2 :size="18"
          /></AppButton>
        </div>
        <div class="grid gap-md tablet:grid-cols-2">
          <AppTextField
            :model-value="row.discordPrice"
            :label="text('Discord price (THB)', 'ราคา Discord (บาท)')"
            input-type="number"
            :min="1"
            step="any"
            placeholder="250"
            required
            :state="error(row, 'discordPrice') ? 'error' : 'default'"
            :support-text="error(row, 'discordPrice')"
            @update:model-value="updateRow(index, 'discordPrice', $event)"
          />
          <AppTextField
            :model-value="row.shopPrice"
            :label="text('Shop price (THB)', 'ราคาร้านขาย (บาท)')"
            input-type="number"
            :min="0"
            step="any"
            placeholder="55"
            required
            :state="error(row, 'shopPrice') ? 'error' : 'default'"
            :support-text="error(row, 'shopPrice')"
            @update:model-value="updateRow(index, 'shopPrice', $event)"
          />
        </div>
        <p v-if="duplicates[index]" role="status" class="mt-sm text-xs text-warning-text">
          {{
            text(
              'This Discord price is repeated. The first matching row is used.',
              'ราคา Discord ซ้ำ ระบบจะใช้แถวแรกที่ตรงกัน',
            )
          }}
        </p>
      </div>
      <p
        v-if="!rows.length"
        class="rounded-lg border border-dashed border-border-default p-lg text-center text-sm text-text-muted"
      >
        {{ t('botSettings.noPriceMappingsYet') }}
      </p>
      <AppButton variant="secondary" class="!w-auto" data-add-price @click="addRow"
        ><Plus :size="18" /> {{ t('botSettings.addPrice') }}</AppButton
      >
    </template>
  </div>
</template>

<style scoped>
.price-map-delete.app-button {
  width: calc(var(--icon-size-32) + var(--space-xs));
  height: calc(var(--icon-size-32) + var(--space-xs));
  padding: 0;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-md);
  background: var(--semantic-color-background-bg-surface);
  box-shadow: none;
  flex-shrink: 0;
  color: var(--semantic-color-error-error-text);
}
</style>
