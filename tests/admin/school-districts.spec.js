const { test, expect } = require('@playwright/test');
const {
  gotoSchoolDistricts,
  gotoAddSchoolDistrict,
  createSchoolDistrict,
  openSelectFilter,
} = require('./helpers');

// Find a district row by name and open its edit form, retrying the edit-pencil
// click until the edit URL sticks.
async function openDistrictEditByName(page, name) {
  const row = page.locator('tr.ant-table-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(async () => {
    if (!/\/school-districts\/edit\/\d+/.test(page.url())) {
      await row.locator('td').last().locator('svg').first().click();
    }
    await expect(page).toHaveURL(/\/school-districts\/edit\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('School Districts list page loads with its core UI', async ({ page }) => {
  await gotoSchoolDistricts(page);

  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  await expect(page.locator('.ant-select-selection-placeholder', { hasText: 'State' }).first()).toBeVisible();

  await expect(page.getByRole('heading', { name: /Showing \d+ School Districts/ })).toBeVisible();
  for (const col of ['School District', 'District Code', 'Schools', 'Status', 'State', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Search filters the school district list', async ({ page }) => {
  await gotoSchoolDistricts(page);
  await page.waitForTimeout(1500);

  const name = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: name }).first()).toBeVisible({
    timeout: 15000,
  });

  await search.fill('zzzznotarealdistrict');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 School Districts/ })).toBeVisible({
    timeout: 15000,
  });
});

test('State filter applies a selection', async ({ page }) => {
  await gotoSchoolDistricts(page);

  const options = await openSelectFilter(page, 'State');
  await options.filter({ hasText: 'California' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'California' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Add / create
// ---------------------------------------------------------------------------

test('Add button opens the Add School District form', async ({ page }) => {
  await gotoSchoolDistricts(page);
  await page.waitForTimeout(2000);

  const addBtn = page.getByRole('button', { name: 'Add' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/school-districts\/add/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await expect(page.locator('#name')).toBeVisible();
});

test('Adding a district with an empty form shows required-field validation', async ({ page }) => {
  await gotoAddSchoolDistrict(page);

  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Please enter a title')).toBeVisible();
  await expect(page.getByText('Please select a state')).toBeVisible();
  await expect(page.getByText('Please select at least one school')).toBeVisible();
  await expect(page).toHaveURL(/\/school-districts\/add/);
});

test('Create a school district', async ({ page }) => {
  const name = await createSchoolDistrict(page);

  await gotoSchoolDistricts(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: name }).first()).toBeVisible({
    timeout: 15000,
  });
});

// ---------------------------------------------------------------------------
// Edit / delete
// ---------------------------------------------------------------------------

test('Edit opens the school district edit form', async ({ page }) => {
  await gotoSchoolDistricts(page);

  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/school-districts\/edit\/\d+/, { timeout: 25000 });
  await expect(page.locator('#name')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Editing a school district saves the change (persists)', async ({ page }) => {
  const name = await createSchoolDistrict(page);

  await gotoSchoolDistricts(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  await openDistrictEditByName(page, name);
  await expect(page.locator('#name')).toHaveValue(/\S/, { timeout: 25000 });

  const newName = 'QASDEdited ' + name.split(' ')[1];
  await page.locator('#name').fill(newName);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/school-districts') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save changes' }).click(),
  ]);
  await expect(page).toHaveURL(/\/school-districts\/?$/, { timeout: 25000 });

  await gotoSchoolDistricts(page);
  await search.fill(newName);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: newName }).first()).toBeVisible({
    timeout: 15000,
  });
});

test('Delete a school district (with confirmation)', async ({ page }) => {
  const name = await createSchoolDistrict(page); // unlinked -> deletable

  await gotoSchoolDistricts(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  const row = page.locator('tr.ant-table-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete School District')).toBeVisible();

  // Confirming deletes the district (the DELETE …→200 is the real proof; the
  // modal's body text can render a beat late, so we don't gate on it).
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/delete-one') && r.request().method() === 'DELETE',
      { timeout: 45000 } // the delete can be slow under full-suite backend load
    ),
    modal.getByRole('button', { name: 'Delete' }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
});

// A district linked to events cannot be deleted — the seed "Murx International
// School" is linked, so the delete dialog blocks with an explanatory message.
test('A district linked to events cannot be deleted', async ({ page }) => {
  await gotoSchoolDistricts(page);
  await page.waitForTimeout(1500);

  const search = page.getByPlaceholder('Search');
  await search.fill('Murx International School');
  await search.press('Enter');
  const row = page.locator('tr.ant-table-row').filter({ hasText: 'Murx' }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/Unable to delete school district/i)).toBeVisible();
  await expect(modal.getByText(/linked to one or more events/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Import / pagination / sorting
// ---------------------------------------------------------------------------

test('Import opens the upload dialog', async ({ page }) => {
  await gotoSchoolDistricts(page);
  await page.waitForTimeout(2000);

  const modal = page.locator('.ant-modal-content');
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Import' }).click();
    }
    await expect(modal).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });

  await expect(modal.getByRole('heading', { name: 'Import school districts' })).toBeVisible();
  await expect(modal.getByText(/Click or drag file/i).first()).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('Pagination navigates to the next page', async ({ page }) => {
  await gotoSchoolDistricts(page);
  await page.waitForTimeout(2000);

  const firstBefore = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  await page.locator('li.ant-pagination-next').click();

  await expect(page.locator('li.ant-pagination-item-active')).toHaveText('2', { timeout: 15000 });
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
  // The page-2 data fetch can lag the pagination indicator — wait for the top
  // row to actually change before asserting.
  await expect
    .poll(
      async () => (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim(),
      { timeout: 15000 }
    )
    .not.toBe(firstBefore);
});

test('Sorting by School District reorders the list', async ({ page }) => {
  await gotoSchoolDistricts(page);
  await page.waitForTimeout(2000);

  const header = page.getByRole('columnheader', { name: 'School District', exact: false }).first();
  await header.click();
  await expect(header).toHaveClass(/ant-table-column-sort/, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const firstAsc = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();

  await header.click();
  await page.waitForTimeout(1500);
  const firstDesc = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();

  expect(firstAsc).not.toBe(firstDesc);
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
