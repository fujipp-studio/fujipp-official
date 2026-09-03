import { readFileSync } from 'node:fs'
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config'
import { fixtureResponse } from './e2e/fixtures/api'

const fixtureHtml = readFileSync(new URL('./e2e/fixtures/index.html', import.meta.url), 'utf8')
export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      {
        name: 'local-smoke-fixtures',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
            if (path.startsWith('/api/')) {
              let raw = ''
              for await (const chunk of request) raw += String(chunk)
              const input =
                raw && request.headers['content-type']?.includes('application/json')
                  ? (JSON.parse(raw) as Record<string, unknown>)
                  : {}
              response.setHeader('Content-Type', 'application/json')
              response.end(JSON.stringify(fixtureResponse(path, request.method ?? 'GET', input)))
              return
            }
            if (request.method === 'GET' && request.headers.accept?.includes('text/html')) {
              response.setHeader('Content-Type', 'text/html')
              response.end(await server.transformIndexHtml(path, fixtureHtml))
              return
            }
            next()
          })
        },
      },
    ],
  }),
)
