const { test, expect } = require('@playwright/test');
const {
  gotoBundles,
  gotoAddBundle,
  fillRequiredBundleFields,
  createAndPublishBundle,
  createAndPublishEvent,
  openSelectFilter,
} = require('./helpers');

// ---------------------------------------------------------------------------
// Bundles list
// ---------------------------------------------------------------------------

test('Bundles list page loads with its core UI', async ({ page }) => {
  await gotoBundles(page);

  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();

  // Filter dropdowns
  for (const f of ['Teams', 'Category', 'Level', 'Status']) {
    await expect(page.locator('.ant-select-selection-placeholder', { hasText: f }).first()).toBeVisible();
  }

  // Count line + key columns
  await expect(page.getByRole('heading', { name: /Showing \d+ Bundles/ })).toBeVisible();
  for (const col of ['Title', '# of linked events', 'Expiry Date', 'Status', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
});

test('An existing bundle row shows its data', async ({ page }) => {
  await gotoBundles(page);

  // There is at least one published bundle in the sandbox; its row renders with
  // a title, a linked-events count and a status.
  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 25000 });
  await expect(row).toContainText(/events/); // "# of linked events" cell, e.g. "2 events"
  await expect(row.getByText(/Published|Draft/).first()).toBeVisible();
});

test('Add button opens the Add Bundle form with its defaults', async ({ page }) => {
  await gotoBundles(page);
  await page.waitForTimeout(2500); // let the list settle before navigating

  const addBtn = page.getByRole('button', { name: 'Add' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/bundles\/add-bundle/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByText('Add Bundle').first()).toBeVisible();
  await expect(page.getByText('Publish Status :')).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save as Draft' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save and Publish' })).toBeVisible();
});

test('Bundle title is auto-generated and read-only', async ({ page }) => {
  await gotoAddBundle(page);

  const title = page.locator('#seasonPassName');
  await expect(title).toBeDisabled();

  // After picking Team/Sports/Level the title builds itself, e.g.
  // "14U Team Texas - 7 - 7 on 7 Football" (a " - "-separated composite).
  const built = await fillRequiredBundleFields(page);
  expect(built.length).toBeGreaterThan(3);
  expect(built).toMatch(/\s-\s/);
});

// ---------------------------------------------------------------------------
// Create / publish
// ---------------------------------------------------------------------------

test('Create and publish a valid bundle', async ({ page }) => {
  // A bundle publishes only with a linked event, so seed a matching one first.
  await createAndPublishEvent(page);

  await gotoAddBundle(page);
  await fillRequiredBundleFields(page);

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/seasons') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save and Publish' }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

test('Search filters the bundle list', async ({ page }) => {
  await gotoBundles(page);

  const firstRow = page.locator('tr.ant-table-row').first();
  await expect(firstRow).toBeVisible({ timeout: 25000 });
  const title = (await firstRow.locator('td').first().innerText()).trim();
  const term = title.split(/\s+/)[0]; // a word from the first bundle's title

  const search = page.getByPlaceholder('Search');
  await search.fill(term);
  await search.press('Enter');

  // The matching bundle stays in the list.
  await expect(page.locator('tr.ant-table-row').filter({ hasText: term }).first()).toBeVisible({
    timeout: 15000,
  });

  // A gibberish term yields zero results.
  await search.fill('zzzznotarealbundle');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Bundles/ })).toBeVisible({
    timeout: 15000,
  });
});

// ---------------------------------------------------------------------------
// Negative / validation
// ---------------------------------------------------------------------------

test('Publishing an empty bundle shows required-field validation', async ({ page }) => {
  await gotoAddBundle(page);
  await page.waitForTimeout(1500); // let the form finish hydrating before submitting

  await page.getByRole('button', { name: 'Save and Publish' }).click();

  // First message gets a generous wait — validation can render slowly under load.
  await expect(page.getByText('Please select a team')).toBeVisible({ timeout: 25000 });
  await expect(page.getByText('Please select a Sub Category')).toBeVisible();
  await expect(page.getByText('Please select a Level')).toBeVisible();
  await expect(page.getByText('Please pick a Date')).toBeVisible();
  await expect(page.getByText('Please pick a time')).toBeVisible();

  await expect(page).toHaveURL(/\/bundles\/add-bundle/);
});

// BUG: like the Add Event form, "Save as Draft" performs NO validation — an
// entirely empty bundle is accepted and created.
test('BUG: Save as Draft accepts a completely empty bundle', async ({ page }) => {
  await gotoAddBundle(page);

  await page.getByRole('button', { name: 'Save as Draft' }).click();

  await expect(page.getByText(/Created Successfully/i)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Edit / delete
// ---------------------------------------------------------------------------

test('Edit opens the bundle edit form', async ({ page }) => {
  await gotoBundles(page);

  // The first action icon (pencil) opens the edit form for that bundle.
  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 25000 });
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/bundles\/edit-bundle\/\d+/, { timeout: 25000 });
  // The edit form is pre-populated — its title field (#seasonTitle) carries the
  // existing bundle name.
  await expect(page.locator('#seasonTitle')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Delete removes a bundle (with confirmation)', async ({ page }) => {
  // Create a fresh bundle so there is something safe to delete.
  await createAndPublishBundle(page);
  await gotoBundles(page);

  // Bundle actions: the second icon (trash) opens the delete confirmation.
  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 25000 });
  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete Bundle')).toBeVisible();
  await expect(modal.getByText(/Are you sure/i)).toBeVisible();

  // Confirming fires the delete request; assert the backend accepts it (200).
  // (The modal element lingers in the DOM after success, so we key off the API.)
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/delete-one') && r.request().method() === 'DELETE',
      { timeout: 25000 }
    ),
    modal.getByRole('button', { name: 'Delete' }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Filters / sorting
// ---------------------------------------------------------------------------

test('Status filter offers options and applies a selection', async ({ page }) => {
  await gotoBundles(page);
  await page.waitForTimeout(1500);

  const options = await openSelectFilter(page, 'Status');
  await expect(options.first()).toBeVisible({ timeout: 15000 });
  const value = (await options.first().innerText()).trim();
  await options.first().click();

  // Applied either as a selection tag (single) or a selected option (multi).
  await expect(
    page
      .locator('.ant-select-selection-item')
      .filter({ hasText: value })
      .or(page.locator('.ant-select-item-option-selected').filter({ hasText: value }))
      .first()
  ).toBeVisible();
});

test('Category filter offers options and applies a selection', async ({ page }) => {
  await gotoBundles(page);
  await page.waitForTimeout(1500);

  const options = await openSelectFilter(page, 'Category');
  await expect(options.first()).toBeVisible({ timeout: 15000 });
  const value = (await options.first().innerText()).trim();
  await options.first().click();

  await expect(
    page
      .locator('.ant-select-selection-item')
      .filter({ hasText: value })
      .or(page.locator('.ant-select-item-option-selected').filter({ hasText: value }))
      .first()
  ).toBeVisible();
});

test('Sorting by Title marks the column sorted', async ({ page }) => {
  await gotoBundles(page);

  const header = page.getByRole('columnheader', { name: 'Title', exact: false }).first();
  await header.click();
  await expect(header).toHaveClass(/ant-table-column-sort/, { timeout: 10000 });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
