<script setup lang="ts">
import { useId, type Component } from 'vue'
import FeatureSettingsHeading from './FeatureSettingsHeading.vue'

withDefaults(
  defineProps<{
    as?: 'section' | 'aside' | 'div'
    title?: string
    description?: string
    icon?: Component
    compact?: boolean
    headingId?: string
  }>(),
  { as: 'section' },
)
const id = useId()
</script>

<template>
  <component
    :is="as"
    class="min-w-0 rounded-xl border border-border-subtle bg-bg-surface p-md tablet:p-lg"
    :aria-labelledby="title ? headingId || id + '-heading' : undefined"
    data-feature-settings-card
  >
    <FeatureSettingsHeading
      v-if="title"
      :title="title"
      :description="description"
      :icon="icon"
      :compact="compact"
      :heading-id="headingId || id + '-heading'"
      :class="compact ? 'mb-md' : 'mb-lg'"
    >
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </FeatureSettingsHeading>
    <slot />
  </component>
</template>
