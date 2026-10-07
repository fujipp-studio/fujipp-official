<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FeatureSubcommand } from '../config/feature-commands'
defineProps<{ commands: readonly FeatureSubcommand[]; labelledby?: string }>()
const { locale } = useI18n()
</script>

<template>
  <dl
    :aria-labelledby="labelledby"
    class="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-bg-default"
    data-feature-command-list
  >
    <div v-for="command in commands" :key="command.name" class="min-w-0 p-md">
      <dt class="font-mono text-sm [overflow-wrap:anywhere]">
        /{{ command.name.replaceAll('/', ' ') }}
      </dt>
      <dd class="mt-xs text-xs text-text-secondary">
        {{ locale === 'th' ? command.description.th : command.description.en }}
      </dd>
    </div>
  </dl>
</template>
