import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/acceptance',
  testIgnore: '**/assetflow-api.spec.ts',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
  },
})
