const { test, expect } = require('@playwright/test');
const {
  gotoUsers,
  gotoAddUser,
  createUser,
  fillUserForm,
  uniqueAlpha,
  openSelectFilter,
} = require('./helpers');

// ---------------------------------------------------------------------------
// Users list
// ---------------------------------------------------------------------------

test('Users list page loads with its core UI', async ({ page }) => {
  await gotoUsers(page);

  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  await expect(page.locator('.ant-select-selection-placeholder', { hasText: 'Role' }).first()).toBeVisible();
  await expect(page.getByText('Clear All')).toBeVisible();

  // Count line, columns and at least one user row (the sandbox is seeded).
  await expect(page.getByRole('heading', { name: /Showing \d+ Users/ })).toBeVisible();
  for (const col of ['Name', 'Role', 'Level', 'Commission Type', 'Rate', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
});

test('Search filters the user list by name', async ({ page }) => {
  await gotoUsers(page);

  const firstRow = page.locator('tr.ant-table-row').first();
  const name = (await firstRow.locator('td').first().innerText()).trim();
  const token = name.split(/\s+/)[0];

  const search = page.getByPlaceholder('Search');
  await search.fill(token);
  await search.press('Enter');

  // The matching user stays in the list.
  await expect(page.locator('tr.ant-table-row').filter({ hasText: token }).first()).toBeVisible({
    timeout: 15000,
  });

  // A gibberish term yields zero results.
  await search.fill('zzzznotarealuser');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Users/ })).toBeVisible({
    timeout: 15000,
  });
});

test('Role filter narrows the list', async ({ page }) => {
  await gotoUsers(page);

  const options = await openSelectFilter(page, 'Role');
  await expect(options.filter({ hasText: 'Admin' }).first()).toBeVisible();
  await expect(options.filter({ hasText: 'Photographer' }).first()).toBeVisible();

  // Select Photographer — the filter applies and the first row reflects it.
  await options.filter({ hasText: 'Photographer' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Photographer' })).toBeVisible();
  await expect(page.locator('tr.ant-table-row').first().locator('td').nth(1)).toContainText(
    /Photographer/
  );
});

// ---------------------------------------------------------------------------
// Add / create
// ---------------------------------------------------------------------------

test('Add button opens the Add User form', async ({ page }) => {
  await gotoUsers(page);
  await page.waitForTimeout(2000); // let the list settle before navigating

  const addBtn = page.getByRole('button', { name: 'Add' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/users\/add-user/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.locator('#firstName')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
});

test('Adding a user with an empty form shows required-field validation', async ({ page }) => {
  await gotoAddUser(page);

  await page.getByRole('button', { name: 'Save' }).click();

  for (const msg of [
    'Please enter a First Name',
    'Please enter a Last Name',
    'Please enter a Phone Number',
    'Please enter a Email Address',
    'Please choose a Level',
    'Please choose a Compensation Type',
    'Please enter a Rate',
  ]) {
    await expect(page.getByText(msg)).toBeVisible();
  }
  await expect(page).toHaveURL(/\/users\/add-user/);
});

test('Create a valid user', async ({ page }) => {
  // createUser fills the required fields, saves and waits for the create call.
  const { lastName } = await createUser(page);

  // The new user is findable in the list by its unique last name.
  await gotoUsers(page);
  const search = page.getByPlaceholder('Search');
  await search.fill(lastName);
  await search.press('Enter');
  await expect(page.locator('tr.ant-table-row').filter({ hasText: lastName }).first()).toBeVisible({
    timeout: 15000,
  });
});

// ---------------------------------------------------------------------------
// Edit / delete
// ---------------------------------------------------------------------------

test('Edit opens the user edit form', async ({ page }) => {
  await gotoUsers(page);

  const row = page.locator('tr.ant-table-row').first();
  await expect(row).toBeVisible({ timeout: 25000 });
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/users\/edit-user\/\d+/, { timeout: 25000 });
  await expect(page.locator('#firstName')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Delete a user (with confirmation)', async ({ page }) => {
  // Create a throwaway user so the delete is safe (won't touch seeded users).
  const { lastName } = await createUser(page);

  await gotoUsers(page);
  const search = page.getByPlaceholder('Search');

  // A just-created user can lag the search index under load, so re-issue the
  // search until the row shows up rather than relying on a single query.
  const row = page.locator('tr.ant-table-row').filter({ hasText: lastName }).first();
  await expect(async () => {
    await search.fill('');
    await search.fill(lastName);
    await search.press('Enter');
    await expect(row).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40000 });

  await row.locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete User')).toBeVisible();
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

test('Add user validates field formats', async ({ page }) => {
  await gotoAddUser(page);

  await page.locator('#firstName').fill('Test');
  await page.locator('#lastName').fill('Bad123'); // numbers not allowed
  await page.locator('#phone').fill('1234567890');
  await page.locator('#email').fill('notanemail'); // not a valid email
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Spaces and Numbers are not allowed in Last Name')).toBeVisible();
  await expect(page.getByText('Please enter a Valid Email Address')).toBeVisible();
  await expect(page).toHaveURL(/\/users\/add-user/);
});

// BUG: creating a user with a phone (or email) that already exists fails on the
// server but returns HTTP 200 with an error body and shows NO UI feedback — the
// form just sits there. This test documents that silent failure.
test('BUG: duplicate phone is rejected silently (HTTP 200 + error body, no UI)', async ({ page }) => {
  const existing = await createUser(page);

  await gotoAddUser(page);
  await fillUserForm(page, {
    lastName: 'Qa' + uniqueAlpha(6),
    phone: existing.phone, // reuse the existing phone -> duplicate
    email: 'qa' + Date.now() + '@example.com', // fresh email, so phone is the only clash
  });

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);

  // The request "succeeds" (200) but carries an error and creates nothing...
  expect(resp.status()).toBe(200);
  expect(JSON.stringify(await resp.json())).toMatch(/already exists/i);
  // ...with no inline validation shown and the form left on screen.
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
  await expect(page).toHaveURL(/\/users\/add-user/);
});

// Search for a user by last name and open its edit form. The edit-pencil click
// can misfire while the filtered list is still settling, so retry until the
// edit URL sticks (skipping the click once we've already navigated).
async function openUserEditByLastName(page, lastName) {
  const search = page.getByPlaceholder('Search');
  await search.fill(lastName);
  await search.press('Enter');
  const row = page.locator('tr.ant-table-row').filter({ hasText: lastName }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(async () => {
    if (!/\/users\/edit-user\/\d+/.test(page.url())) {
      await row.locator('td').last().locator('svg').first().click();
    }
    await expect(page).toHaveURL(/\/users\/edit-user\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

test('Editing a user saves the change (persists)', async ({ page }) => {
  const { lastName } = await createUser(page);

  // Open the new user's edit form.
  await gotoUsers(page);
  await openUserEditByLastName(page, lastName);

  // Change the City and save (Save redirects back to the list on success).
  // City is letters-only, so build a unique alpha value.
  const newCity = 'City' + uniqueAlpha(6);
  await page.locator('#city').fill(newCity);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/users/update-one') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await expect(page).toHaveURL(/\/users(\?|$)/, { timeout: 25000 });

  // Reopen the user and confirm the change persisted.
  await gotoUsers(page);
  await openUserEditByLastName(page, lastName);
  // Wait for the form to finish loading the record before reading City.
  await expect(page.locator('#firstName')).toHaveValue(/\S/, { timeout: 25000 });
  await expect(page.locator('#city')).toHaveValue(newCity, { timeout: 25000 });
});

test('Clear All resets the search', async ({ page }) => {
  await gotoUsers(page);

  const search = page.getByPlaceholder('Search');
  await search.fill('zzzznotarealuser');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: /Showing 0 Users/ })).toBeVisible({ timeout: 15000 });

  await page.getByText('Clear All').click();
  await expect(search).toHaveValue('');
  // The list is restored (rows reappear) — don't hard-code the page size.
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: /Showing [1-9]\d* Users/ })).toBeVisible();
});

test('Pagination navigates to the next page', async ({ page }) => {
  await gotoUsers(page);

  const firstBefore = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  await page.locator('li.ant-pagination-next').click();

  await expect(page.locator('li.ant-pagination-item-active')).toHaveText('2', { timeout: 15000 });
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible();
  const firstAfter = (await page.locator('tr.ant-table-row').first().locator('td').first().innerText()).trim();
  expect(firstAfter).not.toBe(firstBefore);
});

test('Sorting by Name marks the column sorted', async ({ page }) => {
  await gotoUsers(page);

  const nameHeader = page.getByRole('columnheader', { name: 'Name' }).first();
  await nameHeader.click();
  await expect(nameHeader).toHaveClass(/ant-table-column-sort/, { timeout: 10000 });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
