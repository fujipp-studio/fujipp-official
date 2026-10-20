import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const developmentTools = process.env.VUE_DEVTOOLS === 'true'
  ? (vueDevTools() as Plugin[]).map((plugin) => ({
      ...plugin,
      apply: 'serve' as const,
    }))
  : []

function sitePreviewMetadata(): Plugin {
  let siteOrigin = 'https://fujipp.com'

  return {
    name: 'fujipp-site-preview-metadata',
    configResolved(config) {
      siteOrigin = new URL(config.env.VITE_SITE_URL?.trim() || siteOrigin).origin
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        // Resolve before Vite processes image URLs, including on nested routes.
        const origin = context.server?.resolvedUrls?.local[0] ?? siteOrigin
        return html.replaceAll('__FUJIPP_SITE_ORIGIN__', new URL(origin).origin)
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), ...developmentTools, tailwindcss(), sitePreviewMetadata()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@price-reader': fileURLToPath(
        new URL('../bot-runner/src/features/price-reader', import.meta.url),
      ),
    },
  },
  build: {
    manifest: true,
  },
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        fileURLToPath(new URL('../bot-runner/src/features/price-reader', import.meta.url)),
      ],
    },
  },
})
