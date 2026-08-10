<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { icons } from '../../../config'
import { useThemeStore } from '../../../stores'
import { AppIcon } from '../../ui'
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
      { label: 'LinkedIn', icon: icons.social.linkedin },
      { label: 'GitHub', icon: icons.social.github },
      { label: 'Instagram', icon: icons.social.instagram },
      { label: 'Discord', icon: icons.social.discord },
      { label: 'Email', icon: icons.social.email },
    ],
  },
)

const themeStore = useThemeStore()
const { t } = useI18n()
const { isDarkTheme } = storeToRefs(themeStore)
const brandLockup = computed(() =>
  isDarkTheme.value ? icons.brand.lockupDark : icons.brand.lockup,
)
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
    <div class="footer__divider" />

    <div class="footer__company">
      <div class="footer__brand">
        <img
          class="footer__logo"
          :src="brandLockup"
          alt="Fujipp"
          loading="lazy"
          decoding="async"
        />
        <p class="footer__tagline">{{ resolvedTagline }}</p>
      </div>

      <nav class="footer__legal-links" :aria-label="t('footer.legalLabel')">
        <a v-for="link in resolvedLinks" :key="link.href" :href="link.href">
          {{ link.label }}
        </a>
      </nav>
    </div>

    <div class="footer__bottom">
      <p>{{ copyright }}</p>

      <nav
        v-if="socialLinks.length"
        class="footer__social-links"
        :aria-label="t('footer.socialLabel')"
      >
        <template v-for="link in socialLinks" :key="link.label">
          <a
            v-if="link.href"
            :href="link.href"
            :aria-label="link.label"
            target="_blank"
            rel="noreferrer"
          >
            <AppIcon
              class="footer__social-icon"
              :source="link.icon"
            />
          </a>
          <button v-else type="button" :aria-label="link.label">
            <AppIcon
              class="footer__social-icon"
              :source="link.icon"
            />
          </button>
        </template>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-body-medium);
  text-align: left;
}

.footer__divider {
  height: 1px;
  background: var(--semantic-color-border-border-strong);
}

.footer__company {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6.8125rem 1.25rem;
}

.footer__brand {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
}

.footer__logo {
  width: var(--brand-lockup-width);
  height: var(--brand-lockup-height);
}

.footer__tagline,
.footer__bottom p {
  margin: 0;
  line-height: var(--line-height-body);
}

.footer__tagline {
  width: min(19.9375rem, 100%);
}

.footer__legal-links {
  display: flex;
  min-height: 3.6875rem;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-xs);
}

.footer__legal-links a,
.footer__social-links a,
.footer__social-links button {
  color: inherit;
  text-decoration: none;
}

.footer__legal-links a {
  position: relative;
  line-height: var(--line-height-label);
  font-weight: var(--typography-font-weight-medium);
}

.footer__legal-links a::after {
  position: absolute;
  right: 0;
  bottom: -0.25rem;
  left: 0;
  height: 1px;
  background: currentcolor;
  content: '';
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.footer__legal-links a:hover::after,
.footer__legal-links a:focus-visible::after {
  transform: scaleX(1);
}

.footer__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs) 1.25rem;
  padding: var(--space-xs);
}

.footer__social-links {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.footer__social-links a,
.footer__social-links button {
  display: grid;
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  place-items: center;
  cursor: pointer;
  border: 0;
  border-radius: var(--corner-radius-sm);
  padding: 0;
  background: transparent;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.footer__social-links a:active,
.footer__social-links button:active {
  transform: scale(0.96);
}

.footer__social-icon {
  display: block;
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  transition: transform 260ms cubic-bezier(0.22, 1.35, 0.36, 1);
}

.footer__social-links a:hover .footer__social-icon,
.footer__social-links a:focus-visible .footer__social-icon,
.footer__social-links button:hover .footer__social-icon,
.footer__social-links button:focus-visible .footer__social-icon {
  transform: rotate(20deg) scale(1.08);
}

.footer__social-links a:active .footer__social-icon,
.footer__social-links button:active .footer__social-icon {
  transform: rotate(-10deg) scale(0.92);
}

@media (max-width: 47.99rem) {
  .footer__company,
  .footer__bottom {
    align-items: flex-start;
  }

  .footer__company {
    flex-direction: column;
    gap: var(--space-md);
  }

  .footer__legal-links {
    min-height: auto;
    flex-wrap: wrap;
    padding: 0;
  }

  .footer__bottom {
    flex-wrap: wrap;
    padding-inline: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .footer__legal-links a::after,
  .footer__social-links a,
  .footer__social-links button,
  .footer__social-icon {
    transition: none;
  }
}
</style>
