import { fileURLToPath, URL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const developmentTools =
  process.env.VUE_DEVTOOLS === 'true'
    ? (vueDevTools() as Plugin[]).map((plugin) => ({
        ...plugin,
        apply: 'serve' as const,
      }))
    : []

function sitePreviewMetadata(): Plugin {
  let siteOrigin = 'https://fujipp.com'

  function discordPreview(html: string, origin: string) {
    const image = new URL('/icons/brand/site-preview.png?v=2', origin).href
    const metadata: Record<string, string> = {
      'og:image': image,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': 'FUJIPP — Websites. Bots. Automation. on a graphite background',
      'twitter:card': 'summary_large_image',
      'twitter:image': image,
      'twitter:image:alt': 'FUJIPP — Websites. Bots. Automation. on a graphite background',
    }
    return html.replace(
      /(<meta\s+(?:property|name)="([^"]+)"\s+content=")([^"]*)(")/g,
      (tag, prefix: string, name: string, _content: string, suffix: string) =>
        metadata[name] ? `${prefix}${metadata[name]}${suffix}` : tag,
    )
  }

  return {
    name: 'fujipp-site-preview-metadata',
    configResolved(config) {
      siteOrigin = new URL(config.env.VITE_SITE_URL?.trim() || siteOrigin).origin
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname
        if (
          !['GET', 'HEAD'].includes(request.method ?? '') ||
          !/Discordbot/i.test(request.headers['user-agent'] ?? '') ||
          path.startsWith('/api/') ||
          (extname(path) && extname(path) !== '.html')
        )
          return next()
        try {
          const origin = server.resolvedUrls?.local[0] ?? siteOrigin
          const html = discordPreview(
            await readFile(resolve(server.config.root, 'index.html'), 'utf8'),
            origin,
          )
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.setHeader('Vary', 'User-Agent')
          response.setHeader('Cache-Control', 'no-cache')
          response.end(await server.transformIndexHtml(path, html))
        } catch (error) {
          next(error)
        }
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        // Resolve before Vite processes image URLs, including on nested routes.
        const origin = context.server?.resolvedUrls?.local[0] ?? siteOrigin
        return html.replaceAll('__FUJIPP_SITE_ORIGIN__', new URL(origin).origin)
      },
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle['index.html']
        if (index?.type !== 'asset') return
        // Static hosting serves this variant only to Discord's link crawler.
        // Keep the same page and built assets; only its preview metadata differs.
        this.emitFile({
          type: 'asset',
          fileName: 'discord-preview.html',
          source: discordPreview(String(index.source), siteOrigin),
        })
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
    rolldownOptions: {
      output: {
        codeSplitting: {
          // These libraries are already required by the app shell. Compress them
          // together so additional session logic stays within every route budget.
          groups: [
            {
              name: 'vue-framework',
              test: /node_modules[\\/](?:@vue[\\/]|@intlify[\\/]|vue[\\/]|vue-router[\\/]|vue-i18n[\\/]|pinia[\\/])/,
            },
          ],
        },
      },
    },
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
