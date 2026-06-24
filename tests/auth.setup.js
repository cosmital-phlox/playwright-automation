const { test: setup, expect } = require('@playwright/test');
const fs = require('fs');

const authFile = 'playwright/.auth/user.json';
const EMAIL = 'raj.pal@hnrtech.com';

// True if we have a saved session file that still carries an auth token cookie.
function hasSavedSession() {
  if (!fs.existsSync(authFile)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    return (state.cookies || []).some((c) => c.name === 'token' && c.value);
  } catch {
    return false;
  }
}

// Runs once before the suite. Reuses the saved session when present; otherwise
// performs a fresh login (enter the OTP manually at the pause — run --headed).
//
// NOTE: the app's login state isn't reliably detectable headlessly (no route
// guard, flaky page loads, duplicated/hidden nav elements), so we trust the
// saved token cookie. If the tests ever fail as if logged out, the session has
// expired server-side — refresh it with:  npx playwright test --project=setup --headed
setup('authenticate', async ({ browser }) => {
  if (hasSavedSession()) {
    setup.skip(true, 'Saved session present — skipping login.');
    return;
  }

  // In CI the login is OTP-based and cannot be entered unattended. Rather than
  // hang on page.pause(), fail fast with a clear message — CI is expected to
  // restore a pre-baked session from the FRONTEND_STORAGE_STATE secret (see
  // CI-SETUP.md). Locally, fall through to the interactive OTP login below.
  if (process.env.CI) {
    throw new Error(
      'No saved frontend session in CI. Add the FRONTEND_STORAGE_STATE secret ' +
        '(base64 of playwright/.auth/user.json) — see CI-SETUP.md.'
    );
  }

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('https://uat-phlox-frontend.netlify.app/');
  await page.getByText('Login').nth(1).click();
  await page.getByRole('textbox').fill(EMAIL);
  await page.getByRole('button', { name: 'Login' }).click();

  // Enter OTP manually, then resume in the Inspector (must run with --headed).
  await page.pause();

  // Confirm we're logged in before saving the session.
  await expect(page).toHaveURL(/spotlights/);

  await ctx.storageState({ path: authFile });
  await ctx.close();
});
