<script setup lang="ts">
import { ref } from 'vue'
import { ArrowUpRight, Moon, Sun, Music2, Play, X } from 'lucide-vue-next'
import { icons } from '../../../config'
import AppIcon from '../../../shared/ui/icons/AppIcon.vue'

const dark = ref(true)
const musicOpen = ref(false)
const playlist = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
const socials = [
  { label: 'Instagram', detail: 'A little behind the scenes', href: 'https://www.instagram.com/fujipp.official/', icon: icons.social.instagram },
  { label: 'GitHub', detail: 'Things I’m building', href: 'https://github.com/Fujipp', icon: icons.social.github },
  { label: 'Discord', detail: 'Come say hello', href: 'https://discord.gg/nRn7YDwGSH', icon: icons.social.discord },
  { label: 'LinkedIn', detail: 'Let’s connect', href: 'https://www.linkedin.com/in/anawat-boripakhirun-aa1799426', icon: icons.social.linkedin },
]
</script>

<template>
  <main class="links-page" :data-theme="dark ? 'dark' : 'light'">
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
        <a class="contact-link" href="mailto:anawat.boripakhirun@gmail.com">
          Let’s make something <ArrowUpRight class="size-icon-24" />
        </a>
      </section>

      <section class="links-card about-card" aria-label="About Fujipp">
        <span class="eyebrow">A LITTLE ABOUT ME</span>
        <p>I’m Anawat. I build websites, Discord bots, and digital experiences that make everyday things a little easier.</p>
        <RouterLink to="/work" class="inline-link">Explore my work <ArrowUpRight class="size-icon-16" /></RouterLink>
      </section>

      <section class="links-card music-card" aria-label="Music">
        <div class="flex items-center justify-between mb-lg">
          <span class="eyebrow">A SOUNDTRACK FOR YOUR SCROLL</span>
          <Music2 class="size-icon-16 text-text-muted" />
        </div>
        <div class="music-row">
          <div class="record-art" aria-hidden="true"><span class="record"><span>f.</span></span></div>
          <div class="min-w-0 flex-1">
            <p class="text-heading-h3">Today’s Top Hits</p>
            <p class="text-body-small text-text-muted mt-xxs">A little pop. A little good energy.</p>
            <a :href="playlist" target="_blank" rel="noopener noreferrer" class="spotify-link">CURATED BY SPOTIFY ↗</a>
          </div>
          <button type="button" class="play-button" :aria-expanded="musicOpen" aria-controls="links-music-player" :aria-label="musicOpen ? 'Close music player' : 'Open music player'" @click="musicOpen = !musicOpen">
            <X v-if="musicOpen" class="size-icon-24" /><Play v-else class="size-icon-24" />
          </button>
        </div>
        <div v-if="musicOpen" id="links-music-player" class="player-wrap">
          <iframe title="Today’s Top Hits Spotify music player" src="https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0" width="100%" height="352" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
          <p class="text-label-small text-text-muted mt-sm">Press play in Spotify to listen. <a :href="playlist" target="_blank" rel="noopener noreferrer" class="underline">Open Spotify ↗</a></p>
        </div>
      </section>

      <nav aria-label="Find Fujipp online" class="social-links">
        <a v-for="(link, index) in socials" :key="link.label" :href="link.href" target="_blank" rel="noopener noreferrer" class="links-card social-card">
          <AppIcon :source="link.icon" class="size-icon-24" />
          <div class="flex-1"><span class="social-name">{{ link.label }}</span><span class="social-detail">{{ link.detail }}</span></div>
          <span class="social-number">0{{ index + 1 }}</span>
          <ArrowUpRight class="size-icon-24 social-arrow" />
        </a>
      </nav>
      <footer class="links-footer"><span>© {{ new Date().getFullYear() }} FUJIPP</span><RouterLink to="/">BACK TO WEBSITE ↗</RouterLink></footer>
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
.contact-link { display: inline-flex; align-items: center; gap: var(--space-xs); margin-top: var(--space-xl); padding-bottom: var(--space-xxs); border-bottom: 1px solid var(--semantic-color-border-border-strong); font-size: var(--font-size-body-large); }
.eyebrow { font-size: var(--font-size-label-small); color: var(--semantic-color-text-text-muted); letter-spacing: .08em; }
.about-card p { margin-top: var(--space-lg); font-size: var(--font-size-heading-h2); line-height: var(--line-height-body); letter-spacing: -.025em; color: var(--semantic-color-text-text-secondary); }
.inline-link { display: inline-flex; align-items: center; gap: var(--space-xs); margin-top: var(--space-lg); font-size: var(--font-size-body-small); }
.music-row { display: flex; align-items: center; gap: var(--space-md); }
.record-art { width: var(--icon-size-64); height: var(--icon-size-64); display: grid; place-items: center; border-radius: var(--corner-radius-md); background: var(--semantic-color-background-bg-surface-active); flex: none; }
.record { width: calc(var(--icon-size-64) - var(--space-sm)); aspect-ratio: 1; border-radius: var(--corner-radius-full); border: 1px solid var(--semantic-color-border-border-strong); display: grid; place-items: center; background: repeating-radial-gradient(circle, var(--semantic-color-background-bg-default) 0 2px, var(--semantic-color-border-border-subtle) 3px 4px); }
.record span { display: grid; place-items: center; width: var(--icon-size-24); height: var(--icon-size-24); border-radius: var(--corner-radius-full); background: var(--semantic-color-action-backgrounds-bg-primary); color: var(--semantic-color-action-text-text-on-primary); font-size: var(--font-size-label-small); }
.spotify-link { display: inline-block; font-size: var(--font-size-label-small); color: var(--semantic-color-text-text-muted); margin-top: var(--space-sm); }
.play-button { display: grid; place-items: center; width: calc(var(--icon-size-32) + var(--space-md)); height: calc(var(--icon-size-32) + var(--space-md)); border-radius: var(--corner-radius-full); background: var(--semantic-color-action-backgrounds-bg-primary); color: var(--semantic-color-action-text-text-on-primary); flex: none; cursor: pointer; }
.player-wrap { margin-top: var(--space-lg); }
.player-wrap iframe { border: 0; border-radius: var(--corner-radius-md); }
.social-links { display: grid; gap: var(--space-xs); }
.social-card { display: flex; align-items: center; gap: var(--space-md); transition: background-color .2s, transform .2s; }
.social-card:hover { background: var(--semantic-color-background-bg-surface-hover); transform: translateY(-2px); }
.social-name { display: block; font-size: var(--font-size-body-large); font-weight: var(--typography-font-weight-medium); }
.social-detail { display: block; margin-top: var(--space-xxs); color: var(--semantic-color-text-text-muted); font-size: var(--font-size-label-small); }
.social-number { color: var(--semantic-color-text-text-muted); font-size: var(--font-size-label-small); }
.links-footer { display: flex; justify-content: space-between; gap: var(--space-md); padding: var(--space-lg) var(--space-xs); font-size: var(--font-size-label-small); color: var(--semantic-color-text-text-muted); letter-spacing: .04em; }
@media (prefers-reduced-motion: reduce) { .social-card { transition: none; } .social-card:hover { transform: none; } }
</style>
