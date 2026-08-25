<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { icons } from '../../../config'
import AppIcon from '../icons/AppIcon.vue'

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
    if (open && !dialog.value?.open) {
      dialog.value?.showModal()
      dialog.value?.focus({ preventScroll: true })
    }
    if (!open && dialog.value?.open) dialog.value.close()
  },
  { immediate: true },
)
</script>

<template>
  <dialog ref="dialog" class="image-lightbox" tabindex="-1" @click="handleBackdrop" @cancel.prevent="close">
    <div class="image-lightbox__content">
      <button type="button" class="image-lightbox__close" aria-label="Close image preview" @click="close"><AppIcon class="image-lightbox__close-icon" :source="icons.base.close" /></button>
      <img :src="src" :alt="alt" />
      <p v-if="caption">{{ caption }}</p>
    </div>
  </dialog>
</template>

<style scoped>
.image-lightbox { width: 100vw; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: var(--space-xl); border: 0; background: color-mix(in srgb, var(--semantic-color-background-bg-default) 88%, transparent); color: var(--semantic-color-text-text-primary); backdrop-filter: blur(1rem); }
.image-lightbox:focus { outline: none; }
.image-lightbox::backdrop { background: color-mix(in srgb, var(--semantic-color-background-bg-default) 82%, transparent); }
.image-lightbox__content { position: relative; display: grid; width: 100%; height: 100%; place-items: center; align-content: center; gap: var(--space-md); }
.image-lightbox img { display: block; max-width: min(92vw, 100rem); max-height: 82dvh; border-radius: var(--corner-radius-md); object-fit: contain; box-shadow: var(--effect-shadow-lg); }
.image-lightbox p { max-width: 52rem; margin: 0; color: var(--semantic-color-text-text-secondary); text-align: center; }
.image-lightbox__close { position: fixed; z-index: 1; top: var(--space-lg); right: var(--space-lg); display: grid; width: var(--icon-size-32); height: var(--icon-size-32); place-items: center; border: 0; padding: 0; background: transparent; color: var(--semantic-color-text-text-primary); cursor: pointer; transition: opacity 150ms ease; }
.image-lightbox__close-icon { width: var(--icon-size-20); height: var(--icon-size-20); }
.image-lightbox__close:hover { opacity: 0.68; }
.image-lightbox__close:focus-visible { outline: 2px solid var(--semantic-color-action-borders-border-focus); outline-offset: 2px; }
@media (max-width: 47.99rem) { .image-lightbox { padding: var(--space-md); } .image-lightbox img { max-width: 100%; max-height: 78dvh; } }
</style>
