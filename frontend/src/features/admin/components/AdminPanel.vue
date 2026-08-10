<script setup lang="ts">
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <section>
    <header
      v-if="title || $slots.header"
      class="mb-lg flex flex-col gap-sm tablet:flex-row tablet:items-end tablet:justify-between"
    >
      <slot name="header">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight text-text-primary">{{ title }}</h2>
          <p v-if="description" class="mt-xxs text-xs text-text-secondary">{{ description }}</p>
        </div>
      </slot>
      <slot name="actions" />
    </header>
    <div><slot /></div>
  </section>
</template>

<style scoped>
:deep(.admin-table-scroll) {
  scrollbar-width: none;
}

:deep(.admin-table-scroll::-webkit-scrollbar) {
  display: none;
}
</style>
