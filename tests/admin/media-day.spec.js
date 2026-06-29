const { test, expect } = require('@playwright/test');
const {
  gotoEvents,
  gotoAddEvent,
  openSelectFilter,
  selectEventType,
  fillRequiredMediaDayFields,
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
  await gotoAddEvent(page);
  await selectEventType(page, 'Media Day');
  const title = 'QA Media Day ' + Date.now();
  await fillRequiredMediaDayFields(page, title);

  // The real create is /api/events/create-one (the /api/events/clash-events
  // pre-check fires first). Asserting on create-one confirms the event was
  // actually created, not just that the conflict check ran.
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/events/create-one') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save and Publish' }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();

  // The form was accepted, not rejected — no required-field errors remain.
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);
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
  const title = await createAndPublishMediaDay(page);

  const row = await findEventRowByTitle(page, title);
  await expect(row).toContainText(title);
});

test('Edit opens a Media Day in the edit form with its title intact', async ({ page }) => {
  const title = await createAndPublishMediaDay(page);
  const row = await findEventRowByTitle(page, title);

  // Media Day rows have three action icons: View (eye), Edit (pencil), Delete.
  // The 2nd icon opens the edit form (the 1st is read-only View).
  await row.locator('td').last().locator('svg').nth(1).click();

  await expect(page).toHaveURL(/\/events\/edit-event\/\d+/, { timeout: 25000 });
  await expect(page.locator('#eventTitle')).toHaveValue(title, { timeout: 25000 });
});

// SKIPPED: Media Day list rows have three action icons — View (eye, →
// /events/view-event/{id}), Edit (pencil, → /events/edit-event/{id}) and a
// third "Delete" icon. Unlike Game rows (kebab → Delete → confirm modal →
// DELETE /delete-one), clicking the Media Day Delete icon produces NO detectable
// confirmation: no ant modal, no popconfirm/popover, no native window.confirm,
// and no DELETE network request fire. So row deletion can't be driven reliably
// from here yet. Re-enable once the Delete control's behavior is pinned down
// (the View and Edit icons, and create/search/edit flows, are all covered).
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

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
