import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const developmentTools = (vueDevTools() as Plugin[]).map((plugin) => ({
  ...plugin,
  apply: 'serve' as const,
}))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), ...developmentTools, tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    manifest: true,
  },
})
