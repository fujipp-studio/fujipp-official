import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5174'
const backendURL = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:8081'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'bun run dev --host 127.0.0.1 --port 5174',
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_BACKEND_URL: backendURL,
      },
    },
    {
      command:
        '../backend/mvnw -f ../backend/pom.xml spring-boot:run -Dspring-boot.run.arguments=--server.port=8081',
      url: `${backendURL}/actuator/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        APP_CORS_ALLOWED_ORIGINS: baseURL,
        SPRING_PROFILES_ACTIVE: 'local',
      },
    },
  ],
})
