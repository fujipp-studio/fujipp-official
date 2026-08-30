<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { AppButton, AppTextField } from '../../../shared/ui'

const props = defineProps<{ modelValue: string; rate: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { locale, t } = useI18n()
const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)

const amounts = ref<string[]>([])
let committing = false

watch(
  () => props.modelValue,
  (value) => {
    if (committing) {
      committing = false
      return
    }
    try {
      const parsed = JSON.parse(value) as unknown
      amounts.value = Array.isArray(parsed)
        ? parsed.flatMap((item) => {
            const robux = item && typeof item === 'object' ? Number(Reflect.get(item, 'robux')) : 0
            return Number.isInteger(robux) && robux > 0 ? [String(robux)] : []
          })
        : []
    } catch {
      amounts.value = []
    }
  },
  { immediate: true },
)

const validRate = computed(() => (Number.isFinite(props.rate) && props.rate > 0 ? props.rate : 3.5))
const price = (amount: string) => Math.ceil(Number(amount || 0) / validRate.value)
function commit() {
  const packages = amounts.value.flatMap((amount) => {
    const robux = Number(amount)
    return Number.isInteger(robux) && robux > 0 ? [{ robux }] : []
  })
  committing = true
  emit('update:modelValue', JSON.stringify(packages, null, 2))
}
function update(index: number, value: string) {
  amounts.value[index] = value
  commit()
}
function add() {
  amounts.value.push('')
}
function remove(index: number) {
  amounts.value.splice(index, 1)
  commit()
}
</script>

<template>
  <div class="packages-editor">
    <div class="packages-editor__header">
      <span>{{ t('botSettings.robuxAmount') }}</span
      ><span>{{ t('botSettings.calculatedPrice') }}</span
      ><span />
    </div>
    <div v-for="(amount, index) in amounts" :key="index" class="packages-editor__row">
      <AppTextField
        :model-value="amount"
        label=""
        input-type="number"
        placeholder="200"
        @update:model-value="(value) => update(index, value)"
      />
      <output>฿{{ price(amount).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US') }}</output>
      <button
        type="button"
        class="packages-editor__delete"
        :aria-label="text(`Delete package ${index + 1}`, `ลบแพ็กเกจที่ ${index + 1}`)"
        @click="remove(index)"
      >
        <Trash2 :size="18" />
      </button>
    </div>
    <p v-if="!amounts.length" class="packages-editor__empty">
      {{ t('botSettings.noRobuxPackagesYet') }}
    </p>
    <AppButton class="packages-editor__add" @click="add"
      ><Plus :size="18" /> {{ t('botSettings.addPackage') }}</AppButton
    >
    <p class="packages-editor__hint">
      {{
        text(
          `Price = Robux ÷ ${validRate} (rounded up to THB)`,
          `ราคา = จำนวน Robux ÷ ${validRate} และปัดขึ้นเป็นบาท`,
        )
      }}
    </p>
  </div>
</template>

<style scoped>
.packages-editor {
  display: grid;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}
.packages-editor__header,
.packages-editor__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(8rem, 0.6fr) var(--icon-size-40);
  align-items: center;
  gap: var(--space-xs);
}
.packages-editor__header {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-medium);
}
.packages-editor__row output {
  font-size: var(--font-size-body-large);
  font-weight: var(--typography-font-weight-bold);
}
.packages-editor__delete {
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
.packages-editor__empty {
  padding-block: var(--space-md);
  color: var(--semantic-color-text-text-muted);
  text-align: center;
}
.packages-editor__add {
  width: auto;
  justify-self: start;
}
.packages-editor__hint {
  color: var(--semantic-color-text-text-muted);
  font-size: var(--font-size-label-small);
}
@media (max-width: 47.99rem) {
  .packages-editor__header {
    display: none;
  }
  .packages-editor__row {
    grid-template-columns: minmax(0, 1fr) auto var(--icon-size-40);
  }
}
</style>
