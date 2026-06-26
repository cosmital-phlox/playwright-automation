// @ts-check
import { defineConfig, devices } from '@playwright/test';

// Demo mode: `DEMO=1 npx playwright test --project=chromium`
// Runs headed on real Google Chrome and slows every action so an audience can
// watch. Optional pause between tests via DEMO_PAUSE (ms). Normal runs (no DEMO)
// are completely unaffected.
const DEMO = !!process.env.DEMO;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* The live backend can be slow and the events list sometimes needs several
     reloads (see helpers.js), so allow more time per test than the 30s default. */
  timeout: 120 * 1000,
  /* Pages (cart, events, spotlights) render their data slowly, so give every
     assertion more than the 5s default to avoid flaky "element not found". */
  expect: { timeout: 15 * 1000 },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry to absorb the flaky live backend (pages occasionally load empty /
     slowly). One retry absorbs a single transient miss; we dropped from 2 to 1
     because on a slow-backend window each retry re-runs a test at the full
     120s+ timeout serially, which was ballooning CI runs toward an hour. */
  retries: 1,
  /* Workers default to 1 because the app talks to a shared live backend that
     slows down / rate-limits under parallel load, causing flaky "still loading"
     failures. Tunable via PW_WORKERS so CI can experiment with parallelism
     without a code change — bump it only if runs stay green at the higher value;
     back off if flaky/failed counts rise. */
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters
     In CI: never auto-open the HTML report, also emit JSON (so the Slack
     notifier can read pass/fail counts) and a line log. Locally: keep the
     auto-opening HTML report. */
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'results.json' }],
        ['line'],
      ]
    : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Cap a single navigation so a hung page.goto fails (and retries) in ~60s
       instead of eating the whole 120s test timeout. */
    navigationTimeout: 60 * 1000,

    /* Demo mode: real Chrome, headed, slowed down so every action is visible. */
    ...(DEMO
      ? {
          headless: false,
          channel: 'chrome',
          launchOptions: { slowMo: 800 },
        }
      : {}),
  },

  /* Configure projects for major browsers */
  projects: [
    // Logs in once and saves the session to playwright/.auth/user.json.
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },

    {
      name: 'chromium',
      // Admin specs live under tests/admin and run via the `admin` project only.
      testIgnore: /admin\//,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      testIgnore: /admin\//,
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // --- Admin panel (uat-phlox-admin.netlify.app) ---
    // Logs in once (email + password) and saves the session to admin.json.
    {
      name: 'admin-setup',
      testMatch: /admin\.setup\.js/,
    },
    {
      name: 'admin',
      testMatch: /admin\/.*\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['admin-setup'],
    },

    {
      name: 'webkit',
      testIgnore: /admin\//,
      use: {
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

