<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    headingId?: string
    icon?: Component
    compact?: boolean
    level?: 2 | 3
  }>(),
  { level: 2 },
)
</script>

<template>
  <header data-feature-settings-heading>
    <div class="flex items-start justify-between gap-sm">
      <component
        :is="`h${level}`"
        :id="headingId"
        class="flex min-w-0 items-center gap-xs"
        :class="compact ? 'text-sm font-medium' : 'text-lg font-semibold'"
      >
        <component
          :is="icon"
          v-if="icon"
          :size="compact ? 16 : 20"
          class="shrink-0"
          aria-hidden="true"
        />
        {{ title }}
      </component>
      <div v-if="$slots.actions" class="shrink-0 text-xs text-text-muted">
        <slot name="actions" />
      </div>
    </div>
    <p v-if="description" class="mt-xxs text-sm text-text-secondary">{{ description }}</p>
  </header>
</template>
