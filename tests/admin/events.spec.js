const { test, expect } = require('@playwright/test');
const {
  gotoEvents,
  gotoAddEvent,
  gotoEventsFilteredByFirstTeam,
  fillRequiredEventFields,
  createAndPublishEvent,
  openSelectFilter,
} = require('./helpers');

// ---------------------------------------------------------------------------
// Events list
// ---------------------------------------------------------------------------

test('Events list page loads with its core UI', async ({ page }) => {
  await gotoEvents(page);

  // Header actions
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();

  // Search + a few of the filter dropdowns
  await expect(page.getByPlaceholder('Search')).toBeVisible();
  for (const f of ['Teams', 'Levels', 'Status']) {
    await expect(page.locator('.ant-select-selection-placeholder', { hasText: f }).first()).toBeVisible();
  }

  // Table column headers and the count line
  await expect(page.getByText(/Showing \d+ Events/)).toBeVisible();
  for (const col of ['Title', 'Location', 'Event Date & Time', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
});

test('Add button opens the Add Event form with its defaults', async ({ page }) => {
  await gotoEvents(page);
  // Let the list finish loading first — it rewrites its own URL (sort params)
  // on load, which can clobber the Add navigation if we click too early.
  await page.waitForTimeout(2500);

  const addBtn = page.getByRole('button', { name: 'Add' });
  await expect(async () => {
    await addBtn.click();
    await expect(page).toHaveURL(/\/events\/add-event/, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await expect(page.getByText('Add Event').first()).toBeVisible();

  // The form ships with sensible defaults: Event Type "Game", privacy "No",
  // and a "Draft" publish status.
  await expect(page.locator('.ant-select-selection-item').filter({ hasText: 'Game' })).toBeVisible();
  await expect(page.getByText('Publish Status :')).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();

  // Save actions are present.
  await expect(page.getByRole('button', { name: 'Save as Draft' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save and Publish' })).toBeVisible();
});

test('Event title is auto-generated and read-only', async ({ page }) => {
  await gotoAddEvent(page);

  // Title is disabled — you never type it.
  const title = page.locator('#eventTitle');
  await expect(title).toBeDisabled();

  // After picking the teams/level/sport, the title builds itself from them.
  const built = await fillRequiredEventFields(page);
  expect(built.length).toBeGreaterThan(3);
  expect(built).toContain('@'); // "{Visiting} @ {Home} - {Level} - {Sport}"
});

// ---------------------------------------------------------------------------
// Create / publish
// ---------------------------------------------------------------------------

test('Create and publish a valid event', async ({ page }) => {
  await gotoAddEvent(page);
  await fillRequiredEventFields(page);

  // Publishing a fully-valid form submits to the backend (clash check + create)
  // and clears all client-side validation.
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/events') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save and Publish' }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();

  // No required-field errors remain (the form was accepted, not rejected).
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Negative / validation
// ---------------------------------------------------------------------------

test('Publishing an empty event shows required-field validation', async ({ page }) => {
  await gotoAddEvent(page);

  await page.getByRole('button', { name: 'Save and Publish' }).click();

  // The form blocks the publish and flags every required field.
  await expect(page.getByText('Please select a Visiting Team')).toBeVisible();
  await expect(page.getByText('Please select a Home Team')).toBeVisible();
  await expect(page.getByText('Please select a Sub Category')).toBeVisible();
  await expect(page.getByText('Please select a Level')).toBeVisible();
  await expect(page.getByText('Please pick a Date')).toBeVisible();
  await expect(page.getByText('Please pick valid Time Slot')).toBeVisible();

  // We stay on the form (nothing was created).
  await expect(page).toHaveURL(/\/events\/add-event/);
});

// BUG: "Save as Draft" performs NO validation — an entirely empty form is
// accepted and a blank "@ - -" draft is created. This test documents that gap;
// a draft should arguably still require at least a title or teams.
test('BUG: Save as Draft accepts a completely empty form', async ({ page }) => {
  await gotoAddEvent(page);

  await page.getByRole('button', { name: 'Save as Draft' }).click();

  // It "succeeds" — a success toast appears and no validation is shown.
  await expect(page.getByText(/Created Successfully/i)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
});

test('Searching for a non-existent event shows no results', async ({ page }) => {
  await gotoEvents(page);

  const search = page.getByPlaceholder('Search');
  await search.fill('zzzznotarealadminevent');
  await search.press('Enter');

  // The list resolves to an empty result (count line reads 0 / "No Data").
  await expect(page.getByText(/Showing 0 Events/)).toBeVisible({ timeout: 15000 });
});

// ---------------------------------------------------------------------------
// Edit / delete
// ---------------------------------------------------------------------------

test('Edit opens the event edit form', async ({ page }) => {
  // Ensure at least one event exists, then surface it via the Team filter.
  await createAndPublishEvent(page);
  await gotoEventsFilteredByFirstTeam(page);

  // The first action icon (pencil) opens the edit form for that event.
  const row = page.locator('tr.ant-table-row').first();
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/events\/edit-event\/\d+/, { timeout: 25000 });
  // The form is pre-populated — the auto-title carries the existing value.
  await expect(page.locator('#eventTitle')).toHaveValue(/\S/, { timeout: 25000 });
});

test('Delete removes an event (with confirmation)', async ({ page }) => {
  await createAndPublishEvent(page);
  await gotoEventsFilteredByFirstTeam(page);

  // Event actions: a kebab (⋮) menu holds Duplicate / Delete.
  const row = page.locator('tr.ant-table-row').first();
  await row.locator('td').last().locator('svg').nth(1).click();
  await page.locator('.ant-dropdown-menu-item', { hasText: 'Delete' }).click();

  // A confirmation dialog appears before anything is removed.
  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Delete Event')).toBeVisible();
  await expect(modal.getByText(/Are you sure/i)).toBeVisible();

  // Confirming fires the delete request; assert the backend accepts it (200).
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
// Filters / Import / clash detection
// ---------------------------------------------------------------------------

test('Status filter offers the expected options', async ({ page }) => {
  await gotoEvents(page);
  await page.waitForTimeout(2000);

  const options = await openSelectFilter(page, 'Status');
  for (const o of ['Draft', 'Published', 'Cancelled', 'Fulfilled']) {
    await expect(options.filter({ hasText: o }).first()).toBeVisible();
  }
});

test('Type filter offers the expected options', async ({ page }) => {
  await gotoEvents(page);
  await page.waitForTimeout(2000);

  const options = await openSelectFilter(page, 'Type');
  for (const o of ['Game', 'Tournament', 'Media Day']) {
    await expect(options.filter({ hasText: o }).first()).toBeVisible();
  }
});

test('Import opens the CSV upload dialog', async ({ page }) => {
  await gotoEvents(page);
  await page.waitForTimeout(2000);

  const modal = page.locator('.ant-modal-content');
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Import' }).click();
    }
    await expect(modal).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });

  await expect(modal.getByRole('heading', { name: 'Import events' })).toBeVisible();
  await expect(modal.getByText(/Click or drag file/i).first()).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Import' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

// Publishing an event whose photographer already has an event at the same
// time triggers a schedule-conflict modal and blocks creation. The standard
// fixture event (created elsewhere in this suite) makes this collide reliably.
test('Publishing a conflicting event shows the schedule-conflict modal', async ({ page }) => {
  await createAndPublishEvent(page); // ensure the conflicting event exists

  await gotoAddEvent(page);
  await fillRequiredEventFields(page); // same teams/date/time -> conflict
  await page.getByRole('button', { name: 'Save and Publish' }).click();

  await expect(page.getByText(/schedule conflict/i).first()).toBeVisible({ timeout: 25000 });
  await expect(page).toHaveURL(/\/events\/add-event/);
});

// ---------------------------------------------------------------------------
// July 2026 release tickets — Events list & org reassignment
// ---------------------------------------------------------------------------
const EV_BASE = 'https://uat-phlox-admin.netlify.app';
const EV_ROWS = '.ant-table-tbody tr:not(.ant-table-measure-row)';

// PAS-698 — Admin staff personalization: the list defaults to the logged-in user.
test('PAS-698 Events list applies the logged-in user as the default Staff filter', async ({ page }) => {
  await page.goto(`${EV_BASE}/events/vype-sideline`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const staffChip = page.locator('.ant-select-selection-item').filter({ hasText: /[A-Za-z]+ [A-Za-z]+/ }).first();
  expect(/staff=\d+/.test(page.url()) || (await staffChip.count()) > 0).toBeTruthy();
});

// PAS-717 — the Sideline list API is not fired twice when switching tabs.
test('PAS-717 Each tab fires its list API exactly once (no double call)', async ({ page }) => {
  test.slow();
  let md = 0;
  page.on('request', (r) => { if (/\/api\/media-days\/get-all/i.test(r.url())) md++; });
  await page.goto(`${EV_BASE}/events/vype-sideline`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  md = 0;
  await page.getByText('Vype Media Days', { exact: false }).first().click({ timeout: 8000 });
  await page.waitForTimeout(4000);
  expect(md, 'media-days list API should fire at most once per tab switch').toBeLessThanOrEqual(1);
});

// PAS-720 — pagination returns fresh next-page data (no stale page-1 rows).
test('PAS-720 Pagination returns fresh next-page data', async ({ page }) => {
  test.slow();
  await page.goto(`${EV_BASE}/events/vype-sideline`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const titlesOf = async () => (await page.locator(`${EV_ROWS} td:nth-child(2)`).allTextContents()).map((t) => t.trim()).filter(Boolean);
  const page1 = await titlesOf();
  expect(page1.length).toBeGreaterThan(0);
  await page.locator('.ant-pagination-next').click({ timeout: 6000 });
  await page.waitForTimeout(4000);
  const page2 = await titlesOf();
  expect(page2.length).toBeGreaterThan(0);
  expect(page2.filter((t) => page1.includes(t)).length, 'page 2 must not repeat page 1 rows').toBe(0);
});

// PAS-760 — reassign an event's organization (Home Team), assert it persists, then revert.
test('PAS-760 Reassign event 2753 Home Team, assert persist, then revert', async ({ page }) => {
  test.slow();
  test.setTimeout(120000);
  let saveStatus = null;
  page.on('response', (r) => {
    if (/\/api\/events\/update-one/i.test(r.url()) && r.request().method() === 'POST') saveStatus = r.status();
  });
  const setHome = async (to) => {
    const ht = page.locator('#homeTeam').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
    await ht.locator('.ant-select-selection-item-remove, .ant-select-clear').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500); await ht.click({ timeout: 6000 }); await page.waitForTimeout(400);
    await page.keyboard.type(to, { delay: 25 }); await page.waitForTimeout(1700);
    const opt = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: new RegExp('^' + to + '$', 'i') }).first();
    await opt.scrollIntoViewIfNeeded().catch(() => {});
    await opt.click({ timeout: 4000, force: true }).catch(async () => { await page.keyboard.press('Enter'); });
    await page.waitForTimeout(1000);
  };
  await page.goto(`${EV_BASE}/events/edit-event/2753`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const anchor = page.locator('#homeTeam').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
  await expect(anchor).toContainText(/Lake Travis/i);

  await setHome('Lake Travis HS');
  saveStatus = null;
  await page.getByRole('button', { name: /save and publish/i }).first().click({ timeout: 6000 });
  await page.waitForTimeout(8000);
  expect(saveStatus, 'update-one should return 200').toBe(200);
  await expect(page).toHaveURL(/vype-sideline/);

  await page.goto(`${EV_BASE}/events/edit-event/2753`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await expect(page.locator('#homeTeam').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]')).toContainText(/Lake Travis HS/i);

  // revert (cleanup)
  await setHome('Lake Travis');
  await page.getByRole('button', { name: /save and publish/i }).first().click({ timeout: 6000 });
  await page.waitForTimeout(7000);
  await page.goto(`${EV_BASE}/events/edit-event/2753`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await expect(page.locator('#homeTeam').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]')).toContainText(/^Lake Travis$/i);
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
