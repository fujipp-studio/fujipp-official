<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { icons } from '../../../config'
import type { FooterLink, FooterSocialLink } from './types'

const props = withDefaults(
  defineProps<{
    tagline?: string
    copyright?: string
    links?: readonly FooterLink[]
    socialLinks?: readonly FooterSocialLink[]
  }>(),
  {
    tagline: 'Building ideas, one commit at a time.',
    copyright: '© 2026 Fujipp',
    links: () => [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Changelog', href: '/changelog' },
    ],
    socialLinks: () => [
      {
        label: 'LinkedIn',
        icon: icons.social.linkedin,
        href: 'https://www.linkedin.com/in/anawat-boripakhirun-aa1799426',
      },
      { label: 'GitHub', icon: icons.social.github, href: 'https://github.com/Fujipp' },
      {
        label: 'Instagram',
        icon: icons.social.instagram,
        href: 'https://www.instagram.com/f.janw/',
      },
      {
        label: 'Discord',
        icon: icons.social.discord,
        href: 'https://discord.com/users/1108816021915176962',
      },
      {
        label: 'Email',
        icon: icons.social.email,
        href: 'mailto:anawat.boripakhirun@gmail.com',
      },
    ],
  },
)

const { t } = useI18n()
const resolvedTagline = computed(() =>
  props.tagline === 'Building ideas, one commit at a time.' ? t('footer.tagline') : props.tagline,
)
const resolvedLinks = computed(() =>
  props.links.map((link) => ({
    ...link,
    label:
      link.href === '/terms'
        ? t('footer.terms')
        : link.href === '/privacy'
          ? t('footer.privacy')
          : link.href === '/changelog'
            ? t('footer.changelog')
            : link.label,
  })),
)
</script>

<template>
  <footer class="footer">
    <div class="footer__layout">
      <a class="footer__brand" href="/">
        <span class="footer__brand-lockup">
          <svg class="footer__mascot" viewBox="0 0 1080 1080" aria-hidden="true">
            <use class="footer__mascot-body" :href="`${icons.brand.mascot}#mascot-body`" />
            <use
              v-for="faceIndex in 12"
              :key="faceIndex"
              class="footer__mascot-face"
              :href="`${icons.brand.mascot}#mascot-face-${faceIndex}`"
              :style="{ animationDelay: `${-(24 - (faceIndex - 1) * 2)}s` }"
            />
          </svg>
          <span class="footer__wordmark">FUJIPP</span>
        </span>
        <span class="footer__tagline">{{ resolvedTagline }}</span>
      </a>

      <div class="footer__link-columns">
        <nav v-if="socialLinks.length" class="footer__link-list" :aria-label="t('footer.socialLabel')">
          <template v-for="link in socialLinks" :key="link.label">
            <a
              v-if="link.href"
              :href="link.href"
              :target="link.href.startsWith('http') ? '_blank' : undefined"
              :rel="link.href.startsWith('http') ? 'noreferrer' : undefined"
            >
              {{ link.label }}
            </a>
            <button v-else type="button">{{ link.label }}</button>
          </template>
        </nav>

        <nav class="footer__link-list" :aria-label="t('footer.legalLabel')">
          <a v-for="link in resolvedLinks" :key="link.href" :href="link.href">
            {{ link.label }}
          </a>
        </nav>
      </div>

      <p class="footer__copyright">{{ copyright }}</p>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  box-sizing: border-box;
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  padding: var(--space-xl) var(--space-md) var(--space-md);
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-sans);
}

.footer__layout {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--space-lg) var(--space-md);
  border-top: 1px solid var(--semantic-color-border-border-strong);
  padding-top: var(--space-lg);
}

.footer__brand {
  display: flex;
  min-width: 0;
  grid-column: span 5;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
  color: inherit;
  text-decoration: none;
}

.footer__brand-lockup {
  display: flex;
  max-width: 100%;
  align-items: center;
  gap: var(--space-sm);
}

.footer__mascot {
  width: clamp(4.5rem, 8vw, 7.5rem);
  height: clamp(4.5rem, 8vw, 7.5rem);
  flex-shrink: 0;
}

.footer__mascot-body {
  fill: var(--semantic-color-text-text-primary);
}

.footer__mascot-face {
  fill: var(--semantic-color-text-text-inverse);
  opacity: 0;
  transform: scale(1.45);
  transform-box: view-box;
  transform-origin: 50% 64%;
  animation: footer-face 24s steps(1, end) infinite;
}

.footer__wordmark {
  overflow: hidden;
  font-family: var(--font-family-brand);
  font-size: clamp(2rem, 5vw, 4.5rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.025em;
}

.footer__tagline {
  max-width: 24rem;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-medium);
  line-height: var(--line-height-body);
}

.footer__link-columns {
  display: grid;
  grid-column: span 5;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-lg);
}

.footer__link-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
}

.footer__link-list a,
.footer__link-list button {
  position: relative;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: var(--line-height-body);
  text-decoration: none;
  cursor: pointer;
}

.footer__link-list a::after,
.footer__link-list button::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  background: currentcolor;
  content: '';
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.footer__link-list a:hover::after,
.footer__link-list a:focus-visible::after,
.footer__link-list button:hover::after,
.footer__link-list button:focus-visible::after {
  transform: scaleX(1);
}

.footer__copyright {
  margin: 0;
  grid-column: span 2;
  justify-self: end;
  color: var(--semantic-color-text-text-secondary);
  line-height: var(--line-height-body);
  white-space: nowrap;
}

@keyframes footer-face {
  0%,
  8.32% {
    opacity: 1;
  }

  8.33%,
  100% {
    opacity: 0;
  }
}

@media (max-width: 63.99rem) {
  .footer__brand {
    grid-column: span 7;
  }

  .footer__link-columns {
    grid-column: span 5;
  }

  .footer__copyright {
    grid-column: 1 / -1;
    justify-self: start;
  }
}

@media (max-width: 47.99rem) {
  .footer {
    padding-top: var(--space-lg);
  }

  .footer__layout {
    display: flex;
    flex-direction: column;
  }

  .footer__brand-lockup {
    gap: var(--space-xs);
  }

  .footer__mascot {
    width: 4rem;
    height: 4rem;
  }

  .footer__wordmark {
    font-size: clamp(2rem, 12vw, 3.25rem);
  }

  .footer__link-columns {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .footer__mascot-face {
    animation: none;
  }

  .footer__mascot-face:first-of-type {
    opacity: 1;
  }

  .footer__link-list a::after,
  .footer__link-list button::after {
    transition: none;
  }
}
</style>
