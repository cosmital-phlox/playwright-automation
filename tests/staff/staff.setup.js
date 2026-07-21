const { test: setup, expect } = require('@playwright/test');
const fs = require('fs');

// One-time login for a NON-ADMIN staff user on UAT admin (uat-phlox-admin),
// used to verify per-role enforcement / staff-scoped visibility (PAS-692) that
// the admin account can't exercise. Saves the session to
// playwright/.auth/staff.json (gitignored). The PASSWORD must come from env:
//   STAFF_PASSWORD=... npx playwright test --project=staff-setup
// Default account is a limited "staff / photographer"-role user (no wildcard,
// no roles.manage). Override with STAFF_EMAIL if needed.
const authFile = 'playwright/.auth/staff.json';
const BASE = 'https://uat-phlox-admin.netlify.app';
const EMAIL = process.env.STAFF_EMAIL || 'raj.pal@hnrtech.com';
const PASSWORD = process.env.STAFF_PASSWORD;

function hasSavedSession() {
  if (!fs.existsSync(authFile)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    return (state.cookies || []).some((c) => c.name === 'token' && c.value);
  } catch {
    return false;
  }
}

setup('authenticate staff', async ({ browser }) => {
  if (hasSavedSession()) {
    setup.skip(true, 'Saved staff session present — skipping login.');
    return;
  }
  if (!PASSWORD) {
    throw new Error(
      'No staff session and STAFF_PASSWORD not set. Run with ' +
        'STAFF_PASSWORD=... npx playwright test --project=staff-setup (see staff.setup.js).'
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
