const { test, expect } = require('@playwright/test');
const {
  gotoCoupons,
  gotoAddCoupon,
  createCoupon,
  fillCouponForm,
  uniqueAlpha,
  openSelectFilter,
} = require('./helpers');

// Search for a coupon by code and open its edit form, retrying the edit-pencil
// click until the edit URL sticks (it can misfire while the list is settling).
async function openCouponEditByCode(page, code) {
  const search = page.getByPlaceholder('Search');
  await search.fill(code);
  await search.press('Enter');
  const row = page.locator('tr.ant-table-row').filter({ hasText: code }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(async () => {
    if (!/\/coupons\/edit-coupon\/\d+/.test(page.url())) {
      await row.locator('td').last().locator('svg').first().click();
    }
    await expect(page).toHaveURL(/\/coupons\/edit-coupon\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('Coupons list page loads with its core UI', async ({ page }) => {
  await gotoCoupons(page);

  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByText('Clear All')).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  await expect(page.locator('.ant-select-selection-placeholder', { hasText: 'Discount Type' }).first()).toBeVisible();
  await expect(page.getByPlaceholder('Start date')).toBeVisible();
  await expect(page.getByPlaceholder('End date')).toBeVisible();

  await expect(page.getByRole('heading', { name: /Showing \d+ Coupons/ })).toBeVisible();
  for (const col of ['Coupon Code', 'Discount Type', 'Discount Rate', 'Start Date', 'Expiry Date', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Search filters the coupon list', async ({ page }) => {
  await gotoCoupons(page);
  await page.waitForTimeout(1500);

  const code = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  const search = page.getByPlaceholder('Search');
  await search.fill(code);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: code }).first()).toBeVisible({
    timeout: 15000,
  });

  await search.fill('zzzznotarealcoupon');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Coupons/ })).toBeVisible({ timeout: 15000 });
});

test('Discount Type filter narrows the list', async ({ page }) => {
  await gotoCoupons(page);

  const options = await openSelectFilter(page, 'Discount Type');
  await expect(options.filter({ hasText: 'Flat' }).first()).toBeVisible();
  await expect(options.filter({ hasText: 'Percentage' }).first()).toBeVisible();

  await options.filter({ hasText: 'Flat' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Flat' })).toBeVisible();
  await expect(page.locator('tr.ant-table-row').first().locator('td').nth(3)).toContainText(/Flat/);
});

// ---------------------------------------------------------------------------
// Add / create
// ---------------------------------------------------------------------------

test('Add button opens the Add Coupon form', async ({ page }) => {
  await gotoCoupons(page);
  await page.waitForTimeout(2000);

  const addBtn = page.getByRole('button', { name: 'Add' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/coupons\/add-coupon/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.locator('#couponCode')).toBeVisible();
});

test('Adding a coupon with an empty form shows required-field validation', async ({ page }) => {
  await gotoAddCoupon(page);

  await page.getByRole('button', { name: 'Save' }).click();

  for (const msg of [
    'Please enter coupon code',
    'Please enter coupon description',
    'Please select a discount type',
    'Please enter a price',
    'Please select a coupon usage type',
    'Please pick a start date',
    'Please pick a end date',
  ]) {
    await expect(page.getByText(msg)).toBeVisible();
  }
  await expect(page).toHaveURL(/\/coupons\/add-coupon/);
});

test('Create a valid coupon', async ({ page }) => {
  const code = await createCoupon(page);

  await expect(page).toHaveURL(/\/coupons(\?|$)/, { timeout: 25000 });
  await gotoCoupons(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(code);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: code }).first()).toBeVisible({
    timeout: 15000,
  });
});

// ---------------------------------------------------------------------------
// Edit / delete
// ---------------------------------------------------------------------------

test('Edit opens the coupon edit form', async ({ page }) => {
  await gotoCoupons(page);

  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/coupons\/edit-coupon\/\d+/, { timeout: 25000 });
  await expect(page.locator('#couponCode')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Editing a coupon saves the change (persists)', async ({ page }) => {
  const code = await createCoupon(page);

  await gotoCoupons(page);
  await openCouponEditByCode(page, code);
  await expect(page.locator('#couponCode')).toHaveValue(/\S/, { timeout: 25000 });

  const newDesc = 'Edited ' + uniqueAlpha(6);
  await page.locator('#description').fill(newDesc);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/coupon') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await expect(page).toHaveURL(/\/coupons(\?|$)/, { timeout: 25000 });

  // Reopen and confirm the description persisted.
  await gotoCoupons(page);
  await openCouponEditByCode(page, code);
  await expect(page.locator('#couponCode')).toHaveValue(/\S/, { timeout: 25000 });
  await expect(page.locator('#description')).toHaveValue(newDesc, { timeout: 25000 });
});

test('Delete a coupon (with confirmation)', async ({ page }) => {
  const code = await createCoupon(page);

  await gotoCoupons(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(code);
  await search.press('Enter');

  const row = page.locator('tr.ant-table-row').filter({ hasText: code }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete Coupon')).toBeVisible();
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

test('Clear All resets the Discount Type filter', async ({ page }) => {
  await gotoCoupons(page);

  const options = await openSelectFilter(page, 'Discount Type');
  await options.filter({ hasText: 'Flat' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Flat' })).toBeVisible();

  await page.getByText('Clear All').click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Flat' })).toHaveCount(0);
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Pagination navigates to the next page', async ({ page }) => {
  await gotoCoupons(page);

  const firstBefore = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  await page.locator('li.ant-pagination-next').click();

  await expect(page.locator('li.ant-pagination-item-active')).toHaveText('2', { timeout: 15000 });
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
  const firstAfter = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  expect(firstAfter).not.toBe(firstBefore);
});

test('Sorting by Coupon Code reorders the list', async ({ page }) => {
  await gotoCoupons(page);

  const header = page.getByRole('columnheader', { name: 'Coupon Code', exact: false }).first();
  await header.click();
  await expect(header).toHaveClass(/ant-table-column-sort/, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const firstAsc = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();

  await header.click();
  await page.waitForTimeout(1500);
  const firstDesc = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();

  expect(firstAsc).not.toBe(firstDesc);
});

// ---------------------------------------------------------------------------
// Date-range filter / duplicate / percentage
// ---------------------------------------------------------------------------

test('Date-range filter applies to the coupon list', async ({ page }) => {
  await gotoCoupons(page);
  await page.waitForTimeout(1500);

  // The Start date / End date inputs form a range picker — pick the first and
  // last enabled days in view.
  await page.getByPlaceholder('Start date').click();
  await page.waitForTimeout(800);
  const cells = page.locator(
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell:not(.ant-picker-cell-disabled) .ant-picker-cell-inner'
  );
  await cells.first().click();
  await page.waitForTimeout(400);
  await cells.last().click();
  await page.waitForTimeout(1500);

  await expect(page.getByPlaceholder('Start date')).not.toHaveValue('');
  await expect(page.getByRole('heading', { name: /Showing \d+ Coupons/ })).toBeVisible({
    timeout: 15000,
  });
});

// BUG: creating a coupon whose code already exists fails on the server but
// returns HTTP 200 with an error body and shows NO UI feedback (same pattern as
// the duplicate user/organization bugs).
test('BUG: duplicate coupon code is rejected silently (200 + error body)', async ({ page }) => {
  const code = await createCoupon(page);

  await gotoAddCoupon(page);
  await fillCouponForm(page, { code }); // reuse the existing code

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/coupon') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);

  expect(resp.status()).toBe(200);
  expect(JSON.stringify(await resp.json())).toMatch(/already exist/i);
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
  await expect(page).toHaveURL(/\/coupons\/add-coupon/);
});

test('Create a Percentage-type coupon', async ({ page }) => {
  await gotoAddCoupon(page);
  const code = 'QA' + uniqueAlpha(6);
  await fillCouponForm(page, { code, discountTypeIndex: 1 }); // Percentage

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/coupon') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await expect(page).toHaveURL(/\/coupons(\?|$)/, { timeout: 25000 });

  // It's findable and shows the Percentage discount type.
  await gotoCoupons(page);
  await page.waitForTimeout(1500);
  const search = page.getByPlaceholder('Search');
  await search.fill(code);
  await search.press('Enter');
  const row = page.locator('tr.ant-table-row').filter({ hasText: code }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(row).toContainText(/Percentage/);
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
