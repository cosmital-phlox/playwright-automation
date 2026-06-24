const { test, expect } = require('@playwright/test');
const { gotoPayouts } = require('./helpers');

// Payouts is a read-only payee/amount view (no Add). It opens on the current
// date showing 0 records; "View History" reveals the seeded payout history.

test('Payouts list page loads with its core UI', async ({ page }) => {
  await gotoPayouts(page);

  await expect(page.getByRole('button', { name: 'View History' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(page.getByText('Clear All')).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  await expect(page.locator('.ant-select-selection-placeholder', { hasText: 'Role' }).first()).toBeVisible();
  await expect(page.getByPlaceholder('Select date')).toBeVisible();

  await expect(page.getByRole('heading', { name: /Showing \d+ Records/ })).toBeVisible();
  for (const col of ['Payee', 'Role', 'Amount', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
});

test('Role filter offers Staff and Booster Club', async ({ page }) => {
  await gotoPayouts(page);

  await page.locator('.ant-select').filter({ hasText: 'Role' }).first().click();
  const options = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ visible: true });
  await expect(options.filter({ hasText: 'Staff' }).first()).toBeVisible();
  await expect(options.filter({ hasText: 'Booster Club' }).first()).toBeVisible();
});

test('View History reveals payout records', async ({ page }) => {
  await gotoPayouts(page);

  await page.getByRole('button', { name: 'View History' }).click();

  // History shows the seeded payout records (payee / role / amount rows).
  await expect(page.getByRole('heading', { name: /Showing [1-9]\d* Records/ })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible({ timeout: 20000 });
});

test('Download exports a payouts CSV', async ({ page }) => {
  await gotoPayouts(page);
  await page.waitForTimeout(1500);

  let download = null;
  for (let i = 0; i < 3 && !download; i++) {
    const dlPromise = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await page.getByRole('button', { name: 'Download' }).click();
    download = await dlPromise;
  }
  expect(download, 'Download should produce a file').toBeTruthy();
  expect(download.suggestedFilename()).toMatch(/Payout.*\.csv/i);
});

test('Search accepts a term and keeps the table rendered', async ({ page }) => {
  await gotoPayouts(page);

  const search = page.getByPlaceholder('Search');
  await search.fill('zzzznotarealpayee');
  await search.press('Enter');

  await expect(search).toHaveValue('zzzznotarealpayee');
  await expect(page.getByRole('columnheader', { name: 'Payee', exact: false }).first()).toBeVisible();
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
