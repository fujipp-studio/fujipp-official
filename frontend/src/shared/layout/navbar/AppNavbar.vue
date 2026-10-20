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
import { Wallet } from 'lucide-vue-next'

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
const brandCollapseScrollY = 100
const brandExpandScrollY = 40
const isAtPageTop = ref(true)
const isMobileMenuOpen = ref(false)
const isProfileMenuOpen = ref(false)
const openNavigationMenu = ref<string>()
const requestedLanguage = ref<'th' | 'en'>()
const activeLanguage = computed(
  () => requestedLanguage.value ?? (locale.value === 'th' ? 'th' : 'en'),
)
let languageVersion = 0
const navigationMenuPosition = ref({ top: 0, left: 0 })
const isAuthDialogOpen = ref(false)
const authDialogComponent = shallowRef<Component>()
const authLoadingOverlayComponent = shallowRef<Component>()
const authDialogMode = ref<AuthDialogMode>('login')
const profileMenuPosition = ref({ top: 0, right: 12 })
const navigationElement = ref<HTMLElement>()
const desktopAvatarFrame = ref<HTMLElement>()
const mobileAvatarFrame = ref<HTMLElement>()
const avatarPosition = ref<{ top: number; left: number; width: number; height: number }>()
let avatarResizeObserver: ResizeObserver | undefined
const navigationMenuElement = ref<HTMLElement>()
const navigationButtons = ref<HTMLButtonElement[]>([])
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
    (currentUser.value?.walletBalanceSatang !== undefined
      ? currentUser.value.walletBalanceSatang / 100
      : (currentUser.value?.walletBalance ?? 0)),
)
const themeStore = useThemeStore()
const { currentTheme, selectedTheme } = storeToRefs(themeStore)
const { initialize: initializeAdminToolsVisibility } = useAdminToolsVisibility()
const walletAmount = computed(() =>
  resolvedWalletBalance.value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
)
const formattedWalletBalance = computed(() => `${walletAmount.value} THB`)

function setNavigationButtonRef(element: unknown, index: number) {
  if (element instanceof HTMLButtonElement) navigationButtons.value[index] = element
}

function previewNavigationItem(label: string) {
  if (isNavigationDragging.value) return
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
}

function moveNavigationDrag(event: PointerEvent) {
  if (!isNavigationDragging.value || !navigationElement.value) return

  const target = document.elementFromPoint(event.clientX, event.clientY)
  const button = target?.closest<HTMLButtonElement>('[data-navigation-label]')
  if (!button) return

  const label = button.dataset.navigationLabel
  if (!label || label === draggedNavigationItem.value) return
  draggedNavigationItem.value = label
}

function finishNavigationDrag() {
  if (!isNavigationDragging.value) return
  suppressNavigationClick = draggedNavigationItem.value !== navigationDragStartItem
  if (draggedNavigationItem.value) navigateToItem(draggedNavigationItem.value)
  isNavigationDragging.value = false
  draggedNavigationItem.value = undefined
  navigationDragStartItem = undefined
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

function handleNavigationResize() {
  updateNavbarScrollState()
}

function updateAvatarPosition() {
  const bounds = [desktopAvatarFrame.value, mobileAvatarFrame.value]
    .map((frame) => frame?.getBoundingClientRect())
    .find((rect) => rect && rect.width > 0 && rect.height > 0)
  if (!bounds) {
    avatarPosition.value = undefined
    return
  }
  const previous = avatarPosition.value
  if (previous && previous.top === bounds.top && previous.left === bounds.left
    && previous.width === bounds.width && previous.height === bounds.height) return
  avatarPosition.value = {
    top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height,
  }
}

function observeAvatarFrames() {
  avatarResizeObserver?.disconnect()
  for (const frame of [desktopAvatarFrame.value, mobileAvatarFrame.value]) {
    if (frame?.parentElement) avatarResizeObserver?.observe(frame.parentElement)
  }
  updateAvatarPosition()
}

function updateNavigationMenuPosition() {
  if (!openNavigationMenu.value) return
  const index = navbarLinks.value.findIndex((item) => item.label === openNavigationMenu.value)
  const button = navigationButtons.value[index]
  if (!button) return
  const rect = button.getBoundingClientRect()
  navigationMenuPosition.value = { top: rect.bottom, left: rect.left + rect.width / 2 }
}

function enterNavigationMenu(event: KeyboardEvent, label: string) {
  if (event.shiftKey || openNavigationMenu.value !== label) return
  const firstItem = navigationMenuElement.value?.querySelector<HTMLButtonElement>('button')
  if (!firstItem) return
  event.preventDefault()
  firstItem.focus()
}

function leaveNavigationMenu(event: KeyboardEvent) {
  const items = navigationMenuElement.value?.querySelectorAll<HTMLButtonElement>('button')
  if (!items?.length) return
  const index = navbarLinks.value.findIndex((item) => item.label === openNavigationMenu.value)
  const trigger = navigationButtons.value[index]
  if (event.shiftKey && event.target === items[0]) {
    event.preventDefault()
    trigger?.focus()
  } else if (!event.shiftKey && event.target === items[items.length - 1]) {
    const nextControl =
      navigationElement.value?.nextElementSibling?.querySelector<HTMLElement>(
        'button:not([disabled])',
      )
    if (nextControl) {
      event.preventDefault()
      openNavigationMenu.value = undefined
      nextControl.focus()
    }
  }
}

function updateNavbarScrollState() {
  navbarScrollFrame = undefined
  const scrollY = window.scrollY
  if (window.innerWidth < 1024) {
    isAtPageTop.value = scrollY <= 16
  } else if (isAtPageTop.value && scrollY >= brandCollapseScrollY) {
    isAtPageTop.value = false
  } else if (!isAtPageTop.value && scrollY <= brandExpandScrollY) {
    isAtPageTop.value = true
  }
  updateNavigationMenuPosition()
  updateAvatarPosition()
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

async function toggleQuickLanguage() {
  const next = activeLanguage.value === 'th' ? 'en' : 'th'
  const version = ++languageVersion
  requestedLanguage.value = next
  try {
    await setAppLocale(next)
    if (version !== languageVersion || locale.value !== next) return
    const query = { ...route.query }
    if (next === 'th') query.locale = 'th'
    else delete query.locale
    await router.replace({ query, hash: route.hash })
  } finally {
    if (version === languageVersion) requestedLanguage.value = undefined
  }
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
    if (navigationMenuElement.value?.contains(document.activeElement)) {
      const index = navbarLinks.value.findIndex((item) => item.label === openNavigationMenu.value)
      navigationButtons.value[index]?.focus()
    }
    closeMobileMenu()
    closeProfileMenu()
    openNavigationMenu.value = undefined
  }
}

watch([isMobileMenuOpen, isProfileMenuOpen], ([isNavigationOpen, isProfileOpen]) => {
  document.body.style.overflow = isNavigationOpen || isProfileOpen ? 'hidden' : ''
})

watch(openNavigationMenu, () => {
  void nextTick(updateNavigationMenuPosition)
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

watch([resolvedAuthenticated, authStateReady, walletAmount, activeLanguage], () => {
  void nextTick(updateAvatarPosition)
})

watch([desktopAvatarFrame, mobileAvatarFrame], observeAvatarFrames, { flush: 'post' })

onMounted(() => {
  initializeAdminToolsVisibility()
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', handleNavigationResize)
  window.addEventListener('scroll', requestNavbarScrollUpdate, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    avatarResizeObserver = new ResizeObserver(updateAvatarPosition)
  }
  observeAvatarFrames()
  updateNavbarScrollState()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', handleNavigationResize)
  window.removeEventListener('scroll', requestNavbarScrollUpdate)
  if (navbarScrollFrame !== undefined) window.cancelAnimationFrame(navbarScrollFrame)
  avatarResizeObserver?.disconnect()
  document.body.style.overflow = ''
})

const mobileMenu = ref<InstanceType<typeof AppMobileNavigation>>()
function closeProfileMenu() {
  isProfileMenuOpen.value = false
}
</script>
<template>
  <header class="navbar" :class="{ 'navbar--at-top': isAtPageTop }">
    <div class="desktop-navbar">
      <button
        class="brand"
        type="button"
        aria-label="Fujipp home"
        @pointerenter="prefetchNavigationImages('/')"
        @focus="prefetchNavigationImages('/')"
        @click="navigateHome"
      >
        <span class="brand__desktop-visual">
          <svg class="brand__lockup brand__lockup--desktop" viewBox="0 0 140 32" aria-hidden="true">
            <path
              d="M203 338L338 203H283C238.817 203 203 238.817 203 283V338ZM0 189V540L135 405V270C135 195.442 195.442 135 270 135H405L540 0H189C84.6182 0 0 84.6182 0 189ZM0 540H337C411.558 540 472 479.558 472 405H135L0 540ZM203 338H404.5C479.058 338 539.5 277.558 539.5 203H338L203 338ZM405 135H473C547.558 135 608 74.5584 608 0H540L405 135Z"
              transform="translate(0 1.79) scale(0.05263158)"
              fill="currentColor"
            />
            <text x="40" y="23" fill="currentColor">FUJIPP</text>
          </svg>
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
      >
        <div v-for="(item, index) in navbarLinks" :key="item.path" class="navigation__item">
          <button
            :ref="(element) => setNavigationButtonRef(element, index)"
            type="button"
            class="navigation__link"
            :data-navigation-label="item.label"
            :aria-current="item.label === selectedItem ? 'page' : undefined"
            :aria-expanded="item.children?.length ? openNavigationMenu === item.label : undefined"
            :aria-haspopup="item.children?.length ? 'menu' : undefined"
            @click="selectNavigationItem(item.label)"
            @keydown.tab="enterNavigationMenu($event, item.label)"
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
          <Teleport to="body">
            <Transition name="navigation-menu">
              <div
                v-if="item.children?.length && openNavigationMenu === item.label"
                :ref="(element) => (navigationMenuElement = element as HTMLElement | undefined)"
                class="navigation__dropdown"
                :style="{
                  top: `${navigationMenuPosition.top}px`,
                  left: `${navigationMenuPosition.left}px`,
                }"
                role="menu"
                @click.stop
                @keydown.tab="leaveNavigationMenu"
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
          </Teleport>
        </div>
      </nav>

      <div class="actions">
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
            class="action-button action-button--filled"
            type="button"
            @click="openAuthDialog('register')"
          >
            <span>{{ t('navigation.signUp') }}</span>
          </button>
        </template>

        <button
          v-else
          class="profile-navbar"
          :title="formattedWalletBalance"
          type="button"
          aria-label="Open profile"
          aria-controls="profile-dialog"
          :aria-expanded="isProfileMenuOpen"
          @click.stop="toggleProfileMenu"
        >
          <span ref="desktopAvatarFrame" class="profile-navbar__avatar-frame" aria-hidden="true" />
          <span class="profile-navbar__wallet">
            <Wallet class="profile-navbar__wallet-icon" :size="16" aria-hidden="true" />
            <span class="profile-navbar__amount">{{ formattedWalletBalance }}</span>
          </span>
        </button>

        <button
          class="theme-toggle language-toggle"
          type="button"
          :aria-label="
            activeLanguage === 'th' ? 'Switch language to English' : 'Switch language to Thai'
          "
          @click="toggleQuickLanguage"
        >
          {{ activeLanguage.toUpperCase() }}
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
            <AppIcon class="brand__mark" :source="icons.brand.mark" />
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
          class="profile-navbar mobile-profile"
          type="button"
          :title="formattedWalletBalance"
          aria-label="Open profile"
          aria-controls="profile-dialog"
          :aria-expanded="isProfileMenuOpen"
          @click.stop="toggleProfileMenu"
        >
          <span ref="mobileAvatarFrame" class="profile-navbar__avatar-frame" aria-hidden="true" />
          <span class="profile-navbar__wallet">
            <span class="profile-navbar__amount">฿{{ walletAmount }}</span>
          </span>
        </button>

        <button
          class="theme-toggle language-toggle"
          type="button"
          :aria-label="
            activeLanguage === 'th' ? 'Switch language to English' : 'Switch language to Thai'
          "
          @click="toggleQuickLanguage"
        >
          {{ activeLanguage.toUpperCase() }}
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

    <!-- A normal blend mode cannot undo an ancestor's difference compositing. -->
    <Teleport to="body">
      <img
        v-if="authStateReady && resolvedAuthenticated && avatarPosition"
        class="profile-navbar__avatar"
        :src="resolvedProfileSrc"
        :style="{
          top: `${avatarPosition.top}px`,
          left: `${avatarPosition.left}px`,
          width: `${avatarPosition.width}px`,
          height: `${avatarPosition.height}px`,
        }"
        alt=""
        aria-hidden="true"
      />
    </Teleport>

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
  /* Blend the whole bar with the page, just like the section indicator. */
  mix-blend-mode: difference;
  top: 0;
  box-sizing: border-box;
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  background: transparent;
  color: var(--semantic-color-text-text-blend-source);
}

.desktop-navbar {
  display: flex;
  height: 4rem;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding-inline: var(--space-md);
}

.navbar :focus-visible {
  outline-color: var(--semantic-color-text-text-blend-source);
}

.desktop-navbar > .brand {
  --brand-expanded-lockup-width: 24.0625rem;
  --brand-expanded-scale: 2.75;

  align-self: flex-start;
  align-items: flex-start;
  width: 8.75rem;
  height: var(--brand-lockup-height);
  margin-top: var(--space-md);
}

.brand {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  border: 0;
  background: transparent;
  color: inherit;
}

.brand__lockup {
  display: flex;
  width: auto;
  height: var(--brand-lockup-height);
  align-items: center;
  gap: var(--space-xs);
}

.brand__desktop-visual {
  display: block;
  flex-shrink: 0;
  width: 8.75rem;
  height: var(--brand-lockup-height);
  transform-origin: top left;
  transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.desktop-navbar > .brand .brand__lockup--desktop {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.brand__lockup--desktop text {
  font-family: var(--font-family-brand);
  font-size: 20px;
  letter-spacing: 0.8px;
}

.brand__mark {
  width: var(--brand-logo-size);
  height: var(--brand-logo-size);
  color: inherit;
}

.brand__wordmark {
  font-family: var(--font-family-brand);
  font-size: 1.25rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.04em;
}

.navbar--at-top .desktop-navbar > .brand {
  width: var(--brand-expanded-lockup-width);
  height: calc(var(--brand-lockup-height) * var(--brand-expanded-scale));
}

.navbar--at-top .brand__desktop-visual {
  transform: scale(var(--brand-expanded-scale));
}

@media (min-width: 64rem) and (max-width: 79.99rem) {
  .desktop-navbar {
    gap: var(--space-sm);
  }

  .desktop-navbar .navigation {
    gap: var(--space-xs);
    margin-right: var(--space-xs);
  }

  .desktop-navbar .navigation__link {
    padding-inline: var(--space-xs);
  }

  .desktop-navbar > .brand {
    --brand-expanded-lockup-width: 19.6875rem;
    --brand-expanded-scale: 2.25;
  }
}

.navigation {
  position: relative;
  isolation: isolate;
  display: flex;
  height: 2.5rem;
  margin-right: var(--space-md);
  margin-left: auto;
  align-items: center;
  gap: var(--space-md);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-large);
  line-height: var(--line-height-body);
  text-align: center;
}

.navigation--dragging {
  cursor: grabbing;
  user-select: none;
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
  white-space: nowrap;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease,
    color 160ms ease;
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
  position: fixed;
  z-index: var(--z-popover);
  margin-top: var(--space-xs);
  display: grid;
  width: 12rem;
  gap: var(--space-xxs);
  padding: var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-elevated);
  color: var(--semantic-color-text-text-primary);
  box-shadow: var(--effect-shadow-lg);
  font-family: var(--font-family-sans);
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

.actions {
  display: flex;
  height: 2.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-large);
  line-height: var(--line-height-body);
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
  position: relative;
  isolation: isolate;
  display: flex;
  width: auto;
  height: 2.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid color-mix(in srgb, currentcolor 35%, transparent);
  border-radius: var(--corner-radius-full);
  padding: calc(var(--space-xxs) - 1px) var(--space-sm) calc(var(--space-xxs) - 1px)
    calc(var(--space-xxs) - 1px);
  background: color-mix(in srgb, currentcolor 5%, transparent);
  color: inherit;
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-medium);
  line-height: var(--line-height-label);
  transition:
    background-color 180ms ease,
    border-color 180ms ease;
}

.profile-navbar:hover,
.profile-navbar:focus-visible,
.profile-navbar[aria-expanded='true'] {
  border-color: color-mix(in srgb, currentcolor 65%, transparent);
  background: color-mix(in srgb, currentcolor 12%, transparent);
}

.profile-navbar__wallet {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-xs);
  font-weight: var(--typography-font-weight-semibold);
  white-space: nowrap;
}
.profile-navbar__amount {
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
.profile-navbar__wallet-icon {
  display: block;
  width: var(--icon-size-16);
  height: var(--icon-size-16);
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
  border: 0;
  border-radius: var(--corner-radius-full);
  background: transparent;
}

.profile-navbar__avatar {
  position: fixed;
  z-index: var(--z-sticky);
  display: block;
  border-radius: var(--corner-radius-full);
  object-fit: cover;
  object-position: center;
  pointer-events: none;
}

.action-button {
  position: relative;
  z-index: 2;
  isolation: isolate;
  display: inline-flex;
  height: calc(var(--icon-size-32) + var(--space-xxs));
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--corner-radius-md) + var(--corner-radius-sm));
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
  transform-origin: right;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.action-button--text:hover::after,
.action-button--text:focus-visible::after {
  transform: scaleX(1);
  transform-origin: left;
}

.action-button--filled {
  width: auto;
  border: 1px solid var(--semantic-color-text-text-blend-source);
  padding-inline: var(--space-md);
  background: var(--semantic-color-text-text-blend-source);
  color: var(--semantic-color-text-text-blend-cutout);
  white-space: nowrap;
}

.action-button--filled::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  border-radius: inherit;
  background: var(--semantic-color-text-text-blend-cutout);
  content: '';
  transform: translateY(102%);
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.action-button--filled span {
  position: relative;
  z-index: 1;
  color: var(--semantic-color-text-text-blend-source);
  mix-blend-mode: difference;
}

.action-button--filled:hover::before,
.action-button--filled:focus-visible::before {
  transform: translateY(0);
}

.theme-toggle {
  display: grid;
  width: var(--icon-size-32);
  height: var(--icon-size-32);
  flex-shrink: 0;
  cursor: pointer;
  place-items: center;
  border: 1px solid color-mix(in srgb, currentcolor 20%, transparent);
  border-radius: var(--corner-radius-full);
  background: transparent;
  color: inherit;
  transition:
    border-color 180ms ease,
    background-color 180ms ease;
}

.theme-toggle__icon {
  display: block;
  width: var(--icon-size-16);
  height: var(--icon-size-16);
}

.language-toggle {
  margin-inline-start: var(--space-xs);
  padding: 0;
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-medium);
  line-height: var(--line-height-label);
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  border-color: color-mix(in srgb, currentcolor 40%, transparent);
  background: color-mix(in srgb, currentcolor 8%, transparent);
}

.theme-toggle:active {
  background: color-mix(in srgb, currentcolor 12%, transparent);
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
    gap: var(--space-xs);
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
    gap: var(--space-xs);
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
    color: inherit;
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
    border: 1px solid color-mix(in srgb, currentcolor 20%, transparent);
    border-radius: calc(var(--corner-radius-md) + var(--corner-radius-sm));
    padding-inline: var(--space-md);
    background: transparent;
    color: inherit;
    font-family: var(--font-family-sans);
    font-size: var(--font-size-label-medium);
    font-weight: var(--typography-font-weight-medium);
    line-height: var(--line-height-label);
  }

  .mobile-profile {
    height: var(--icon-size-32);
    gap: var(--space-xxs);
    padding: calc(var(--space-xxs) - 1px) var(--space-xs) calc(var(--space-xxs) - 1px)
      calc(var(--space-xxs) - 1px);
    font-size: var(--font-size-label-small);
  }

  .mobile-profile .profile-navbar__avatar-frame {
    width: var(--icon-size-24);
    height: var(--icon-size-24);
  }
}

@media (max-width: 39.99rem) {
  .mobile-navbar .brand__wordmark {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .brand__lockup,
  .brand__desktop-visual,
  .brand__mark,
  .brand__wordmark,
  .navigation__link,
  .profile-navbar,
  .profile-navbar__wallet,
  .action-button--filled,
  .action-button--filled::before,
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
