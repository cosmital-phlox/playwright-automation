const { test, expect } = require('@playwright/test');

// Each sidebar item and the route it should open.
const SIDEBAR = [
  ['Events', '/events'],
  ['Spotlight Bundles', '/bundles'],
  ['Orders', '/orders'],
  ['Users', '/users'],
  ['Organizations', '/organizations'],
  ['Products', '/products'],
  ['Coupons', '/coupons'],
  ['Gift Cards', '/giftcards'],
  ['Categories', '/categories'],
  ['Levels', '/levels'],
  ['School Districts', '/school-districts'],
  ['Zenfolio', '/browse-and-buy'],
  ['Payouts', '/payout'],
  ['Reports', '/reports'],
];

test('Sidebar links navigate to every admin module', async ({ page }) => {
  await page.goto('https://uat-phlox-admin.netlify.app/events', { waitUntil: 'domcontentloaded' });
  const sidebar = page.getByRole('complementary');
  await expect(sidebar.getByRole('link', { name: 'Events', exact: true })).toBeVisible({ timeout: 25000 });

  for (const [label, path] of SIDEBAR) {
    const re = new RegExp(`${path}(\\?|$)`);
    // Sidebar navigation is slow (~3s) and under load the app can bounce to "/".
    // Click and wait for the URL to settle; if it didn't reach the target, click
    // again (each attempt waits fully — no rapid mid-navigation re-clicking).
    let reached = false;
    for (let attempt = 0; attempt < 3 && !reached; attempt++) {
      await sidebar.getByRole('link', { name: label, exact: true }).click();
      reached = await page
        .waitForURL(re, { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
    }
    expect(reached, `sidebar "${label}" should navigate to ${path}`).toBeTruthy();
    // The sidebar persists across pages — confirm it's still there for the next click.
    await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
