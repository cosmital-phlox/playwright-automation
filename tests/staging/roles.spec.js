const { test, expect } = require('@playwright/test');

// Admin Roles / RBAC module — STAGING (phlox-admin.netlify.app). A role is built
// in a permission builder (/roles/add-role): each resource gets an access tier
// (None / View / Manage) plus optional add-ons revealed by expanding the row.
// The `staging` project supplies the logged-in Super Admin session (roles.setup.js).
//
// Scope: the Roles list + permission-builder CRUD, add-on behavior, validation
// and persistence — everything drivable as Super Admin. The server-side
// enforcement matrix (per-role nav/button/API gating, 403, union of roles) and
// the Photographer-can't-see-Roles gating need non-Super-Admin logins and are
// covered by the app repo's test:rbac suite.

const BASE = 'https://phlox-admin.netlify.app';
const ROLES_URL = `${BASE}/roles`;
const ADD_ROLE_URL = `${BASE}/roles/add-role`;

async function gotoRolesList(page) {
  await page.goto(ROLES_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('columnheader', { name: 'Role Title' })).toBeVisible({ timeout: 25000 });
}

async function gotoAddRole(page) {
  await page.goto(ADD_ROLE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#form_item_name')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

// The resource name/chevron button (e.g. "Events"). Tier buttons follow it.
const resourceBtn = (page, r) => page.getByRole('button', { name: r, exact: false }).first();
// The tier button (None/View/Manage) for `resource` — the first such button
// following the resource's name button in document order.
const tierBtn = (page, r, t) =>
  resourceBtn(page, r).locator(`xpath=following::button[normalize-space()="${t}"][1]`);
const isTierActive = async (loc) =>
  ((await loc.getAttribute('class').catch(() => '')) || '').includes('bg-[#692d5d]');

// Find a role row by exact title. The Roles list has NO search box and defaults
// to oldest-first, so a just-created role is on a later page. We sort by ID so
// the newest role surfaces on page 1, then find it there (no slow page walk).
// Adaptive: click the ID sorter until the target appears on page 1 (handles the
// ascending→descending toggle regardless of the initial sort state).
async function findRoleRow(page, name) {
  await gotoRolesList(page);
  const idHeader = page.locator('th.ant-table-column-has-sorters').filter({ hasText: 'ID' }).first();
  const row = page.locator('tr.ant-table-row', { hasText: name }).first();
  for (let i = 0; i < 3; i++) {
    if (await row.count()) break;
    await idHeader.click();
    await page.waitForTimeout(1500);
  }
  await expect(row).toBeVisible({ timeout: 10000 });
  return row;
}

// Create a role with a unique name and the given tiers (default Events=Manage).
// Waits for the create call (POST /api/v2/roles). Returns the name.
async function createRole(page, tiers = [['Events', 'Manage']]) {
  await gotoAddRole(page);
  const name = 'QA Role ' + Date.now();
  await page.locator('#form_item_name').fill(name);
  for (const [res, tier] of tiers) await tierBtn(page, res, tier).click();
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/v2/roles') && r.request().method() === 'POST',
      { timeout: 45000 }
    ),
    page.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  await expect(page).toHaveURL(/\/roles$/, { timeout: 25000 });
  // The create response returns the new role: { id, name, ... } — capturing the
  // id lets edit tests navigate straight to /roles/edit-role/:id (no list find).
  let id = null;
  try {
    id = (await resp.json()).id;
  } catch {
    /* leave id null; callers fall back to finding by name */
  }
  return { name, id };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

test('Roles list loads with its core UI', async ({ page }) => {
  await gotoRolesList(page);
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  for (const col of ['ID', 'Role Title', 'Users', 'Created Date', 'Modified Date', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
  }
  await expect(page.locator('tr.ant-table-row', { hasText: 'Admin' }).first()).toBeVisible();
  await expect(page.locator('tr.ant-table-row', { hasText: 'Photographer' }).first()).toBeVisible();
});

test('Roles list is paginated', async ({ page }) => {
  await gotoRolesList(page);
  await expect(page.locator('.ant-pagination')).toBeVisible({ timeout: 15000 });
  // At least a first page of rows renders.
  expect(await page.locator('tr.ant-table-row').count()).toBeGreaterThan(0);
});

test('Role Title column is sortable', async ({ page }) => {
  await gotoRolesList(page);
  const header = page.getByRole('columnheader', { name: 'Role Title' });
  await header.click();
  await page.waitForTimeout(1500);
  // Sorting keeps the table populated (no crash / empty).
  expect(await page.locator('tr.ant-table-row').count()).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Builder UI
// ---------------------------------------------------------------------------

test('Add Role opens the permission builder', async ({ page }) => {
  await gotoAddRole(page);
  await expect(page.getByPlaceholder('e.g. Regional Manager')).toBeVisible();
  await expect(page.getByText('Permissions')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save$/ })).toBeVisible();
  for (const domain of ['Sales & Operations', 'Catalog', 'Organizations & Districts', 'Finance', 'Administration']) {
    await expect(page.getByText(domain, { exact: false }).first()).toBeVisible();
  }
});

test('Resource tier options match the spec', async ({ page }) => {
  await gotoAddRole(page);
  // 18 resources all offer None; all but Billing offer View (17); all but
  // Payouts/Reports/Platform offer Manage (15).
  await expect(page.getByRole('button', { name: 'None', exact: true })).toHaveCount(18);
  await expect(page.getByRole('button', { name: 'View', exact: true })).toHaveCount(17);
  await expect(page.getByRole('button', { name: 'Manage', exact: true })).toHaveCount(15);
});

// Data-driven regression: each resource must expose exactly the tiers and
// add-ons from the RBAC spec. Guards against a future change dropping an add-on
// (e.g. Media Days → SoW) or loosening a tier (e.g. adding View to Billing).
test('Every resource exposes the spec tiers and add-ons', async ({ page }) => {
  test.slow(); // 17 resources, each expanded and read
  const SPEC = [
    ['Events', ['None', 'View', 'Manage'], ['Staff', 'Galleries', 'Offline sales']],
    ['Media Days', ['None', 'View', 'Manage'], ['SoW', 'Staff', 'Offline sales']],
    ['Bundles', ['None', 'View', 'Manage'], ['Linked events']],
    ['Orders', ['None', 'View', 'Manage'], ['Galleries', 'Upload status', 'Archive orders', 'Order status']],
    ['Browse & Buy', ['None', 'View', 'Manage'], ['Import']],
    ['Products', ['None', 'View', 'Manage'], []],
    ['Sport Categories', ['None', 'View', 'Manage'], []],
    ['Levels', ['None', 'View', 'Manage'], []],
    ['Coupons', ['None', 'View', 'Manage'], []],
    ['Giftcards', ['None', 'View', 'Manage'], []],
    ['Organizations', ['None', 'View', 'Manage'], []],
    ['School Districts', ['None', 'View', 'Manage'], []],
    ['Billing', ['None', 'Manage'], []], // no View by design
    ['Payouts', ['None', 'View'], ['Settle payout']], // no Manage
    ['Reports', ['None', 'View'], ['Download']], // no Manage
    ['Users', ['None', 'View', 'Manage'], ['Assign roles', 'Archive user']],
    ['Platform', ['None', 'View'], ['Reports', 'Communications']], // no Manage
  ];
  const NAMES = SPEC.map((s) => s[0]).concat('Roles');

  await gotoAddRole(page);
  for (const [res, tiers, addons] of SPEC) {
    const btn = page.getByRole('button', { name: res, exact: false }).first();

    // Tier buttons that follow this resource's name, up to the next resource.
    const gotTiers = await btn.evaluate((el, names) => {
      const all = [...document.querySelectorAll('button')];
      const out = [];
      for (let i = all.indexOf(el) + 1; i < all.length; i++) {
        const t = all[i].textContent.trim();
        if (['None', 'View', 'Manage'].includes(t)) out.push(t);
        else if (names.some((r) => t.replace(/\s+/g, ' ').includes(r))) break;
      }
      return out;
    }, NAMES);
    expect(gotTiers, `${res} tiers`).toEqual(tiers);

    // Expand and read the add-on titles, then collapse. Wait for the first
    // expected add-on to render before reading (the panel populates async, so
    // reading too early under-counts).
    await btn.click();
    if (addons.length) {
      await page.getByText(addons[0], { exact: true }).first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
    }
    await page.waitForTimeout(500);
    const gotAddons = await page.evaluate(() =>
      [...document.querySelectorAll('span')]
        .filter((s) => /font-semibold/.test(s.className) && /text-\[12px\]/.test(s.className))
        .map((s) => s.textContent.trim())
        .filter(Boolean)
    );
    expect([...gotAddons].sort(), `${res} add-ons`).toEqual([...addons].sort());
    await btn.click();
    await page.waitForTimeout(250);
  }
});

test('Selecting a tier highlights it', async ({ page }) => {
  await gotoAddRole(page);
  const manage = tierBtn(page, 'Events', 'Manage');
  await manage.click();
  await expect(manage).toHaveClass(/bg-\[#692d5d\]/, { timeout: 5000 });
});

test('Chevron expands and collapses a resource add-on panel', async ({ page }) => {
  await gotoAddRole(page);
  const staff = page.getByText('Staff', { exact: true }).first();
  await expect(staff).toBeHidden(); // collapsed initially
  await resourceBtn(page, 'Events').click();
  await expect(staff).toBeVisible({ timeout: 5000 }); // expanded
  await resourceBtn(page, 'Events').click();
  await expect(staff).toBeHidden({ timeout: 5000 }); // collapsed again
});

test('Expanding a resource reveals its add-ons', async ({ page }) => {
  await gotoAddRole(page);
  await resourceBtn(page, 'Events').click();
  await page.waitForTimeout(800);
  for (const addon of ['Staff', 'Galleries', 'Offline sales']) {
    await expect(page.getByText(addon, { exact: false }).first()).toBeVisible();
  }
});

test('Add-ons are gated: locked at None, toggleable at Manage', async ({ page }) => {
  await gotoAddRole(page);
  await resourceBtn(page, 'Events').click();
  await page.waitForTimeout(800);
  const counter = page.getByText(/Add-ons: 3 · \d+ on/).first();

  // At None (default): clicking an add-on does nothing (stays "0 on").
  await page.getByText('Staff', { exact: true }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  await expect(counter).toContainText('0 on');

  // At Manage: the add-on toggles on ("1 on").
  await tierBtn(page, 'Events', 'Manage').click();
  await page.waitForTimeout(500);
  await page.getByText('Staff', { exact: true }).first().click({ force: true });
  await expect(counter).toContainText('1 on', { timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

test('Create a role (Manage) and it appears in the list', async ({ page }) => {
  const { name } = await createRole(page, [['Events', 'Manage']]);
  await findRoleRow(page, name);
});

test('Create a View-only role', async ({ page }) => {
  const { name } = await createRole(page, [['Events', 'View']]);
  await findRoleRow(page, name);
});

test('Create a role spanning multiple modules', async ({ page }) => {
  const { name } = await createRole(page, [
    ['Events', 'Manage'],
    ['Orders', 'View'],
    ['Products', 'Manage'],
  ]);
  await findRoleRow(page, name);
});

test('Create a role with an add-on enabled', async ({ page }) => {
  await gotoAddRole(page);
  const name = 'QA Role Addon ' + Date.now();
  await page.locator('#form_item_name').fill(name);
  await tierBtn(page, 'Events', 'Manage').click();
  await resourceBtn(page, 'Events').click(); // expand
  await page.waitForTimeout(600);
  await page.getByText('Staff', { exact: true }).first().click({ force: true }); // enable add-on
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/v2/roles') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  await expect(page).toHaveURL(/\/roles$/, { timeout: 25000 });
  await findRoleRow(page, name);
});

// ---------------------------------------------------------------------------
// Validation / negative
// ---------------------------------------------------------------------------

test('Saving a role with no name is blocked', async ({ page }) => {
  await gotoAddRole(page);
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/\/roles\/add-role/); // nothing created
});

// FIXED: a role with no permission (all resources = None) can no longer be
// saved. An inline message appears and the save is blocked (client + server).
test('Saving a role with no permission is blocked with a message', async ({ page }) => {
  await gotoAddRole(page);
  await page.locator('#form_item_name').fill('QA NoPerm ' + Date.now());
  await page.getByRole('button', { name: /^Save$/ }).click();

  await expect(page.getByText(/Select at least one View or Manage permission/i)).toBeVisible({ timeout: 8000 });
  await expect(page).toHaveURL(/\/roles\/add-role/); // not created
});

// BUG: a duplicate role name is rejected by the API (HTTP 400) but the UI shows
// NO error/toast — the form just sits there with no feedback. This test locks in
// that no duplicate is created; the missing feedback is the defect.
test('BUG: duplicate role name is rejected without UI feedback', async ({ page }) => {
  await gotoAddRole(page);
  await page.locator('#form_item_name').fill('Admin'); // existing role
  await tierBtn(page, 'Events', 'View').click();

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/v2/roles') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  expect(resp.status()).toBe(400); // server rejects the duplicate
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/roles\/add-role/); // stayed on the form
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0); // ...but no visible error
});

// ---------------------------------------------------------------------------
// Edit / persistence
// ---------------------------------------------------------------------------

test('Edit opens a role in the builder with its name populated', async ({ page }) => {
  const { id, name } = await createRole(page);
  // Navigate straight to the edit form by id (the list has no search).
  await page.goto(`${BASE}/roles/edit-role/${id}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/roles\/edit-role\/\d+/, { timeout: 25000 });
  await expect(page.locator('#form_item_name')).toHaveValue(name, { timeout: 25000 });
});

test('Selected tiers persist after save and reopen', async ({ page }) => {
  const { id } = await createRole(page, [['Events', 'Manage'], ['Orders', 'View']]);
  await page.goto(`${BASE}/roles/edit-role/${id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#form_item_name')).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(2000);
  expect(await isTierActive(tierBtn(page, 'Events', 'Manage'))).toBeTruthy();
  expect(await isTierActive(tierBtn(page, 'Orders', 'View'))).toBeTruthy();
});

// BUG: editing a role's NAME does not persist. The edit form sends the correct
// payload (PUT /api/v2/roles/:id with {"name":"…Edited", permission_keys:[…]})
// and the API returns 200, but on reload the name reverts to the original — the
// backend accepts the update without saving the name change. This test locks in
// the (buggy) revert so a future fix flips it red.
test('BUG: editing a role name does not persist (PUT 200 but reverts)', async ({ page }) => {
  const { id, name } = await createRole(page);
  const editUrl = `${BASE}/roles/edit-role/${id}`;
  await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#form_item_name').first()).toHaveValue(name, { timeout: 25000 });

  const newName = name + ' Edited';
  await page.locator('#form_item_name:not([disabled])').first().fill(newName);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/api\/v2\/roles\/\d+/.test(r.url()) && r.request().method() === 'PUT', { timeout: 30000 }),
    page.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  expect(resp.ok()).toBeTruthy(); // API says 200 OK...

  // ...but reopening shows the ORIGINAL name — the change was not persisted.
  await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#form_item_name:not([disabled])').first()).toHaveValue(name, { timeout: 25000 });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

test('Delete removes a role (with confirmation)', async ({ page }) => {
  const { name } = await createRole(page);
  await (await findRoleRow(page, name)).locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content').first();
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(modal.getByText('Delete Role').first()).toBeVisible();
  await expect(modal.getByText(/Are you sure/i).first()).toBeVisible();

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => /\/api\/v2\/roles\/\d+/.test(r.url()) && r.request().method() === 'DELETE',
      { timeout: 25000 }
    ),
    modal.getByRole('button', { name: /^Delete$/ }).click(),
  ]);
  expect(resp.ok()).toBeTruthy();
  await expect(page.locator('tr.ant-table-row', { hasText: name })).toHaveCount(0, { timeout: 25000 });
});

test('Cancel on the delete dialog keeps the role', async ({ page }) => {
  const { name } = await createRole(page);
  await (await findRoleRow(page, name)).locator('td').last().locator('svg').nth(1).click();

  const modal = page.locator('.ant-modal-content').first();
  await expect(modal).toBeVisible({ timeout: 10000 });
  await modal.getByRole('button', { name: /^Cancel$/ }).click();

  await expect(modal).toBeHidden({ timeout: 5000 });
  await findRoleRow(page, name); // still there
});

test('System role (Super Admin) is not deletable', async ({ page }) => {
  await gotoRolesList(page);
  const superRow = page.locator('tr.ant-table-row', { hasText: 'Super Admin' }).first();
  // Its action icons are disabled — clicking Delete does not open a modal.
  await superRow.locator('td').last().locator('svg').nth(1).click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.locator('.ant-modal-content')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Role assignment (Add User)
// ---------------------------------------------------------------------------

// FIXED: the Add User "Role" field is now a searchable multi-select dropdown
// (ant-select-multiple) listing ALL roles including custom ones — not the old
// checkbox row / uncreatable combobox.
test('Add User Role field is a dropdown listing all roles (incl. custom)', async ({ page }) => {
  await page.goto(BASE + '/users/add-user', { waitUntil: 'domcontentloaded' });
  const roleItem = page.locator('.ant-form-item', { hasText: 'Role' }).first();
  await expect(roleItem.locator('.ant-select-multiple')).toBeVisible({ timeout: 20000 });

  await roleItem.locator('.ant-select').first().click();
  const opts = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ visible: true });
  await expect(opts.filter({ hasText: 'Admin' }).first()).toBeVisible({ timeout: 10000 });
  await expect(opts.filter({ hasText: 'QA Role' }).first()).toBeVisible(); // a custom role appears
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
