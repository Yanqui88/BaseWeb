import { defineConfig, devices } from '@playwright/test';

// URL de la DB de prueba temporal — se inyecta en webServer y en el global-setup
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://proyectoweb:proyectoweb@localhost:5432/proyectoweb_test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',

  // Script que se ejecuta UNA VEZ antes de todos los tests:
  // recrea la DB de prueba y carga el seed.
  globalSetup: require.resolve('./global-setup.ts'),

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm --dir ../.. dev',
    url: 'http://localhost:4000/',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    // Inyectamos DATABASE_URL para que Next.js y NestJS apunten a la DB de prueba
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NEXT_PUBLIC_TENANT_SLUG: 'test-tenant',
    },
  },
});
