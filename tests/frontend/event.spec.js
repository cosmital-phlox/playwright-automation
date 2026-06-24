const { test, expect } = require('@playwright/test');

test('Verify all tabs are visible', async ({ page }) => {
  // Already logged in via saved session (see auth.setup.js).
  await page.goto('https://uat-phlox-frontend.netlify.app/');

  // Navigate to Events page
  await page.getByRole('navigation').getByRole('link', { name: 'Future Events' }).click();
  await expect(page).toHaveURL(/events-bundles/);

  // The tabs are listitems inside a list. Scope to that list (via the
  // unique "Tournaments" text) so "Spotlight Bundles" doesn't also match
  // the footer link.
  const tabs = page.getByRole('list').filter({ hasText: 'Tournaments' });

  // Now verify the tabs
  await expect(tabs.getByText('All', { exact: true })).toBeVisible();
  await expect(tabs.getByText('Games', { exact: true })).toBeVisible();
  await expect(tabs.getByText('Tournaments', { exact: true })).toBeVisible();
  await expect(tabs.getByText('Spotlight Bundles', { exact: true })).toBeVisible();
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
