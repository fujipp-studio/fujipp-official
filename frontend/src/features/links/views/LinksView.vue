<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ArrowUpRight, Moon, Sun, Music2, Play, Pause, Volume2 } from 'lucide-vue-next'
import { icons } from '../../../config'
import AppIcon from '../../../shared/ui/icons/AppIcon.vue'
import AppTextLink from '../../../shared/ui/navigation/AppTextLink.vue'
import getHighUrl from '../assets/get-high.mp3?url'

const dark = ref(true)
const audio = ref<HTMLAudioElement | null>(null)
const playing = ref(false)
const manuallyStopped = ref(false)
const needsTap = ref(false)
const audioFailed = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.4)
let hasPlayed = false
let wheelAttempted = false
let playPending = false
let requestedPlaying = false

async function playMusic() {
  const player = audio.value
  if (!player || playPending) return
  requestedPlaying = true
  playPending = true
  audioFailed.value = false
  try {
    await player.play()
    if (!requestedPlaying) player.pause()
    else needsTap.value = false
  } catch (error) {
    if (!requestedPlaying) return
    if (error instanceof DOMException && error.name === 'NotAllowedError') needsTap.value = true
    else if (!(error instanceof DOMException && error.name === 'AbortError')) audioFailed.value = true
  } finally {
    playPending = false
  }
}

function startMusic(event: Event) {
  if (manuallyStopped.value || hasPlayed || playPending) return
  if (event.target instanceof Element && event.target.closest('[data-music-control]')) return
  if (event.type === 'wheel') {
    if (wheelAttempted) return
    wheelAttempted = true
  }
  void playMusic()
}

function toggleMusic() {
  if (playing.value || playPending) {
    requestedPlaying = false
    manuallyStopped.value = true
    audio.value?.pause()
  } else {
    manuallyStopped.value = false
    void playMusic()
  }
}

function onPlaying() {
  playing.value = true
  hasPlayed = true
  needsTap.value = false
}

function updateTime() {
  currentTime.value = audio.value?.currentTime ?? 0
  const length = audio.value?.duration ?? 0
  duration.value = Number.isFinite(length) ? length : 0
}

function seek(event: Event) {
  if (audio.value && duration.value > 0) audio.value.currentTime = Number((event.target as HTMLInputElement).value)
}

function setVolume(event: Event) {
  volume.value = Number((event.target as HTMLInputElement).value)
  if (audio.value) audio.value.volume = volume.value
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

onMounted(() => { if (audio.value) audio.value.volume = volume.value })
onUnmounted(() => {
  requestedPlaying = false
  audio.value?.pause()
})

const socials = [
  { label: 'Instagram', detail: 'A little behind the scenes', href: 'https://www.instagram.com/fujipp.official/', icon: icons.social.instagram },
  { label: 'GitHub', detail: 'Things I’m building', href: 'https://github.com/Fujipp', icon: icons.social.github },
  { label: 'Discord', detail: 'Come say hello', href: 'https://discord.gg/nRn7YDwGSH', icon: icons.social.discord },
  { label: 'LinkedIn', detail: 'Let’s connect', href: 'https://www.linkedin.com/in/anawat-boripakhirun-aa1799426', icon: icons.social.linkedin },
]
</script>

<template>
  <main class="links-page" :data-theme="dark ? 'dark' : 'light'" @pointerdown.capture="startMusic" @keydown.capture="startMusic" @wheel.passive="startMusic" @touchend.passive="startMusic">
    <div class="links-column">
      <header class="flex items-center justify-between px-xs pb-sm">
        <RouterLink to="/" aria-label="Fujipp home" class="mini-brand">
          <AppIcon :source="icons.brand.mark" class="size-icon-24" />
          <span>FUJIPP / LINKS</span>
        </RouterLink>
        <button class="theme-button" type="button" :aria-label="dark ? 'Switch to light theme' : 'Switch to dark theme'" @click="dark = !dark">
          <Sun v-if="dark" class="size-icon-16" />
          <Moon v-else class="size-icon-16" />
        </button>
      </header>

      <section class="links-card intro-card" aria-labelledby="links-title">
        <div class="flex items-center justify-between text-label-small text-text-muted">
          <span>DEVELOPER & CREATOR</span>
          <span>BASED IN THAILAND ↗</span>
        </div>
        <h1 id="links-title">fujipp<span class="intro-star" aria-hidden="true">✳</span></h1>
        <p class="intro-caption">Ideas into things.<br />One project at a time.</p>
        <AppTextLink to="/work" class="portfolio-link">View my portfolio</AppTextLink>
      </section>

      <section class="links-card about-card" aria-label="About Fujipp">
        <span class="eyebrow">A LITTLE ABOUT ME</span>
        <p>I’m Anawat. I build websites, Discord bots, and digital experiences that make everyday things a little easier.</p>
      </section>

      <section class="links-card music-card" aria-label="Music">
        <div class="flex items-center justify-between mb-lg">
          <span class="eyebrow">A SOUNDTRACK FOR YOUR SCROLL</span>
          <Music2 class="size-icon-16 text-text-muted" />
        </div>
        <div class="music-row">
          <div class="record-art" aria-hidden="true"><span class="record"><span>f.</span></span></div>
          <div class="min-w-0 flex-1">
            <p class="text-heading-h3">เขียว เหลือง แดง (Get high)</p>
            <p class="text-body-small text-text-muted mt-xxs">PUN, THE TOYS</p>
            <span class="track-caption">FULL TRACK · ON REPEAT</span>
          </div>
          <button type="button" data-music-control class="play-button" :aria-label="playing ? 'Pause music' : 'Play music'" @click="toggleMusic">
            <Pause v-if="playing" class="size-icon-24" /><Play v-else class="size-icon-24" />
          </button>
        </div>
        <audio ref="audio" :src="getHighUrl" preload="metadata" loop @playing="onPlaying" @pause="playing = false" @timeupdate="updateTime" @loadedmetadata="updateTime" @error="audioFailed = true" />
        <div class="audio-controls" data-music-control>
          <input class="audio-slider progress-slider" type="range" aria-label="Song position" min="0" :max="duration || 1" step="0.1" :value="currentTime" :disabled="!duration" :aria-valuetext="`${formatTime(currentTime)} of ${formatTime(duration)}`" @input="seek" />
          <div class="flex items-center justify-between gap-md">
            <span class="track-time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
            <label class="volume-control"><Volume2 class="size-icon-16" /><span class="sr-only">Music volume</span><input class="audio-slider" type="range" min="0" max="1" step="0.05" :value="volume" @input="setVolume" /></label>
          </div>
        </div>
        <p class="text-label-small text-text-muted mt-md" role="status">{{ audioFailed ? 'Unable to load the song. Please refresh and try again.' : playing ? 'Playing on repeat. Stay a little longer.' : manuallyStopped ? 'Music paused. Press Play to listen again.' : needsTap ? 'Tap Play to start the music.' : 'Tap or scroll to start the music.' }}</p>
      </section>

      <nav aria-label="Find Fujipp online" class="social-links">
        <a v-for="(link, index) in socials" :key="link.label" :href="link.href" target="_blank" rel="noopener noreferrer" class="links-card social-card">
          <AppIcon :source="link.icon" class="size-icon-24" />
          <div class="flex-1"><span class="social-name">{{ link.label }}</span><span class="social-detail">{{ link.detail }}</span></div>
          <span class="social-number">0{{ index + 1 }}</span>
          <ArrowUpRight class="size-icon-24 social-arrow" />
        </a>
      </nav>
      <footer class="links-footer"><span>© {{ new Date().getFullYear() }} FUJIPP</span></footer>
    </div>
  </main>
</template>

<style scoped>
.links-page { min-height: 100dvh; background: var(--semantic-color-background-bg-default); color: var(--semantic-color-text-text-primary); padding: var(--space-2xl) var(--layout-page-gutter); }
.links-column { width: 100%; max-width: calc(var(--icon-size-512) - var(--space-3xl)); margin-inline: auto; display: flex; flex-direction: column; gap: var(--space-xs); }
.mini-brand { display: inline-flex; align-items: center; gap: var(--space-xs); font-size: var(--font-size-label-small); letter-spacing: .06em; }
.mini-brand > .app-icon, .social-card > .app-icon { width: var(--icon-size-24); height: var(--icon-size-24); }
.theme-button { padding: var(--space-sm); border-radius: var(--corner-radius-full); cursor: pointer; }
.theme-button:hover { background: var(--semantic-color-background-bg-surface-hover); }
.links-card { background: var(--semantic-color-background-bg-surface); border: 1px solid var(--semantic-color-border-border-subtle); border-radius: var(--corner-radius-lg); padding: var(--space-lg); }
.intro-card { padding-block: var(--space-lg) var(--space-xl); overflow: hidden; }
.intro-card h1 { font-family: var(--font-family-sans); font-size: calc(var(--font-size-display-large) + var(--font-size-display-medium)); font-weight: var(--typography-font-weight-medium); line-height: var(--line-height-display); letter-spacing: -.085em; margin-block: var(--space-xl); }
.intro-star { font-size: var(--font-size-display-small); display: inline-block; vertical-align: top; margin-left: var(--space-sm); margin-top: var(--space-sm); }
.intro-caption { font-size: var(--font-size-heading-h2); line-height: var(--line-height-heading); color: var(--semantic-color-text-text-muted); letter-spacing: -.03em; }
.portfolio-link { margin-top: var(--space-xl); }
.eyebrow { font-size: var(--font-size-label-small); color: var(--semantic-color-text-text-muted); letter-spacing: .08em; }
.about-card p { margin-top: var(--space-lg); font-size: var(--font-size-heading-h2); line-height: var(--line-height-body); letter-spacing: -.025em; color: var(--semantic-color-text-text-secondary); }
.music-row { display: flex; align-items: center; gap: var(--space-md); }
.record-art { width: var(--icon-size-64); height: var(--icon-size-64); display: grid; place-items: center; border-radius: var(--corner-radius-md); background: var(--semantic-color-background-bg-surface-active); flex: none; }
.record { width: calc(var(--icon-size-64) - var(--space-sm)); aspect-ratio: 1; border-radius: var(--corner-radius-full); border: 1px solid var(--semantic-color-border-border-strong); display: grid; place-items: center; background: repeating-radial-gradient(circle, var(--semantic-color-background-bg-default) 0 2px, var(--semantic-color-border-border-subtle) 3px 4px); }
.record span { display: grid; place-items: center; width: var(--icon-size-24); height: var(--icon-size-24); border-radius: var(--corner-radius-full); background: var(--semantic-color-action-backgrounds-bg-primary); color: var(--semantic-color-action-text-text-on-primary); font-size: var(--font-size-label-small); }
.track-caption { display: inline-block; font-size: var(--font-size-label-small); color: var(--semantic-color-text-text-muted); margin-top: var(--space-sm); }
.play-button { display: grid; place-items: center; width: calc(var(--icon-size-32) + var(--space-md)); height: calc(var(--icon-size-32) + var(--space-md)); border-radius: var(--corner-radius-full); background: var(--semantic-color-action-backgrounds-bg-primary); color: var(--semantic-color-action-text-text-on-primary); flex: none; cursor: pointer; }
.audio-controls { display: grid; gap: var(--space-sm); margin-top: var(--space-lg); }
.audio-slider { min-width: 0; accent-color: var(--semantic-color-text-text-primary); cursor: pointer; }
.progress-slider { width: 100%; }
.track-time { font-size: var(--font-size-label-small); color: var(--semantic-color-text-text-muted); font-variant-numeric: tabular-nums; }
.volume-control { display: flex; align-items: center; gap: var(--space-xs); color: var(--semantic-color-text-text-muted); }
.volume-control input { width: var(--icon-size-64); }
.social-links { display: grid; gap: var(--space-xs); }
.social-card { display: flex; align-items: center; gap: var(--space-md); transition: background-color .2s, transform .2s; }
.social-card:hover { background: var(--semantic-color-background-bg-surface-hover); transform: translateY(-2px); }
.social-name { display: block; font-size: var(--font-size-body-large); font-weight: var(--typography-font-weight-medium); }
.social-detail { display: block; margin-top: var(--space-xxs); color: var(--semantic-color-text-text-muted); font-size: var(--font-size-label-small); }
.social-number { color: var(--semantic-color-text-text-muted); font-size: var(--font-size-label-small); }
.links-footer { display: flex; justify-content: space-between; gap: var(--space-md); padding: var(--space-lg) var(--space-xs); font-size: var(--font-size-label-small); color: var(--semantic-color-text-text-muted); letter-spacing: .04em; }
@media (prefers-reduced-motion: reduce) { .social-card { transition: none; } .social-card:hover { transform: none; } }
</style>
