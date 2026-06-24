const { test, expect } = require('@playwright/test');
const { gotoCategories, gotoAddCategory, createCategory } = require('./helpers');

// Delete a category by name if it exists (test cleanup — this list has no search
// and rows accumulate, so create/edit tests remove what they add).
async function deleteCategoryByName(page, name) {
  await gotoCategories(page);
  const row = page.locator('tr.ant-table-row').filter({ hasText: name }).first();
  if (!(await row.count())) return;
  await row.locator('td').last().locator('svg').nth(1).click();
  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('tr.ant-table-row').filter({ hasText: name })).toHaveCount(0, {
    timeout: 25000,
  });
}

// Find a category row by name and open its edit form, retrying the edit-pencil
// click until the edit URL sticks.
async function openCategoryEditByName(page, name) {
  const row = page.locator('tr.ant-table-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(async () => {
    if (!/\/categories\/edit-category\/\d+/.test(page.url())) {
      await row.locator('td').last().locator('svg').first().click();
    }
    await expect(page).toHaveURL(/\/categories\/edit-category\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('Categories list page loads with its core UI', async ({ page }) => {
  await gotoCategories(page);

  await expect(page.getByRole('button', { name: 'Add Category' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Showing \d+ Categories/ })).toBeVisible();
  for (const col of ['Category Name', '# of sub-categories', '# of custom questions', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Expanding a category reveals its sub-categories', async ({ page }) => {
  await gotoCategories(page);

  // "Indoors" is seeded with a sub-category and sorts first (always on page 1).
  const parent = page.locator('tr.ant-table-row').filter({ hasText: 'Indoors' }).first();
  await expect(parent).toBeVisible({ timeout: 15000 });
  const before = await page.locator('tr.ant-table-row').count();

  await parent.locator('td').first().locator('svg').first().click();
  await expect
    .poll(async () => page.locator('tr.ant-table-row').count(), { timeout: 15000 })
    .toBeGreaterThan(before);
});

// ---------------------------------------------------------------------------
// Add / create
// ---------------------------------------------------------------------------

test('Add Category button opens the form', async ({ page }) => {
  await gotoCategories(page);
  await page.waitForTimeout(2000);

  const addBtn = page.getByRole('button', { name: 'Add Category' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/categories\/add-category/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.locator('#categoryName')).toBeVisible();
});

test('Adding a category with an empty form shows required-field validation', async ({ page }) => {
  await gotoAddCategory(page);

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Please enter category name')).toBeVisible();
  await expect(page).toHaveURL(/\/categories\/add-category/);
});

test('Create a category', async ({ page }) => {
  const name = await createCategory(page);

  // Save redirects to the list, where the new category appears.
  await expect(page.locator('tr.ant-table-row').filter({ hasText: name }).first()).toBeVisible({
    timeout: 20000,
  });

  await deleteCategoryByName(page, name); // cleanup
});

// ---------------------------------------------------------------------------
// Edit / delete
// ---------------------------------------------------------------------------

test('Edit opens the category edit form', async ({ page }) => {
  await gotoCategories(page);

  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/categories\/edit-category\/\d+/, { timeout: 25000 });
  // The edit page's name field is #category (the add page uses #categoryName).
  await expect(page.locator('#category')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Editing a category saves the change (persists)', async ({ page }) => {
  const name = await createCategory(page);

  await gotoCategories(page);
  await openCategoryEditByName(page, name);
  await expect(page.locator('#category')).toHaveValue(/\S/, { timeout: 25000 });

  // Remember this record's own edit URL so we can verify persistence directly,
  // without depending on the list. (The list has no search and is alphabetical,
  // so a renamed row can fall onto page 2 under load — re-opening the record by
  // its URL is the reliable check.)
  const editUrl = page.url();

  const newName = 'QAEdited ' + name.split(' ')[1];
  await page.locator('#category').fill(newName);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/categories\/?$/, { timeout: 25000 });

  // Re-open the same record and confirm the new name persisted.
  await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#category')).toHaveValue(newName, { timeout: 25000 });

  await deleteCategoryByName(page, newName); // cleanup
});

test('Delete a category (with confirmation)', async ({ page }) => {
  const name = await createCategory(page);

  await gotoCategories(page);
  const row = page.locator('tr.ant-table-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete Category')).toBeVisible();
  await expect(modal.getByText(/Are you sure/i)).toBeVisible();

  await modal.getByRole('button', { name: 'Delete' }).click();

  // The category is removed from the list.
  await expect(page.locator('tr.ant-table-row').filter({ hasText: name })).toHaveCount(0, {
    timeout: 25000,
  });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
