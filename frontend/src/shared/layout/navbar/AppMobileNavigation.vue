<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { icons, type NavbarLink } from '@/config'
import { AppButton, AppIcon } from '@/shared/ui'
defineProps<{
  open: boolean
  links: readonly NavbarLink[]
  selectedItem: string
  openMenu?: string
  authenticated: boolean
}>()
const emit = defineEmits<{
  close: []
  select: [label: string]
  child: [item: NavbarLink, parentLabel: string]
  register: []
  home: []
}>()
const { t } = useI18n()
const mobileNavigationElement = ref<HTMLElement>()
defineExpose({
  contains: (target: Node) => mobileNavigationElement.value?.contains(target) ?? false,
})
function navigationLabel(item: NavbarLink) {
  const keyByPath: Record<string, string> = {
    '/': 'navigation.home',
    '/work': 'navigation.work',
    '/about': 'navigation.about',
    '/store': 'navigation.store',
    '/my-bot': 'navigation.myBot',
    '/add-credit': 'navigation.addCredit',
  }
  return t(keyByPath[item.path] ?? item.label)
}
</script>
<template>
  <Transition name="mobile-navigation" :duration="{ enter: 300, leave: 180 }">
    <div v-if="open" class="mobile-menu-layer">
      <button
        class="mobile-menu-backdrop"
        type="button"
        aria-label="Close navigation"
        @click="emit('close')"
      />

      <aside
        id="mobile-navigation"
        class="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div class="mobile-menu__header">
          <button class="brand" type="button" aria-label="Fujipp home" @click="emit('home')">
            <span class="brand__lockup" aria-hidden="true">
              <svg class="brand__mascot" viewBox="0 0 1080 1080">
                <use class="brand__mascot-body" :href="`${icons.brand.mascot}#mascot-body`" />
                <use
                  v-for="faceIndex in 12"
                  :key="faceIndex"
                  class="brand__mascot-face"
                  :href="`${icons.brand.mascot}#mascot-face-${faceIndex}`"
                  :style="{ animationDelay: `${-(24 - (faceIndex - 1) * 2)}s` }"
                />
              </svg>
              <span class="brand__wordmark">FUJIPP</span>
            </span>
          </button>

          <button
            class="mobile-icon-button"
            type="button"
            aria-label="Close navigation"
            @click="emit('close')"
          >
            <AppIcon class="mobile-icon mobile-icon--32" :source="icons.base.close" />
          </button>
        </div>

        <nav
          ref="mobileNavigationElement"
          class="mobile-menu__navigation"
          aria-label="Mobile main navigation"
        >
          <template v-for="item in links" :key="item.path">
            <button
              type="button"
              class="mobile-menu__row"
              :aria-current="item.label === selectedItem ? 'page' : undefined"
              :aria-expanded="item.children?.length ? openMenu === item.label : undefined"
              @click="emit('select', item.label)"
            >
              <span class="mobile-menu__row-label">
                <AppIcon v-if="item.icon" class="mobile-icon mobile-icon--24" :source="item.icon" />
                <span>{{ navigationLabel(item) }}</span>
              </span>
              <AppIcon
                class="mobile-icon mobile-icon--16"
                :class="{ 'mobile-menu__chevron--open': openMenu === item.label }"
                :source="item.children?.length ? icons.base.arrowDown : icons.base.arrowRight"
              />
            </button>
            <div
              v-if="item.children?.length && openMenu === item.label"
              class="mobile-menu__children"
            >
              <button
                v-for="child in item.children"
                :key="child.path"
                type="button"
                @click="emit('child', child, item.label)"
              >
                <AppIcon
                  v-if="child.icon"
                  class="mobile-icon mobile-icon--24"
                  :source="child.icon"
                />
                <span>{{ child.label }}</span>
              </button>
            </div>
          </template>
        </nav>

        <AppButton v-if="!authenticated" variant="secondary" @click="emit('register')">
          {{ t('navigation.signUp') }}
        </AppButton>
      </aside>
    </div>
  </Transition>
</template>
<style scoped>
.brand {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  border: 0;
  background: transparent;
}

.brand__lockup {
  display: flex;
  width: auto;
  height: var(--brand-lockup-height);
  align-items: center;
  gap: var(--space-xs);
  transform-origin: left top;
  transition: transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.brand__mascot {
  width: var(--brand-logo-size);
  height: var(--brand-logo-size);
}

.brand__mascot-body {
  fill: var(--semantic-color-text-text-primary);
}

.brand__mascot-face {
  fill: var(--semantic-color-text-text-inverse);
  opacity: 0;
  transform: scale(1.45);
  transform-box: view-box;
  transform-origin: 50% 64%;
  animation: brand-face 24s steps(1, end) infinite;
}

@keyframes brand-face {
  0%,
  8.32% {
    opacity: 1;
  }

  8.33%,
  100% {
    opacity: 0;
  }
}

.brand__wordmark {
  font-family: var(--font-family-brand);
  font-size: 1.25rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.04em;
}

@media (prefers-reduced-motion: reduce) {
  .brand__mascot-face {
    animation: none;
  }

  .brand__mascot-face:nth-of-type(2) {
    opacity: 1;
  }
}

.mobile-menu-layer {
  display: none;
}

@media (max-width: 47.99rem) {
  .mobile-menu .brand__lockup {
    width: auto;
    height: var(--brand-lockup-height);
  }

  .mobile-icon-button {
    display: grid;
    width: var(--icon-size-32);
    height: var(--icon-size-32);
    flex-shrink: 0;
    cursor: pointer;
    place-items: center;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--semantic-color-text-text-primary);
  }

  .mobile-icon {
    display: block;
    flex-shrink: 0;
  }

  .mobile-icon--16 {
    width: var(--icon-size-16);
    height: var(--icon-size-16);
  }

  .mobile-icon--24 {
    width: var(--icon-size-24);
    height: var(--icon-size-24);
  }

  .mobile-icon--32 {
    width: var(--icon-size-32);
    height: var(--icon-size-32);
  }

  .mobile-menu-layer {
    position: fixed;
    z-index: var(--z-overlay);
    inset: 0;
    display: block;
  }

  .mobile-menu-backdrop {
    position: absolute;
    z-index: 0;
    inset: 0;
    width: 100%;
    border: 0;
    padding: 0;
    background: var(--semantic-color-background-bg-overlay);
    backdrop-filter: blur(var(--effect-backdrop-blur-sm));
  }

  .mobile-menu {
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    width: min(19.5rem, calc(100vw - 3rem));
    height: 100vh;
    height: 100dvh;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--semantic-color-background-bg-default);
    color: var(--semantic-color-text-text-primary);
    font-family: var(--font-family-sans);
    font-size: var(--font-size-label-large);
    line-height: var(--line-height-label);
    transform: translateX(0);
    will-change: transform;
  }

  .mobile-navigation-enter-active .mobile-menu {
    transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .mobile-navigation-leave-active .mobile-menu {
    transition: transform 180ms cubic-bezier(0.4, 0, 1, 1);
  }

  .mobile-navigation-enter-active .mobile-menu-backdrop {
    transition: opacity 260ms ease;
  }

  .mobile-navigation-leave-active .mobile-menu-backdrop {
    transition: opacity 160ms ease;
  }

  .mobile-navigation-enter-from .mobile-menu,
  .mobile-navigation-leave-to .mobile-menu {
    transform: translateX(-100%);
  }

  .mobile-navigation-enter-from .mobile-menu-backdrop,
  .mobile-navigation-leave-to .mobile-menu-backdrop {
    opacity: 0;
  }

  .mobile-menu__header {
    display: flex;
    min-height: var(--icon-size-32);
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
  }

  .mobile-menu__navigation {
    display: grid;
    gap: var(--space-xs);
  }

  .mobile-menu__row {
    display: flex;
    width: 100%;
    height: var(--icon-size-32);
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    cursor: pointer;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: var(--typography-font-weight-medium);
    text-align: left;
  }

  .mobile-menu__row:hover,
  .mobile-menu__row[aria-current='page'] {
    color: var(--semantic-color-text-text-accent);
  }

  .mobile-menu__row-label {
    display: flex;
    align-items: center;
    gap: var(--space-xxs);
  }

  .mobile-menu__chevron--open {
    transform: rotate(180deg);
  }

  .mobile-menu__children {
    display: grid;
    gap: var(--space-xxs);
    padding-left: var(--space-lg);
  }

  .mobile-menu__children button {
    display: flex;
    min-height: 2.5rem;
    align-items: center;
    gap: var(--space-xs);
    cursor: pointer;
    border: 0;
    border-radius: var(--corner-radius-sm);
    padding: var(--space-xs);
    background: transparent;
    color: var(--semantic-color-text-text-secondary);
    font: inherit;
    text-align: left;
  }

  .mobile-menu__children button:hover,
  .mobile-menu__children button:focus-visible {
    background: var(--semantic-color-background-bg-surface-hover);
    color: var(--semantic-color-text-text-primary);
    outline: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-menu,
  .mobile-menu-backdrop {
    transition: none;
  }
}
</style>
