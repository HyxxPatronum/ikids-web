import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      name: 'React UI',
      command: 'node node_modules/vinext/dist/cli.js start --port 4175',
      url: 'http://127.0.0.1:4175/words',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      name: 'Cloudflare API',
      command: 'node node_modules/vinext/dist/cli.js dev --port 4176',
      url: 'http://127.0.0.1:4176/api/health',
      reuseExistingServer: true,
      env: { ...process.env, CONTENT_EDITOR_PREVIEW_TOKEN: 'playwright-preview-token' },
      timeout: 120_000,
    },
  ],
});
