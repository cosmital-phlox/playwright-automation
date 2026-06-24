const { test, expect } = require('@playwright/test');

const LOGIN_URL = 'https://uat-phlox-admin.netlify.app/';
const EMAIL = 'dhaval.kukadia@hnrtech.com';

// ---------------------------------------------------------------------------
// Login negatives + protected routes — run logged OUT (no saved session).
// ---------------------------------------------------------------------------
test.describe('Admin login (logged out)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // The app runs a token check on load and re-renders the form, which wipes
  // anything typed too early — wait for it to settle before interacting.
  async function gotoLogin(page) {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('Enter Your Email')).toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(2500);
  }

  test('Login page loads with its fields', async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByPlaceholder('Enter Your Email')).toBeVisible();
    await expect(page.getByPlaceholder('Enter Your Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByText(/Forgot your password/i)).toBeVisible();
  });

  test('Submitting an empty form shows required-field validation', async ({ page }) => {
    await gotoLogin(page);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Please enter the Email!').first()).toBeVisible();
    await expect(page.getByText('Please enter the Password!').first()).toBeVisible();
  });

  test('A password shorter than 6 characters is rejected', async ({ page }) => {
    await gotoLogin(page);
    await page.getByPlaceholder('Enter Your Email').fill(EMAIL);
    await page.getByPlaceholder('Enter Your Password').fill('123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText(/minimum 6 characters/i).first()).toBeVisible();
  });

  test('Wrong credentials show an error and stay on the login screen', async ({ page }) => {
    await gotoLogin(page);
    await page.getByPlaceholder('Enter Your Email').fill(EMAIL);
    await page.getByPlaceholder('Enter Your Password').fill('wrongpass999');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText(/Please Check the Credentials/i)).toBeVisible({ timeout: 15000 });
    // Still on the login screen (not authenticated).
    await expect(page.getByPlaceholder('Enter Your Email')).toBeVisible();
  });

  test('An admin route redirects to login when not authenticated', async ({ page }) => {
    await page.goto('https://uat-phlox-admin.netlify.app/events', { waitUntil: 'domcontentloaded' });
    // No session -> bounced to the login screen.
    await expect(page.getByPlaceholder('Enter Your Email')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Logout — runs with the saved admin session (the default for this project).
// (Logging out only clears this context; the saved session file is untouched,
// so other admin specs are unaffected.)
// ---------------------------------------------------------------------------
test.describe('Admin session (logged in)', () => {
  test('Logout returns to the login screen', async ({ page }) => {
    await page.goto('https://uat-phlox-admin.netlify.app/events', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Logout')).toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(3000); // let the page settle before clicking

    // Retry the Logout click until the login screen appears (it can misfire
    // while the page is still loading).
    await expect(async () => {
      if (await page.getByPlaceholder('Enter Your Email').isVisible().catch(() => false)) return;
      await page.getByText('Logout').first().click();
      await expect(page.getByPlaceholder('Enter Your Email')).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 25000 });
  });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
