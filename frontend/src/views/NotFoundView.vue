<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { AppButton } from '../shared/ui'

const router = useRouter()
const { locale } = useI18n()
const copy = computed(() =>
  locale.value === 'th'
    ? {
        eyebrow: '404 · ไม่พบหน้านี้',
        title: 'หน้านี้ยังไม่พร้อมใช้งาน',
        description: 'หน้าที่คุณเปิดอาจยังไม่ได้พัฒนา ถูกย้าย หรือไม่มีอยู่ในระบบ',
        action: 'กลับหน้า Home',
      }
    : {
        eyebrow: '404 · Page not found',
        title: 'This page is not available yet.',
        description: 'The page may still be under development, may have moved, or does not exist.',
        action: 'Back to Home',
      },
)
</script>

<template>
  <main class="not-found-page">
    <section class="not-found-card">
      <p class="not-found-eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ copy.title }}</h1>
      <p class="not-found-description">{{ copy.description }}</p>
      <AppButton class="not-found-action" variant="secondary" @click="router.replace('/')">
        {{ copy.action }}
      </AppButton>
    </section>
  </main>
</template>

<style scoped>
.not-found-page {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: calc(var(--layout-navbar-height) + var(--space-xl)) var(--page-gutter) var(--space-xl);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
}
.not-found-card {
  width: min(42rem, 100%);
  text-align: center;
}
.not-found-eyebrow {
  color: var(--semantic-color-text-text-accent);
  font-size: var(--font-size-label-large);
  font-weight: var(--typography-font-weight-semibold);
}
.not-found-card h1 {
  margin-top: var(--space-sm);
  font-size: clamp(2.25rem, 7vw, 4.5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.04em;
  line-height: 1;
}
.not-found-description {
  max-width: 34rem;
  margin: var(--space-md) auto 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
}
.not-found-action {
  width: auto;
  margin: var(--space-xl) auto 0;
}
</style>
