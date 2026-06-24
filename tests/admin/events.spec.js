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

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
