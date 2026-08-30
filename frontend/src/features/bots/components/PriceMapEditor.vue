<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { AppButton, AppTextField } from '../../../shared/ui'

interface PriceRow {
  discordPrice: string
  shopPrice: string
}
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { locale, t } = useI18n()
const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)

const rows = ref<PriceRow[]>([])
let updatingFromRows = false

watch(
  () => props.modelValue,
  (value) => {
    if (updatingFromRows) {
      updatingFromRows = false
      return
    }
    try {
      const parsed = JSON.parse(value) as unknown
      if (!Array.isArray(parsed)) return
      rows.value = parsed.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const discordPrice = Reflect.get(item, 'discordPrice')
        const shopPrice = Reflect.get(item, 'shopPrice')
        return typeof discordPrice === 'number' && typeof shopPrice === 'number'
          ? [{ discordPrice: String(discordPrice), shopPrice: String(shopPrice) }]
          : []
      })
    } catch {
      rows.value = []
    }
  },
  { immediate: true },
)

function updateRow(index: number, key: keyof PriceRow, value: string) {
  const row = rows.value[index]
  if (!row) return
  row[key] = value
  commit()
}
function addRow() {
  rows.value.push({ discordPrice: '', shopPrice: '' })
}
function removeRow(index: number) {
  rows.value.splice(index, 1)
  commit()
}
function commit() {
  const mapped = rows.value.flatMap((row) => {
    const discordPrice = Number(row.discordPrice),
      shopPrice = Number(row.shopPrice)
    return row.discordPrice !== '' &&
      row.shopPrice !== '' &&
      Number.isFinite(discordPrice) &&
      Number.isFinite(shopPrice)
      ? [{ discordPrice, shopPrice }]
      : []
  })
  updatingFromRows = true
  emit('update:modelValue', JSON.stringify(mapped, null, 2))
}
</script>

<template>
  <div class="price-map-editor">
    <div class="price-map-editor__header" aria-hidden="true">
      <span>{{ t('botSettings.discordPriceThb') }}</span
      ><span>{{ t('botSettings.shopPriceThb') }}</span
      ><span />
    </div>
    <div v-for="(row, index) in rows" :key="index" class="price-map-editor__row">
      <AppTextField
        :model-value="row.discordPrice"
        label=""
        input-type="number"
        placeholder="209"
        @update:model-value="(value) => updateRow(index, 'discordPrice', value)"
      />
      <AppTextField
        :model-value="row.shopPrice"
        label=""
        input-type="number"
        placeholder="45"
        @update:model-value="(value) => updateRow(index, 'shopPrice', value)"
      />
      <button
        type="button"
        class="price-map-editor__delete"
        :aria-label="text(`Delete price pair ${index + 1}`, `ลบราคาคู่ที่ ${index + 1}`)"
        @click="removeRow(index)"
      >
        <Trash2 :size="18" />
      </button>
    </div>
    <p v-if="!rows.length" class="price-map-editor__empty">
      {{ t('botSettings.noPriceMappingsYet') }}
    </p>
    <AppButton class="price-map-editor__add" @click="addRow"
      ><Plus :size="18" /> {{ t('botSettings.addPrice') }}</AppButton
    >
  </div>
</template>

<style scoped>
.price-map-editor {
  display: grid;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}
.price-map-editor__header,
.price-map-editor__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) var(--icon-size-40);
  align-items: center;
  gap: var(--space-xs);
}
.price-map-editor__header {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-medium);
}
.price-map-editor__delete {
  display: grid;
  width: var(--icon-size-40);
  height: var(--icon-size-40);
  cursor: pointer;
  place-items: center;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-md);
  background: var(--semantic-color-background-bg-elevated);
  color: var(--semantic-color-error-error-text);
}
.price-map-editor__delete:hover {
  background: var(--semantic-color-background-bg-surface-hover);
}
.price-map-editor__empty {
  padding-block: var(--space-md);
  color: var(--semantic-color-text-text-muted);
  text-align: center;
}
.price-map-editor__add {
  width: auto;
  justify-self: start;
  margin-top: var(--space-xs);
}
@media (max-width: 47.99rem) {
  .price-map-editor__header {
    display: none;
  }
  .price-map-editor__row {
    grid-template-columns: minmax(0, 1fr) var(--icon-size-40);
  }
  .price-map-editor__row > :nth-child(2) {
    grid-column: 1;
  }
  .price-map-editor__delete {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
}
</style>
