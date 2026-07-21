const { test, expect } = require('@playwright/test');

// PAS-692 — staff-scoped payout/compensation visibility.
// Runs under the `staff` project (non-admin session, playwright/.auth/staff.json).
// Counterpart to PS-01 in tests/admin/new-features.spec.js, which asserts the
// ADMIN sees the full data (incl. the platform fee). Here we assert a staff user
// does NOT see the platform-level payout data.
//
// Account: a limited "staff / photographer"-role user (no wildcard / roles.manage).

const BASE = 'https://uat-phlox-admin.netlify.app';
const EVENT_ID = 5065; // stable event with orders, a professional, and payouts

test.describe('PAS-692 · staff-scoped payout visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/events/view-event/${EVENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Event Details', { exact: false }).first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1500);
  });

  test('PS-02 staff can open the event and its Sales Analysis', async ({ page }) => {
    // Staff still has read access to the event + a Sales Analysis section...
    await expect(page.getByText(/Sales analysis/i).first()).toBeVisible();
  });

  test('PS-03 staff does NOT see the platform fee / platform-level payout', async ({ page }) => {
    const body = await page.locator('body').innerText();
    // The "Vypesideline" platform-fee line and platform total are admin-only.
    // (Admin sees them — asserted by PS-01 in the admin project.)
    expect(body).not.toMatch(/vypesideline/i);
    expect(body).not.toMatch(/platform fee/i);
  });
});
