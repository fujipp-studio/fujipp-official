<script setup lang="ts">
import AppUserMenu from './AppUserMenu.vue'
import AppMobileNavigation from './AppMobileNavigation.vue'
import {
  computed,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Component,
} from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { authenticatedNavbarLinks, guestNavbarLinks, icons } from '../../../config'
import type { NavbarLink } from '../../../config'
import type { ThemeMode } from '../../../config/theme'
import { setAppLocale } from '../../../i18n'
import { useAuthStore, useThemeStore } from '../../../stores'
import { useAdminToolsVisibility } from '../../../features/admin/composables/useAdminToolsVisibility'
import AppIcon from '../../ui/icons/AppIcon.vue'
import type { AuthDialogMode } from '../../ui/dialogs/types'

const props = withDefaults(
  defineProps<{
    activeItem?: string
    authenticated?: boolean
    profileSrc?: string
    walletBalance?: number
    username?: string
    email?: string
  }>(),
  {
    activeItem: 'Home',
    authenticated: undefined,
    profileSrc: undefined,
    walletBalance: undefined,
    username: undefined,
    email: undefined,
  },
)

const selectedItem = ref(props.activeItem)
const route = useRoute()
const router = useRouter()
const { locale, t } = useI18n()
const isAtPageTop = ref(true)
const showScrolledBackground = computed(() => route.path !== '/' && !isAtPageTop.value)
const isMobileMenuOpen = ref(false)
const isProfileMenuOpen = ref(false)
const openNavigationMenu = ref<string>()
const isAuthDialogOpen = ref(false)
const authDialogComponent = shallowRef<Component>()
const authLoadingOverlayComponent = shallowRef<Component>()
const authDialogMode = ref<AuthDialogMode>('login')
const profileMenuPosition = ref({ top: 0, right: 12 })
const navigationElement = ref<HTMLElement>()
const navigationButtons = ref<HTMLButtonElement[]>([])
const navigationPill = ref({ left: 0, width: 0 })
const isNavigationDragging = ref(false)
const draggedNavigationItem = ref<string>()
let navigationDragStartItem: string | undefined
let suppressNavigationClick = false
let navbarScrollFrame: number | undefined
const prefetchedImages = new Set<string>()
const prefetchedRoutes = new Set<string>()
const navbarLinks = computed<readonly NavbarLink[]>(() => {
  if (!resolvedAuthenticated.value) return guestNavbarLinks
  return authenticatedNavbarLinks
})
const authStore = useAuthStore()
const {
  currentUser,
  initialized: authInitialized,
  isAuthenticated,
  loading: authLoading,
} = storeToRefs(authStore)
const resolvedAuthenticated = computed(() => props.authenticated ?? isAuthenticated.value)
const authStateReady = computed(() => props.authenticated !== undefined || authInitialized.value)
const resolvedProfileSrc = computed(
  () =>
    props.profileSrc ?? currentUser.value?.avatarUrl ?? '/images/profile/avatar-placeholder.png',
)
const resolvedUsername = computed(
  () => props.username ?? currentUser.value?.username ?? currentUser.value?.displayName ?? 'User',
)
const resolvedEmail = computed(() => props.email ?? currentUser.value?.email ?? '')
const resolvedWalletBalance = computed(
  () =>
    props.walletBalance ??
    currentUser.value?.walletBalance ??
    (currentUser.value?.walletBalanceSatang !== undefined
      ? currentUser.value.walletBalanceSatang / 100
      : 0),
)
const themeStore = useThemeStore()
const { currentTheme, selectedTheme } = storeToRefs(themeStore)
const { initialize: initializeAdminToolsVisibility } = useAdminToolsVisibility()
const formattedWalletBalance = computed(
  () =>
    `${resolvedWalletBalance.value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} THB`,
)

function setNavigationButtonRef(element: unknown, index: number) {
  if (element instanceof HTMLButtonElement) navigationButtons.value[index] = element
}

function moveNavigationPill(label = selectedItem.value) {
  const index = navbarLinks.value.findIndex((item) => item.label === label)
  const button = navigationButtons.value[index]
  const navigation = navigationElement.value
  if (!button || !navigation) return

  const buttonRect = button.getBoundingClientRect()
  const navigationRect = navigation.getBoundingClientRect()
  navigationPill.value = {
    left: buttonRect.left - navigationRect.left,
    width: buttonRect.width,
  }
}

function previewNavigationItem(label: string) {
  if (isNavigationDragging.value) return
  moveNavigationPill(label)
  const item = navbarLinks.value.find((link) => link.label === label)
  if (item) prefetchNavigationImages(item.path)
}

function prefetchImage(source: string, sourceSet?: string) {
  if (prefetchedImages.has(source)) return
  prefetchedImages.add(source)
  const image = new Image()
  image.decoding = 'async'
  if (sourceSet) image.srcset = sourceSet
  image.src = source
}

function prefetchNavigationImages(path: string) {
  prefetchRoute(path)
  if (path === '/about') {
    prefetchImage('/images/about/anawat-grudtoop-profile-cropped-768.webp')
    prefetchImage('/images/about/anawat-grudtoop-profile-512.webp')
  }
}

function prefetchRoute(path: string) {
  if (prefetchedRoutes.has(path)) return
  prefetchedRoutes.add(path)
  const matched = router.resolve(path).matched
  const component = matched[matched.length - 1]?.components?.default
  if (typeof component === 'function') {
    const loadRoute = component as () => unknown
    void Promise.resolve(loadRoute()).catch(() => prefetchedRoutes.delete(path))
  }
}

function startNavigationDrag(event: PointerEvent, label: string) {
  isNavigationDragging.value = true
  navigationDragStartItem = label
  draggedNavigationItem.value = label
  ;(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId)
  moveNavigationPill(label)
}

function moveNavigationDrag(event: PointerEvent) {
  if (!isNavigationDragging.value || !navigationElement.value) return

  const target = document.elementFromPoint(event.clientX, event.clientY)
  const button = target?.closest<HTMLButtonElement>('[data-navigation-label]')
  if (!button) return

  const label = button.dataset.navigationLabel
  if (!label || label === draggedNavigationItem.value) return
  draggedNavigationItem.value = label
  moveNavigationPill(label)
}

function finishNavigationDrag() {
  if (!isNavigationDragging.value) return
  suppressNavigationClick = draggedNavigationItem.value !== navigationDragStartItem
  if (draggedNavigationItem.value) navigateToItem(draggedNavigationItem.value)
  isNavigationDragging.value = false
  draggedNavigationItem.value = undefined
  navigationDragStartItem = undefined
  moveNavigationPill()
}

function selectNavigationItem(label: string) {
  if (suppressNavigationClick) {
    suppressNavigationClick = false
    return
  }
  navigateToItem(label)
}

function navigateToItem(label: string) {
  const item = navbarLinks.value.find((link) => link.label === label)
  if (!item) return

  if (item.children?.length) {
    openNavigationMenu.value = openNavigationMenu.value === label ? undefined : label
    return
  }

  navigateToPath(item.path, item.label)
}

function navigateToPath(path: string, label: string) {
  openNavigationMenu.value = undefined

  const targetRoute = router.resolve(path)
  if (targetRoute.matched.length === 0) return

  selectedItem.value = label
  if (
    router.currentRoute.value.path !== targetRoute.path ||
    router.currentRoute.value.hash !== targetRoute.hash
  ) {
    void router.push({ path: targetRoute.path, hash: targetRoute.hash, query: localeQuery() })
    return
  }

  scrollToPageTop()
}

function navigateMobileHome() {
  navigateHome()
  closeMobileMenu()
}

function navigateHome() {
  selectedItem.value = 'Home'
  if (router.currentRoute.value.path !== '/') {
    void router.push({ path: '/', query: localeQuery() })
    return
  }

  scrollToPageTop()
}

function localeQuery() {
  return locale.value === 'th' ? { locale: 'th' } : {}
}

function navigationLabel(item: NavbarLink) {
  const keyByLabel: Record<string, string> = {
    Dashboard: 'navigation.dashboard',
    'Top up': 'navigation.topUp',
  }
  const keyByPath: Record<string, string> = {
    '/': 'navigation.home',
    '/work': 'navigation.work',
    '/about': 'navigation.about',
    '/store': 'navigation.store',
    '/my-bot': 'navigation.myBot',
    '/add-credit': 'navigation.addCredit',
  }
  return t(keyByLabel[item.label] ?? keyByPath[item.path] ?? item.label)
}

function scrollToPageTop() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}

function resetNavigationPreview() {
  if (!isNavigationDragging.value) moveNavigationPill()
}

function handleNavigationResize() {
  moveNavigationPill()
}

function updateNavbarScrollState() {
  navbarScrollFrame = undefined
  isAtPageTop.value = window.scrollY <= 16
}

function requestNavbarScrollUpdate() {
  if (navbarScrollFrame !== undefined) return
  navbarScrollFrame = window.requestAnimationFrame(updateNavbarScrollState)
}

function toggleQuickTheme(event: MouseEvent) {
  const target = event.currentTarget as HTMLButtonElement
  const rect = target.getBoundingClientRect()
  const nextTheme: ThemeMode = document.documentElement.dataset.theme === 'dark' ? 'LIGHT' : 'DARK'

  themeStore.setTheme(nextTheme, {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  })
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
}

async function openAuthDialog(mode: AuthDialogMode) {
  closeMobileMenu()
  closeProfileMenu()
  if (!authDialogComponent.value || !authLoadingOverlayComponent.value) {
    const [dialog, overlay] = await Promise.all([
      import('../../ui/dialogs/AppAuthDialog.vue'),
      import('../../ui/dialogs/AppAuthLoadingOverlay.vue'),
    ])
    authDialogComponent.value = markRaw(dialog.default)
    authLoadingOverlayComponent.value = markRaw(overlay.default)
  }
  authDialogMode.value = mode
  isAuthDialogOpen.value = true
}

function toggleProfileMenu(event: MouseEvent) {
  const target = event.currentTarget as HTMLButtonElement

  if (isProfileMenuOpen.value) {
    closeProfileMenu()
    return
  }

  const rect = target.getBoundingClientRect()
  profileMenuPosition.value = {
    top: rect.bottom + 8,
    right: Math.max(12, window.innerWidth - rect.right),
  }
  closeMobileMenu()
  isProfileMenuOpen.value = true
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node
  if (!navigationElement.value?.contains(target) && !mobileMenu.value?.contains(target)) {
    openNavigationMenu.value = undefined
  }
  closeProfileMenu()
}

function selectMobileItem(label: string) {
  const item = navbarLinks.value.find((link) => link.label === label)
  if (item?.children?.length) {
    openNavigationMenu.value = openNavigationMenu.value === label ? undefined : label
    return
  }
  navigateToItem(label)
  closeMobileMenu()
}

function selectNavigationChild(item: NavbarLink, parentLabel: string) {
  navigateToPath(item.path, parentLabel)
  closeMobileMenu()
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMobileMenu()
    closeProfileMenu()
    openNavigationMenu.value = undefined
  }
}

watch([isMobileMenuOpen, isProfileMenuOpen], ([isNavigationOpen, isProfileOpen]) => {
  document.body.style.overflow = isNavigationOpen || isProfileOpen ? 'hidden' : ''
})

watch([selectedItem, navbarLinks], () => {
  void nextTick(() => moveNavigationPill())
})

watch(
  () => props.activeItem,
  (activeItem) => {
    selectedItem.value = activeItem
  },
)

watch(
  () => route.query.locale,
  (value) => {
    const nextLocale = value === 'th' ? 'th' : 'en'
    setAppLocale(nextLocale)
  },
)

watch(
  () => authStore.session,
  async (newSession) => {
    if (newSession && (!currentUser.value || currentUser.value.walletBalanceSatang === undefined)) {
      await authStore.reloadCurrentUser()
    }
  },
  { immediate: true },
)

onMounted(() => {
  initializeAdminToolsVisibility()
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', handleNavigationResize)
  window.addEventListener('scroll', requestNavbarScrollUpdate, { passive: true })
  updateNavbarScrollState()
  void nextTick(() => moveNavigationPill())
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', handleNavigationResize)
  window.removeEventListener('scroll', requestNavbarScrollUpdate)
  if (navbarScrollFrame !== undefined) window.cancelAnimationFrame(navbarScrollFrame)
  document.body.style.overflow = ''
})

const mobileMenu = ref<InstanceType<typeof AppMobileNavigation>>()
function closeProfileMenu() {
  isProfileMenuOpen.value = false
}
</script>
<template>
  <header
    class="navbar"
    :class="{
      'navbar--at-top': isAtPageTop,
      'navbar--scrolled': showScrolledBackground,
    }"
  >
    <div class="desktop-navbar">
      <button
        class="brand"
        type="button"
        aria-label="Fujipp home"
        @pointerenter="prefetchNavigationImages('/')"
        @focus="prefetchNavigationImages('/')"
        @click="navigateHome"
      >
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

      <nav
        ref="navigationElement"
        class="navigation"
        :class="{ 'navigation--dragging': isNavigationDragging }"
        aria-label="Main navigation"
        @pointermove="moveNavigationDrag"
        @pointerup="finishNavigationDrag"
        @pointercancel="finishNavigationDrag"
        @pointerleave="resetNavigationPreview"
      >
        <span
          class="navigation__liquid-pill"
          :style="{
            '--navigation-pill-left': `${navigationPill.left}px`,
            '--navigation-pill-width': `${navigationPill.width}px`,
          }"
          aria-hidden="true"
        />
        <div v-for="(item, index) in navbarLinks" :key="item.path" class="navigation__item">
          <button
            :ref="(element) => setNavigationButtonRef(element, index)"
            type="button"
            class="navigation__link"
            :class="{ 'navigation__link--active': item.label === selectedItem }"
            :data-navigation-label="item.label"
            :aria-current="item.label === selectedItem ? 'page' : undefined"
            :aria-expanded="item.children?.length ? openNavigationMenu === item.label : undefined"
            :aria-haspopup="item.children?.length ? 'menu' : undefined"
            @click="selectNavigationItem(item.label)"
            @pointerenter="previewNavigationItem(item.label)"
            @pointerdown="!item.children?.length && startNavigationDrag($event, item.label)"
          >
            <span>{{ navigationLabel(item) }}</span>
            <AppIcon
              v-if="item.children?.length"
              class="navigation__chevron"
              :class="{ 'navigation__chevron--open': openNavigationMenu === item.label }"
              :source="icons.base.arrowDown"
            />
          </button>
          <Transition name="navigation-menu">
            <div
              v-if="item.children?.length && openNavigationMenu === item.label"
              class="navigation__dropdown"
              role="menu"
            >
              <button
                v-for="child in item.children"
                :key="child.path"
                type="button"
                role="menuitem"
                @click.stop="selectNavigationChild(child, item.label)"
              >
                <AppIcon v-if="child.icon" :source="child.icon" />
                <span>{{ navigationLabel(child) }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </nav>

      <div class="actions" :class="{ 'actions--authenticated': resolvedAuthenticated }">
        <div v-if="!authStateReady" class="auth-loading-placeholder" aria-label="Loading account" />
        <template v-else-if="!resolvedAuthenticated">
          <button
            class="action-button action-button--text"
            type="button"
            @click="openAuthDialog('login')"
          >
            {{ t('navigation.signIn') }}
          </button>
          <button
            class="action-button action-button--outline"
            type="button"
            @click="openAuthDialog('register')"
          >
            <span>{{ t('navigation.signUp') }}</span>
          </button>
        </template>

        <button
          v-else
          class="profile-navbar"
          type="button"
          aria-label="Open profile"
          aria-controls="profile-dialog"
          :aria-expanded="isProfileMenuOpen"
          @click.stop="toggleProfileMenu"
        >
          <span class="profile-navbar__wallet">
            <AppIcon class="profile-navbar__wallet-icon" :source="icons.common.wallet" />
            <span>{{ formattedWalletBalance }}</span>
          </span>
          <span class="profile-navbar__avatar-frame">
            <img class="profile-navbar__avatar" :src="resolvedProfileSrc" alt="" />
          </span>
        </button>

        <button
          class="theme-toggle"
          type="button"
          :aria-label="`Theme: ${selectedTheme.toLowerCase()}`"
          @click="toggleQuickTheme"
        >
          <AppIcon class="theme-toggle__icon" :source="currentTheme.src" />
        </button>
      </div>
    </div>

    <div class="mobile-navbar">
      <div class="mobile-navbar__left">
        <button
          class="mobile-icon-button"
          type="button"
          aria-label="Open navigation"
          :aria-expanded="isMobileMenuOpen"
          aria-controls="mobile-navigation"
          @click="isMobileMenuOpen = true"
        >
          <AppIcon class="mobile-icon mobile-icon--32" :source="icons.base.burger" />
        </button>

        <button class="brand" type="button" aria-label="Fujipp home" @click="navigateHome">
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
      </div>

      <div class="mobile-navbar__actions">
        <span v-if="!authStateReady" class="mobile-auth-loading" aria-label="Loading account" />
        <button
          v-else-if="!resolvedAuthenticated"
          class="mobile-sign-in"
          type="button"
          @click="openAuthDialog('login')"
        >
          {{ t('navigation.signIn') }}
        </button>
        <button
          v-else
          class="mobile-profile"
          type="button"
          aria-label="Open profile"
          aria-controls="profile-dialog"
          :aria-expanded="isProfileMenuOpen"
          @click.stop="toggleProfileMenu"
        >
          <span class="profile-navbar__avatar-frame">
            <img class="profile-navbar__avatar" :src="resolvedProfileSrc" alt="" />
          </span>
        </button>

        <button
          class="theme-toggle"
          type="button"
          :aria-label="`Theme: ${selectedTheme.toLowerCase()}`"
          @click="toggleQuickTheme"
        >
          <AppIcon class="theme-toggle__icon" :source="currentTheme.src" />
        </button>
      </div>
    </div>

    <AppUserMenu
      v-model:open="isProfileMenuOpen"
      :profile-src="resolvedProfileSrc"
      :username="resolvedUsername"
      :email="resolvedEmail"
      :position="profileMenuPosition"
    />
    <Teleport to="body">
      <AppMobileNavigation
        ref="mobileMenu"
        :open="isMobileMenuOpen"
        :links="navbarLinks"
        :selected-item="selectedItem"
        :open-menu="openNavigationMenu"
        :authenticated="resolvedAuthenticated"
        @close="closeMobileMenu"
        @select="selectMobileItem"
        @child="selectNavigationChild"
        @register="openAuthDialog('register')"
        @home="navigateMobileHome"
      />
    </Teleport>

    <component
      :is="authDialogComponent"
      v-if="isAuthDialogOpen && authDialogComponent"
      v-model:open="isAuthDialogOpen"
      v-model:mode="authDialogMode"
    />
    <component
      :is="authLoadingOverlayComponent"
      v-if="authLoading && authLoadingOverlayComponent"
      :open="authLoading"
      :message="resolvedAuthenticated ? t('navigation.signOut') : t('navigation.signIn')"
    />
  </header>
</template>
<style scoped>
.navbar {
  position: sticky;
  z-index: var(--z-sticky);
  isolation: isolate;
  top: 0;
  box-sizing: border-box;
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  background: transparent;
  color: var(--semantic-color-text-text-primary);
}

.navbar::before {
  position: absolute;
  z-index: -1;
  top: 0;
  left: 50%;
  width: 100vw;
  height: 100%;
  border-bottom: 1px solid transparent;
  background: transparent;
  content: '';
  pointer-events: none;
  transform: translateX(-50%);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    backdrop-filter 180ms ease;
}

.navbar--scrolled::before {
  border-color: color-mix(in srgb, var(--semantic-color-border-border-default) 65%, transparent);
  background: color-mix(in srgb, var(--semantic-color-background-bg-default) 86%, transparent);
  box-shadow: var(--effect-shadow-sm);
  backdrop-filter: blur(var(--effect-backdrop-blur-sm)) saturate(1.25);
}

.desktop-navbar {
  display: flex;
  height: 4rem;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding-inline: var(--space-md);
}

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

.navbar--at-top .desktop-navbar > .brand .brand__lockup {
  transform: scale(2.75);
}

@media (prefers-reduced-motion: reduce) {
  .brand__mascot-face {
    animation: none;
  }

  .brand__mascot-face:nth-of-type(2) {
    opacity: 1;
  }

  .navbar::before {
    transition: none;
  }
}

.navigation {
  position: relative;
  isolation: isolate;
  display: flex;
  height: 2.5rem;
  margin-right: clamp(1.5rem, 4vw, 4rem);
  margin-left: auto;
  align-items: center;
  gap: var(--space-md);
  font-family: var(--font-family-display);
  font-size: 1.125rem;
  line-height: var(--line-height-body);
  text-align: center;
}

.navigation__liquid-pill {
  position: absolute;
  z-index: -1;
  top: 0;
  left: 0;
  display: block;
  width: var(--navigation-pill-width);
  height: 100%;
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 60%, transparent);
  border-radius: var(--corner-radius-lg);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 80%, transparent),
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 60%, transparent)
    ),
    transparent;
  box-shadow: var(--effect-glass-highlight), var(--effect-shadow-button);
  pointer-events: none;
  transform: translateX(var(--navigation-pill-left)) scale(1);
  transform-origin: center;
  backdrop-filter: blur(0) saturate(1.5);
  transition:
    width 420ms cubic-bezier(0.22, 1.35, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 1.35, 0.36, 1);
}

.navigation--dragging {
  cursor: grabbing;
  user-select: none;
}

.navigation--dragging .navigation__liquid-pill {
  transform: translateX(var(--navigation-pill-left)) scale(1.08, 0.92);
  transition:
    width 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.navigation__link {
  position: relative;
  display: flex;
  min-width: 3rem;
  height: 100%;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--corner-radius-full);
  padding-inline: var(--space-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: none;
  touch-action: none;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.navigation__item {
  position: relative;
  display: flex;
  height: 100%;
}

.navigation__item:nth-of-type(2) .navigation__link {
  min-width: 5.125rem;
}

.navigation__item:nth-of-type(3) .navigation__link {
  min-width: 3.6875rem;
}

.navigation__chevron {
  width: var(--icon-size-16);
  height: var(--icon-size-16);
  margin-left: var(--space-xxs);
  transition: transform 160ms ease;
}

.navigation__chevron--open {
  transform: rotate(180deg);
}

.navigation__dropdown {
  position: absolute;
  z-index: var(--z-popover);
  top: calc(100% + var(--space-xs));
  left: 50%;
  display: grid;
  width: 12rem;
  gap: var(--space-xxs);
  padding: var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-elevated);
  box-shadow: var(--effect-shadow-lg);
  transform: translateX(-50%);
}

.navigation__dropdown button {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  border: 0;
  border-radius: var(--corner-radius-sm);
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--font-size-label-medium);
  text-align: left;
}

.navigation__dropdown button:hover,
.navigation__dropdown button:focus-visible {
  background: var(--semantic-color-background-bg-surface-hover);
  outline: none;
}

.navigation__dropdown button :deep(.app-icon) {
  width: var(--icon-size-20);
  height: var(--icon-size-20);
}

.navigation__link:hover {
  transform: translateY(-1px);
}

.navigation__link--active {
  border-color: transparent;
  background: transparent;
}

.actions {
  display: flex;
  height: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-md);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-large);
  line-height: var(--line-height-label);
}

.actions--authenticated {
  width: 16rem;
}

.auth-loading-placeholder,
.mobile-auth-loading {
  border-radius: var(--corner-radius-full);
  background: linear-gradient(
    90deg,
    var(--semantic-color-background-bg-surface) 25%,
    var(--semantic-color-background-bg-surface-hover) 50%,
    var(--semantic-color-background-bg-surface) 75%
  );
  background-size: 200% 100%;
  animation: auth-loading-shimmer 1.2s ease-in-out infinite;
}

.auth-loading-placeholder {
  width: 8rem;
  height: var(--icon-size-32);
}

.mobile-auth-loading {
  width: var(--icon-size-32);
  height: var(--icon-size-32);
}

@keyframes auth-loading-shimmer {
  to {
    background-position: -200% 0;
  }
}

.profile-navbar {
  display: flex;
  width: auto;
  max-width: var(--icon-size-32);
  height: var(--icon-size-32);
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  overflow: hidden;
  cursor: pointer;
  border: 0;
  border-radius: var(--corner-radius-full);
  padding: 0;
  background: var(--semantic-color-action-backgrounds-bg-secondary);
  color: var(--semantic-color-action-text-text-on-secondary);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-large);
  line-height: var(--line-height-label);
  transition: max-width 200ms ease;
}

.profile-navbar:hover,
.profile-navbar:focus-visible {
  max-width: 15rem;
}

.profile-navbar__wallet {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xxs);
  padding: 0 var(--space-xxs) 0 var(--space-xs);
  font-weight: var(--typography-font-weight-medium);
  white-space: nowrap;
}

.profile-navbar__wallet-icon {
  display: block;
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  flex-shrink: 0;
}

.profile-navbar__avatar-frame {
  box-sizing: border-box;
  display: grid;
  width: var(--icon-size-32);
  height: var(--icon-size-32);
  flex-shrink: 0;
  overflow: hidden;
  place-items: center;
  border: 1px solid var(--semantic-color-background-bg-inverse);
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-background-bg-surface-active);
}

.profile-navbar__avatar {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.action-button {
  position: relative;
  z-index: 2;
  isolation: isolate;
  display: inline-flex;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: var(--corner-radius-lg);
  cursor: pointer;
  border: 0;
  overflow: hidden;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: var(--typography-font-weight-medium);
  text-decoration: none;
}

.action-button--text {
  padding-inline: 0.625rem;
}

.action-button--text::after {
  position: absolute;
  right: 0.625rem;
  bottom: 0.125rem;
  left: 0.625rem;
  height: 1px;
  background: currentcolor;
  content: '';
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.action-button--text:hover::after,
.action-button--text:focus-visible::after {
  transform: scaleX(1);
}

.action-button--outline {
  width: 6.875rem;
  border: 1px solid var(--semantic-color-background-bg-inverse);
  padding-inline: var(--space-md);
  background: transparent;
  color: var(--semantic-color-text-text-primary);
  transition: color 220ms ease;
}

.action-button--outline::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: var(--semantic-color-background-bg-inverse);
  content: '';
  transform: translateY(102%);
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.action-button--outline span {
  position: relative;
  z-index: 1;
}

.action-button--outline:hover {
  color: var(--semantic-color-text-text-inverse);
}

.action-button--outline:hover::before {
  transform: translateY(0);
}

.theme-toggle {
  display: grid;
  width: var(--icon-size-32);
  height: var(--icon-size-32);
  flex-shrink: 0;
  cursor: pointer;
  place-items: center;
  border: 1px solid var(--semantic-color-border-border-strong);
  border-radius: var(--corner-radius-full);
  background: transparent;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.theme-toggle__icon {
  display: block;
  width: var(--icon-size-16);
  height: var(--icon-size-16);
  transition: transform 260ms cubic-bezier(0.22, 1.35, 0.36, 1);
}

.theme-toggle:hover .theme-toggle__icon {
  transform: rotate(20deg) scale(1.08);
}

.theme-toggle:active {
  transform: scale(0.96);
}

.theme-toggle:active .theme-toggle__icon {
  transform: rotate(-10deg) scale(0.92);
}

.profile-dialog {
  position: fixed;
  z-index: var(--z-popover);
  box-sizing: border-box;
  display: flex;
  width: min(19.5rem, calc(100vw - 1.5rem));
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: 0.75rem;
  padding: var(--space-sm) var(--space-md);
  background: var(--semantic-color-background-bg-default);
  box-shadow: var(--effect-shadow-md);
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-body-small);
  text-align: center;
}

.mobile-navbar {
  display: none;
}

@media (max-width: 63.99rem) {
  .desktop-navbar {
    display: none;
  }

  .mobile-navbar {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-height: 3rem;
    align-items: stretch;
    justify-content: space-between;
    gap: 1.25rem;
    padding: var(--space-xs) var(--space-sm);
  }

  .profile-dialog {
    top: auto !important;
    right: 0 !important;
    bottom: 0;
    width: 100%;
    height: 78dvh;
    max-height: 78dvh;
    overflow-y: auto;
    gap: var(--space-xs);
    border: 0;
    border-radius: 0.75rem 0.75rem 0 0;
    padding: var(--space-sm) var(--space-md);
    box-shadow: var(--effect-shadow-lg);
    transform: translateY(var(--profile-sheet-drag, 0));
    transition:
      height 280ms cubic-bezier(0.22, 1, 0.36, 1),
      max-height 280ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .mobile-navbar__left {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: var(--space-sm);
  }

  .mobile-navbar__actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--space-xs);
  }

  .mobile-navbar .brand__lockup,
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

  .mobile-icon--32 {
    width: var(--icon-size-32);
    height: var(--icon-size-32);
  }

  .mobile-sign-in {
    display: inline-flex;
    height: var(--icon-size-32);
    align-items: center;
    justify-content: center;
    border: 1px solid var(--semantic-color-border-border-strong);
    border-radius: var(--corner-radius-lg);
    padding-inline: var(--space-md);
    background: transparent;
    color: inherit;
    font-family: var(--font-family-sans);
    font-size: var(--font-size-label-large);
    font-weight: var(--typography-font-weight-medium);
    line-height: var(--line-height-label);
  }

  .mobile-profile {
    width: var(--icon-size-32);
    height: var(--icon-size-32);
    flex-shrink: 0;
    overflow: hidden;
    cursor: pointer;
    border: 0;
    border-radius: var(--corner-radius-full);
    padding: 0;
    background: var(--semantic-color-action-backgrounds-bg-secondary);
  }

  .mobile-profile .profile-navbar__avatar-frame {
    width: 100%;
    height: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .navigation__link,
  .navigation__liquid-pill,
  .profile-navbar,
  .action-button--outline,
  .action-button--outline::before,
  .action-button--text::after,
  .theme-toggle,
  .theme-toggle__icon,
  .profile-dialog {
    transition: none;
  }
  .auth-loading-placeholder,
  .mobile-auth-loading {
    animation: none;
  }
}
</style>
