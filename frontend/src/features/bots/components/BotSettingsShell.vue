<script setup lang="ts">
import { computed } from 'vue'
import { Clock3 } from 'lucide-vue-next'

import { icons } from '../../../config'
import type { UserBot } from '../../../services/backend'
import { AppButton } from '../../../shared/ui'
import {
  botRuntimeDisplayState,
  isBotOnline,
  type BotControlAction,
  type BotRuntimeDisplayState,
} from '../runtime-status'

const props = withDefaults(
  defineProps<{
    bot: UserBot | null
    loading?: boolean
    controlling?: boolean
    controlAction?: BotControlAction | null
    trail?: string[]
  }>(),
  { loading: false, controlling: false, controlAction: null, trail: () => [] },
)
const emit = defineEmits<{
  back: []
  main: []
  trail: [index: number]
  control: [action: 'start' | 'stop' | 'restart']
}>()

const online = computed(() => Boolean(props.bot && isBotOnline(props.bot)))
const runtimeLabels: Record<BotRuntimeDisplayState, string> = {
  starting: 'Starting…',
  stopping: 'Stopping…',
  restarting: 'Restarting…',
  running: 'Running',
  stopped: 'Stopped',
  crashed: 'Crashed',
  offline: 'Offline',
}

function runtimeLabel() {
  if (!props.bot) return ''
  return runtimeLabels[botRuntimeDisplayState(props.bot, props.controlAction)]
}
</script>

<template>
  <header class="bot-shell-hero">
    <h1>Bot settings</h1>
    <AppButton class="bot-shell-hug" :left-icon="icons.base.arrowLeft" @click="emit('back')"
      >Back</AppButton
    >
  </header>
  <section v-if="bot" class="bot-shell-summary">
    <div class="bot-shell-identity">
      <img
        v-if="bot.discordAvatarUrl"
        class="bot-shell-avatar"
        :src="bot.discordAvatarUrl"
        :alt="`${bot.name} avatar`"
        decoding="async"
        fetchpriority="high"
      />
      <div v-else class="bot-shell-avatar bot-shell-avatar--fallback">
        {{ bot.name.slice(0, 1).toUpperCase() }}
      </div>
      <div class="min-w-0">
        <h2>{{ bot.name }}</h2>
        <strong :class="online ? 'bot-shell-online' : 'bot-shell-offline'">{{
          online ? 'online' : 'offline'
        }}</strong>
        <p><Clock3 :size="16" />{{ runtimeLabel() }}</p>
      </div>
    </div>
    <div class="bot-shell-controls">
      <AppButton
        class="bot-shell-hug"
        variant="secondary"
        :left-icon="bot.desiredState === 'RUNNING' ? icons.action.pause : icons.action.play"
        :disabled="controlling"
        @click="emit('control', bot.desiredState === 'RUNNING' ? 'stop' : 'start')"
        >{{ bot.desiredState === 'RUNNING' ? 'Stop' : 'Start' }}</AppButton
      >
      <AppButton
        class="bot-shell-hug"
        variant="secondary"
        :left-icon="icons.action.restart"
        :disabled="controlling || bot.desiredState !== 'RUNNING'"
        @click="emit('control', 'restart')"
        >Restart</AppButton
      >
    </div>
  </section>
  <div v-else-if="loading" class="bot-shell-loading" />
  <nav class="bot-shell-breadcrumb" aria-label="Bot settings breadcrumb">
    <button v-if="trail.length" type="button" @click="emit('main')">Main</button
    ><span v-else>Main</span>
    <TransitionGroup name="breadcrumb-item">
      <span v-for="(item, index) in trail" :key="item" class="bot-shell-crumb">
        <span aria-hidden="true">&gt;</span>
        <button v-if="index < trail.length - 1" type="button" @click="emit('trail', index)">
          {{ item }}
        </button>
        <span v-else aria-current="page">{{ item }}</span>
      </span>
    </TransitionGroup>
  </nav>
</template>

<style scoped>
.bot-shell-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
  view-transition-name: bot-settings-hero;
}
.bot-shell-hero h1 {
  font-size: clamp(2.25rem, 5vw, 3rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.04em;
  line-height: 1;
}
.bot-shell-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xl);
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface);
  view-transition-name: bot-settings-summary;
}
.bot-shell-identity,
.bot-shell-controls {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}
.bot-shell-avatar {
  width: 6rem;
  height: 6rem;
  flex: none;
  border-radius: var(--radius-lg);
  object-fit: cover;
}
.bot-shell-avatar--fallback {
  display: grid;
  place-items: center;
  background: var(--semantic-color-background-bg-elevated);
  font-size: 2rem;
  font-weight: var(--typography-font-weight-bold);
}
.bot-shell-identity h2 {
  font-size: 1.5rem;
  font-weight: var(--typography-font-weight-bold);
}
.bot-shell-identity p {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
  color: var(--semantic-color-text-text-muted);
}
.bot-shell-online {
  color: var(--semantic-color-success-success-text);
}
.bot-shell-offline {
  color: var(--semantic-color-error-error-text);
}
.bot-shell-hug {
  width: auto;
}
.bot-shell-loading {
  height: 8rem;
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface);
}
.bot-shell-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  margin-block: var(--space-xl);
  font-size: var(--font-size-label-large);
  font-weight: var(--typography-font-weight-semibold);
  view-transition-name: bot-settings-breadcrumb;
}
.bot-shell-breadcrumb button {
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: none;
}
.bot-shell-breadcrumb button:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.bot-shell-crumb {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}
.breadcrumb-item-enter-active,
.breadcrumb-item-leave-active {
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.breadcrumb-item-enter-from {
  opacity: 0;
  transform: translateX(var(--space-lg));
}
.breadcrumb-item-leave-to {
  opacity: 0;
  transform: translateX(calc(var(--space-lg) * -1));
}
@media (max-width: 47.99rem) {
  .bot-shell-summary,
  .bot-shell-controls {
    align-items: stretch;
    flex-direction: column;
  }
  .bot-shell-controls > * {
    width: 100%;
  }
}
</style>
