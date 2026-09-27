<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { icons } from '../../../config'
import AppIcon from '../../ui/icons/AppIcon.vue'
import type { FooterSocialLink } from './types'

withDefaults(
  defineProps<{
    copyright?: string
    socialLinks?: readonly FooterSocialLink[]
  }>(),
  {
    copyright: '© 2026 Fujipp',
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
</script>

<template>
  <footer class="footer">
    <div class="footer__layout">
      <RouterLink class="footer__brand" to="/">
        <span class="footer__brand-lockup">
          <AppIcon class="footer__mark" :source="icons.brand.mark" />
          <span class="footer__wordmark">FUJIPP</span>
        </span>
      </RouterLink>

      <div class="footer__bottom">
        <nav
          v-if="socialLinks.length"
          class="footer__link-list"
          :aria-label="t('footer.socialLabel')"
        >
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

        <p class="footer__copyright">{{ copyright }}</p>
      </div>
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
  display: flex;
  min-height: clamp(18rem, 30vw, 24rem);
  flex-direction: column;
  gap: var(--space-xl);
  padding-top: var(--space-lg);
}

.footer__brand {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  color: inherit;
  text-decoration: none;
}

.footer__brand-lockup {
  display: flex;
  width: 100%;
  max-width: 100%;
  align-items: center;
  gap: var(--space-md);
}

.footer__mark {
  width: clamp(7rem, 15vw, 12rem);
  height: clamp(7rem, 15vw, 12rem);
  flex-shrink: 0;
  color: var(--semantic-color-text-text-primary);
}

.footer__wordmark {
  overflow: hidden;
  font-family: var(--font-family-brand);
  font-size: clamp(4rem, 15vw, 12rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.025em;
}

.footer__bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-lg);
}

.footer__link-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-lg);
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
  color: var(--semantic-color-text-text-secondary);
  line-height: var(--line-height-body);
  white-space: nowrap;
}

@media (max-width: 47.99rem) {
  .footer {
    padding-top: var(--space-lg);
  }

  .footer__layout {
    min-height: 20rem;
  }

  .footer__brand-lockup {
    gap: var(--space-xs);
  }

  .footer__mark {
    width: 5rem;
    height: 5rem;
  }

  .footer__wordmark {
    font-size: clamp(3rem, 14vw, 4rem);
  }

  .footer__bottom {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .footer__link-list a::after,
  .footer__link-list button::after {
    transition: none;
  }
}
</style>
