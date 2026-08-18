const { test, expect } = require('@playwright/test');
const {
  gotoSowList,
  gotoAddSow,
  fillRequiredSowFields,
  createSow,
  findSowRowByTitle,
} = require('./helpers');

// Admin "Statement of Work" (SOW). The SOW area is a tab on the Events page
// (/events?tab=sow) with its own list and an Add form at /events/add-sow. A SOW
// has a Title, a Duration (date range), an optional School district, a Status
// (Active / Inactive / Draft) and an Agreed-on date. These tests cover the list
// UI, the create form, the Status options, a happy-path create, and a
// validation gap on the empty form.

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('SOW list loads with its core UI', async ({ page }) => {
  await gotoSowList(page);

  await expect(page.getByRole('button', { name: /Create New SOW/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Showing \d+ Statements of Work/ })).toBeVisible();
  for (const col of ['ID', 'Title', 'Status', 'Agreed On', 'Timeline', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// Add form
// ---------------------------------------------------------------------------

test('Create New SOW opens the Add SOW form with its fields', async ({ page }) => {
  await gotoSowList(page);

  await page.getByRole('button', { name: /Create New SOW/i }).click();
  await expect(page).toHaveURL(/\/events\/add-sow/, { timeout: 25000 });

  await expect(page.locator('#title')).toBeVisible();
  for (const label of ['Title', 'Duration', 'School district', 'Status', 'Agreed on']) {
    await expect(page.locator('.ant-form-item', { hasText: label }).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Save as Draft' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save$/ })).toBeVisible();
});

test('SOW Status select offers Active, Inactive and Draft', async ({ page }) => {
  await gotoAddSow(page);

  await page.locator('.ant-form-item', { hasText: 'Status' }).first().locator('.ant-select').click();
  const options = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ visible: true });
  for (const o of ['Active', 'Inactive', 'Draft']) {
    await expect(options.filter({ hasText: new RegExp(`^${o}$`) }).first()).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

test('Create a Statement of Work', async ({ page }) => {
  await gotoAddSow(page);
  const title = 'QA SOW ' + Date.now();
  await fillRequiredSowFields(page, title);

  // Saving a complete SOW posts to the backend and returns to the SOW list.
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/sow/create-one') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
  await expect(page).toHaveURL(/tab=sow/, { timeout: 25000 });
});

test('Created SOW appears in the list', async ({ page }) => {
  const title = await createSow(page);
  const row = await findSowRowByTitle(page, title);
  await expect(row).toContainText(title);
});

test('Save as Draft creates a SOW', async ({ page }) => {
  await gotoAddSow(page);
  const title = 'QA SOW Draft ' + Date.now();
  await fillRequiredSowFields(page, title);

  // "Save as Draft" posts to the same create endpoint as Save.
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/sow/create-one') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: /Save as Draft/i }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
});

test('Create a SOW with the optional fields filled', async ({ page }) => {
  await gotoAddSow(page);
  const title = 'QA SOW Opt ' + Date.now();
  await fillRequiredSowFields(page, title);

  // Optional: School district, amount, a contract link and notes.
  await page.locator('.ant-form-item', { hasText: 'School district' }).first().locator('.ant-select').click();
  await page.waitForTimeout(500);
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ visible: true })
    .first()
    .click();
  await page.locator('input[placeholder="Enter amount"]').fill('2500');
  await page.locator('#contractUrl').fill('https://example.com/sow-contract.pdf');
  await page.getByRole('button', { name: /^Link$/ }).click().catch(() => {});
  await page.locator('#notes').fill('QA optional-fields SOW');

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/sow/create-one') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Edit / delete
// ---------------------------------------------------------------------------

test('Edit opens a SOW in the edit form', async ({ page }) => {
  const title = await createSow(page);
  const row = await findSowRowByTitle(page, title);

  // The first action icon (pencil) opens the edit form.
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/events\/edit-sow\/\d+/, { timeout: 25000 });
  await expect(page.locator('#title')).toHaveValue(title, { timeout: 25000 });
});

test('Delete removes a SOW (with confirmation)', async ({ page }) => {
  const title = await createSow(page);
  const row = await findSowRowByTitle(page, title);

  // The 2nd action icon opens a "Delete SOW" confirmation modal.
  await row.locator('td').last().locator('svg').nth(1).click();
  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete SOW')).toBeVisible();
  await expect(modal.getByText(/Are you sure/i)).toBeVisible();

  await modal.getByRole('button', { name: /^Delete$/ }).click();

  // The SOW is gone — re-searching the title surfaces no matching row.
  await expect(page.locator('tr.ant-table-row', { hasText: title })).toHaveCount(0, { timeout: 25000 });
});

// ---------------------------------------------------------------------------
// Negative / gap
// ---------------------------------------------------------------------------

// GAP: clicking Save on a completely empty SOW form does nothing — it neither
// submits nor surfaces any validation message, so the user gets no feedback.
// (Contrast the Add Event form, which flags every required field.)
test('GAP: empty Save shows no validation and does not submit', async ({ page }) => {
  await gotoAddSow(page);

  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(3000);

  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
  // We stay on the form — nothing was created.
  await expect(page).toHaveURL(/\/events\/add-sow/);
});

// ---------------------------------------------------------------------------
// July 2026 release tickets — SOW logs & linked Media Days
// ---------------------------------------------------------------------------
const SOW_BASE = 'https://uat-phlox-admin.netlify.app';
const SOW_ROWS = '.ant-table-tbody tr:not(.ant-table-measure-row)';

// PAS-734 — SOW has an audit-log timeline, mirroring Media Days.
test('PAS-734 SOW detail shows an audit-log / history section', async ({ page }) => {
  test.slow();
  await page.goto(`${SOW_BASE}/events/statement-of-work`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await expect(page.locator(SOW_ROWS).first()).toBeVisible({ timeout: 20000 });
  await page.locator(SOW_ROWS).first().locator('td').last().locator('svg,a,button').last().click({ timeout: 6000 });
  await page.waitForTimeout(6000);
  await expect(page.getByText(/Logs|History|Activity/i).first()).toBeVisible({ timeout: 15000 });
});

// PAS-710 — the SOW shows a live Linked Media Days table (values reflect without relink).
test('PAS-710 SOW detail shows a Linked Media Days table', async ({ page }) => {
  test.slow();
  await page.goto(`${SOW_BASE}/events/statement-of-work`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.locator(SOW_ROWS).first().locator('td').last().locator('svg,a,button').last().click({ timeout: 6000 });
  await page.waitForTimeout(6000);
  await expect(page.getByText(/Linked Media Days/i).first()).toBeVisible({ timeout: 12000 });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
