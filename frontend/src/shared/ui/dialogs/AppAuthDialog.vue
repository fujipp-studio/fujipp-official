<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import { icons } from '../../../config'
import { useAuthStore } from '../../../stores'
import AppButton from '../buttons/AppButton.vue'
import AppTextField from '../fields/AppTextField.vue'
import type { TextFieldState } from '../fields/types'
import AppIcon from '../icons/AppIcon.vue'
import AppTurnstile from '../security/AppTurnstile.vue'
import type { AuthDialogMode } from './types'

const props = withDefaults(
  defineProps<{
    open?: boolean
    mode?: AuthDialogMode
  }>(),
  {
    open: false,
    mode: 'login',
  },
)

const turnstileSiteKey =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? (import.meta.env.DEV ? '1x00000000000000000000AA' : '')

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:mode': [value: AuthDialogMode]
}>()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const acceptedTerms = ref(false)
const captchaToken = ref('')
const captchaResetKey = ref(0)
const feedback = ref('')
const awaitingEmailConfirmation = ref(false)
const authStep = ref<'credentials' | 'verification'>('credentials')
const sheetDrag = ref(0)
const isDragging = ref(false)
const isExpanded = ref(false)
let pointerId: number | undefined
let startY = 0

const isRegister = computed(() => props.mode === 'register')
const title = computed(() => {
  if (authStep.value === 'verification') return 'Security check'
  return isRegister.value ? 'Sign up to' : 'Sign in to'
})
const authStore = useAuthStore()
const { error, loading } = storeToRefs(authStore)
const hasValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const hasPassword = computed(() => password.value.length > 0)
const hasValidRegistrationPassword = computed(() => password.value.length >= 6)
const hasConfirmPassword = computed(() => confirmPassword.value.length > 0)
const passwordsMatch = computed(
  () => hasConfirmPassword.value && password.value === confirmPassword.value,
)
const isFormValid = computed(() => {
  if (awaitingEmailConfirmation.value) return false
  if (!hasValidEmail.value || !hasPassword.value) return false
  if (!isRegister.value) return true
  return hasValidRegistrationPassword.value && passwordsMatch.value && acceptedTerms.value
})
const confirmPasswordState = computed<TextFieldState>(() =>
  hasConfirmPassword.value && !passwordsMatch.value ? 'error' : 'default',
)
const confirmPasswordSupport = computed(() =>
  hasConfirmPassword.value && !passwordsMatch.value ? 'Passwords do not match.' : '',
)
const passwordSupport = computed(() =>
  isRegister.value && hasPassword.value && !hasValidRegistrationPassword.value
    ? 'Password must contain at least 6 characters.'
    : '',
)

function close() {
  emit('update:open', false)
  awaitingEmailConfirmation.value = false
  authStep.value = 'credentials'
  resetCaptcha()
  sheetDrag.value = 0
  isDragging.value = false
  isExpanded.value = false
  pointerId = undefined
  feedback.value = ''
  authStore.clearError()
}

function switchMode(mode: AuthDialogMode) {
  feedback.value = ''
  awaitingEmailConfirmation.value = false
  authStep.value = 'credentials'
  resetCaptcha()
  authStore.clearError()
  emit('update:mode', mode)
}

function beginEmailVerification() {
  if (loading.value || awaitingEmailConfirmation.value) return
  feedback.value = ''
  resetCaptcha()
  authStep.value = 'verification'
}

function returnToCredentials() {
  feedback.value = ''
  resetCaptcha()
  authStep.value = 'credentials'
}

async function completeEmailAuth() {
  if (loading.value || awaitingEmailConfirmation.value || !captchaToken.value) return

  feedback.value = ''

  const result = isRegister.value
    ? await authStore.signUp(email.value, password.value, captchaToken.value)
    : await authStore.signIn(email.value, password.value, captchaToken.value)

  resetCaptcha()

  if (!result.success) return
  if (result.requiresEmailConfirmation) {
    awaitingEmailConfirmation.value = true
    feedback.value = result.message ?? 'Check your email to confirm your account.'
    return
  }

  resetForm()
  close()
}

async function submitOAuth(provider: 'google' | 'discord' | 'github') {
  if (loading.value || awaitingEmailConfirmation.value) return

  feedback.value = ''
  await authStore.signInWithOAuth(provider)
}

function resetForm() {
  email.value = ''
  password.value = ''
  confirmPassword.value = ''
  acceptedTerms.value = false
}

function resetCaptcha() {
  captchaToken.value = ''
  captchaResetKey.value += 1
}

function handleCaptchaError() {
  captchaToken.value = ''
  feedback.value = 'Security verification failed. Please try again.'
}

function startDrag(event: PointerEvent) {
  if (!window.matchMedia('(max-width: 47.99rem)').matches) return
  pointerId = event.pointerId
  startY = event.clientY
  sheetDrag.value = 0
  isDragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (!isDragging.value || event.pointerId !== pointerId) return
  const distance = event.clientY - startY

  if (distance <= -48) {
    isExpanded.value = true
    sheetDrag.value = 0
    return
  }

  if (isExpanded.value) {
    if (distance >= 48) {
      isExpanded.value = false
      startY = event.clientY
    }
    return
  }

  sheetDrag.value = Math.max(0, distance)
}

function finishDrag(event: PointerEvent) {
  if (!isDragging.value || event.pointerId !== pointerId) return
  const shouldClose = sheetDrag.value >= 96
  isDragging.value = false
  pointerId = undefined
  if (shouldClose) close()
  else sheetDrag.value = 0
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) close()
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="auth-backdrop">
      <button
        v-if="open"
        class="auth-dialog__backdrop"
        type="button"
        aria-label="Close authentication dialog"
        @click="close"
      />
    </Transition>

    <Transition name="auth-dialog">
      <section
        v-if="open"
        class="auth-dialog"
        :class="{
          'auth-dialog--dragging': isDragging,
          'auth-dialog--expanded': isExpanded,
        }"
        :style="{ '--auth-sheet-drag': `${sheetDrag}px` }"
        role="dialog"
        aria-modal="true"
        :aria-label="isRegister ? 'Create an account' : 'Sign in'"
      >
        <div
          class="auth-dialog__drag-area"
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="finishDrag"
          @pointercancel="finishDrag"
        >
          <span class="auth-dialog__indicator" aria-hidden="true" />
          <div class="auth-dialog__header">
            <span class="auth-dialog__header-spacer" />
            <svg class="auth-dialog__mark" viewBox="0 0 1080 1080" aria-hidden="true">
              <use
                class="auth-dialog__mark-body"
                :href="`${icons.brand.mascot}#mascot-body`"
              />
              <use
                v-for="faceIndex in 12"
                :key="faceIndex"
                class="auth-dialog__mark-face"
                :href="`${icons.brand.mascot}#mascot-face-${faceIndex}`"
                :style="{ animationDelay: `${-(24 - (faceIndex - 1) * 2)}s` }"
              />
            </svg>
            <button class="auth-dialog__close" type="button" aria-label="Close" @click="close">
              <AppIcon :source="icons.base.close" />
            </button>
          </div>
        </div>

        <h2 class="auth-dialog__title" :class="{ 'auth-dialog__title--verification': authStep === 'verification' }">
          <strong>{{ title }}</strong>
          <span v-if="authStep === 'credentials'"> Fujipp</span>
        </h2>

        <form v-if="authStep === 'credentials'" class="auth-dialog__form" @submit.prevent="beginEmailVerification">
          <AppTextField
            v-model="email"
            input-type="email"
            name="email"
            autocomplete="email"
            label="Email"
            placeholder="you@example.com"
            :disabled="awaitingEmailConfirmation"
            required
          />
          <AppTextField
            v-model="password"
            variant="secret"
            name="password"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            label="Password"
            placeholder="Enter password"
            :support-text="passwordSupport"
            :state="passwordSupport ? 'error' : 'default'"
            :disabled="awaitingEmailConfirmation"
            required
          />
          <AppTextField
            v-if="isRegister"
            v-model="confirmPassword"
            variant="secret"
            label="Confirm Password"
            placeholder="Confirm password"
            :state="confirmPasswordState"
            :support-text="confirmPasswordSupport"
            :disabled="awaitingEmailConfirmation"
            required
          />

          <label v-if="isRegister" class="auth-dialog__terms">
            <input
              v-model="acceptedTerms"
              type="checkbox"
              :disabled="awaitingEmailConfirmation"
              required
            />
            <span>
              Do you agree to our <a href="/terms">Terms</a> and
              <a href="/privacy">Privacy Policy</a>.
            </span>
          </label>

          <p v-if="error || feedback" class="auth-dialog__feedback" aria-live="polite">
            {{ error ?? feedback }}
          </p>

          <AppButton
            type="submit"
            :disabled="!isFormValid || loading || awaitingEmailConfirmation"
            :loading="loading"
          >
            {{
              awaitingEmailConfirmation ? 'Email sent' : isRegister ? 'Create account' : 'Sign in'
            }}
          </AppButton>
        </form>

        <section v-else class="auth-dialog__verification" aria-labelledby="security-check-description">
          <p id="security-check-description">
            Complete this quick verification to keep your account secure.
          </p>
          <AppTurnstile
            :site-key="turnstileSiteKey"
            :reset-key="captchaResetKey"
            @verify="captchaToken = $event"
            @expired="resetCaptcha"
            @error="handleCaptchaError"
          />
          <p v-if="error || feedback" class="auth-dialog__feedback" aria-live="polite">
            {{ error ?? feedback }}
          </p>
          <div class="auth-dialog__verification-actions">
            <AppButton variant="secondary" :disabled="loading" @click="returnToCredentials">
              Back
            </AppButton>
            <AppButton :disabled="!captchaToken || loading" :loading="loading" @click="completeEmailAuth">
              Continue
            </AppButton>
          </div>
        </section>

        <div v-if="authStep === 'credentials'" class="auth-dialog__separator">
          <span />
          <small>or</small>
          <span />
        </div>

        <div v-if="authStep === 'credentials'" class="auth-dialog__socials">
          <AppButton
            :left-icon="icons.social.google"
            :disabled="loading || awaitingEmailConfirmation"
            @click="submitOAuth('google')"
          >
            Google
          </AppButton>
          <AppButton
            :left-icon="icons.social.discord"
            :disabled="loading || awaitingEmailConfirmation"
            @click="submitOAuth('discord')"
          >
            Discord
          </AppButton>
          <AppButton
            :left-icon="icons.social.github"
            :disabled="loading || awaitingEmailConfirmation"
            @click="submitOAuth('github')"
          >
            GitHub
          </AppButton>
        </div>

        <p v-if="authStep === 'credentials'" class="auth-dialog__switch">
          <span>{{ isRegister ? 'Already have an account?' : 'New here?' }}</span>
          <button type="button" @click="switchMode(isRegister ? 'login' : 'register')">
            {{ isRegister ? 'Sign in' : 'Create an account' }}
          </button>
        </p>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.auth-dialog__backdrop {
  position: fixed;
  z-index: calc(var(--z-popover) + 10);
  inset: 0;
  width: 100%;
  border: 0;
  padding: 0;
  background: var(--global-color-black-10);
  backdrop-filter: blur(var(--effect-backdrop-blur-sm));
}

.auth-dialog {
  position: fixed;
  z-index: calc(var(--z-popover) + 11);
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  display: flex;
  width: min(42.5rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  overflow-y: auto;
  border-radius: 0.75rem;
  padding: var(--space-sm) var(--space-md);
  background: var(--semantic-color-background-bg-default);
  box-shadow: var(--effect-shadow-lg);
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-sans);
  transform: translate(-50%, -50%);
}

.auth-dialog__drag-area,
.auth-dialog__header {
  width: 100%;
}

.auth-dialog__indicator {
  display: none;
}

.auth-dialog__feedback {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
  line-height: var(--line-height-body);
  text-align: center;
}

.auth-dialog__header {
  display: grid;
  height: var(--icon-size-32);
  grid-template-columns: var(--icon-size-32) 1fr var(--icon-size-32);
  align-items: center;
}

.auth-dialog__mark {
  width: var(--icon-size-32);
  height: var(--icon-size-32);
  justify-self: center;
}

.auth-dialog__mark-body {
  fill: var(--semantic-color-text-text-primary);
}

.auth-dialog__mark-face {
  fill: var(--semantic-color-text-text-inverse);
  opacity: 0;
  transform: scale(1.45);
  transform-box: view-box;
  transform-origin: 50% 64%;
  animation: auth-dialog-mark-face 24s steps(1, end) infinite;
}

@keyframes auth-dialog-mark-face {
  0%,
  8.32% {
    opacity: 1;
  }

  8.33%,
  100% {
    opacity: 0;
  }
}

.auth-dialog__close {
  display: grid;
  width: var(--icon-size-32);
  height: var(--icon-size-32);
  cursor: pointer;
  place-items: center;
  border: 0;
  padding: 0;
  background: transparent;
}

.auth-dialog__close span {
  width: var(--icon-size-32);
  height: var(--icon-size-32);
}

.auth-dialog__title {
  margin: 0;
  padding: 0 0.15em 0.12em;
  font-size: 2.5rem;
  line-height: 1.2;
  text-align: center;
}

.auth-dialog__title span {
  display: inline-block;
  padding-right: 0.18em;
  background: linear-gradient(180deg, #00e5ff, #2979ff);
  background-clip: text;
  color: transparent;
  font-family: var(--font-family-handwriting);
  font-size: 3rem;
  line-height: 1.2;
}

.auth-dialog__form {
  display: grid;
  width: min(100%, 30rem);
  gap: var(--space-xs);
}

.auth-dialog__verification {
  display: grid;
  width: min(100%, 30rem);
  justify-items: center;
  gap: var(--space-md);
  padding-block: var(--space-sm) var(--space-md);
  text-align: center;
}

.auth-dialog__verification > p:first-child {
  max-width: 24rem;
  color: var(--semantic-color-text-text-secondary);
  line-height: var(--line-height-body);
}

.auth-dialog__verification-actions {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}

.auth-dialog__terms {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-body-small);
  line-height: var(--line-height-body);
}

.auth-dialog__terms input {
  width: var(--icon-size-16);
  height: var(--icon-size-16);
  flex-shrink: 0;
  accent-color: var(--semantic-color-text-text-primary);
}

.auth-dialog__terms a,
.auth-dialog__switch button {
  color: var(--semantic-color-text-text-primary);
  text-decoration: underline;
  text-underline-offset: 0.2rem;
}

.auth-dialog__separator {
  display: flex;
  width: min(100%, 23.125rem);
  align-items: center;
  gap: var(--space-xs);
  color: var(--semantic-color-text-text-muted);
}

.auth-dialog__separator span {
  height: 1px;
  flex: 1;
  background: var(--semantic-color-border-border-default);
}

.auth-dialog__separator small {
  font: inherit;
  line-height: var(--line-height-body);
}

.auth-dialog__socials {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, 8.6875rem);
  justify-content: center;
  gap: var(--space-sm);
}

.auth-dialog__switch {
  display: flex;
  margin: 0;
  align-items: center;
  gap: var(--space-sm);
  color: var(--semantic-color-text-text-muted);
  font-size: var(--font-size-body-small);
  line-height: var(--line-height-body);
}

.auth-dialog__switch button {
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
}

.auth-backdrop-enter-active,
.auth-backdrop-leave-active {
  transition: opacity 220ms ease;
}

.auth-backdrop-enter-from,
.auth-backdrop-leave-to {
  opacity: 0;
}

.auth-dialog-enter-active,
.auth-dialog-leave-active {
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.auth-dialog-enter-from,
.auth-dialog-leave-to {
  opacity: 0;
  transform: translate(-50%, -48%) scale(0.96);
}

@media (max-width: 47.99rem) {
  .auth-dialog {
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 78dvh;
    max-height: 78dvh;
    border-radius: 0.75rem 0.75rem 0 0;
    padding-bottom: 2rem;
    transform: translateY(var(--auth-sheet-drag, 0));
    transition:
      height 280ms cubic-bezier(0.22, 1, 0.36, 1),
      max-height 280ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .auth-dialog--expanded {
    height: 88dvh;
    max-height: 88dvh;
  }

  .auth-dialog--dragging {
    transition: none;
  }

  .auth-dialog__drag-area {
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .auth-dialog__indicator {
    display: block;
    width: 1.5rem;
    height: 0.25rem;
    margin: 0 auto var(--space-xxs);
    border-radius: var(--corner-radius-full);
    background: currentcolor;
  }

  .auth-dialog__title {
    font-size: 1.75rem;
  }

  .auth-dialog__title span {
    font-size: 2rem;
  }

  .auth-dialog__form {
    width: 100%;
  }

  .auth-dialog__socials {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-xs);
  }

  .auth-dialog__switch {
    flex-wrap: wrap;
    justify-content: center;
  }

  .auth-dialog-enter-from,
  .auth-dialog-leave-to {
    opacity: 1;
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-dialog__mark-face {
    animation: none;
  }

  .auth-dialog__mark-face:nth-of-type(2) {
    opacity: 1;
  }

  .auth-dialog,
  .auth-dialog-enter-active,
  .auth-dialog-leave-active,
  .auth-backdrop-enter-active,
  .auth-backdrop-leave-active {
    transition: none;
  }
}
</style>
