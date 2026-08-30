<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { icons, ThemeApp } from '@/config'
import type { ThemeMode } from '@/config/theme'
import { setAppLocale } from '@/i18n'
import { useAuthStore, useThemeStore } from '@/stores'
import { useAdminToolsVisibility } from '@/features/admin/composables/useAdminToolsVisibility'
import { AppButton, AppIcon, AppToggle } from '@/shared/ui'
const props = defineProps<{
  open: boolean
  profileSrc: string
  username: string
  email: string
  position: { top: number; right: number }
}>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const { t, locale } = useI18n()
const route = useRoute(),
  router = useRouter()
const authStore = useAuthStore(),
  themeStore = useThemeStore()
const { currentUser, loading: authLoading } = storeToRefs(authStore)
const { selectedTheme } = storeToRefs(themeStore)
const { visible: adminToolsVisible, setVisible: setAdminToolsVisible } = useAdminToolsVisibility()
const selectedLanguage = computed(() => (locale.value === 'th' ? 'TH' : 'EN'))
const profileSheetDrag = ref(0)
const isProfileSheetDragging = ref(false)
const isProfileSheetExpanded = ref(false)
let profileSheetPointerId: number | undefined
let profileSheetStartY = 0
watch(
  () => props.open,
  () => {
    profileSheetDrag.value = 0
    isProfileSheetDragging.value = false
    isProfileSheetExpanded.value = false
  },
)
function closeProfileMenu() {
  emit('update:open', false)
  profileSheetDrag.value = 0
  isProfileSheetDragging.value = false
  isProfileSheetExpanded.value = false
  profileSheetPointerId = undefined
}

async function signOut() {
  if (authLoading.value) return
  const result = await authStore.signOut()
  if (result.success) closeProfileMenu()
}

function selectTheme(mode: ThemeMode, event: MouseEvent) {
  const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
  themeStore.setTheme(mode, {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  })
}

async function selectLanguage(language: 'TH' | 'EN') {
  if (selectedLanguage.value === language) return
  setAppLocale(language === 'TH' ? 'th' : 'en')
  const query = { ...route.query }
  if (language === 'TH') query.locale = 'th'
  else delete query.locale
  await router.replace({ query })
  closeProfileMenu()
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
</script>
<template>
  <Teleport to="body">
    <Transition name="profile-backdrop">
      <button
        v-if="open"
        class="profile-dialog-backdrop"
        type="button"
        aria-label="Close user settings"
        @click="closeProfileMenu"
      />
    </Transition>

    <Transition name="profile-dialog">
      <aside
        v-if="open"
        id="profile-dialog"
        class="profile-dialog"
        :class="{
          'profile-dialog--dragging': isProfileSheetDragging,
          'profile-dialog--expanded': isProfileSheetExpanded,
        }"
        :style="{
          top: `${position.top}px`,
          right: `${position.right}px`,
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
            <strong>{{ t('navigation.setting') }}</strong>
            <button
              class="mobile-icon-button"
              type="button"
              aria-label="Close user settings"
              @click="closeProfileMenu"
            >
              <AppIcon class="mobile-icon mobile-icon--32" :source="icons.base.close" />
            </button>
          </div>
        </div>

        <div class="profile-dialog__user">
          <span class="profile-navbar__avatar-frame">
            <img class="profile-navbar__avatar" :src="profileSrc" alt="" />
          </span>
          <span class="profile-dialog__identity">
            <span class="profile-dialog__username">{{ username }}</span>
            <span class="profile-dialog__email">{{ email }}</span>
          </span>
        </div>

        <div class="profile-dialog__divider" />

        <div class="profile-dialog__row">
          <span class="profile-dialog__label">{{ t('navigation.theme') }}</span>
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
              <AppIcon class="profile-dialog__theme-icon" :source="theme.src" />
            </button>
          </div>
        </div>

        <div class="profile-dialog__row">
          <span class="profile-dialog__label">{{ t('navigation.language') }}</span>
          <div class="profile-dialog__options" aria-label="Language">
            <button
              class="profile-dialog__language-button"
              :class="{ 'profile-dialog__icon-button--active': selectedLanguage === 'TH' }"
              type="button"
              aria-label="Thai"
              :aria-pressed="selectedLanguage === 'TH'"
              @click="selectLanguage('TH')"
            >
              <img :src="icons.language.thai" alt="" />
            </button>
            <button
              class="profile-dialog__language-button"
              :class="{ 'profile-dialog__icon-button--active': selectedLanguage === 'EN' }"
              type="button"
              aria-label="English"
              :aria-pressed="selectedLanguage === 'EN'"
              @click="selectLanguage('EN')"
            >
              <img :src="icons.language.english" alt="" />
            </button>
          </div>
        </div>

        <div v-if="currentUser?.role === 'ADMIN'" class="profile-dialog__row">
          <span class="profile-dialog__label">Admin tools</span>
          <AppToggle
            :model-value="adminToolsVisible"
            aria-label="Show Admin tools button"
            @change="setAdminToolsVisible"
          />
        </div>

        <button class="profile-dialog__row profile-dialog__manage" type="button">
          <span class="profile-dialog__label">{{ t('navigation.manageAccount') }}</span>
          <AppIcon class="profile-dialog__arrow" :source="icons.base.arrowRight" />
        </button>

        <AppButton variant="secondary" :loading="authLoading" @click="signOut">{{
          t('navigation.signOut')
        }}</AppButton>
      </aside>
    </Transition>
  </Teleport>
</template>
<style scoped>
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
}

@media (max-width: 47.99rem) {
  .profile-dialog-backdrop {
    position: fixed;
    z-index: calc(var(--z-popover) - 1);
    inset: 0;
    display: block;
    width: 100%;
    border: 0;
    padding: 0;
    background: var(--semantic-color-background-bg-overlay);
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
}

@media (prefers-reduced-motion: reduce) {
  .profile-dialog {
    transition: none;
  }
}
</style>
