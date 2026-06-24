const { test, expect } = require('@playwright/test');

// The account dropdown (top-right, class .user-details) opens on click and
// contains My Spotlights, My Orders, and Logout.
test('Logout from the account menu', async ({ page }) => {
  // Already logged in via saved session (see auth.setup.js).
  await page.goto('https://uat-phlox-frontend.netlify.app/events-bundles');
  const account = page.locator('.navbar-item.has-dropdown.user-details');
  await expect(account).toBeVisible({ timeout: 20000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // Open the account dropdown and click Logout.
  await account.locator('a.navbar-link').click();
  await account.getByText('Logout', { exact: true }).click();

  // After logout the account dropdown is gone and Login is offered again
  // (target the visible Login — there's a hidden mobile-menu duplicate).
  await expect(page.locator('.navbar-item.has-dropdown.user-details')).toHaveCount(0);
  await expect(page.getByText('Login').filter({ visible: true }).first()).toBeVisible({
    timeout: 10000,
  });
});

test('My Orders lists placed orders', async ({ page }) => {
  await page.goto('https://uat-phlox-frontend.netlify.app/orders');
  await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible({ timeout: 20000 });
  // At least one order row (order number + a Receipts action) is shown.
  await expect(page.getByText(/#\d+/).first()).toBeVisible();
  await expect(page.getByText(/Receipts/i).first()).toBeVisible();
});

// Simulated session expiry: clearing the auth cookies logs the user out.
test('Clearing the session logs the user out', async ({ page }) => {
  await page.goto('https://uat-phlox-frontend.netlify.app/events-bundles');
  await expect(page.locator('.navbar-item.has-dropdown.user-details')).toBeVisible({ timeout: 20000 });

  await page.context().clearCookies();
  await page.reload();

  // The account dropdown is gone and Login is shown again.
  await expect(page.locator('.navbar-item.has-dropdown.user-details')).toHaveCount(0);
  await expect(page.getByText('Login').filter({ visible: true }).first()).toBeVisible({
    timeout: 15000,
  });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
