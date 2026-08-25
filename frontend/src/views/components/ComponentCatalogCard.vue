<script setup lang="ts">
withDefaults(
  defineProps<{ name: string; note?: string; padded?: boolean; allowOverflow?: boolean }>(),
  {
  note: '',
  padded: false,
    allowOverflow: false,
  },
)
</script>

<template>
  <article class="component-card">
    <header>
      <code>{{ name }}</code>
      <span>{{ note }}</span>
    </header>
    <div
      class="component-preview"
      :class="{
        'component-preview--padded': padded,
        'component-preview--allow-overflow': allowOverflow,
      }"
    >
      <slot />
    </div>
  </article>
</template>
