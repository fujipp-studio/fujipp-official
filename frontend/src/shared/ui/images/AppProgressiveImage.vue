<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    placeholderSrc: string
    alt?: string
    srcset?: string
    sizes?: string
    width?: number | string
    height?: number | string
    loading?: 'eager' | 'lazy'
    fetchpriority?: 'high' | 'low' | 'auto'
    fit?: 'cover' | 'contain'
    position?: string
  }>(),
  {
    alt: '',
    srcset: undefined,
    sizes: undefined,
    width: undefined,
    height: undefined,
    loading: 'lazy',
    fetchpriority: 'auto',
    fit: 'cover',
    position: 'center',
  },
)

const loaded = ref(false)
watch(
  () => props.src,
  () => (loaded.value = false),
)
</script>

<template>
  <span
    class="progressive-image"
    :class="{ 'progressive-image--loaded': loaded }"
    :style="{
      '--progressive-image-fit': fit,
      '--progressive-image-position': position,
    }"
  >
    <img
      class="progressive-image__placeholder"
      :src="placeholderSrc"
      alt=""
      aria-hidden="true"
      decoding="async"
    />
    <img
      class="progressive-image__full"
      :src="src"
      :srcset="srcset"
      :sizes="sizes"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="loading"
      decoding="async"
      :fetchpriority="fetchpriority"
      @load="loaded = true"
    />
  </span>
</template>

<style scoped>
.progressive-image {
  position: relative;
  display: block;
  overflow: hidden;
  background: var(--semantic-color-background-bg-elevated);
}

.progressive-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: var(--progressive-image-fit);
  object-position: var(--progressive-image-position);
}

.progressive-image__placeholder {
  position: absolute;
  inset: 0;
  filter: blur(18px);
  opacity: 1;
  transform: scale(1.08);
  transition: opacity 240ms ease;
}

.progressive-image__full {
  position: relative;
  opacity: 0;
  transition: opacity 240ms ease;
}

.progressive-image--loaded .progressive-image__placeholder {
  opacity: 0;
}

.progressive-image--loaded .progressive-image__full {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .progressive-image__placeholder,
  .progressive-image__full {
    transition: none;
  }
}
</style>
