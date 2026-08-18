const { test, expect } = require('@playwright/test');
const {
  gotoEvents,
  gotoAddEvent,
  openSelectFilter,
  selectEventType,
  createAndPublishMediaDay,
  findEventRowByTitle,
} = require('./helpers');

// Admin "Media Day" events. A Media Day is a distinct event Type with its own
// form shape: it has an editable, required Title and a "Participating Teams"
// field instead of the Game type's Visiting/Home Team pair. These tests cover
// the form shape, create+publish, validation, search, edit and delete — and
// document a discrepancy around the "Vype Media Day" type.

// ---------------------------------------------------------------------------
// Type availability (list filter vs. Add form)
// ---------------------------------------------------------------------------

test('Events Type filter offers Media Day and Vype Media Day', async ({ page }) => {
  await gotoEvents(page);
  await page.waitForTimeout(2000);

  const options = await openSelectFilter(page, 'Type');
  for (const t of ['Media Day', 'Vype Media Day']) {
    await expect(options.filter({ hasText: new RegExp(`^${t}$`) }).first()).toBeVisible();
  }
});

// DISCREPANCY: "Vype Media Day" exists as a list filter type but is NOT an
// option in the Add Event form's Event Type select (only Game, Tournament,
// Media Day, Team Portrait are), so an event of that type can't be created
// through the UI — which is why the filter returns zero of them.
test('DISCREPANCY: Vype Media Day cannot be created from the Add Event form', async ({ page }) => {
  await gotoAddEvent(page);

  const typeItem = page.locator('.ant-form-item', { hasText: 'Event Type' }).first();
  await typeItem.locator('.ant-select').first().click();
  await page.waitForTimeout(800);

  const dropOptions = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ visible: true });

  await expect(dropOptions.filter({ hasText: /^Media Day$/ }).first()).toBeVisible();
  await expect(dropOptions.filter({ hasText: /^Vype Media Day$/ })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Add Event form — Media Day shape
// ---------------------------------------------------------------------------

test('Switching to Media Day reveals its form fields', async ({ page }) => {
  await gotoAddEvent(page);
  await selectEventType(page, 'Media Day');

  // Media Day has Participating Teams and an editable Title; the Game-only
  // Visiting/Home Team fields are gone.
  await expect(page.locator('.ant-form-item', { hasText: 'Participating Teams' })).toBeVisible();
  await expect(page.locator('#eventTitle')).toBeEnabled();
  await expect(page.locator('.ant-form-item', { hasText: 'Visiting Team' })).toHaveCount(0);
  await expect(page.locator('.ant-form-item', { hasText: 'Home Team' })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Create / publish
// ---------------------------------------------------------------------------

test('Create and publish a Media Day event', async ({ page }) => {
  test.slow(); // create may retry on schedule-conflict against the slow backend
  // createAndPublishMediaDay fills the form on a future date, clicks Save and
  // Publish, and waits for the real /api/events/create-one POST (not the
  // /api/events/clash-events pre-check) — retrying on a further-out slot if a
  // photographer schedule-conflict blocks the create. Reaching here means the
  // event was actually created.
  const title = await createAndPublishMediaDay(page);
  expect(title).toMatch(/^QA Media Day/);
});

// ---------------------------------------------------------------------------
// Negative / validation
// ---------------------------------------------------------------------------

test('Publishing an empty Media Day shows required-field validation', async ({ page }) => {
  await gotoAddEvent(page);
  await selectEventType(page, 'Media Day');

  await page.getByRole('button', { name: 'Save and Publish' }).click();

  // The Media Day form requires a typed Title (Game auto-generates it), plus
  // Sports (Sub Category), Level, Date and Time.
  await expect(page.getByText('Please enter a Title')).toBeVisible();
  await expect(page.getByText('Please select a Sub Category')).toBeVisible();
  await expect(page.getByText('Please select a Level')).toBeVisible();
  await expect(page.getByText('Please pick a Date')).toBeVisible();
  await expect(page.getByText('Please pick valid Time Slot')).toBeVisible();

  await expect(page).toHaveURL(/\/events\/add-event/);
});

// ---------------------------------------------------------------------------
// Search / edit / delete (operate on a Media Day we create)
// ---------------------------------------------------------------------------

test('Search finds a created Media Day by title', async ({ page }) => {
  test.slow();
  const title = await createAndPublishMediaDay(page);

  const row = await findEventRowByTitle(page, title);
  await expect(row).toContainText(title);
});

test('Edit opens a Media Day in the edit form with its title intact', async ({ page }) => {
  test.slow();
  const title = await createAndPublishMediaDay(page);
  const row = await findEventRowByTitle(page, title);

  // Media Day rows have three action icons: View (eye), Edit (pencil), Delete.
  // The 2nd icon opens the edit form (the 1st is read-only View).
  await row.locator('td').last().locator('svg').nth(1).click();

  await expect(page).toHaveURL(/\/events\/edit-event\/\d+/, { timeout: 25000 });
  await expect(page.locator('#eventTitle')).toHaveValue(title, { timeout: 25000 });
});

test('View opens a Media Day in read-only detail', async ({ page }) => {
  test.slow();
  const title = await createAndPublishMediaDay(page);
  const row = await findEventRowByTitle(page, title);

  // The 1st action icon (eye) opens the read-only view page.
  await row.locator('td').last().locator('svg').first().click();

  await expect(page).toHaveURL(/\/events\/view-event\/\d+/, { timeout: 25000 });
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 25000 });
  // The view page offers an Edit action.
  await expect(page.getByRole('button', { name: /^Edit$/ })).toBeVisible();
});

test('Editing a Media Day persists the change', async ({ page }) => {
  test.slow();
  const title = await createAndPublishMediaDay(page);
  let row = await findEventRowByTitle(page, title);
  await row.locator('td').last().locator('svg').nth(1).click(); // edit
  await expect(page).toHaveURL(/\/events\/edit-event\/\d+/, { timeout: 25000 });

  // Edit the (editable) Title and save — edits post to /api/events/update-one.
  // We change the Title (a plain input) rather than Location, which is an
  // autocomplete select that wouldn't persist a free-typed value.
  const newTitle = title + ' Edited';
  await page.locator('#eventTitle').fill(newTitle);
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/events/update-one') && r.request().method() === 'POST',
      { timeout: 60000 }
    ),
    page.getByRole('button', { name: 'Save and Publish' }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
  await page.waitForTimeout(1500);

  // Reopen the edit form (find by the NEW title) and confirm the change stuck.
  row = await findEventRowByTitle(page, newTitle);
  await row.locator('td').last().locator('svg').nth(1).click();
  await expect(page).toHaveURL(/\/events\/edit-event\/\d+/, { timeout: 25000 });
  await expect(page.locator('#eventTitle')).toHaveValue(newTitle, { timeout: 25000 });
});

// SKIPPED: Media Day deletion can't be automated. The list row's 3rd (Delete)
// icon produces NO detectable confirmation when clicked — no ant modal, no
// popconfirm/popover, no native window.confirm, and no DELETE request — unlike
// Game rows (kebab → Delete → modal → DELETE /delete-one) and unlike SOW
// (icon → "Delete SOW" modal). The View and Edit detail pages have no delete
// control either. Re-enable once the Delete control's behavior is identified.
// (Create, search, view and edit-persistence are all covered above.)
test.fixme('Delete removes a Media Day (with confirmation)', async ({ page }) => {
  const title = await createAndPublishMediaDay(page);
  const row = await findEventRowByTitle(page, title);

  // 3rd icon = Delete. (Confirm UI not yet identified — see note above.)
  await row.locator('td').last().locator('svg').nth(2).click();

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/delete-one') && r.request().method() === 'DELETE',
      { timeout: 25000 }
    ),
    page.getByRole('button', { name: /^(Delete|Yes|OK|Confirm)$/ }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Vype Media Days module — July 2026 release tickets
// ---------------------------------------------------------------------------
const MD_BASE = 'https://uat-phlox-admin.netlify.app';
const MD_ROWS = '.ant-table-tbody tr:not(.ant-table-measure-row)';

// PAS-719 — a VYPE Media Days row navigates to its dedicated edit page,
// not a generic/wrong event edit page.
test('PAS-719 Media Day row navigates to /events/edit-media-day/{id}', async ({ page }) => {
  test.slow();
  await page.goto(`${MD_BASE}/events/media-days`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const row = page.locator(MD_ROWS).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.locator('td').last().locator('svg,a,button').last().click({ timeout: 6000 });
  await expect(page).toHaveURL(/\/events\/edit-media-day\/\d+/, { timeout: 20000 });
});

// PAS-711 — the Media Day form surfaces auto-generated suggested titles.
test('PAS-711 Media Day edit form shows suggested titles', async ({ page }) => {
  test.slow();
  await page.goto(`${MD_BASE}/events/media-days`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.locator(MD_ROWS).first().locator('td').last().locator('svg,a,button').last().click({ timeout: 6000 });
  await expect(page).toHaveURL(/edit-media-day\/\d+/, { timeout: 20000 });
  await expect(page.getByText(/suggest/i).first()).toBeVisible({ timeout: 12000 });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
