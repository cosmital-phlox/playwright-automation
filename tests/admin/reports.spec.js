const { test, expect } = require('@playwright/test');
const { gotoReports } = require('./helpers');

// Reports lists downloadable reports; each Download opens a modal where you pick
// a date range, then it exports a file.

// Open a report's download modal, retrying the click (it can misfire before the
// row's handler is ready while the list is still settling).
async function openReportModal(page, reportName) {
  await page.waitForTimeout(1500);
  const row = page.locator('tr.ant-table-row').filter({ hasText: reportName }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  const modal = page.locator('.ant-modal-content');
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await row.getByText('Download').click();
    }
    await expect(modal).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });
  return modal;
}

test('Reports list page loads with its reports', async ({ page }) => {
  await gotoReports(page);

  for (const col of ['Name', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.getByText('Event profitability')).toBeVisible();
  await expect(page.getByText('Customer Information - Orders')).toBeVisible();
  await expect(page.getByText('Download')).toHaveCount(2);
});

test('Download opens the report date-range dialog', async ({ page }) => {
  await gotoReports(page);

  const modal = await openReportModal(page, 'Event profitability');
  await expect(modal.getByRole('heading', { name: /Event profitability report/i })).toBeVisible();
  await expect(modal.getByPlaceholder('Start date')).toBeVisible();
  await expect(modal.getByPlaceholder('End date')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('Downloading the Event profitability report produces a file', async ({ page }) => {
  await gotoReports(page);

  const modal = await openReportModal(page, 'Event profitability');

  // Pick a date range (first → last enabled day in view).
  await modal.getByPlaceholder('Start date').click();
  await page.waitForTimeout(800);
  const cells = page.locator(
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell:not(.ant-picker-cell-disabled) .ant-picker-cell-inner'
  );
  await cells.first().click();
  await page.waitForTimeout(400);
  await cells.last().click();
  await page.waitForTimeout(800);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    modal.getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/profitability.*\.(xlsx|csv)/i);
});

test('The Customer Information report opens its download dialog', async ({ page }) => {
  await gotoReports(page);

  const modal = await openReportModal(page, 'Customer Information');
  await expect(modal.getByPlaceholder('Start date')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Download' })).toBeVisible();
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
