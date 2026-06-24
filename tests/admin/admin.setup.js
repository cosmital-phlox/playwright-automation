const { test: setup, expect } = require('@playwright/test');
const fs = require('fs');

const authFile = 'playwright/.auth/admin.json';

// Admin credentials (sandbox). Override via env if needed:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx playwright test --project=admin-setup
const EMAIL = process.env.ADMIN_EMAIL || 'dhaval.kukadia@hnrtech.com';
const PASSWORD = process.env.ADMIN_PASSWORD || '123456';

// True if we already have a saved session carrying an auth token cookie.
function hasSavedSession() {
  if (!fs.existsSync(authFile)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    return (state.cookies || []).some((c) => c.name === 'token' && c.value);
  } catch {
    return false;
  }
}

// Runs once before the admin suite. Reuses the saved session when present;
// otherwise performs a fresh email + password login (fully automated — no OTP).
//
// If the admin tests ever start failing as if logged out, the session has
// expired — refresh it with:  npx playwright test --project=admin-setup
setup('authenticate admin', async ({ browser }) => {
  if (hasSavedSession()) {
    setup.skip(true, 'Saved admin session present — skipping login.');
    return;
  }

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('https://uat-phlox-admin.netlify.app/', { waitUntil: 'domcontentloaded' });

  // The app runs a verify-token check on load and re-renders the form, which
  // wipes anything typed too early — wait for it to settle before filling.
  const email = page.getByPlaceholder('Enter Your Email');
  await expect(email).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000);

  await email.click();
  await email.fill(EMAIL);
  const pwd = page.getByPlaceholder('Enter Your Password');
  await pwd.click();
  await pwd.fill(PASSWORD);

  // Guard against the early-render wipe: re-fill if the values didn't stick.
  if ((await email.inputValue()) !== EMAIL) await email.fill(EMAIL);
  if ((await pwd.inputValue()) !== PASSWORD) await pwd.fill(PASSWORD);

  await page.getByRole('button', { name: 'Login' }).click();

  // A successful login lands on the Events dashboard.
  await expect(page).toHaveURL(/\/events/, { timeout: 30000 });

  await ctx.storageState({ path: authFile });
  await ctx.close();
});
