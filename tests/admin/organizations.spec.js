const { test, expect } = require('@playwright/test');
const {
  gotoOrgs,
  gotoAddOrg,
  createOrg,
  uniqueAlpha,
  openSelectFilter,
} = require('./helpers');

// Open the first organization row's edit form. The edit-pencil click can misfire
// while the list is still settling, so retry until the edit URL sticks.
async function openFirstOrgEdit(page) {
  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(async () => {
    if (!/\/organizations\/edit-organization\/\d+/.test(page.url())) {
      await row.locator('td').last().locator('svg').first().click();
    }
    await expect(page).toHaveURL(/\/organizations\/edit-organization\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('Organizations list page loads with its core UI', async ({ page }) => {
  await gotoOrgs(page);

  for (const btn of ['Import', 'Export', 'Add']) {
    await expect(page.getByRole('button', { name: btn })).toBeVisible();
  }
  await expect(page.getByText('Clear All')).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  for (const f of ['Type', 'City']) {
    await expect(page.locator('.ant-select-selection-placeholder', { hasText: f }).first()).toBeVisible();
  }

  await expect(page.getByRole('heading', { name: /Showing \d+ Organizations/ })).toBeVisible();
  for (const col of ['Name', 'Short name', 'Parent', 'Type', 'City', 'State', 'Zip Code', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

// BUG: the Organizations search box does nothing — typing a term (even gibberish)
// never filters the list; the count and rows stay unchanged and no request fires.
test('BUG: the search box does not filter the list', async ({ page }) => {
  await gotoOrgs(page);

  await expect(page.locator('tr.ant-table-row')).toHaveCount(10);
  const search = page.getByPlaceholder('Search');
  await search.fill('zzzznotarealorganization');
  await search.press('Enter');
  await page.waitForTimeout(3000);

  // A working search would show "Showing 0 Organizations"; instead the full page
  // of rows remains (search is non-functional).
  await expect(page.locator('tr.ant-table-row')).toHaveCount(10);
});

test('Type filter narrows the list', async ({ page }) => {
  await gotoOrgs(page);

  const options = await openSelectFilter(page, 'Type');
  for (const o of ['Booster Club', 'Team', 'Venue']) {
    await expect(options.filter({ hasText: o }).first()).toBeVisible();
  }

  await options.filter({ hasText: 'Venue' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Venue' })).toBeVisible();
  // The first row's Type column now reflects the filter.
  await expect(page.locator('tr.ant-table-row').first().locator('td').nth(3)).toContainText(/Venue/);
});

// ---------------------------------------------------------------------------
// Add / create
// ---------------------------------------------------------------------------

test('Add button opens the Add Organization form', async ({ page }) => {
  await gotoOrgs(page);
  await page.waitForTimeout(2000);

  const addBtn = page.getByRole('button', { name: 'Add' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/organizations\/add-organization/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#shortName')).toBeVisible();
});

test('Adding an organization with an empty form shows required-field validation', async ({ page }) => {
  await gotoAddOrg(page);

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Please select a Type')).toBeVisible();
  await expect(page.getByText('Please enter Organizations Name')).toBeVisible();
  await expect(page.getByText('Please enter a short name for organization')).toBeVisible();
  await expect(page).toHaveURL(/\/organizations\/add-organization/);
});

test('Create a valid organization', async ({ page }) => {
  const { shortName } = await createOrg(page);

  // Save redirects to the list, where the new org sorts to the top.
  await expect(page).toHaveURL(/\/organizations(\?|$)/, { timeout: 25000 });
  await gotoOrgs(page);
  await expect(page.locator('tr.ant-table-row').first()).toContainText(shortName, { timeout: 20000 });
});

// ---------------------------------------------------------------------------
// Edit / delete
// ---------------------------------------------------------------------------

test('Edit opens the organization edit form', async ({ page }) => {
  await gotoOrgs(page);
  await openFirstOrgEdit(page);
  await expect(page.locator('#name')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Editing an organization saves the change (persists)', async ({ page }) => {
  await createOrg(page); // newest -> first row

  await gotoOrgs(page);
  await openFirstOrgEdit(page);
  await expect(page.locator('#name')).toHaveValue(/\S/, { timeout: 25000 });

  const newName = 'QAEdited ' + uniqueAlpha(6);
  await page.locator('#name').fill(newName);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/organizations') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await expect(page).toHaveURL(/\/organizations(\?|$)/, { timeout: 25000 });

  // The edited org (still newest) shows the new name in the first row.
  await gotoOrgs(page);
  await expect(page.locator('tr.ant-table-row').first()).toContainText(newName, { timeout: 20000 });
});

test('Delete an organization (with confirmation)', async ({ page }) => {
  await createOrg(page); // create a throwaway org (first row) so delete is safe

  await gotoOrgs(page);
  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 20000 });

  // Open the delete confirmation (retry if the first click misfires).
  await expect(async () => {
    if (!(await page.locator('.ant-modal-content').isVisible().catch(() => false))) {
      await row.locator('td').last().locator('svg').nth(1).click();
    }
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });

  const modal = page.locator('.ant-modal-content');
  await expect(modal.getByText('Delete Organization')).toBeVisible();
  await expect(modal.getByText(/Are you sure/i)).toBeVisible();

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
// Export / filters reset / pagination / sorting
// ---------------------------------------------------------------------------

test('Export downloads an organizations file', async ({ page }) => {
  await gotoOrgs(page);
  await page.waitForTimeout(2000); // let the list settle before exporting

  // Generating a CSV for thousands of orgs is slow and the first click can fail
  // to kick off the download, so retry the click until a download starts.
  let download = null;
  for (let i = 0; i < 3 && !download; i++) {
    const dlPromise = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);
    await page.getByRole('button', { name: 'Export' }).click();
    download = await dlPromise;
  }
  expect(download, 'Export should trigger a download').toBeTruthy();
  expect(download.suggestedFilename()).toMatch(/Organizations.*\.csv/i);
});

test('Clear All resets the Type filter', async ({ page }) => {
  await gotoOrgs(page);

  const options = await openSelectFilter(page, 'Type');
  await options.filter({ hasText: 'Venue' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Venue' })).toBeVisible();

  await page.getByText('Clear All').click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Venue' })).toHaveCount(0);
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Pagination navigates to the next page', async ({ page }) => {
  await gotoOrgs(page);

  const firstBefore = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  await page.locator('li.ant-pagination-next').click();

  await expect(page.locator('li.ant-pagination-item-active')).toHaveText('2', { timeout: 15000 });
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
  const firstAfter = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  expect(firstAfter).not.toBe(firstBefore);
});

test('Sorting by Name reorders the list', async ({ page }) => {
  await gotoOrgs(page);

  const nameHeader = page.getByRole('columnheader', { name: 'Name', exact: false }).first();
  await nameHeader.click(); // first sort direction
  await expect(nameHeader).toHaveClass(/ant-table-column-sort/, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const firstAsc = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();

  await nameHeader.click(); // toggle direction
  await page.waitForTimeout(1500);
  const firstDesc = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();

  // The top row differs between ascending and descending — the list reordered.
  expect(firstAsc).not.toBe(firstDesc);
});

// ---------------------------------------------------------------------------
// Import / City filter / validation
// ---------------------------------------------------------------------------

test('Import opens the CSV upload dialog', async ({ page }) => {
  await gotoOrgs(page);
  await page.waitForTimeout(2000);

  const modal = page.locator('.ant-modal-content');
  // Retry the click — the first one can misfire while the list is still settling.
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Import' }).click();
    }
    await expect(modal).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });

  await expect(modal.getByRole('heading', { name: 'Import organizations' })).toBeVisible();
  await expect(modal.getByText(/Click or drag file/i).first()).toBeVisible();
  await expect(modal.getByText(/\.csv/i).first()).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Import' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('Import downloads its CSV template', async ({ page }) => {
  await gotoOrgs(page);
  await page.waitForTimeout(2000);

  const modal = page.locator('.ant-modal-content');
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Import' }).click();
    }
    await expect(modal).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    modal.getByText(/CSV Template/i).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
});

test('Uploading a CSV parses and validates the rows', async ({ page }) => {
  await gotoOrgs(page);
  await page.waitForTimeout(2000);

  const modal = page.locator('.ant-modal-content');
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Import' }).click();
    }
    await expect(modal).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });

  // Ant Upload accepts the file via the OS file chooser, not the hidden input.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    modal.getByText(/Click or drag file/i).click(),
  ]);
  await fileChooser.setFiles(require('path').join(__dirname, 'fixtures', 'organizations-import.csv'));

  // The system parses the file and reports row counts + the uploaded filename.
  // (The sample row is intentionally incomplete, so it parses as invalid and
  // nothing is actually imported — no data pollution.)
  await expect(modal.getByText(/organizations-import\.csv/i)).toBeVisible({ timeout: 15000 });
  await expect(modal.getByText(/Total Row/i)).toBeVisible();
  await expect(modal.getByText(/Invalid Row/i)).toBeVisible();
});

test('City filter narrows the list', async ({ page }) => {
  await gotoOrgs(page);

  const options = await openSelectFilter(page, 'City');
  const first = options.first();
  await expect(first).toBeVisible({ timeout: 15000 });
  const city = (await first.innerText()).trim();
  await first.click();

  // The chosen city is applied as the filter value. (A given city may legitimately
  // have zero organizations, so we assert the filter, not a row count.)
  await expect(page.locator('.ant-select-selection-item').filter({ hasText: city }).first()).toBeVisible();
});

test('Add organization validates postal code and website formats', async ({ page }) => {
  await gotoAddOrg(page);

  await page.getByText('Team', { exact: true }).first().click();
  await page.locator('#name').fill('QAFmt ' + uniqueAlpha(5));
  await page.locator('#shortName').fill('QAF' + uniqueAlpha(5));
  await page.locator('#postalCode').fill('abc'); // invalid zip
  await page.locator('#website').fill('notaurl'); // invalid url
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Please enter a Valid Postal Code')).toBeVisible();
  await expect(page.getByText('Please enter Valid URL.')).toBeVisible();
  await expect(page).toHaveURL(/\/organizations\/add-organization/);
});

// BUG: creating an organization with a name that already exists fails on the
// server but returns HTTP 200 with an error body and shows NO UI feedback.
test('BUG: duplicate organization name is rejected silently (200 + error body)', async ({ page }) => {
  const existing = await createOrg(page);

  await gotoAddOrg(page);
  await page.getByText('Team', { exact: true }).first().click();
  await page.locator('#name').fill(existing.name); // duplicate name
  await page.locator('#shortName').fill('QAD' + uniqueAlpha(5)); // fresh short name

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/organizations') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);

  expect(resp.status()).toBe(200);
  expect(JSON.stringify(await resp.json())).toMatch(/already exist/i);
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
  await expect(page).toHaveURL(/\/organizations\/add-organization/);
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
