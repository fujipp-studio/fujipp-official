<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface CategoryOption {
  code: string
  name: string
}

const props = defineProps<{
  modelValue: string
  allLabel: string
  options: CategoryOption[]
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const filterElement = ref<HTMLElement>()

function updateIndicator() {
  const filter = filterElement.value
  const activeButton = filter?.querySelector<HTMLElement>('button.active')
  if (!filter || !activeButton) return

  filter.style.setProperty('--work-filter-left', `${activeButton.offsetLeft}px`)
  filter.style.setProperty('--work-filter-width', `${activeButton.offsetWidth}px`)
}

function selectOption(value: string) {
  if (value !== props.modelValue) emit('update:modelValue', value)
}

watch(
  () => [props.modelValue, props.options] as const,
  async () => {
    await nextTick()
    updateIndicator()
  },
  { deep: true },
)

onMounted(() => {
  updateIndicator()
  window.addEventListener('resize', updateIndicator)
})

onBeforeUnmount(() => window.removeEventListener('resize', updateIndicator))
</script>

<template>
  <div class="work-category-filter-scroller">
    <nav ref="filterElement" class="work-category-filter" :aria-label="label">
      <span class="work-category-filter__indicator" aria-hidden="true" />
      <button
        type="button"
        :class="{ active: modelValue === 'all' }"
        @click="selectOption('all')"
      >
        {{ allLabel }}
      </button>
      <button
        v-for="option in options"
        :key="option.code"
        type="button"
        :class="{ active: modelValue === option.code }"
        @click="selectOption(option.code)"
      >
        {{ option.name }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.work-category-filter-scroller {
  overflow-x: auto;
  scrollbar-width: none;
}

.work-category-filter-scroller::-webkit-scrollbar {
  display: none;
}

.work-category-filter {
  --work-filter-left: var(--space-xxs);
  --work-filter-width: 0px;

  position: relative;
  isolation: isolate;
  display: flex;
  width: max-content;
  padding: var(--space-xxs);
  gap: var(--space-xxs);
  border-radius: var(--radius-full);
  background: var(--semantic-color-background-bg-surface-hover);
}

.work-category-filter__indicator {
  position: absolute;
  z-index: 0;
  top: var(--space-xxs);
  bottom: var(--space-xxs);
  left: 0;
  width: var(--work-filter-width);
  border-radius: var(--radius-full);
  background: var(--semantic-color-text-text-primary);
  box-shadow: var(--effect-shadow-button);
  pointer-events: none;
  transform: translateX(var(--work-filter-left));
  transition:
    width 360ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.work-category-filter button {
  position: relative;
  z-index: 1;
  flex: none;
  padding: var(--space-xs) var(--space-md);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--semantic-color-text-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-body-small);
  transition: color 180ms ease;
}

.work-category-filter button.active {
  color: var(--semantic-color-background-bg-default);
  font-weight: var(--typography-font-weight-bold);
}

@media (prefers-reduced-motion: reduce) {
  .work-category-filter__indicator,
  .work-category-filter button {
    transition: none;
  }
}
</style>
