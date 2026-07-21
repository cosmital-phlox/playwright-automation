const { test, expect } = require('@playwright/test');

// New-feature coverage for the 13 Jul 2026 deployment (gaps not covered by the
// other admin specs). Runs under the `admin` project (UAT admin session).
// See NEW_FEATURES_TEST_CASES.md for the full manual matrix.

const BASE = 'https://uat-phlox-admin.netlify.app';
// A stable, fully-populated Sideline event used as the detail-view fixture.
const EVENT_ID = 5065;

// --- PAS-686 Sales Analysis + event detail view (Tracker / Gallery) ---
test.describe('Event detail — Sales Analysis, Tracker, Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/events/view-event/${EVENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Event Details', { exact: false }).first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1500);
  });

  test('SA-01 Sales Analysis section renders on an event', async ({ page }) => {
    await expect(page.getByText('Sales Analysis', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Total sales', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Total payout', { exact: false }).first()).toBeVisible();
  });

  test('EV-02 Status shows Weblink and Zenfolio folder', async ({ page }) => {
    await expect(page.getByText('Weblink', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Zenfolio folder/i).first()).toBeVisible();
  });

  test('EV-03 Tracker section shows fulfillment + gallery status', async ({ page }) => {
    await expect(page.getByText('Tracker', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/fulfilled/i).first()).toBeVisible();
    await expect(page.getByText(/Browse & Buy Gallery/i).first()).toBeVisible();
  });

  test('EV-04 Gallery / deliverables lists the Zenfolio gallery', async ({ page }) => {
    await expect(page.getByText(/Zenfolio galleries/i).first()).toBeVisible();
    // the deliverable gallery link id (e/p<digits>) is shown on the view page
    await expect(page.getByText(/e\/p\d+/i).first()).toBeVisible();
  });
});

// --- PAS-703 Media Day Status filter + Clear All ---
test.describe('Media Day listing — Status filter (PAS-703)', () => {
  test('MDF-01 Status filter and Clear All are present on the Media Days tab', async ({ page }) => {
    await page.goto(`${BASE}/events`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.getByRole('tab', { name: /Media Day/i }).first().click();
    await page.waitForTimeout(3500);
    await expect(page.getByText('Status', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Clear All/i).first()).toBeVisible();
  });
});

// --- PAS-705 "Browse & Buy" -> "Zenfolio" page title ---
// NOTE: not applied on UAT as of this deployment — the page still reads
// "Browse & Buy". Marked fixme so it flags as pending, not a hard failure.
test.describe('Browse & Buy -> Zenfolio rename (PAS-705)', () => {
  test.fixme('ZN-01 page title reads "Zenfolio" (NOT applied on UAT)', async ({ page }) => {
    await page.goto(`${BASE}/browse-and-buy`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await expect(page).toHaveTitle(/Zenfolio/i);
  });

  test('ZN-01b current UAT title is still "Browse & Buy" (documents the gap)', async ({ page }) => {
    await page.goto(`${BASE}/browse-and-buy`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Characterization: confirms PAS-705 has NOT reached UAT yet.
    await expect(page).toHaveTitle(/Browse & Buy/i);
  });
});
