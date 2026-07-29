<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import { authenticatedNavbarLinks, guestNavbarLinks, icons, ThemeApp } from '../../../config'
import type { NavbarLink } from '../../../config'
import type { ThemeMode } from '../../../config/theme'
import { useAuthStore, useThemeStore } from '../../../stores'
import { AppAuthDialog, AppButton } from '../../ui'
import type { AuthDialogMode } from '../../ui'

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
const isMobileMenuOpen = ref(false)
const isProfileMenuOpen = ref(false)
const isAuthDialogOpen = ref(false)
const authDialogMode = ref<AuthDialogMode>('login')
const selectedLanguage = ref<'TH' | 'EN'>('TH')
const profileMenuPosition = ref({ top: 0, right: 12 })
const profileSheetDrag = ref(0)
const isProfileSheetDragging = ref(false)
const isProfileSheetExpanded = ref(false)
const navigationElement = ref<HTMLElement>()
const navigationButtons = ref<HTMLButtonElement[]>([])
const navigationPill = ref({ left: 0, width: 0 })
const isNavigationDragging = ref(false)
const draggedNavigationItem = ref<string>()
let navigationDragStartItem: string | undefined
let suppressNavigationClick = false
let profileSheetPointerId: number | undefined
let profileSheetStartY = 0
const navbarLinks = computed<readonly NavbarLink[]>(() =>
  resolvedAuthenticated.value ? authenticatedNavbarLinks : guestNavbarLinks,
)
const authStore = useAuthStore()
const { currentUser, isAuthenticated } = storeToRefs(authStore)
const resolvedAuthenticated = computed(() => props.authenticated ?? isAuthenticated.value)
const resolvedProfileSrc = computed(
  () =>
    props.profileSrc ??
    currentUser.value?.avatarUrl ??
    '/images/profile/avatar-placeholder.png',
)
const resolvedUsername = computed(
  () => props.username ?? currentUser.value?.username ?? currentUser.value?.displayName ?? 'User',
)
const resolvedEmail = computed(() => props.email ?? currentUser.value?.email ?? '')
const resolvedWalletBalance = computed(() => props.walletBalance ?? 0)
const themeStore = useThemeStore()
const { currentTheme, isDarkTheme, selectedTheme } = storeToRefs(themeStore)
const brandLockup = computed(() =>
  isDarkTheme.value ? icons.brand.lockupDark : icons.brand.lockup,
)
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
  if (draggedNavigationItem.value) selectedItem.value = draggedNavigationItem.value
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
  selectedItem.value = label
}

function resetNavigationPreview() {
  if (!isNavigationDragging.value) moveNavigationPill()
}

function handleNavigationResize() {
  moveNavigationPill()
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

function openAuthDialog(mode: AuthDialogMode) {
  closeMobileMenu()
  closeProfileMenu()
  authDialogMode.value = mode
  isAuthDialogOpen.value = true
}

function closeProfileMenu() {
  isProfileMenuOpen.value = false
  profileSheetDrag.value = 0
  isProfileSheetDragging.value = false
  isProfileSheetExpanded.value = false
  profileSheetPointerId = undefined
}

async function signOut() {
  closeProfileMenu()
  await authStore.signOut()
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

function selectTheme(mode: ThemeMode, event: MouseEvent) {
  const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
  themeStore.setTheme(mode, {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  })
}

function startProfileSheetDrag(event: PointerEvent) {
  if (!window.matchMedia('(max-width: 47.99rem)').matches) return

  profileSheetPointerId = event.pointerId
  profileSheetStartY = event.clientY
  profileSheetDrag.value = 0
  isProfileSheetDragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveProfileSheetDrag(event: PointerEvent) {
  if (!isProfileSheetDragging.value || event.pointerId !== profileSheetPointerId) return
  const distance = event.clientY - profileSheetStartY

  if (distance <= -48) {
    isProfileSheetExpanded.value = true
    profileSheetDrag.value = 0
    return
  }

  if (isProfileSheetExpanded.value) {
    if (distance >= 48) {
      isProfileSheetExpanded.value = false
      profileSheetStartY = event.clientY
    }
    return
  }

  profileSheetDrag.value = Math.max(0, distance)
}

function finishProfileSheetDrag(event: PointerEvent) {
  if (!isProfileSheetDragging.value || event.pointerId !== profileSheetPointerId) return

  const shouldClose = profileSheetDrag.value >= 96
  isProfileSheetDragging.value = false
  profileSheetPointerId = undefined

  if (shouldClose) {
    closeProfileMenu()
    return
  }

  profileSheetDrag.value = 0
}

function handleDocumentClick() {
  closeProfileMenu()
}

function selectMobileItem(label: string) {
  selectedItem.value = label
  closeMobileMenu()
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMobileMenu()
    closeProfileMenu()
  }
}

watch([isMobileMenuOpen, isProfileMenuOpen], ([isNavigationOpen, isProfileOpen]) => {
  document.body.style.overflow = isNavigationOpen || isProfileOpen ? 'hidden' : ''
})

watch([selectedItem, navbarLinks], () => {
  void nextTick(() => moveNavigationPill())
})

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', handleNavigationResize)
  void nextTick(() => moveNavigationPill())
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', handleNavigationResize)
  document.body.style.overflow = ''
})
</script>

<template>
  <header class="navbar">
    <div class="desktop-navbar">
      <button class="brand" type="button" aria-label="Fujipp home">
        <img class="brand__lockup" :src="brandLockup" alt="Fujipp" />
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
        <button
          v-for="(item, index) in navbarLinks"
          :key="item.path"
          :ref="(element) => setNavigationButtonRef(element, index)"
          type="button"
          class="navigation__link"
          :class="{ 'navigation__link--active': item.label === selectedItem }"
          :data-navigation-label="item.label"
          :aria-current="item.label === selectedItem ? 'page' : undefined"
          @click="selectNavigationItem(item.label)"
          @pointerenter="previewNavigationItem(item.label)"
          @pointerdown="startNavigationDrag($event, item.label)"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="actions" :class="{ 'actions--authenticated': resolvedAuthenticated }">
        <template v-if="!resolvedAuthenticated">
          <button
            class="action-button action-button--text"
            type="button"
            @click="openAuthDialog('login')"
          >
            Sign in
          </button>
          <button
            class="action-button action-button--outline"
            type="button"
            @click="openAuthDialog('register')"
          >
            <span>Sign up</span>
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
            <span
              class="profile-navbar__wallet-icon"
              :style="{ '--profile-icon': `url(${icons.common.wallet})` }"
              aria-hidden="true"
            />
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
          <span
            class="theme-toggle__icon"
            :style="{ '--theme-icon': `url(${currentTheme.src})` }"
            aria-hidden="true"
          />
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
          <span
            class="mobile-icon mobile-icon--32"
            :style="{ '--mobile-icon': `url(${icons.base.burger})` }"
            aria-hidden="true"
          />
        </button>

        <button class="brand" type="button" aria-label="Fujipp home">
          <img class="brand__lockup" :src="brandLockup" alt="Fujipp" />
        </button>
      </div>

      <div class="mobile-navbar__actions">
        <button
          v-if="!resolvedAuthenticated"
          class="mobile-sign-in"
          type="button"
          @click="openAuthDialog('login')"
        >
          Sign in
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
          <span
            class="theme-toggle__icon"
            :style="{ '--theme-icon': `url(${currentTheme.src})` }"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="profile-backdrop">
        <button
          v-if="isProfileMenuOpen"
          class="profile-dialog-backdrop"
          type="button"
          aria-label="Close user settings"
          @click="closeProfileMenu"
        />
      </Transition>

      <Transition name="profile-dialog">
        <aside
          v-if="isProfileMenuOpen"
          id="profile-dialog"
          class="profile-dialog"
          :class="{
            'profile-dialog--dragging': isProfileSheetDragging,
            'profile-dialog--expanded': isProfileSheetExpanded,
          }"
          :style="{
            top: `${profileMenuPosition.top}px`,
            right: `${profileMenuPosition.right}px`,
            '--profile-sheet-drag': `${profileSheetDrag}px`,
          }"
          aria-label="User settings"
          @click.stop
        >
          <div
            class="profile-dialog__mobile-header"
            @pointerdown="startProfileSheetDrag"
            @pointermove="moveProfileSheetDrag"
            @pointerup="finishProfileSheetDrag"
            @pointercancel="finishProfileSheetDrag"
          >
          <span class="profile-dialog__indicator" aria-hidden="true" />
          <div class="profile-dialog__title-row">
            <span class="profile-dialog__title-spacer" aria-hidden="true" />
            <strong>Setting</strong>
            <button
              class="mobile-icon-button"
              type="button"
              aria-label="Close user settings"
              @click="closeProfileMenu"
            >
              <span
                class="mobile-icon mobile-icon--32"
                :style="{ '--mobile-icon': `url(${icons.base.close})` }"
                aria-hidden="true"
              />
            </button>
          </div>
          </div>

          <div class="profile-dialog__user">
          <span class="profile-navbar__avatar-frame">
            <img class="profile-navbar__avatar" :src="resolvedProfileSrc" alt="" />
          </span>
          <span class="profile-dialog__identity">
            <span class="profile-dialog__username">{{ resolvedUsername }}</span>
            <span class="profile-dialog__email">{{ resolvedEmail }}</span>
          </span>
          </div>

          <div class="profile-dialog__divider" />

          <div class="profile-dialog__row">
          <span class="profile-dialog__label">Theme</span>
          <div class="profile-dialog__options" aria-label="Theme">
            <button
              v-for="theme in ThemeApp"
              :key="theme.mode"
              class="profile-dialog__icon-button"
              :class="{ 'profile-dialog__icon-button--active': selectedTheme === theme.mode }"
              type="button"
              :aria-label="`${theme.mode.toLowerCase()} theme`"
              :aria-pressed="selectedTheme === theme.mode"
              @click="selectTheme(theme.mode, $event)"
            >
              <span
                class="profile-dialog__theme-icon"
                :style="{ '--dialog-icon': `url(${theme.src})` }"
                aria-hidden="true"
              />
            </button>
          </div>
          </div>

          <div class="profile-dialog__row">
          <span class="profile-dialog__label">Language</span>
          <div class="profile-dialog__options" aria-label="Language">
            <button
              class="profile-dialog__language-button"
              :class="{ 'profile-dialog__icon-button--active': selectedLanguage === 'TH' }"
              type="button"
              aria-label="Thai"
              :aria-pressed="selectedLanguage === 'TH'"
              @click="selectedLanguage = 'TH'"
            >
              <img :src="icons.language.thai" alt="" />
            </button>
            <button
              class="profile-dialog__language-button"
              :class="{ 'profile-dialog__icon-button--active': selectedLanguage === 'EN' }"
              type="button"
              aria-label="English"
              :aria-pressed="selectedLanguage === 'EN'"
              @click="selectedLanguage = 'EN'"
            >
              <img :src="icons.language.english" alt="" />
            </button>
          </div>
          </div>

          <button class="profile-dialog__row profile-dialog__manage" type="button">
          <span class="profile-dialog__label">Manage Account</span>
          <span
            class="profile-dialog__arrow"
            :style="{ '--dialog-icon': `url(${icons.base.arrowRight})` }"
            aria-hidden="true"
          />
          </button>

          <AppButton variant="secondary" @click="signOut">Sign out</AppButton>
        </aside>
      </Transition>

      <Transition name="mobile-navigation" :duration="{ enter: 300, leave: 180 }">
        <div v-if="isMobileMenuOpen" class="mobile-menu-layer">
          <button
            class="mobile-menu-backdrop"
            type="button"
            aria-label="Close navigation"
            @click="closeMobileMenu"
          />

          <aside
            id="mobile-navigation"
            class="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
          <div class="mobile-menu__header">
            <button class="brand" type="button" aria-label="Fujipp home">
              <img class="brand__lockup" :src="brandLockup" alt="Fujipp" />
            </button>

            <button
              class="mobile-icon-button"
              type="button"
              aria-label="Close navigation"
              @click="closeMobileMenu"
            >
              <span
                class="mobile-icon mobile-icon--32"
                :style="{ '--mobile-icon': `url(${icons.base.close})` }"
                aria-hidden="true"
              />
            </button>
          </div>

          <nav class="mobile-menu__navigation" aria-label="Mobile main navigation">
            <button
              v-for="item in navbarLinks"
              :key="item.path"
              type="button"
              class="mobile-menu__row"
              :aria-current="item.label === selectedItem ? 'page' : undefined"
              @click="selectMobileItem(item.label)"
            >
              <span class="mobile-menu__row-label">
                <span
                  v-if="item.icon"
                  class="mobile-icon mobile-icon--24"
                  :style="{ '--mobile-icon': `url(${item.icon})` }"
                  aria-hidden="true"
                />
                <span>{{ item.label }}</span>
              </span>

              <span
                class="mobile-icon mobile-icon--16"
                :style="{ '--mobile-icon': `url(${icons.base.arrowRight})` }"
                aria-hidden="true"
              />
            </button>
          </nav>

            <AppButton
              v-if="!resolvedAuthenticated"
              variant="secondary"
              @click="openAuthDialog('register')"
            >
              Sign up
            </AppButton>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <AppAuthDialog
      v-model:open="isAuthDialogOpen"
      v-model:mode="authDialogMode"
    />
  </header>
</template>

<style scoped>
.navbar {
  box-sizing: border-box;
  width: 100%;
  max-width: 80rem;
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
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
  width: var(--brand-lockup-width);
  height: var(--brand-lockup-height);
}

.navigation {
  position: relative;
  isolation: isolate;
  display: flex;
  height: 2rem;
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
  width: var(--navigation-pill-width);
  height: 100%;
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 55%, transparent);
  border-radius: var(--corner-radius-full);
  background:
    radial-gradient(
      circle at 28% 18%,
      color-mix(in srgb, var(--semantic-color-background-bg-default) 90%, transparent),
      transparent 38%
    ),
    color-mix(in srgb, var(--semantic-color-background-bg-glass) 72%, transparent);
  box-shadow:
    inset 0 1px 1px color-mix(in srgb, var(--global-color-white-100) 75%, transparent),
    inset 0 -1px 1px color-mix(in srgb, var(--semantic-color-text-text-primary) 12%, transparent),
    var(--effect-shadow-sm);
  pointer-events: none;
  transform: translateX(var(--navigation-pill-left)) scale(1);
  transform-origin: center;
  backdrop-filter: blur(var(--effect-backdrop-blur-sm)) saturate(1.35);
  transition:
    width 360ms cubic-bezier(0.22, 1.35, 0.36, 1),
    transform 360ms cubic-bezier(0.22, 1.35, 0.36, 1);
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
  border: 0;
  border-radius: var(--corner-radius-full);
  padding-inline: var(--space-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: none;
  touch-action: none;
  transition:
    color 160ms ease,
    transform 160ms ease;
}

.navigation__link:nth-child(2) {
  min-width: 5.125rem;
}

.navigation__link:nth-child(3) {
  min-width: 3.6875rem;
}

.navigation__link:hover {
  transform: translateY(-1px);
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

.profile-navbar {
  display: flex;
  width: var(--icon-size-32);
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
  transition: width 200ms ease;
}

.profile-navbar:hover,
.profile-navbar:focus-visible {
  width: 13rem;
}

.profile-navbar__wallet {
  display: flex;
  min-width: 11rem;
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
  background-color: currentcolor;
  mask: var(--profile-icon) center / contain no-repeat;
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
  background: var(--global-color-brand-primary-600);
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
  background-color: var(--semantic-color-text-text-primary);
  mask: var(--theme-icon) center / contain no-repeat;
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

.profile-dialog-backdrop,
.profile-dialog__mobile-header {
  display: none;
}

.profile-backdrop-enter-active,
.profile-backdrop-leave-active {
  transition: opacity 220ms ease;
}

.profile-backdrop-enter-from,
.profile-backdrop-leave-to {
  opacity: 0;
}

.profile-dialog__user {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  text-align: left;
}

.profile-dialog__identity {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xxs);
}

.profile-dialog__username,
.profile-dialog__email {
  max-width: 14rem;
  overflow: hidden;
  line-height: var(--line-height-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-dialog__username {
  font-size: var(--font-size-body-medium);
}

.profile-dialog__email {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
}

.profile-dialog__divider {
  height: 1px;
  background: var(--semantic-color-border-border-strong);
}

.profile-dialog__row {
  display: flex;
  width: 100%;
  height: var(--icon-size-32);
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
}

.profile-dialog__label {
  line-height: var(--line-height-label);
  font-weight: var(--typography-font-weight-medium);
}

.profile-dialog__options {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xxs);
}

.profile-dialog__icon-button,
.profile-dialog__language-button {
  display: grid;
  width: var(--icon-size-32);
  height: var(--icon-size-32);
  cursor: pointer;
  place-items: center;
  border: 0;
  border-radius: var(--corner-radius-sm);
  padding: var(--space-xxs);
  background: transparent;
}

.profile-dialog__icon-button:hover,
.profile-dialog__language-button:hover,
.profile-dialog__icon-button--active {
  background: var(--semantic-color-background-bg-surface-hover);
  box-shadow: var(--effect-shadow-sm);
}

.profile-dialog__theme-icon,
.profile-dialog__arrow {
  display: block;
  background-color: var(--semantic-color-text-text-primary);
  mask: var(--dialog-icon) center / contain no-repeat;
}

.profile-dialog__theme-icon,
.profile-dialog__language-button img {
  width: var(--icon-size-24);
  height: var(--icon-size-24);
}

.profile-dialog__language-button img {
  display: block;
  object-fit: contain;
}

.profile-dialog__manage {
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

.profile-dialog__manage:hover {
  color: var(--semantic-color-text-text-accent);
}

.profile-dialog__arrow {
  width: var(--icon-size-16);
  height: var(--icon-size-16);
  background-color: currentcolor;
}

.mobile-navbar,
.mobile-menu-layer {
  display: none;
}

@media (max-width: 47.99rem) {
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

  .profile-dialog-backdrop {
    position: fixed;
    z-index: calc(var(--z-popover) - 1);
    inset: 0;
    display: block;
    width: 100%;
    border: 0;
    padding: 0;
    background: var(--global-color-black-10);
    backdrop-filter: blur(var(--effect-backdrop-blur-sm));
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

  .profile-dialog--expanded {
    height: 88dvh;
    max-height: 88dvh;
  }

  .profile-dialog--dragging {
    transition: none;
  }

  .profile-dialog-enter-active,
  .profile-dialog-leave-active {
    transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .profile-dialog-enter-from,
  .profile-dialog-leave-to {
    transform: translateY(100%);
  }

  .profile-dialog__mobile-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-xxs);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .profile-dialog__mobile-header:active {
    cursor: grabbing;
  }

  .profile-dialog__indicator {
    width: 1.5rem;
    height: 0.25rem;
    align-self: center;
    border-radius: var(--corner-radius-full);
    background: var(--semantic-color-text-text-primary);
  }

  .profile-dialog__title-row {
    display: grid;
    height: var(--icon-size-32);
    grid-template-columns: var(--icon-size-32) 1fr var(--icon-size-32);
    align-items: center;
    font-family: var(--font-family-display);
    font-size: 1.125rem;
    line-height: 1.2;
  }

  .profile-dialog__title-row strong {
    font-weight: var(--typography-font-weight-semibold);
  }

  .profile-dialog__title-spacer {
    width: var(--icon-size-32);
    height: var(--icon-size-32);
  }

  .profile-dialog__user {
    flex-direction: column;
    justify-content: center;
    border-radius: 0.75rem;
    padding: var(--space-xs) var(--space-sm);
    text-align: center;
  }

  .profile-dialog__identity {
    align-items: center;
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
    width: var(--brand-lockup-width);
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
    background-color: currentcolor;
    mask: var(--mobile-icon) center / contain no-repeat;
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
    background: var(--global-color-black-10);
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
  .profile-dialog,
  .profile-dialog-enter-active,
  .profile-dialog-leave-active,
  .profile-backdrop-enter-active,
  .profile-backdrop-leave-active,
  .mobile-menu,
  .mobile-menu-backdrop {
    transition: none;
  }
}
</style>
