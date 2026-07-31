<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  src: string
  alt?: string
  caption?: string
}>(), {
  open: false,
  alt: '',
  caption: '',
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const dialog = ref<HTMLDialogElement>()

function close() {
  emit('update:open', false)
}

function handleBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    if (open && !dialog.value?.open) dialog.value?.showModal()
    if (!open && dialog.value?.open) dialog.value.close()
  },
  { immediate: true },
)
</script>

<template>
  <dialog ref="dialog" class="image-lightbox" @click="handleBackdrop" @cancel.prevent="close">
    <div class="image-lightbox__content">
      <button type="button" class="image-lightbox__close" aria-label="Close image preview" @click="close">×</button>
      <img :src="src" :alt="alt" />
      <p v-if="caption">{{ caption }}</p>
    </div>
  </dialog>
</template>

<style scoped>
.image-lightbox { width: 100vw; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: var(--space-xl); border: 0; background: color-mix(in srgb, var(--semantic-color-background-bg-default) 88%, transparent); color: var(--semantic-color-text-text-primary); backdrop-filter: blur(1rem); }
.image-lightbox::backdrop { background: color-mix(in srgb, var(--semantic-color-background-bg-default) 82%, transparent); }
.image-lightbox__content { position: relative; display: grid; width: 100%; height: 100%; place-items: center; align-content: center; gap: var(--space-md); }
.image-lightbox img { display: block; max-width: min(92vw, 100rem); max-height: 82dvh; border-radius: var(--corner-radius-md); object-fit: contain; box-shadow: var(--effect-shadow-lg); }
.image-lightbox p { max-width: 52rem; margin: 0; color: var(--semantic-color-text-text-secondary); text-align: center; }
.image-lightbox__close { position: fixed; z-index: 1; top: var(--space-lg); right: var(--space-lg); display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--corner-radius-full); background: var(--semantic-color-background-bg-elevated); color: var(--semantic-color-text-text-primary); cursor: pointer; font: inherit; font-size: 1.75rem; line-height: 1; }
.image-lightbox__close:focus-visible { outline: 2px solid var(--semantic-color-action-borders-border-focus); outline-offset: 2px; }
@media (max-width: 47.99rem) { .image-lightbox { padding: var(--space-md); } .image-lightbox img { max-width: 100%; max-height: 78dvh; } }
</style>
