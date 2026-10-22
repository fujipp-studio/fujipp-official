<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ArrowUpRight, Check, Copy } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'


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
        <h2 id="contact-title">{{ t('about.contact.title') }}</h2>
        <p class="contact-description">{{ t('about.contact.description') }}</p>
      </div>

      <div class="contact-card">
        <p class="contact-card__label">{{ t('about.contact.emailLabel') }}</p>
        <div class="contact-card__email-row">
          <a :href="`mailto:${email}`" class="contact-email">
            <span>{{ email }}</span>
            <ArrowUpRight class="contact-card__arrow" :stroke-width="1.25" aria-hidden="true" />
          </a>
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
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-4xl) var(--layout-page-gutter);
  color: var(--semantic-color-text-text-primary);
}
.contact-layout {
  display: grid;
  width: min(100%, 72rem);
  gap: var(--space-3xl);
  margin-inline: auto;
  padding-top: var(--space-2xl);
  border-top: 1px solid var(--semantic-color-border-border-default);
}
.contact-copy {
  display: grid;
  gap: var(--space-xl);
  min-width: 0;
}
.contact-copy h2 {
  margin: 0;
  font-family: var(--font-family-display);
  font-size: clamp(4rem, 11vw, 9rem);
  font-weight: var(--typography-font-weight-medium);
  letter-spacing: -0.065em;
  line-height: 1.05;
}
.contact-copy h2:lang(th) {
  letter-spacing: 0;
  line-height: 1.2;
}
.contact-description {
  max-width: 30rem;
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}
.contact-card {
  min-width: 0;
}
.contact-card__label {
  margin: 0 0 var(--space-md);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-medium);
}
.contact-card__email-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}
.contact-email {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding-block: var(--space-lg);
  border-bottom: 1px solid var(--semantic-color-border-border-default);
  color: var(--semantic-color-text-text-primary);
  font-size: clamp(1rem, 3.6vw, 2.75rem);
  letter-spacing: -0.035em;
  text-decoration: none;
  transition: border-color 180ms ease;
}
.contact-email span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.contact-card__arrow {
  width: clamp(1.5rem, 5vw, 4rem);
  height: auto;
  flex-shrink: 0;
  transition: transform 180ms ease;
}
.contact-copy-button {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-full);
  background: transparent;
  color: var(--semantic-color-text-text-secondary);
  cursor: pointer;
}
.contact-copy-button[data-copied='true'] {
  color: var(--semantic-color-text-text-primary);
}
.contact-card__feedback {
  min-height: 1.5em;
  margin: var(--space-sm) 0 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
}
.contact-section :is(a, button):focus-visible {
  outline: 2px solid var(--semantic-color-text-text-primary);
  outline-offset: 4px;
}
@media (hover: hover) and (pointer: fine) {
  .contact-email:hover {
    border-color: var(--semantic-color-text-text-primary);
  }
  .contact-email:hover .contact-card__arrow {
    transform: translate(3px, -3px);
  }
  .contact-copy-button:hover {
    background: var(--semantic-color-background-bg-surface-hover);
    color: var(--semantic-color-text-text-primary);
  }
}
@media (min-width: 64rem) {
  .contact-section {
    padding-block: var(--space-5xl);
  }
  .contact-copy {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    align-items: end;
    gap: var(--space-3xl);
  }
}
@media (prefers-reduced-motion: reduce) {
  .contact-email,
  .contact-card__arrow {
    transition: none;
  }
  .contact-email:hover .contact-card__arrow {
    transform: none;
  }
}
</style>
