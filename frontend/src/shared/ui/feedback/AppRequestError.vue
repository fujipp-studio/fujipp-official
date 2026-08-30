<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from '../buttons/AppButton.vue'

defineProps<{ message: string; busy?: boolean }>()
defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div
    role="alert"
    class="my-md flex flex-wrap items-center justify-between gap-md rounded-md border border-error-border bg-error-bg p-md text-error-text"
  >
    <p>{{ message }}</p>
    <AppButton variant="secondary" class="tablet:!w-auto" :disabled="busy" @click="$emit('retry')">
      {{ t('common.retry') }}
    </AppButton>
  </div>
</template>
