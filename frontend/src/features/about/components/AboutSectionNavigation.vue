<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { AppSectionIndicator } from '../../../shared/ui'
import { aboutSections } from '../config'

const { t } = useI18n()
const sections = computed(() =>
  aboutSections.map((section) => ({
    id: section.id,
    label: t(section.labelKey),
  })),
)
</script>

<template>
  <AppSectionIndicator
    :sections="sections"
    :aria-label="t('about.sections.navigationLabel')"
  />
</template>
