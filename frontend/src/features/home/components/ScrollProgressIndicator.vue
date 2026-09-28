<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { AppSectionIndicator } from '../../../shared/ui'

const { t } = useI18n()
const sections = computed(() => [
  { id: 'home-hero', label: t('home.sections.introduction') },
  { id: 'discord-bot-services', label: t('home.sections.botServices') },
  { id: 'about-us', label: t('home.sections.developer') },
])

function sectionActionLabel(label: string) {
  return t('home.sections.goTo', { section: label })
}
</script>

<template>
  <AppSectionIndicator
    :sections="sections"
    :aria-label="t('home.sections.navigationLabel')"
    :section-action-label="sectionActionLabel"
  />
</template>
