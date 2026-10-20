<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ArrowUpRight, Check, Copy } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import { AppButton } from '@/shared/ui'

const email = 'anawat.boripakhirun@gmail.com'
const { t } = useI18n()
const copyState = ref<'idle' | 'copied' | 'error'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copyEmail() {
  if (copyTimer) clearTimeout(copyTimer)
  try {
    await navigator.clipboard.writeText(email)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'error'
  }
  copyTimer = setTimeout(() => {
    copyState.value = 'idle'
  }, 3000)
}

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<template>
  <section id="about-contact" class="contact-section" aria-labelledby="contact-title">
    <div class="contact-layout">
      <div class="contact-copy">
        <p class="contact-eyebrow">{{ t('about.sections.contact') }}</p>
        <h2 id="contact-title">{{ t('about.contact.title') }}</h2>
        <p class="contact-description">{{ t('about.contact.description') }}</p>
      </div>

      <div class="contact-card">
        <ArrowUpRight
          class="contact-card__arrow"
          :size="40"
          :stroke-width="1.5"
          aria-hidden="true"
        />
        <p class="contact-card__label">{{ t('about.contact.emailLabel') }}</p>
        <div class="contact-card__email-row">
          <a :href="`mailto:${email}`" class="contact-email">{{ email }}</a>
          <button
            class="contact-copy-button"
            type="button"
            :aria-label="
              t(copyState === 'copied' ? 'about.contact.copied' : 'about.contact.copyEmail')
            "
            :data-copied="copyState === 'copied'"
            @click="copyEmail"
          >
            <Check v-if="copyState === 'copied'" :size="18" aria-hidden="true" />
            <Copy v-else :size="18" aria-hidden="true" />
          </button>
        </div>
        <AppButton class="contact-send" :href="`mailto:${email}`">
          {{ t('about.contact.action') }}<ArrowUpRight :size="18" aria-hidden="true" />
        </AppButton>
        <p class="contact-card__feedback" role="status">
          {{
            copyState === 'idle'
              ? ''
              : t(copyState === 'copied' ? 'about.contact.copied' : 'about.contact.copyError')
          }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.contact-section {
  width: 100%;
  padding: var(--space-4xl) var(--layout-page-gutter);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
}

.contact-layout {
  display: grid;
  width: min(100%, 72rem);
  align-items: center;
  gap: var(--space-2xl);
  margin-inline: auto;
}

.contact-copy {
  min-width: 0;
}

.contact-eyebrow {
  margin: 0 0 var(--space-lg);
  color: var(--semantic-color-text-text-accent);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-semibold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.contact-copy h2 {
  max-width: 14ch;
  margin: 0;
  font-family: var(--font-family-display);
  font-size: clamp(2.5rem, 7vw, 5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.055em;
  line-height: 1.05;
}

.contact-copy h2:lang(th) {
  max-width: 16ch;
  font-family: var(--font-family-sans);
  letter-spacing: 0;
  line-height: 1.3;
}

.contact-description {
  max-width: 34rem;
  margin: var(--space-lg) 0 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.contact-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: var(--space-lg);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  background: var(--semantic-color-background-bg-surface);
  transition:
    border-color 200ms ease,
    transform 200ms ease;
}

.contact-card__arrow {
  align-self: flex-end;
  margin-bottom: var(--space-2xl);
  transition: transform 200ms ease;
}

.contact-card__label {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-medium);
  line-height: var(--line-height-body);
}

.contact-card__email-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--space-xs);
  margin-block: var(--space-xs) var(--space-lg);
}

.contact-email {
  flex: 1;
  min-width: 0;
  color: inherit;
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-medium);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.contact-copy-button {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  place-items: center;
  border: 0;
  border-radius: var(--corner-radius-sm);
  background: transparent;
  color: var(--semantic-color-text-text-secondary);
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease;
}

.contact-copy-button[data-copied='true'] {
  color: var(--semantic-color-text-text-accent);
}

.contact-send.app-button {
  height: 3rem;
  border-color: transparent;
  background: var(--semantic-color-background-bg-inverse);
  color: var(--semantic-color-text-text-inverse);
  box-shadow: none;
}

.contact-send :deep(.app-button__label) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.contact-card__feedback {
  min-height: 1.5em;
  align-self: center;
  margin: var(--space-xs) 0 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
  line-height: var(--line-height-body);
}

.contact-section :is(a, button):focus-visible {
  outline: 2px solid var(--semantic-color-text-text-accent);
  outline-offset: 4px;
}

@media (hover: hover) and (pointer: fine) {
  .contact-card:hover {
    border-color: var(--semantic-color-text-text-accent);
    transform: translateY(-3px);
  }
  .contact-card:hover .contact-card__arrow {
    transform: translate(3px, -3px);
  }
  .contact-copy-button:hover {
    background: var(--semantic-color-background-bg-surface-hover);
  }
  .contact-email:hover {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
}

@media (min-width: 48rem) {
  .contact-card {
    padding: var(--space-xl);
  }
}

@media (min-width: 64rem) {
  .contact-layout {
    min-height: 30rem;
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 25rem);
    gap: var(--space-2xl);
  }
  .contact-copy h2 {
    font-size: clamp(3.25rem, 5.1vw, 5rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .contact-card,
  .contact-card__arrow,
  .contact-copy-button {
    transition: none;
  }
  .contact-card:hover,
  .contact-card:hover .contact-card__arrow {
    transform: none;
  }
}
</style>
