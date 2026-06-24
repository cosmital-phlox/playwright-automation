const { test, expect } = require('@playwright/test');
const { gotoLevels, createLevel, uniqueAlpha } = require('./helpers');

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('Levels list page loads with its core UI', async ({ page }) => {
  await gotoLevels(page);

  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Showing \d+ Levels/ })).toBeVisible();
  for (const col of ['Name', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Search filters the level list', async ({ page }) => {
  await gotoLevels(page);
  await page.waitForTimeout(1500);

  const name = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: name }).first()).toBeVisible({
    timeout: 15000,
  });

  await search.fill('zzzznotarealevel');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Levels/ })).toBeVisible({ timeout: 15000 });
});

// ---------------------------------------------------------------------------
// Add / create
// ---------------------------------------------------------------------------

test('Add opens the "Add New Level" modal', async ({ page }) => {
  await gotoLevels(page);
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: 'Add' }).first().click();
  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Add New Level')).toBeVisible();
  await expect(modal.locator('#name')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('Adding a level with an empty name shows validation', async ({ page }) => {
  await gotoLevels(page);
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: 'Add' }).first().click();
  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Please enter a Level Name')).toBeVisible();
});

test('Create a level', async ({ page }) => {
  const name = await createLevel(page);

  await gotoLevels(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: name }).first()).toBeVisible({
    timeout: 15000,
  });
});

// ---------------------------------------------------------------------------
// Edit (inline) / delete
// ---------------------------------------------------------------------------

test('Editing a level inline saves the change (persists)', async ({ page }) => {
  const name = await createLevel(page);

  await gotoLevels(page);
  await page.waitForTimeout(1500);
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  // Search narrows to the single created level. Use the lone row (not a
  // hasText filter — once editing, the name moves into an input value and a
  // text filter would no longer match the row).
  await expect(page.getByRole('heading', { name: /Showing 1 Levels/ })).toBeVisible({ timeout: 15000 });
  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000); // let the filtered row settle

  // Click the pencil: the Name cell turns into an inline input, and the first
  // action icon becomes a save (check) control. Retry until the input appears.
  const actions = row.locator('td').last();
  const input = row.locator('input');
  await expect(async () => {
    if (!(await input.isVisible().catch(() => false))) {
      await actions.locator('svg').first().click();
    }
    await expect(input).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });

  const newName = 'QALvlE' + uniqueAlpha(6);
  await input.fill(newName);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/levels') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    actions.locator('svg').first().click(), // save (check)
  ]);
  await page.waitForTimeout(1000);

  // The renamed level is findable; the old name is gone.
  await gotoLevels(page);
  await search.fill(newName);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: newName }).first()).toBeVisible({
    timeout: 15000,
  });
  await search.fill(name);
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Levels/ })).toBeVisible({ timeout: 15000 });
});

test('Delete a level (with confirmation)', async ({ page }) => {
  const name = await createLevel(page);

  await gotoLevels(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(name);
  await search.press('Enter');
  const row = page.locator('tr.ant-table-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete Level')).toBeVisible();
  await expect(modal.getByText(/Are you sure/i)).toBeVisible();

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => /\/api\/level/i.test(r.url()) && r.request().method() === 'DELETE',
      { timeout: 25000 }
    ),
    modal.getByRole('button', { name: 'Delete' }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Pagination / sorting
// ---------------------------------------------------------------------------

test('Pagination navigates to the next page', async ({ page }) => {
  await gotoLevels(page);

  const firstBefore = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  await page.locator('li.ant-pagination-next').click();

  await expect(page.locator('li.ant-pagination-item-active')).toHaveText('2', { timeout: 15000 });
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
  const firstAfter = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  expect(firstAfter).not.toBe(firstBefore);
});

test('Sorting by Name reorders the list', async ({ page }) => {
  await gotoLevels(page);

  const header = page.getByRole('columnheader', { name: 'Name', exact: false }).first();
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
