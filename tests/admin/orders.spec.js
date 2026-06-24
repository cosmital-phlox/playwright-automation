const { test, expect } = require('@playwright/test');
const { gotoOrders, openSelectFilter, applyOrderDateRange } = require('./helpers');

// The admin Orders screen ("Prepaid Orders") is a read-only management view —
// orders originate from customer purchases, so there's no "Add". These tests
// cover the list UI, the filters, search and the (empty) table state.

test('Orders list page loads with its core UI', async ({ page }) => {
  await gotoOrders(page);

  // Title / breadcrumb + the Export action.
  await expect(page.getByText('Prepaid Orders').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();

  // Search + the filter dropdowns.
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  for (const f of ['Event', 'Team', 'Category', 'Status', 'Photographer', 'Order Type', 'Payment status']) {
    await expect(page.locator('.ant-select-selection-placeholder', { hasText: f }).first()).toBeVisible();
  }

  // The order/event date-range inputs.
  await expect(page.getByPlaceholder('Order start date')).toBeVisible();
  await expect(page.getByPlaceholder('Event start date')).toBeVisible();

  // Key table columns.
  for (const col of ['Order Id', 'Athlete name', 'Order Date', 'Price Paid', 'Status', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
});

test('Status filter offers the expected options and applies a selection', async ({ page }) => {
  await gotoOrders(page);

  const options = await openSelectFilter(page, 'Status');
  for (const o of ['Pending upload', 'Fulfilment awaits', 'Fulfilled', 'Refunded']) {
    await expect(options.filter({ hasText: o }).first()).toBeVisible();
  }

  // Status is a multi-select — picking an option marks it selected (the dropdown
  // stays open), so assert the option's selected state rather than a single value.
  await options.filter({ hasText: 'Fulfilled' }).first().click();
  await expect(
    page.locator('.ant-select-item-option-selected', { hasText: 'Fulfilled' })
  ).toBeVisible();
});

test('Order Type filter offers Event and Bundle', async ({ page }) => {
  await gotoOrders(page);

  const options = await openSelectFilter(page, 'Order Type');
  await expect(options.filter({ hasText: 'Event' }).first()).toBeVisible();
  await expect(options.filter({ hasText: 'Bundle' }).first()).toBeVisible();

  await options.filter({ hasText: 'Bundle' }).first().click();
  await expect(page.locator('.ant-select-selection-item', { hasText: 'Bundle' })).toBeVisible();
});

test('Search accepts a term and keeps the table rendered', async ({ page }) => {
  await gotoOrders(page);

  const search = page.getByPlaceholder('Search');
  await search.fill('zzzznotarealorder');
  await search.press('Enter');

  // The query is held and the table chrome stays put (no crash); this sandbox
  // admin has no matching prepaid orders, so no data rows appear.
  await expect(search).toHaveValue('zzzznotarealorder');
  await expect(page.getByRole('columnheader', { name: 'Order Id', exact: false }).first()).toBeVisible();
  await expect(page.locator('tr.ant-table-row')).toHaveCount(0);
});

test('Filtering by an Event applies the selection', async ({ page }) => {
  await gotoOrders(page);

  const options = await openSelectFilter(page, 'Event');
  const first = options.first();
  await expect(first).toBeVisible({ timeout: 15000 });
  const eventName = (await first.innerText()).trim();
  await first.click();

  // The chosen event is shown as the applied filter value.
  await expect(page.locator('.ant-select-selection-item').first()).toContainText(
    eventName.slice(0, 10)
  );
});

test('Team, Category and Photographer filters open with options', async ({ page }) => {
  await gotoOrders(page);

  for (const f of ['Team', 'Category', 'Photographer']) {
    const options = await openSelectFilter(page, f);
    await expect(options.first()).toBeVisible({ timeout: 15000 });
  }
});

test('Filtering by an order date range surfaces orders', async ({ page }) => {
  await gotoOrders(page);
  await applyOrderDateRange(page);

  // The range is applied and seeded orders now appear.
  await expect(page.getByPlaceholder('Order start date')).not.toHaveValue('');
  await expect(page.getByRole('heading', { name: /Showing [1-9]\d* Orders/ })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible({ timeout: 20000 });
});

test('Export downloads an orders file', async ({ page }) => {
  await gotoOrders(page);
  await applyOrderDateRange(page); // ensure there is data to export
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible({ timeout: 20000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: 'Export' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/Orders.*\.xlsx/i);
});

test('Sorting the order list marks the column sorted', async ({ page }) => {
  await gotoOrders(page);
  await applyOrderDateRange(page);
  await expect(page.locator('tr.ant-table-row').first()).toBeVisible({ timeout: 20000 });

  const header = page.getByRole('columnheader', { name: 'Order Date', exact: false }).first();
  await header.click();
  await expect(header).toHaveClass(/ant-table-column-sort/, { timeout: 10000 });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
