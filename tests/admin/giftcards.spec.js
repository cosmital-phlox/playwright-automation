const { test, expect } = require('@playwright/test');
const { gotoGiftcards, gotoAddGiftcard, createGiftcard } = require('./helpers');

// Search for a gift card by code and open its edit form, retrying the edit-pencil
// click until the edit URL sticks (it can misfire while the list is settling).
async function openGiftcardEditByCode(page, code) {
  await page.waitForTimeout(1500); // let the list settle so the search applies
  const search = page.getByPlaceholder('Search');
  await search.fill(code);
  await search.press('Enter');
  const row = page.locator('tr.ant-table-row').filter({ hasText: code }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(async () => {
    if (!/\/giftcards\/edit-giftcard\/\d+/.test(page.url())) {
      await row.locator('td').last().locator('svg').first().click();
    }
    await expect(page).toHaveURL(/\/giftcards\/edit-giftcard\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('Gift Cards list page loads with its core UI', async ({ page }) => {
  await gotoGiftcards(page);

  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByText('Clear All')).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();

  await expect(page.getByRole('heading', { name: /Showing \d+ Giftcards/ })).toBeVisible();
  for (const col of ['Gift Card', 'Description', 'Value', 'Balance', 'Created Date', 'Created By', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Search filters the gift card list', async ({ page }) => {
  await gotoGiftcards(page);
  await page.waitForTimeout(1500);

  const code = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  const search = page.getByPlaceholder('Search');
  await search.fill(code);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: code }).first()).toBeVisible({
    timeout: 15000,
  });

  await search.fill('zzzznotarealgiftcard');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Giftcards/ })).toBeVisible({ timeout: 15000 });
});

// ---------------------------------------------------------------------------
// Add / create
// ---------------------------------------------------------------------------

test('Add button opens the form with an auto-generated, read-only code', async ({ page }) => {
  await gotoGiftcards(page);
  await page.waitForTimeout(2000);

  const addBtn = page.getByRole('button', { name: 'Add' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/giftcards\/add-giftcard/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  // The code is pre-filled (auto-generated) and disabled — you don't type it.
  await expect(page.locator('#giftcardCode')).toHaveValue(/\S/);
  await expect(page.locator('#giftcardCode')).toBeDisabled();
  await expect(page.locator('#balance')).toBeVisible();
});

test('Create a gift card', async ({ page }) => {
  const code = await createGiftcard(page, '50');

  // It saves and the new card (auto-code) is findable by search.
  await gotoGiftcards(page);
  await page.waitForTimeout(1500);
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

test('Edit opens the gift card edit form', async ({ page }) => {
  await gotoGiftcards(page);
  await page.waitForTimeout(1500);

  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 20000 });
  // Retry the edit-pencil click — it can misfire while the list is settling.
  await expect(async () => {
    if (!/\/giftcards\/edit-giftcard\/\d+/.test(page.url())) {
      await row.locator('td').last().locator('svg').first().click();
    }
    await expect(page).toHaveURL(/\/giftcards\/edit-giftcard\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.locator('#giftcardCode')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Editing a gift card saves the change (persists)', async ({ page }) => {
  const code = await createGiftcard(page, '50');

  await gotoGiftcards(page);
  await openGiftcardEditByCode(page, code);
  await expect(page.locator('#giftcardCode')).toHaveValue(/\S/, { timeout: 25000 });

  const newDesc = 'Edited gift card ' + Date.now();
  await page.locator('#description').fill(newDesc);
  await Promise.all([
    page.waitForResponse(
      (r) => /\/api\/.*giftcard/i.test(r.url()) && ['POST', 'PUT', 'PATCH'].includes(r.request().method()),
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await expect(page).toHaveURL(/\/giftcards(\?|$)/, { timeout: 25000 });

  // Reopen and confirm the description persisted.
  await gotoGiftcards(page);
  await openGiftcardEditByCode(page, code);
  await expect(page.locator('#description')).toHaveValue(newDesc, { timeout: 25000 });
});

test('Delete a gift card (with confirmation)', async ({ page }) => {
  const code = await createGiftcard(page, '25');

  await gotoGiftcards(page);
  await page.waitForTimeout(1500);
  const search = page.getByPlaceholder('Search');
  await search.fill(code);
  await search.press('Enter');

  const row = page.locator('tr.ant-table-row').filter({ hasText: code }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete Giftcard')).toBeVisible();
  await expect(modal.getByText(/Are you sure/i)).toBeVisible();

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => /giftcard/i.test(r.url()) && r.request().method() === 'DELETE',
      { timeout: 25000 }
    ),
    modal.getByRole('button', { name: 'Delete' }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Filters reset / sorting
// ---------------------------------------------------------------------------

test('Clear All resets the search', async ({ page }) => {
  await gotoGiftcards(page);
  await page.waitForTimeout(1500);

  const search = page.getByPlaceholder('Search');
  await search.fill('zzzznotarealgiftcard');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Giftcards/ })).toBeVisible({ timeout: 15000 });

  await page.getByText('Clear All').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible({ timeout: 15000 });
});

test('Sorting by Gift Card marks the column sorted', async ({ page }) => {
  await gotoGiftcards(page);

  // Few rows exist, so assert the column becomes sorted (the sort control works)
  // rather than a top-row reorder.
  const header = page.getByRole('columnheader', { name: 'Gift Card', exact: false }).first();
  await header.click();
  await expect(header).toHaveClass(/ant-table-column-sort/, { timeout: 10000 });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
