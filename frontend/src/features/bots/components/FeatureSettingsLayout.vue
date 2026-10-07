<template>
  <div
    class="grid min-w-0 items-start gap-lg"
    :class="{ 'desktop:grid-cols-3': $slots.summary }"
    data-feature-settings-layout
  >
    <div class="min-w-0 space-y-lg" :class="{ 'desktop:col-span-2': $slots.summary }">
      <slot />
    </div>
    <div v-if="$slots.summary" class="min-w-0 desktop:sticky desktop:top-24">
      <slot name="summary" />
    </div>
  </div>
</template>
