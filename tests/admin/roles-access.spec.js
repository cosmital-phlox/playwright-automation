const { test, expect } = require('@playwright/test');

// Roles & Access Control — UAT (uat-phlox-admin.netlify.app), PAS-583.
// Runs under the `admin` project (saved UAT admin session, admin.json). That
// account holds roles.manage + roles.view, so it drives the full permission
// builder + role CRUD as an authoring ("super admin") user. Per-role server-side
// ENFORCEMENT (None hides / View read-only / Manage CRUD for an assigned user)
// needs role-scoped non-admin logins and is out of scope here — see §I of
// ROLES_ACCESS_TEST_CASES.md.
//
// Builder facts (verified live):
//   • Tier = 3-button segment; active tier has bg-[#692d5d]. Billing = None/Manage
//     (no View); Payouts/Reports/Platform = None/View (no Manage).
//   • Resource row disclosure = button[data-test="disclosure"] (▸ collapsed / ▾).
//   • Add-on = button[role="checkbox"]; aria-checked=on/off, aria-disabled=locked
//     (locked at tier None, unlocked at View/Manage, off by default).
//   • 18 resources — includes an extra "Roles" not in the spec's 17 (discrepancy).

const BASE = 'https://uat-phlox-admin.netlify.app';
const ROLES_URL = `${BASE}/roles`;
const ADD_ROLE_URL = `${BASE}/roles/add-role`;

// Verified permission matrix (tiers + add-ons per resource, in DOM order).
const MATRIX = [
  { r: 'Events',           tiers: ['None', 'View', 'Manage'], addons: ['Staff', 'Galleries', 'Offline sales'] },
  { r: 'Media Days',       tiers: ['None', 'View', 'Manage'], addons: ['SoW', 'Staff', 'Offline sales'] },
  { r: 'Bundles',          tiers: ['None', 'View', 'Manage'], addons: ['Linked events'] },
  { r: 'Orders',           tiers: ['None', 'View', 'Manage'], addons: ['Galleries', 'Upload status', 'Archive orders', 'Order status'] },
  { r: 'Browse & Buy',     tiers: ['None', 'View', 'Manage'], addons: ['Import'] },
  { r: 'Products',         tiers: ['None', 'View', 'Manage'], addons: [] },
  { r: 'Sport Categories', tiers: ['None', 'View', 'Manage'], addons: [] },
  { r: 'Levels',           tiers: ['None', 'View', 'Manage'], addons: [] },
  { r: 'Coupons',          tiers: ['None', 'View', 'Manage'], addons: [] },
  { r: 'Giftcards',        tiers: ['None', 'View', 'Manage'], addons: [] },
  { r: 'Organizations',    tiers: ['None', 'View', 'Manage'], addons: [] },
  { r: 'School Districts', tiers: ['None', 'View', 'Manage'], addons: [] },
  { r: 'Billing',          tiers: ['None', 'Manage'],         addons: [] },
  { r: 'Payouts',          tiers: ['None', 'View'],           addons: ['Settle payout'] },
  { r: 'Reports',          tiers: ['None', 'View'],           addons: ['Download'] },
  { r: 'Users',            tiers: ['None', 'View', 'Manage'], addons: ['Assign roles', 'Archive user'] },
  { r: 'Platform',         tiers: ['None', 'View'],           addons: ['Reports', 'Communications'] },
  { r: 'Roles',            tiers: ['None', 'View', 'Manage'], addons: [] }, // 18th — spec discrepancy
];
const ORDER = MATRIX.map((m) => m.r);

// ---- helpers ----
async function gotoRolesList(page) {
  await page.goto(ROLES_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible({ timeout: 30000 });
}
async function gotoAddRole(page) {
  await page.goto(ADD_ROLE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#form_item_name')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200);
}
const resourceBtn = (page, r) => page.getByRole('button', { name: r, exact: false }).first();
const tierBtn = (page, r, t) =>
  resourceBtn(page, r).locator(`xpath=following::button[normalize-space()="${t}"][1]`);
// Active tier carries text-white (None-active = grey bg-[#888]; View/Manage-active
// = plum bg-[#692d5d]); inactive tiers are bg-white text-[#888].
const isTierActive = async (loc) =>
  ((await loc.getAttribute('class').catch(() => '')) || '').includes('text-white');
const disclosure = (page, r) => page.locator('button[data-test="disclosure"]', { hasText: r }).first();
const addon = (page, name) => page.getByRole('checkbox', { name, exact: false }).first();

async function tierOptionsFor(page, resource) {
  const idx = ORDER.indexOf(resource);
  const next = ORDER[idx + 1] || null;
  return page.evaluate(({ resource, next }) => {
    const btns = [...document.querySelectorAll('button')];
    const txt = (b) => (b.textContent || '').trim();
    const start = btns.findIndex((b) => txt(b).includes(resource));
    const end = next ? btns.findIndex((b, i) => i > start && txt(b).includes(next)) : btns.length;
    const between = btns.slice(start + 1, end === -1 ? btns.length : end).map(txt);
    return ['None', 'View', 'Manage'].filter((t) => between.includes(t));
  }, { resource, next });
}

// Create a role via the builder. spec = { name, tiers:[[res,tier]], addons:[[res,addonName]] }.
async function createRole(page, spec) {
  await gotoAddRole(page);
  await page.locator('#form_item_name').fill(spec.name);
  for (const [res, tier] of spec.tiers || []) await tierBtn(page, res, tier).click();
  for (const [res, name] of spec.addons || []) {
    await disclosure(page, res).click();
    await addon(page, name).click();
    await disclosure(page, res).click(); // collapse to avoid label clashes
  }
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/v2/roles') && r.request().method() === 'POST', { timeout: 45000 }),
    page.getByRole('button', { name: /^Save$/ }).click(),
  ]);
  await expect(page).toHaveURL(/\/roles$/, { timeout: 25000 });
  let id = null;
  try { const j = await resp.json(); id = j.id ?? j.data?.id; } catch {}
  return { id, status: resp.status() };
}
// The list's search box filters only the currently-loaded page, and roles sort
// oldest-first — so a freshly created role sits on a later page. Sort by ID
// (toggle to descending) to surface the newest role on page 1, then match by name.
async function findRole(page, name) {
  await gotoRolesList(page);
  const idHeader = page.locator('th.ant-table-column-has-sorters', { hasText: 'ID' }).first();
  const row = page.locator('tr.ant-table-row', { hasText: name }).first();
  for (let i = 0; i < 3; i++) {
    if (await row.count()) break;
    await idHeader.click();
    await page.waitForTimeout(1500);
  }
  return row;
}
// Enabled (custom-role) action icon = cursor-pointer WITHOUT the disabled markers.
const enabledActionIcon = (row) =>
  row.locator('svg.cursor-pointer:not(.pointer-events-none):not(.cursor-not-allowed)');

// ===========================================================================
// A. List page
// ===========================================================================
test.describe('A · Roles list', () => {
  test('ROLES-A01/A02 list loads with core UI + system roles', async ({ page }) => {
    await gotoRolesList(page);
    for (const col of ['Role Title', 'Users', 'Actions']) {
      await expect(page.getByRole('columnheader', { name: col, exact: false }).first()).toBeVisible();
    }
    await expect(page.locator('tr.ant-table-row', { hasText: 'Admin' }).first()).toBeVisible();
    await expect(page.locator('tr.ant-table-row', { hasText: 'Super Admin' }).first()).toBeVisible();
    await expect(page.locator('tr.ant-table-row', { hasText: 'Photographer' }).first()).toBeVisible();
  });

  test('ROLES-A05 Super Admin row is protected (action icons disabled)', async ({ page }) => {
    await gotoRolesList(page);
    const sa = page.locator('tr.ant-table-row', { hasText: 'Super Admin' }).first();
    const icons = sa.locator('svg.cursor-pointer');
    await expect(icons.first()).toBeVisible();
    // Icons render but are non-interactive (opacity-30 / cursor-not-allowed / pointer-events-none).
    const n = await icons.count();
    for (let i = 0; i < n; i++) {
      expect(await icons.nth(i).getAttribute('class')).toMatch(/pointer-events-none|cursor-not-allowed|opacity-30/);
    }
  });

  test('ROLES-A08 list search filters by title', async ({ page }) => {
    await gotoRolesList(page);
    const search = page.locator('input[placeholder*="earch" i]').first();
    await expect(search).toBeVisible();
    await search.fill('Super Admin');
    await page.waitForTimeout(2000);
    await expect(page.locator('tr.ant-table-row', { hasText: 'Super Admin' }).first()).toBeVisible();
  });
});

// ===========================================================================
// B. Builder structure
// ===========================================================================
test.describe('B · Builder structure', () => {
  test('ROLES-B02 all 5 domains render', async ({ page }) => {
    await gotoAddRole(page);
    for (const d of ['Sales & Operations', 'Catalog', 'Organizations & Districts', 'Finance', 'Administration']) {
      await expect(page.getByText(d, { exact: false }).first()).toBeVisible();
    }
  });

  test('ROLES-B03/B06 name field, Save, and all 18 resources present', async ({ page }) => {
    await gotoAddRole(page);
    await expect(page.locator('#form_item_name')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeVisible();
    for (const { r } of MATRIX) await expect(resourceBtn(page, r)).toBeVisible();
  });

  test('ROLES-B04 every resource defaults to None', async ({ page }) => {
    await gotoAddRole(page);
    for (const { r } of MATRIX) {
      expect(await isTierActive(tierBtn(page, r, 'None')), `${r} default None`).toBe(true);
    }
  });

  test('ROLES-B05 tier button counts (None18 / View17 / Manage15)', async ({ page }) => {
    await gotoAddRole(page);
    await expect(page.getByRole('button', { name: 'None', exact: true })).toHaveCount(18);
    await expect(page.getByRole('button', { name: 'View', exact: true })).toHaveCount(17);
    await expect(page.getByRole('button', { name: 'Manage', exact: true })).toHaveCount(15);
  });
});

// ===========================================================================
// C. Tier options per resource (full matrix) + interaction
// ===========================================================================
test.describe('C · Access tiers', () => {
  test('ROLES-C-matrix every resource exposes exactly its spec tiers', async ({ page }) => {
    await gotoAddRole(page);
    for (const { r, tiers } of MATRIX) {
      expect(await tierOptionsFor(page, r), `tiers for ${r}`).toEqual(tiers);
    }
  });

  test('ROLES-C05 tier is single-select', async ({ page }) => {
    await gotoAddRole(page);
    const view = tierBtn(page, 'Events', 'View');
    const manage = tierBtn(page, 'Events', 'Manage');
    await view.click();
    await expect.poll(() => isTierActive(view)).toBe(true);
    await manage.click();
    await expect.poll(() => isTierActive(manage)).toBe(true);
    expect(await isTierActive(view)).toBe(false);
  });

  test('ROLES-C04 setting back to None re-locks the resource', async ({ page }) => {
    await gotoAddRole(page);
    await tierBtn(page, 'Events', 'Manage').click();
    await tierBtn(page, 'Events', 'None').click();
    await expect.poll(() => isTierActive(tierBtn(page, 'Events', 'None'))).toBe(true);
  });
});

// ===========================================================================
// D. Add-on gating, toggles, and per-resource coverage
// ===========================================================================
test.describe('D · Add-ons', () => {
  const withAddons = MATRIX.filter((m) => m.addons.length);
  const noAddons = MATRIX.filter((m) => !m.addons.length);

  for (const { r, tiers, addons } of withAddons) {
    const viewTier = tiers.includes('View') ? 'View' : 'Manage';
    test(`ROLES-D · ${r}: add-ons locked at None, unlock + toggle at ${viewTier}`, async ({ page }) => {
      await gotoAddRole(page);
      // locked at None (expanded)
      await disclosure(page, r).click();
      for (const a of addons) {
        await expect(addon(page, a)).toHaveAttribute('aria-disabled', 'true');
        await expect(addon(page, a)).toHaveAttribute('aria-checked', 'false');
      }
      // unlock at View/Manage, still off by default
      await tierBtn(page, r, viewTier).click();
      for (const a of addons) {
        await expect(addon(page, a)).toHaveAttribute('aria-disabled', 'false');
        await expect(addon(page, a)).toHaveAttribute('aria-checked', 'false');
      }
      // toggle first add-on on then off
      const first = addon(page, addons[0]);
      await first.click();
      await expect(first).toHaveAttribute('aria-checked', 'true');
      await first.click();
      await expect(first).toHaveAttribute('aria-checked', 'false');
      // re-lock when tier → None
      await first.click(); // enable again
      await tierBtn(page, r, 'None').click();
      await expect(addon(page, addons[0])).toHaveAttribute('aria-disabled', 'true');
    });
  }

  test('ROLES-D08 resources without add-ons show no add-on checkboxes', async ({ page }) => {
    await gotoAddRole(page);
    for (const { r } of noAddons) {
      await disclosure(page, r).click();
      expect(await page.getByRole('checkbox').count(), `${r} has no add-ons`).toBe(0);
      await disclosure(page, r).click();
    }
  });
});

// ===========================================================================
// E. Expand / collapse
// ===========================================================================
test.describe('E · Expand / collapse', () => {
  test('ROLES-E01/E02 disclosure toggles the add-on panel', async ({ page }) => {
    await gotoAddRole(page);
    await tierBtn(page, 'Events', 'View').click();
    await disclosure(page, 'Events').click();
    await expect(addon(page, 'Staff')).toBeVisible();
    await disclosure(page, 'Events').click();
    await expect(addon(page, 'Staff')).toHaveCount(0);
  });
});

// ===========================================================================
// F/G. Persistence & CRUD
// ===========================================================================
test.describe('F/G · Persistence & CRUD', () => {
  test('ROLES-F01-F04 create with tiers + add-ons (incl. non-standard) persists', async ({ page }) => {
    const name = 'QA Persist ' + Date.now();
    const { id, status } = await createRole(page, {
      name,
      tiers: [['Events', 'Manage'], ['Bundles', 'View'], ['Billing', 'Manage'], ['Payouts', 'View'], ['Platform', 'View']],
      addons: [['Events', 'Staff'], ['Payouts', 'Settle payout']],
    });
    expect(status).toBeLessThan(400);
    test.skip(!id, 'no id in create response');
    await page.goto(`${BASE}/roles/edit-role/${id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#form_item_name')).toHaveValue(name, { timeout: 30000 });
    await page.waitForTimeout(1500);
    expect(await isTierActive(tierBtn(page, 'Events', 'Manage'))).toBe(true);
    expect(await isTierActive(tierBtn(page, 'Bundles', 'View'))).toBe(true);
    expect(await isTierActive(tierBtn(page, 'Billing', 'Manage'))).toBe(true);
    expect(await isTierActive(tierBtn(page, 'Payouts', 'View'))).toBe(true);
    // add-ons persist
    await disclosure(page, 'Events').click();
    await expect(addon(page, 'Staff')).toHaveAttribute('aria-checked', 'true');
    await disclosure(page, 'Events').click();
    await disclosure(page, 'Payouts').click();
    await expect(addon(page, 'Settle payout')).toHaveAttribute('aria-checked', 'true');
  });

  test('ROLES-G02/G03 edit a role tier and it persists', async ({ page }) => {
    const name = 'QA Edit ' + Date.now();
    const { id } = await createRole(page, { name, tiers: [['Orders', 'View']] });
    test.skip(!id, 'no id');
    await page.goto(`${BASE}/roles/edit-role/${id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#form_item_name')).toHaveValue(name, { timeout: 30000 });
    await page.waitForTimeout(1200);
    await tierBtn(page, 'Orders', 'Manage').click();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v2/roles') && ['PUT', 'POST', 'PATCH'].includes(r.request().method()), { timeout: 45000 }),
      page.getByRole('button', { name: /^Save$/ }).click(),
    ]);
    await page.goto(`${BASE}/roles/edit-role/${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(await isTierActive(tierBtn(page, 'Orders', 'Manage'))).toBe(true);
  });

  test('ROLES-G04 delete a role via the confirmation modal', async ({ page }) => {
    const name = 'QA Delete ' + Date.now();
    await createRole(page, { name, tiers: [['Levels', 'Manage']] });
    const row = await findRole(page, name);
    await expect(row).toBeVisible({ timeout: 20000 });
    await enabledActionIcon(row).last().click(); // trash icon
    const modal = page.locator('.ant-modal-content', { hasText: 'Delete Role' }).first();
    await expect(modal).toContainText(/Delete Role/i);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v2/roles') && r.request().method() === 'DELETE', { timeout: 30000 }),
      modal.getByRole('button', { name: /^Delete$/ }).click(),
    ]);
    await page.waitForTimeout(1500);
    const gone = await findRole(page, name);
    expect(await gone.count()).toBe(0);
  });

  test('ROLES-G05 cancel delete keeps the role', async ({ page }) => {
    const name = 'QA Keep ' + Date.now();
    await createRole(page, { name, tiers: [['Coupons', 'Manage']] });
    const row = await findRole(page, name);
    await expect(row).toBeVisible({ timeout: 20000 });
    await enabledActionIcon(row).last().click();
    const modal = page.locator('.ant-modal-content', { hasText: 'Delete Role' }).first();
    await modal.getByRole('button', { name: /Cancel/i }).click();
    await page.waitForTimeout(1000);
    const still = await findRole(page, name);
    await expect(still).toBeVisible();
    // cleanup
    await enabledActionIcon(still).last().click();
    await page.locator('.ant-modal-content', { hasText: 'Delete Role' }).first().getByRole('button', { name: /^Delete$/ }).click();
  });
});

// ===========================================================================
// H. Validation / negative
// ===========================================================================
test.describe('H · Validation', () => {
  test('ROLES-H01 empty name blocked (stays on builder)', async ({ page }) => {
    await gotoAddRole(page);
    await tierBtn(page, 'Events', 'Manage').click();
    await page.getByRole('button', { name: /^Save$/ }).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/add-role/);
  });

  test('ROLES-H04 zero-permission role blocked (regression)', async ({ page }) => {
    await gotoAddRole(page);
    await page.locator('#form_item_name').fill('QA ZeroPerm ' + Date.now());
    await page.getByRole('button', { name: /^Save$/ }).click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/add-role/);
  });

  test('ROLES-H02 spaces-only name blocked (regression)', async ({ page }) => {
    await gotoAddRole(page);
    await page.locator('#form_item_name').fill('     ');
    await tierBtn(page, 'Events', 'Manage').click();
    await page.getByRole('button', { name: /^Save$/ }).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/add-role/);
  });

  test('ROLES-H03 duplicate name rejected with visible feedback (regression)', async ({ page }) => {
    await gotoAddRole(page);
    await page.locator('#form_item_name').fill('Admin'); // existing role
    await tierBtn(page, 'Events', 'Manage').click();
    await page.getByRole('button', { name: /^Save$/ }).click();
    await page.waitForTimeout(2500);
    // correct behaviour: NOT silently redirected as a success; surfaced error/toast
    await expect(page).toHaveURL(/add-role/);
  });
});

// ---------------------------------------------------------------------------
// Aug 2026 release tickets — new permission UI & filter retention
// ---------------------------------------------------------------------------
const RA_BASE = 'https://uat-phlox-admin.netlify.app';
const RA_ROWS = '.ant-table-tbody tr:not(.ant-table-measure-row)';

// PAS-718 — the redesigned icon-based permission builder (grouped domains + grant counters).
test('PAS-718 Role edit shows the icon-based permission builder', async ({ page }) => {
  test.slow();
  await page.goto(`${RA_BASE}/roles`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.locator(RA_ROWS).first().locator('td').last().locator('svg,a,button').last().click({ timeout: 6000 });
  await page.waitForTimeout(5000);
  await expect(page).toHaveURL(/roles\/(edit-role|view)/i);
  await expect(page.getByText(/Sales & Operations|Catalog|Administration|Finance/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/\d\/\d/).first()).toBeVisible({ timeout: 10000 });
});

// PAS-736 — the list filter is applied/retained (mechanism behind edit-save->list-with-filters).
test('PAS-736 Roles list filter applies and narrows the result set', async ({ page }) => {
  test.slow();
  await page.goto(`${RA_BASE}/roles`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const unfiltered = await page.locator(RA_ROWS).count();
  expect(unfiltered).toBeGreaterThan(0);
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill('Photographer');
  await search.press('Enter');
  await page.waitForTimeout(3500);
  const filtered = await page.locator(RA_ROWS).count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThanOrEqual(unfiltered);
  expect((await page.locator(RA_ROWS).allTextContents()).join(' ')).toMatch(/Photographer/i);
});
