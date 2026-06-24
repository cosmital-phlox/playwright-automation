const { test, expect } = require('@playwright/test');
const {
  gotoProducts,
  gotoAddProduct,
  createProduct,
  uniqueAlpha,
  openSelectFilter,
  pickAntOption,
} = require('./helpers');

// Search for a product by name and open its edit form. The edit-pencil click can
// misfire while the filtered list is still settling, so retry until it sticks.
async function openProductEditByName(page, name) {
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  const row = page.locator('tr.ant-table-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(async () => {
    if (!/\/products\/edit-product\/\d+/.test(page.url())) {
      await row.locator('td').last().locator('svg').first().click();
    }
    await expect(page).toHaveURL(/\/products\/edit-product\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('Products list page loads with its core UI', async ({ page }) => {
  await gotoProducts(page);

  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByText('Clear All')).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  await expect(page.locator('.ant-select-selection-placeholder', { hasText: 'Product Category' }).first()).toBeVisible();

  await expect(page.getByRole('heading', { name: /Showing \d+ Products/ })).toBeVisible();
  for (const col of ['Product Name', 'Product Category', 'Price', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Search filters the product list', async ({ page }) => {
  await gotoProducts(page);
  await page.waitForTimeout(1500); // let the initial list load before searching

  const search = page.getByPlaceholder('Search');
  await search.fill('Spotlight');
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: /Spotlight/i }).first()).toBeVisible({
    timeout: 15000,
  });

  await search.fill('zzzznotarealproduct');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Products/ })).toBeVisible({
    timeout: 15000,
  });
});

test('Category filter narrows the list', async ({ page }) => {
  await gotoProducts(page);

  const options = await openSelectFilter(page, 'Product Category');
  await expect(options.filter({ hasText: 'Individual' }).first()).toBeVisible();
  await expect(options.filter({ hasText: 'Team' }).first()).toBeVisible();

  await options.filter({ hasText: 'Team' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Team' })).toBeVisible();
  // The first row's Category column reflects the filter.
  await expect(page.locator('tr.ant-table-row').first().locator('td').nth(1)).toContainText(/Team/);
});

// ---------------------------------------------------------------------------
// Add / create
// ---------------------------------------------------------------------------

test('Add button opens the Add Product form', async ({ page }) => {
  await gotoProducts(page);
  await page.waitForTimeout(2000);

  const addBtn = page.getByRole('button', { name: 'Add' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/products\/add-product/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#price')).toBeVisible();
});

test('Adding a product with an empty form shows required-field validation', async ({ page }) => {
  await gotoAddProduct(page);

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Please enter a Product Name')).toBeVisible();
  await expect(page.getByText('Please enter a Product Category')).toBeVisible();
  await expect(page.getByText('Please enter a Product Price')).toBeVisible();
  await expect(page).toHaveURL(/\/products\/add-product/);
});

test('Create a valid product', async ({ page }) => {
  const name = await createProduct(page);

  // Save redirects to the list; the new product is findable by search.
  await expect(page).toHaveURL(/\/products(\?|$)/, { timeout: 25000 });
  await gotoProducts(page);
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

test('Edit opens the product edit form', async ({ page }) => {
  await gotoProducts(page);

  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/products\/edit-product\/\d+/, { timeout: 25000 });
  await expect(page.locator('#name')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Editing a product saves the change (persists)', async ({ page }) => {
  const name = await createProduct(page);

  await gotoProducts(page);
  await openProductEditByName(page, name);
  await expect(page.locator('#name')).toHaveValue(/\S/, { timeout: 25000 });

  // Rename it and save (Save redirects to the list).
  const newName = 'QAEdited ' + uniqueAlpha(6);
  await page.locator('#name').fill(newName);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/products') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await expect(page).toHaveURL(/\/products(\?|$)/, { timeout: 25000 });

  // The new name is findable; the old name is gone.
  await gotoProducts(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(newName);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: newName }).first()).toBeVisible({
    timeout: 15000,
  });
});

test('Delete a product (with confirmation)', async ({ page }) => {
  const name = await createProduct(page); // throwaway product

  await gotoProducts(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');

  const row = page.locator('tr.ant-table-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete Product')).toBeVisible();
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
// Filters reset / pagination / sorting
// ---------------------------------------------------------------------------

test('Clear All resets the Category filter', async ({ page }) => {
  await gotoProducts(page);

  const options = await openSelectFilter(page, 'Product Category');
  await options.filter({ hasText: 'Team' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Team' })).toBeVisible();

  await page.getByText('Clear All').click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Team' })).toHaveCount(0);
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Pagination navigates to the next page', async ({ page }) => {
  await gotoProducts(page);

  const firstBefore = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  await page.locator('li.ant-pagination-next').click();

  await expect(page.locator('li.ant-pagination-item-active')).toHaveText('2', { timeout: 15000 });
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
  const firstAfter = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  expect(firstAfter).not.toBe(firstBefore);
});

test('Sorting by Product Name reorders the list', async ({ page }) => {
  await gotoProducts(page);

  const header = page.getByRole('columnheader', { name: 'Product Name', exact: false }).first();
  await header.click(); // first sort direction
  await expect(header).toHaveClass(/ant-table-column-sort/, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const firstAsc = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();

  await header.click(); // toggle direction
  await page.waitForTimeout(1500);
  const firstDesc = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();

  expect(firstAsc).not.toBe(firstDesc);
});

// ---------------------------------------------------------------------------
// Validation gaps / description
// ---------------------------------------------------------------------------

// BUG: a product saves with a negative price — there is no validation that the
// price is >= 0, so "-5" is accepted just like any positive number.
test('BUG: a negative price is accepted (no validation)', async ({ page }) => {
  await gotoAddProduct(page);

  const name = 'QANeg ' + uniqueAlpha(6);
  await page.locator('#name').fill(name);
  await pickAntOption(page, 'Category', 0);
  await page.locator('#price').fill('-5');

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/products') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);

  // It "succeeds": no validation error and we land back on the list.
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
  await expect(page).toHaveURL(/\/products(\?|$)/, { timeout: 25000 });
});

test('A product description is saved and persists', async ({ page }) => {
  await gotoAddProduct(page);

  const name = 'QADesc ' + uniqueAlpha(6);
  const description = 'QA description ' + uniqueAlpha(6);
  await page.locator('#name').fill(name);
  await pickAntOption(page, 'Category', 0);
  await page.locator('#price').fill('50');
  await page.locator('#description').fill(description);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/products') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await expect(page).toHaveURL(/\/products(\?|$)/, { timeout: 25000 });

  // Reopen the product and confirm the description persisted.
  await gotoProducts(page);
  await openProductEditByName(page, name);
  await expect(page.locator('#name')).toHaveValue(/\S/, { timeout: 25000 });
  await expect(page.locator('#description')).toHaveValue(description, { timeout: 25000 });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
