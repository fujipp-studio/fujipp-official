<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Camera, KeyRound, UserRound } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import {
  deleteAccountAvatar,
  fetchAccountProfile,
  setAccountUsername,
  updateAccountProfile,
  uploadAccountAvatar,
  type AccountProfile,
} from '@/features/account/api'
import { AppFooter } from '@/shared/layout'
import { AppButton, AppTextField, AppToast } from '@/shared/ui'
import { useAuthStore } from '@/stores'

const auth = useAuthStore()
const { currentUser, loading: authLoading, session } = storeToRefs(auth)
const { t } = useI18n()
const route = useRoute()

const profile = ref<AccountProfile | null>(null)
const loading = ref(true)
const loadError = ref('')
const savingProfile = ref(false)
const savingUsername = ref(false)
const uploadingAvatar = ref(false)
const removingAvatar = ref(false)
const passwordSection = ref<HTMLElement>()
const avatarInput = ref<HTMLInputElement>()
const username = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const toastOpen = ref(false)
const toastMessage = ref('')
const toastVariant = ref<'success' | 'error' | 'info'>('success')
const profileForm = reactive({ displayName: '', firstName: '', lastName: '' })

const avatarUrl = computed(
  () => profile.value?.avatarUrl ?? currentUser.value?.avatarUrl ?? '/images/profile/avatar-placeholder.png',
)
const usernameValid = computed(() => /^[a-z0-9_]{3,50}$/.test(username.value))
const passwordValid = computed(() => newPassword.value.length >= 8)
const passwordsMatch = computed(
  () => confirmPassword.value.length > 0 && newPassword.value === confirmPassword.value,
)

function applyProfile(nextProfile: AccountProfile) {
  profile.value = nextProfile
  profileForm.displayName = nextProfile.displayName ?? ''
  profileForm.firstName = nextProfile.firstName ?? ''
  profileForm.lastName = nextProfile.lastName ?? ''
}

function notify(message: string, variant: 'success' | 'error' | 'info' = 'success') {
  toastMessage.value = message
  toastVariant.value = variant
  toastOpen.value = true
}

async function loadProfile() {
  if (!session.value) return
  loading.value = true
  loadError.value = ''
  try {
    applyProfile(await fetchAccountProfile(session.value))
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : t('account.loadError')
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  if (!session.value || !profileForm.displayName.trim() || savingProfile.value) return
  savingProfile.value = true
  try {
    applyProfile(
      await updateAccountProfile(
        {
          displayName: profileForm.displayName.trim(),
          firstName: profileForm.firstName.trim() || null,
          lastName: profileForm.lastName.trim() || null,
        },
        session.value,
      ),
    )
    await auth.reloadCurrentUser()
    notify(t('account.profileSaved'))
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : t('account.saveError'), 'error')
  } finally {
    savingProfile.value = false
  }
}

async function saveUsername() {
  if (!session.value || !usernameValid.value || savingUsername.value || profile.value?.username) return
  savingUsername.value = true
  try {
    applyProfile(await setAccountUsername(username.value, session.value))
    await auth.reloadCurrentUser()
    username.value = ''
    notify(t('account.usernameSaved'))
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : t('account.usernameError'), 'error')
  } finally {
    savingUsername.value = false
  }
}

async function handleAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !session.value || uploadingAvatar.value) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    notify(t('account.avatarInvalid'), 'error')
    return
  }
  uploadingAvatar.value = true
  try {
    applyProfile(await uploadAccountAvatar(file, session.value))
    await auth.reloadCurrentUser()
    notify(t('account.avatarSaved'))
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : t('account.avatarError'), 'error')
  } finally {
    uploadingAvatar.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

async function removeAvatar() {
  if (!session.value || removingAvatar.value) return
  removingAvatar.value = true
  try {
    applyProfile(await deleteAccountAvatar(session.value))
    await auth.reloadCurrentUser()
    notify(t('account.avatarRemoved'))
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : t('account.avatarError'), 'error')
  } finally {
    removingAvatar.value = false
  }
}

async function changePassword() {
  if (!passwordValid.value || !passwordsMatch.value || authLoading.value) return
  const result = await auth.updatePassword(newPassword.value)
  if (!result.success) {
    notify(result.message ?? t('account.passwordError'), 'error')
    return
  }
  newPassword.value = ''
  confirmPassword.value = ''
  notify(t('account.passwordSaved'))
}

async function sendResetLink() {
  if (authLoading.value) return
  const result = await auth.requestPasswordReset()
  notify(
    result.success ? t('account.resetSent') : (result.message ?? t('account.passwordError')),
    result.success ? 'info' : 'error',
  )
}

onMounted(async () => {
  await loadProfile()
  if (route.query.recovery === '1') {
    await nextTick()
    passwordSection.value?.scrollIntoView({ block: 'start' })
  }
})
</script>

<template>
  <div class="account-page min-h-screen bg-bg-default text-text-primary">
    <main class="page-container account-main">
      <header class="account-header">
        <div>
          <span>{{ t('account.eyebrow') }}</span>
          <h1>{{ t('account.title') }}</h1>
        </div>
        <div class="account-identity">
          <img :src="avatarUrl" alt="" />
          <div>
            <strong>{{ profile?.displayName ?? currentUser?.displayName ?? t('account.user') }}</strong>
            <span>{{ currentUser?.email }}</span>
          </div>
        </div>
      </header>

      <div v-if="loading" class="account-state">{{ t('account.loading') }}</div>
      <div v-else-if="loadError" class="account-state" role="alert">
        <span>{{ loadError }}</span>
        <AppButton class="state-button" variant="secondary" @click="loadProfile">{{ t('account.retry') }}</AppButton>
      </div>

      <div v-else-if="profile" class="account-layout">
        <nav class="account-nav" :aria-label="t('account.navigationLabel')">
          <a href="#profile"><UserRound :size="17" aria-hidden="true" />{{ t('account.profile') }}</a>
          <a href="#security"><KeyRound :size="17" aria-hidden="true" />{{ t('account.security') }}</a>
        </nav>

        <div class="account-content">
          <section id="profile" class="account-section">
            <header>
              <h2>{{ t('account.profile') }}</h2>
              <p>{{ t('account.profileDescription') }}</p>
            </header>

            <div class="avatar-editor">
              <img :src="avatarUrl" :alt="t('account.avatarAlt')" />
              <div>
                <input
                  ref="avatarInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  @change="handleAvatarChange"
                />
                <AppButton
                  class="compact-button"
                  variant="secondary"
                  :loading="uploadingAvatar"
                  @click="avatarInput?.click()"
                >
                  <Camera :size="17" aria-hidden="true" />{{ t('account.changeAvatar') }}
                </AppButton>
                <button
                  v-if="profile.avatarUrl"
                  type="button"
                  class="text-action"
                  :disabled="removingAvatar"
                  @click="removeAvatar"
                >
                  {{ t('account.removeAvatar') }}
                </button>
                <small>{{ t('account.avatarHint') }}</small>
              </div>
            </div>

            <form class="account-form" @submit.prevent="saveProfile">
              <AppTextField
                v-model="profileForm.displayName"
                :label="t('account.displayName')"
                :maxlength="50"
                required
              />
              <div class="field-row">
                <AppTextField v-model="profileForm.firstName" :label="t('account.firstName')" :maxlength="100" />
                <AppTextField v-model="profileForm.lastName" :label="t('account.lastName')" :maxlength="100" />
              </div>
              <AppButton class="section-action" type="submit" variant="secondary" :disabled="!profileForm.displayName.trim()" :loading="savingProfile">
                {{ t('account.saveProfile') }}
              </AppButton>
            </form>

            <div class="username-block">
              <div>
                <strong>{{ t('account.username') }}</strong>
                <span v-if="profile.username">@{{ profile.username }}</span>
                <small>{{ profile.username ? t('account.usernameLocked') : t('account.usernameHint') }}</small>
              </div>
              <form v-if="!profile.username" @submit.prevent="saveUsername">
                <AppTextField v-model="username" :label="t('account.username')" placeholder="fujipp" />
                <AppButton class="compact-button" type="submit" variant="secondary" :disabled="!usernameValid" :loading="savingUsername">
                  {{ t('account.setUsername') }}
                </AppButton>
              </form>
            </div>
          </section>

          <section id="security" ref="passwordSection" class="account-section">
            <header>
              <h2>{{ t('account.security') }}</h2>
              <p>{{ t('account.securityDescription') }}</p>
            </header>

            <form class="account-form" @submit.prevent="changePassword">
              <AppTextField
                v-model="newPassword"
                variant="secret"
                :label="t('account.newPassword')"
                autocomplete="new-password"
                :support-text="t('account.passwordHint')"
              />
              <AppTextField
                v-model="confirmPassword"
                variant="secret"
                :label="t('account.confirmPassword')"
                autocomplete="new-password"
                :state="confirmPassword && !passwordsMatch ? 'error' : 'default'"
                :support-text="confirmPassword && !passwordsMatch ? t('account.passwordMismatch') : ''"
              />
              <div class="security-actions">
                <AppButton class="section-action" type="submit" variant="secondary" :disabled="!passwordValid || !passwordsMatch" :loading="authLoading">
                  {{ t('account.changePassword') }}
                </AppButton>
                <button type="button" class="text-action" :disabled="authLoading" @click="sendResetLink">
                  {{ t('account.sendResetLink') }}
                </button>
              </div>
            </form>
          </section>

        </div>
      </div>
    </main>

    <AppFooter />

    <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" />
  </div>
</template>

<style scoped>
.account-main {
  padding-top: clamp(6rem, 9vw, 8rem);
  padding-bottom: var(--space-5xl);
}

.account-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2xl);
  padding-bottom: var(--space-2xl);
  border-bottom: 1px solid var(--color-border-strong);
}

.account-header > div:first-child {
  display: grid;
  gap: var(--space-xs);
}

.account-header span {
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-small);
}

.account-header h1 {
  margin: 0;
  font-size: clamp(2.5rem, 6vw, 5rem);
  font-weight: var(--typography-font-weight-medium);
  line-height: 0.95;
  letter-spacing: -0.055em;
}

.account-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-sm);
}

.account-identity img {
  width: 3rem;
  height: 3rem;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-full);
  object-fit: cover;
}

.account-identity div {
  display: grid;
  min-width: 0;
  gap: var(--space-xxs);
}

.account-identity strong,
.account-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-identity span {
  color: var(--color-text-muted);
  font-size: var(--font-size-label-small);
}

.account-layout {
  display: grid;
  grid-template-columns: 13rem minmax(0, 44rem);
  gap: clamp(var(--space-2xl), 7vw, 7rem);
  justify-content: center;
  padding-top: var(--space-3xl);
}

.account-nav {
  position: sticky;
  top: 6rem;
  display: grid;
  align-self: start;
  gap: var(--space-xxs);
}

.account-nav a {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-left: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-body-small);
  text-decoration: none;
}

.account-nav a:hover,
.account-nav a:focus-visible {
  border-color: var(--color-border-accent);
  color: var(--color-text-primary);
  outline: none;
}

.account-content {
  display: grid;
  gap: var(--space-3xl);
}

.account-section {
  scroll-margin-top: 6rem;
  padding-bottom: var(--space-3xl);
  border-bottom: 1px solid var(--color-border-default);
}

.account-section > header {
  display: grid;
  gap: var(--space-xs);
  margin-bottom: var(--space-xl);
}

.account-section h2,
.account-section p {
  margin: 0;
}

.account-section h2 {
  font-size: var(--font-size-heading-medium);
  font-weight: var(--typography-font-weight-semibold);
  letter-spacing: -0.025em;
}

.account-section p {
  color: var(--color-text-muted);
  font-size: var(--font-size-body-small);
  line-height: var(--line-height-body);
}

.avatar-editor {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.avatar-editor > img {
  width: 6rem;
  height: 6rem;
  flex: none;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-full);
  object-fit: cover;
}

.avatar-editor > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.avatar-editor small {
  width: 100%;
  color: var(--color-text-muted);
  font-size: var(--font-size-label-small);
}

.account-form {
  display: grid;
  gap: var(--space-md);
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

:deep(.compact-button),
:deep(.section-action) {
  width: auto;
  border-radius: var(--radius-sm);
  box-shadow: none;
}

:deep(.section-action) {
  justify-self: start;
  min-width: 10rem;
}

.text-action {
  border: 0;
  padding: var(--space-xs);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-label-small);
  text-decoration: underline;
  text-underline-offset: 0.2rem;
}

.text-action:disabled {
  color: var(--color-text-disabled);
  cursor: default;
}

.username-block {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-xl);
  margin-top: var(--space-2xl);
  padding-top: var(--space-xl);
  border-top: 1px solid var(--color-border-subtle);
}

.username-block > div {
  display: grid;
  gap: var(--space-xxs);
}

.username-block span {
  font-family: var(--font-family-mono);
}

.username-block small {
  color: var(--color-text-muted);
  font-size: var(--font-size-label-small);
}

.username-block form {
  display: flex;
  min-width: min(100%, 22rem);
  align-items: end;
  gap: var(--space-xs);
}

.security-actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.account-state {
  display: grid;
  min-height: 28rem;
  place-items: center;
  align-content: center;
  gap: var(--space-md);
  color: var(--color-text-muted);
}

:deep(.state-button) {
  width: auto;
}

@media (max-width: 63.99rem) {
  .account-layout {
    grid-template-columns: 10rem minmax(0, 1fr);
    gap: var(--space-xl);
  }
}

@media (max-width: 47.99rem) {
  .account-main {
    padding-top: 6rem;
  }

  .account-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .account-layout {
    grid-template-columns: 1fr;
  }

  .account-nav {
    position: static;
    display: flex;
    overflow-x: auto;
  }

  .account-nav a {
    border-bottom: 2px solid transparent;
    border-left: 0;
    white-space: nowrap;
  }

  .field-row {
    grid-template-columns: 1fr;
  }

  .avatar-editor,
  .username-block,
  .username-block form,
  .security-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .username-block form {
    width: 100%;
  }

  :deep(.compact-button),
  :deep(.section-action) {
    width: 100%;
  }
}
</style>
