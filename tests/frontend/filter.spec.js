const { test, expect } = require('@playwright/test');

const EVENTS_URL = 'https://uat-phlox-frontend.netlify.app/events-bundles';

// Open the events page and wait for the filter bar to be ready.
async function gotoEvents(page) {
  // domcontentloaded — don't wait on the events page's heavy 3rd-party scripts.
  await page.goto(EVENTS_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('li.tab_item').first()).toBeVisible({ timeout: 25000 });
}

test('event tabs switch the active filter', async ({ page }) => {
  await gotoEvents(page);

  for (const name of ['Games', 'Tournaments', 'Spotlight Bundles', 'All']) {
    const tab = page.locator('li.tab_item').filter({ hasText: name });
    await tab.click();
    await expect(tab).toHaveClass(/is-active/);
  }
});

test('select a Sport from the dropdown', async ({ page }) => {
  await gotoEvents(page);

  // Dropdowns by order: 0 = Team, 1 = Sport, 2 = Level, 3 = Future events.
  await page.getByRole('combobox').nth(1).click();
  const openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await openDropdown.locator('.ant-select-item-option').filter({ hasText: 'Baseball' }).first().click();

  // The chosen value shows as the selected item in the filter bar.
  await expect(page.locator('.ant-select-selection-item[title="Baseball"]')).toBeVisible();
});

test('select a Team from the dropdown (typeahead)', async ({ page }) => {
  await gotoEvents(page);

  // Team (combobox 0) loads options from the backend as you type. The query can
  // be slow/empty, so retry typing until options actually appear.
  const team = page.getByRole('combobox').nth(0);
  const openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  const firstOption = openDropdown.locator('.ant-select-item-option').first();

  let loaded = false;
  for (let i = 0; i < 4; i++) {
    await team.click();
    await team.fill('Texas');
    if (await firstOption.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
      loaded = true;
      break;
    }
    await team.fill(''); // clear and retry
    await page.waitForTimeout(500);
  }
  expect(loaded, 'Team typeahead options should load').toBe(true);

  const teamName = (await firstOption.innerText()).trim();
  await firstOption.click();

  // The chosen team shows as the selected item.
  await expect(page.locator(`.ant-select-selection-item[title="${teamName}"]`)).toBeVisible();
});

test('select a Level from the dropdown', async ({ page }) => {
  await gotoEvents(page);

  // Level is combobox 2.
  await page.getByRole('combobox').nth(2).click();
  const openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await openDropdown.locator('.ant-select-item-option').filter({ hasText: '7A' }).first().click();

  await expect(page.locator('.ant-select-selection-item[title="7A"]')).toBeVisible();
});

test('search filters the event list', async ({ page }) => {
  await gotoEvents(page);
  await expect(page.getByRole('link', { name: /View Event Details/ }).first()).toBeVisible({
    timeout: 25000,
  });

  // Search applies on Enter; a term that matches nothing yields "No Results".
  const search = page.getByRole('textbox', { name: 'Search' });
  await search.fill('zzzznotarealevent');
  await search.press('Enter');
  await expect(page.getByText(/No Results/i)).toBeVisible({ timeout: 10000 });
});

test('search returns matching events', async ({ page }) => {
  await gotoEvents(page);
  const firstEvent = page.getByRole('link', { name: /View Event Details/ }).first();
  await expect(firstEvent).toBeVisible({ timeout: 25000 });

  // Take a word from the first event's title and search for it.
  const title = await firstEvent.getByRole('heading').first().innerText();
  const term = title.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '');

  const search = page.getByRole('textbox', { name: 'Search' });
  await search.fill(term);
  await search.press('Enter');

  // Results are filtered to matches (not the "No Results" state) and at least
  // one event containing the searched term is shown.
  await expect(page.getByText(/No Results/i)).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: new RegExp(term, 'i') }).first()
  ).toBeVisible({ timeout: 10000 });
});

// Select a team via the typeahead (retry typing — the backend query is flaky).
async function selectTeam(page) {
  const team = page.getByRole('combobox').nth(0);
  const openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  const firstOption = openDropdown.locator('.ant-select-item-option').first();
  for (let i = 0; i < 4; i++) {
    await team.click();
    await team.fill('Texas');
    if (await firstOption.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) break;
    await team.fill('');
    await page.waitForTimeout(500);
  }
  const name = (await firstOption.innerText()).trim();
  await firstOption.click();
  return name;
}

// Pick an option from an Ant Select by its visible label.
async function selectAntOption(page, comboIndex, label) {
  await page.getByRole('combobox').nth(comboIndex).click();
  const openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await openDropdown.locator('.ant-select-item-option').filter({ hasText: label }).first().click();
}

test('combine Team, Sport and Level filters', async ({ page }) => {
  await gotoEvents(page);

  const teamName = await selectTeam(page); // combobox 0
  await selectAntOption(page, 1, 'Baseball'); // Sport
  await selectAntOption(page, 2, '7A'); // Level

  // All three selections are active simultaneously.
  await expect(page.locator(`.ant-select-selection-item[title="${teamName}"]`)).toBeVisible();
  await expect(page.locator('.ant-select-selection-item[title="Baseball"]')).toBeVisible();
  await expect(page.locator('.ant-select-selection-item[title="7A"]')).toBeVisible();
});

test('a tab and a dropdown filter combine', async ({ page }) => {
  await gotoEvents(page);

  const gamesTab = page.locator('li.tab_item').filter({ hasText: 'Games' });
  await gamesTab.click();
  await expect(gamesTab).toHaveClass(/is-active/);
  await page.waitForTimeout(1500); // let the tab filter settle

  // Pick whichever Sport is available under this tab (don't assume a value).
  await page.getByRole('combobox').nth(1).click();
  const openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  const firstSport = openDropdown.locator('.ant-select-item-option').first();
  await expect(firstSport).toBeVisible({ timeout: 10000 });
  const sportName = (await firstSport.innerText()).trim();
  await firstSport.click();

  // The tab stays active and the dropdown selection is applied together.
  await expect(gamesTab).toHaveClass(/is-active/);
  await expect(page.locator(`.ant-select-selection-item[title="${sportName}"]`)).toBeVisible();
});

test('combine Sport and Level filters', async ({ page }) => {
  await gotoEvents(page);

  // Select a Sport (combobox 1) and a Level (combobox 2) together.
  await page.getByRole('combobox').nth(1).click();
  let openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await openDropdown.locator('.ant-select-item-option').filter({ hasText: 'Baseball' }).first().click();

  await page.getByRole('combobox').nth(2).click();
  openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await openDropdown.locator('.ant-select-item-option').filter({ hasText: '7A' }).first().click();

  // Both selections are active at the same time.
  await expect(page.locator('.ant-select-selection-item[title="Baseball"]')).toBeVisible();
  await expect(page.locator('.ant-select-selection-item[title="7A"]')).toBeVisible();
});

test('Clear all resets the filters', async ({ page }) => {
  await gotoEvents(page);

  // Apply a search term and a Sport filter.
  await page.getByRole('textbox', { name: 'Search' }).fill('Tomball');
  await page.getByRole('combobox').nth(1).click();
  const openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await openDropdown.locator('.ant-select-item-option').filter({ hasText: 'Baseball' }).first().click();
  await expect(page.locator('.ant-select-selection-item[title="Baseball"]')).toBeVisible();

  // Clear all wipes both the search box and the dropdown selection.
  // (There's a hidden mobile duplicate, so target the visible one.)
  await page.getByText('Clear all').filter({ visible: true }).click();
  await expect(page.locator('.ant-select-selection-item[title="Baseball"]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Search' })).toHaveValue('');
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
