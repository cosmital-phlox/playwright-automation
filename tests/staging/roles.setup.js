const { test: setup, expect } = require('@playwright/test');
const fs = require('fs');

// One-time login for the STAGING admin (phlox-admin.netlify.app), where the
// Roles / RBAC module lives. Saves the session to playwright/.auth/staging.json
// (gitignored). The Roles spec runs under the `staging` project, which loads
// this session.
//
// Credentials: email defaults to the QA Super Admin; the PASSWORD must be
// supplied via env (kept out of the repo — it's a live staging credential):
//   STAGING_PASSWORD=... npx playwright test --project=staging-setup
const authFile = 'playwright/.auth/staging.json';
const BASE = 'https://phlox-admin.netlify.app';
const EMAIL = process.env.STAGING_EMAIL || 'qa.superadmin@testlify.com';
const PASSWORD = process.env.STAGING_PASSWORD;

function hasSavedSession() {
  if (!fs.existsSync(authFile)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    return (state.cookies || []).some((c) => c.name === 'token' && c.value);
  } catch {
    return false;
  }
}

setup('authenticate staging', async ({ browser }) => {
  if (hasSavedSession()) {
    setup.skip(true, 'Saved staging session present — skipping login.');
    return;
  }
  if (!PASSWORD) {
    throw new Error(
      'No staging session and STAGING_PASSWORD not set. Run with ' +
        'STAGING_PASSWORD=... npx playwright test --project=staging-setup (see roles.setup.js).'
    );
  }

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const email = page.getByPlaceholder('Enter Your Email');
  await expect(email).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000); // form re-renders after the verify-token check

  await email.fill(EMAIL);
  const pwd = page.getByPlaceholder('Enter Your Password');
  await pwd.fill(PASSWORD);
  if ((await email.inputValue()) !== EMAIL) await email.fill(EMAIL);
  if ((await pwd.inputValue()) !== PASSWORD) await pwd.fill(PASSWORD);

  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/events/, { timeout: 30000 });

  await ctx.storageState({ path: authFile });
  await ctx.close();
});
