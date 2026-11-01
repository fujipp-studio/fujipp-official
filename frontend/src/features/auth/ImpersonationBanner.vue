<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { AppButton } from '@/shared/ui'

const auth = useAuthStore()
const { t, locale } = useI18n()
const router = useRouter()
const busy = ref(false)
const error = ref('')
async function stop() {
  busy.value = true
  error.value = ''
  try {
    await auth.endImpersonation()
    await router.replace({ name: 'admin-users', query: locale.value === 'th' ? { locale: 'th' } : {} })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.impersonation.error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <aside
    v-if="auth.impersonation"
    class="impersonation-banner sticky top-0 border-b border-border-subtle bg-bg-surface px-md py-sm text-text-primary"
    aria-live="polite"
  >
    <div class="flex flex-wrap items-center justify-between gap-sm">
      <p class="text-sm font-semibold">
        {{
          t('admin.impersonation.active', {
            name:
              auth.impersonation.user.displayName ||
              auth.impersonation.user.email ||
              auth.impersonation.user.id,
          })
        }}
        <span class="block text-xs font-normal text-text-secondary">{{
          t('admin.impersonation.expires', {
            time: new Date(auth.impersonation.expiresAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          })
        }}</span>
      </p>
      <AppButton class="!w-auto" variant="secondary" :loading="busy" :disabled="busy" @click="stop">
        {{ t('admin.impersonation.stop') }}
      </AppButton>
    </div>
    <p v-if="error" role="alert" class="mt-xs text-sm">{{ error }}</p>
  </aside>
</template>

<style scoped>
.impersonation-banner {
  z-index: var(--z-popover);
}
</style>
