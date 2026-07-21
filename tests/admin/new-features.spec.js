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

// --- PAS-701 "Edit Vype Media Day" rename ---
// A stable Media Day fixture (created from a SOW). edit route: /events/edit-media-day/:id
const MEDIA_DAY_ID = 4823;

test.describe('Media Day edit — rename (PAS-701) + staff confirmation (PAS-633)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/events/edit-media-day/${MEDIA_DAY_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Basic', { exact: true }).first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1500);
  });

  test('MDR-01 edit page/breadcrumb reads "Edit Vype Media Day"', async ({ page }) => {
    await expect(page.getByText(/Edit Vype Media Day/i).first()).toBeVisible();
    // Event Type is the VYPE Media Day type
    await expect(page.getByText(/VYPE Media Day/i).first()).toBeVisible();
  });

  test('SC-01 Staff section shows a Confirmation status per staff', async ({ page }) => {
    await expect(page.getByText(/Staff \(/i).first()).toBeVisible();
    await expect(page.getByText('Confirmation', { exact: false }).first()).toBeVisible();
    // a confirmation status badge is present (Email Sent / Pending / Confirmed / Rejected)
    await expect(
      page.getByText(/email sent|pending|confirmed|rejected/i).first()
    ).toBeVisible();
  });

  test('QC-03 Media Day form can link or create a SOW (quick-create entry)', async ({ page }) => {
    // The Media Day form links an existing SOW or offers "Create new".
    await expect(page.getByText(/Statement of Work/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Create new/i }).first()).toBeVisible();
  });
});

// --- PAS-680 quick-create modal + PAS-707 SOW contract-file upload (on /events/add-sow) ---
test.describe('SOW form — quick-create (PAS-680) + file upload (PAS-707)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/events/add-sow`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#title')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1200);
  });

  test('QC-01/QC-05 "Create Media Day" opens a quick-create modal; Cancel closes it', async ({ page }) => {
    await page.getByRole('button', { name: /Create Media Day/i }).first().click();
    const modal = page.locator('.ant-modal-content, [role=dialog]').filter({ hasText: 'Create Media Day' }).first();
    await expect(modal).toBeVisible({ timeout: 10000 });
    // basic-details fields, no navigation away from the SOW form
    for (const f of ['Title', 'School / Organization', 'Location', 'Date', 'Gender', 'Level', 'Sport']) {
      await expect(modal.getByText(f, { exact: false }).first()).toBeVisible();
    }
    await modal.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.locator('.ant-modal-content, [role=dialog]').filter({ hasText: 'Create Media Day' })).toHaveCount(0);
    await expect(page).toHaveURL(/add-sow/); // still on the SOW form
  });

  test('QC-03 "Link" existing SOW/Media Day control is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Link$/i }).first()).toBeVisible();
  });

  test('SOWF-01/02 contract-file upload shows a styled filename, not a raw URL', async ({ page }) => {
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'contract.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'),
    });
    await page.waitForTimeout(3000);
    // filename shows styled
    await expect(page.getByText(/contract\.pdf/i).first()).toBeVisible();
    // and NOT rendered as a raw file URL (the PAS-707 bug)
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/https?:\/\/\S+\.pdf/i);
  });
});
