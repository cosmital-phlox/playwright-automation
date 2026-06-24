const { test, expect } = require('@playwright/test');
const { gotoZenfolio, openSelectFilter } = require('./helpers');

// The Zenfolio "Browse & Buy" screen is a read-only sales-matching list (imported
// Zenfolio/PhotoDay sales matched to events/orders) — there's no "Add". The table
// is wide, so use a roomy viewport. The order count loads slowly, so these tests
// cover the list UI, filters, search and Import rather than specific rows.
test.use({ viewport: { width: 1600, height: 900 } });

test('Browse & Buy list loads with its core UI', async ({ page }) => {
  await gotoZenfolio(page);

  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  await expect(page.getByText('Clear All')).toBeVisible();
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  for (const f of ['Event', 'Job Title/Gallery', 'Group', 'Event Match', 'Order Source']) {
    await expect(page.locator('.ant-select-selection-placeholder', { hasText: f }).first()).toBeVisible();
  }
  await expect(page.getByPlaceholder('Sales start date')).toBeVisible();

  await expect(page.getByRole('heading', { name: /Showing \d+ Orders/ })).toBeVisible();
  for (const col of ['ID', 'Sales Date', 'Customer', 'Email', 'Matched event', 'Job Title/Gallery', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
});

test('Event Match filter offers Matched and Unmatched', async ({ page }) => {
  await gotoZenfolio(page);

  const options = await openSelectFilter(page, 'Event Match');
  await expect(options.filter({ hasText: 'Matched' }).first()).toBeVisible();
  await expect(options.filter({ hasText: 'Unmatched' }).first()).toBeVisible();
});

test('Order Source filter offers the expected sources', async ({ page }) => {
  await gotoZenfolio(page);

  const options = await openSelectFilter(page, 'Order Source');
  for (const o of ['Zenfolio B&B', 'Zenfolio Spotlight', 'PhotoDay']) {
    await expect(options.filter({ hasText: o }).first()).toBeVisible();
  }
});

test('Search accepts a term and keeps the table rendered', async ({ page }) => {
  await gotoZenfolio(page);

  const search = page.getByPlaceholder('Search');
  await search.fill('zzzznotarealsale');
  await search.press('Enter');

  await expect(search).toHaveValue('zzzznotarealsale');
  await expect(page.getByRole('columnheader', { name: 'ID', exact: false }).first()).toBeVisible();
});

test('Clear All resets an applied filter', async ({ page }) => {
  await gotoZenfolio(page);

  const options = await openSelectFilter(page, 'Order Source');
  await options.filter({ hasText: 'PhotoDay' }).first().click();
  await expect(
    page
      .locator('.ant-select-selection-item')
      .filter({ hasText: 'PhotoDay' })
      .or(page.locator('.ant-select-item-option-selected').filter({ hasText: 'PhotoDay' }))
      .first()
  ).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByText('Clear All').click();
  await expect(page.locator('.ant-select-selection-item').filter({ hasText: 'PhotoDay' })).toHaveCount(0);
});

test('Import opens the Upload dialog', async ({ page }) => {
  await gotoZenfolio(page);
  await page.waitForTimeout(1500);

  const modal = page.locator('.ant-modal-content');
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Import' }).click();
    }
    await expect(modal).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });

  await expect(modal.getByRole('heading', { name: 'Upload' })).toBeVisible();
  await expect(modal.getByText(/Click or Drag File/i).first()).toBeVisible();
  await expect(modal.getByText(/only csv file is supported/i)).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
