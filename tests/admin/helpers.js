const { expect } = require('@playwright/test');

const ADMIN_BASE = 'https://uat-phlox-admin.netlify.app';
const EVENTS_URL = `${ADMIN_BASE}/events`;
const ADD_EVENT_URL = `${ADMIN_BASE}/events/add-event`;
const BUNDLES_URL = `${ADMIN_BASE}/bundles`;
const ADD_BUNDLE_URL = `${ADMIN_BASE}/bundles/add-bundle`;
const ORDERS_URL = `${ADMIN_BASE}/orders`;
const USERS_URL = `${ADMIN_BASE}/users`;
const ADD_USER_URL = `${ADMIN_BASE}/users/add-user`;
const ORGANIZATIONS_URL = `${ADMIN_BASE}/organizations`;
const ADD_ORG_URL = `${ADMIN_BASE}/organizations/add-organization`;
const PRODUCTS_URL = `${ADMIN_BASE}/products`;
const ADD_PRODUCT_URL = `${ADMIN_BASE}/products/add-product`;
const COUPONS_URL = `${ADMIN_BASE}/coupons`;
const ADD_COUPON_URL = `${ADMIN_BASE}/coupons/add-coupon`;
const GIFTCARDS_URL = `${ADMIN_BASE}/giftcards`;
const ADD_GIFTCARD_URL = `${ADMIN_BASE}/giftcards/add-giftcard`;
const CATEGORIES_URL = `${ADMIN_BASE}/categories`;
const ADD_CATEGORY_URL = `${ADMIN_BASE}/categories/add-category/`;
const LEVELS_URL = `${ADMIN_BASE}/levels`;
const SCHOOL_DISTRICTS_URL = `${ADMIN_BASE}/school-districts`;
const ADD_SCHOOL_DISTRICT_URL = `${ADMIN_BASE}/school-districts/add`;
const ZENFOLIO_URL = `${ADMIN_BASE}/browse-and-buy`;
const PAYOUTS_URL = `${ADMIN_BASE}/payout`;
const REPORTS_URL = `${ADMIN_BASE}/reports`;

// Navigate to `url` and wait for `ready` (a locator), reloading on the flaky
// backend if the page comes up empty/slow. Throws after `attempts` reloads.
async function gotoWithRetry(page, url, ready, { attempts = 3, timeout = 20000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      // goto is inside the try so a slow-load timeout reloads instead of failing.
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await ready.waitFor({ state: 'visible', timeout });
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
  }
}

// Open the Events list and wait for the page chrome to be ready.
// (The "Events" page title isn't a real heading element, so we key off the
// Add button, which always renders.)
async function gotoEvents(page) {
  await gotoWithRetry(page, EVENTS_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByText(/Showing \d+ Events/)).toBeVisible({ timeout: 25000 });
}

// Open the Add Event form and wait for it to render.
async function gotoAddEvent(page) {
  await page.goto(ADD_EVENT_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Save and Publish' })).toBeVisible({
    timeout: 25000,
  });
  // The form's selects hydrate after the page chrome; give them a moment.
  await page.waitForTimeout(1500);
}

// Pick an option from the Ant Design <select> sitting in the form item whose
// label contains `label`. Picks the Nth *visible* option (default the first).
// The options load from the backend and the virtual list can render them hidden
// for a beat, so we filter to visible and wait.
async function pickAntOption(page, label, index = 0) {
  const item = page.locator('.ant-form-item', { hasText: label }).first();
  await item.locator('.ant-select').first().click();
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ visible: true })
    .nth(index);
  await option.waitFor({ state: 'visible', timeout: 15000 });
  const text = (await option.innerText()).trim();
  await option.click();
  await page.waitForTimeout(400);
  return text;
}

// Fill every field required to publish an event: Visiting/Home Team, Sports,
// Level, Date and a Time slot. (Title is read-only — it auto-builds from these.)
// Returns the auto-generated title so callers can assert on it.
async function fillRequiredEventFields(page) {
  await pickAntOption(page, 'Visiting Team', 0);
  await pickAntOption(page, 'Home Team', 1); // different from visiting
  await pickAntOption(page, 'Sports', 0);
  await pickAntOption(page, 'Level', 0);

  // Date: open the calendar and pick the last enabled day in view.
  await page.locator('#basic_date').click();
  await page.waitForTimeout(800);
  await page
    .locator('.ant-picker-cell:not(.ant-picker-cell-disabled) .ant-picker-cell-inner')
    .last()
    .click();
  await page.waitForTimeout(500);

  // Time: range picker — choose a start hour/minute; the end auto-fills.
  await page.locator('#basic_times').click();
  await page.waitForTimeout(700);
  const col = page.locator('.ant-picker-time-panel-column');
  await col.nth(0).locator('.ant-picker-time-panel-cell-inner').nth(9).click();
  await page.waitForTimeout(300);
  await col.nth(1).locator('.ant-picker-time-panel-cell-inner').nth(0).click();
  await page.waitForTimeout(300);
  const ok = page.locator('.ant-picker-ok button');
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.waitForTimeout(400);

  return (await page.locator('#eventTitle').inputValue()).trim();
}

// --- Orders (Prepaid Orders) ---

// Open the Orders list. It's keyed off the Export button, which always renders.
async function gotoOrders(page) {
  await gotoWithRetry(page, ORDERS_URL, page.getByRole('button', { name: 'Export' }));
  // Wait for the table chrome and let the filter controls wire up before use.
  await page
    .getByRole('columnheader', { name: 'Order Id', exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForTimeout(2500);
}

// Set the Orders "Order date" range to the widest span the picker offers (first
// visible day → last visible day). The Orders list stays empty until a date
// range is applied, so this surfaces the seeded orders.
async function applyOrderDateRange(page) {
  await page.getByPlaceholder('Order start date').click();
  await page.waitForTimeout(1000);
  const cells = page.locator(
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell:not(.ant-picker-cell-disabled) .ant-picker-cell-inner'
  );
  await cells.first().click();
  await page.waitForTimeout(400);
  await cells.last().click();
  await page.waitForTimeout(1500);
}

// Open an Ant Select filter by the placeholder/label it shows and return a
// locator for its (visible) options. Retries the open — the first click can
// misfire while the list is still settling on the flaky backend.
async function openSelectFilter(page, label) {
  const select = page.locator('.ant-select').filter({ hasText: label }).first();
  const options = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ visible: true });
  for (let i = 0; i < 4; i++) {
    await select.click();
    const opened = await options
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return options;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(800);
  }
  return options; // caller's assertion will surface a clear failure if still empty
}

// --- Users ---

// Open the Users list and wait for the count line.
async function gotoUsers(page) {
  await gotoWithRetry(page, USERS_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Users/ })).toBeVisible({
    timeout: 25000,
  });
}

// Open the Add User form.
async function gotoAddUser(page) {
  await gotoWithRetry(page, ADD_USER_URL, page.getByRole('button', { name: 'Save' }));
  await page.waitForTimeout(1500);
}

// A unique letters-only string (the Last Name field forbids spaces and numbers).
function uniqueAlpha(len = 8) {
  const a = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  let x = Date.now();
  for (let i = 0; i < len; i++) {
    s += a[x % 26];
    x = Math.floor(x / 26);
  }
  return s;
}

// Fill the required Add-user fields (assumes the Add User form is open).
async function fillUserForm(page, { lastName, phone, email }) {
  await page.locator('#firstName').fill('QAauto');
  await page.locator('#lastName').fill(lastName);
  await page.locator('#phone').fill(phone);
  await page.locator('#email').fill(email);
  await pickAntOption(page, 'Level', 0);
  await pickAntOption(page, 'Compensation', 0);
  await page.locator('#rate').fill('10');
}

// Create a user with unique phone + email (the API rejects duplicates) and Save.
// Returns the field values so callers can find the row or reuse the phone/email.
async function createUser(page) {
  await gotoAddUser(page);
  const lastName = 'Qa' + uniqueAlpha(6);
  const phone = '9' + String(Date.now()).slice(-9);
  const email = 'qa' + Date.now() + '@example.com';
  await fillUserForm(page, { lastName, phone, email });
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/users') && r.request().method() === 'POST',
      { timeout: 60000 } // tolerate a slow backend under full-suite load
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await page.waitForTimeout(1500);
  return { firstName: 'QAauto', lastName, phone, email };
}

// --- Organizations ---

// Open the Organizations list and wait for the count line.
async function gotoOrgs(page) {
  await gotoWithRetry(page, ORGANIZATIONS_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Organizations/ })).toBeVisible({
    timeout: 25000,
  });
}

// Open the Add Organization form.
async function gotoAddOrg(page) {
  await gotoWithRetry(page, ADD_ORG_URL, page.getByRole('button', { name: 'Save' }));
  await page.waitForTimeout(1500);
}

// Create an organization (Type=Team) with a unique name + short name and Save.
// New orgs sort to the top of the list (newest first). Returns the values.
async function createOrg(page) {
  await gotoAddOrg(page);
  const shortName = 'QAO' + uniqueAlpha(6);
  const name = 'QAOrg ' + shortName;
  await page.getByText('Team', { exact: true }).first().click(); // org type
  await page.locator('#name').fill(name);
  await page.locator('#shortName').fill(shortName);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/organizations') && r.request().method() === 'POST',
      { timeout: 60000 } // tolerate a slow backend under full-suite load
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await page.waitForTimeout(1500);
  return { name, shortName };
}

// --- Products ---

// Open the Products list and wait for the count line.
async function gotoProducts(page) {
  await gotoWithRetry(page, PRODUCTS_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Products/ })).toBeVisible({
    timeout: 25000,
  });
}

// Open the Add Product form.
async function gotoAddProduct(page) {
  await gotoWithRetry(page, ADD_PRODUCT_URL, page.getByRole('button', { name: 'Save' }));
  await page.waitForTimeout(1500);
}

// Create a product with a unique name (Category=first option, price=99) and Save.
// Returns the product name (the list search works, so callers can find it).
async function createProduct(page) {
  await gotoAddProduct(page);
  const name = 'QAProd ' + uniqueAlpha(6);
  await page.locator('#name').fill(name);
  await pickAntOption(page, 'Category', 0);
  await page.locator('#price').fill('99');
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/products') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await page.waitForTimeout(1500);
  return name;
}

// --- Coupons ---

// Pick an Ant Select option by clicking the input with the given id.
async function pickSelectById(page, id, index = 0) {
  await page.locator('#' + id).click();
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ visible: true })
    .nth(index);
  await option.waitFor({ state: 'visible', timeout: 12000 });
  const text = (await option.innerText()).trim();
  await option.click();
  await page.waitForTimeout(400);
  return text;
}

// Pick a day from an Ant DatePicker opened by clicking the input with `id`.
// `which` = 'first' (earliest enabled) or 'last' (latest enabled) visible day.
async function pickDateById(page, id, which = 'first') {
  await page.locator('#' + id).click();
  await page.waitForTimeout(800);
  const cells = page.locator(
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell:not(.ant-picker-cell-disabled) .ant-picker-cell-inner'
  );
  await (which === 'last' ? cells.last() : cells.first()).click();
  await page.waitForTimeout(500);
}

// Open the Coupons list and wait for the count line.
async function gotoCoupons(page) {
  await gotoWithRetry(page, COUPONS_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Coupons/ })).toBeVisible({
    timeout: 25000,
  });
}

// Open the Add Coupon form.
async function gotoAddCoupon(page) {
  await gotoWithRetry(page, ADD_COUPON_URL, page.getByRole('button', { name: 'Save' }));
  await page.waitForTimeout(1500);
}

// Fill the Add Coupon form (assumes it's open). discountTypeIndex: 0 = Flat,
// 1 = Percentage. Usage type 0 = Unlimited; rate 10; start→expiry dates.
async function fillCouponForm(page, { code, discountTypeIndex = 0 }) {
  await page.locator('#couponCode').fill(code);
  await page.locator('#description').fill('QA test coupon');
  await pickSelectById(page, 'discountType', discountTypeIndex);
  // Percentage coupons reveal an extra required "Max. Discount" field.
  const maxAmount = page.locator('#max_amount');
  if (await maxAmount.isVisible().catch(() => false)) {
    await maxAmount.fill('20');
  }
  await pickSelectById(page, 'coupon_usage_type', 0);
  await page.locator('#discountRate').fill('10');
  await pickDateById(page, 'basic_startDate', 'first');
  await pickDateById(page, 'basic_expiryDate', 'last');
}

// Create a Flat/Unlimited coupon with a unique code and Save. Returns the code.
async function createCoupon(page) {
  await gotoAddCoupon(page);
  const code = 'QA' + uniqueAlpha(6);
  await fillCouponForm(page, { code });
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/coupon') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await page.waitForTimeout(1500);
  return code;
}

// --- Gift Cards ---

// Open the Gift Cards list and wait for the count line.
async function gotoGiftcards(page) {
  await gotoWithRetry(page, GIFTCARDS_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Giftcards/ })).toBeVisible({
    timeout: 25000,
  });
}

// Open the Add Gift Card form.
async function gotoAddGiftcard(page) {
  await gotoWithRetry(page, ADD_GIFTCARD_URL, page.getByRole('button', { name: 'Save' }));
  await page.waitForTimeout(1500);
}

// Create a gift card. The code is auto-generated (read-only) — we read it off the
// form before saving and return it so callers can find the card afterwards.
async function createGiftcard(page, balance = '50') {
  await gotoAddGiftcard(page);
  const code = await page.locator('#giftcardCode').inputValue();
  await page.locator('#balance').fill(balance);
  await page.locator('#description').fill('QA gift card');
  await Promise.all([
    page.waitForResponse(
      (r) => /\/api\/.*giftcard/i.test(r.url()) && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  await page.waitForTimeout(1500);
  return code;
}

// --- Categories ---

// Open the Categories list and wait for the count line. There's no search on
// this list, so bump the page size to 30 to keep all rows on one page (test
// categories accumulate over runs and would otherwise spill onto page 2).
async function gotoCategories(page) {
  await gotoWithRetry(page, CATEGORIES_URL, page.getByRole('button', { name: 'Add Category' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Categories/ })).toBeVisible({
    timeout: 25000,
  });
  try {
    const sizer = page.locator('.ant-pagination-options .ant-select').first();
    if (await sizer.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sizer.click();
      await page
        .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', {
          hasText: '30',
        })
        .first()
        .click();
      await page.waitForTimeout(1000);
    }
  } catch {
    /* best-effort: if the size changer isn't present, the default page is fine */
  }
}

// Open the Add Category form.
async function gotoAddCategory(page) {
  await gotoWithRetry(page, ADD_CATEGORY_URL, page.getByRole('button', { name: 'Save' }));
  await page.waitForTimeout(1500);
}

// Create a category with a unique name and Save (redirects to the list).
// Returns the name (there's no search, so callers find it by row text).
async function createCategory(page) {
  await gotoAddCategory(page);
  const name = 'QACat ' + uniqueAlpha(6);
  await page.locator('#categoryName').fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/categories\/?$/, { timeout: 25000 });
  await page.waitForTimeout(1000);
  return name;
}

// --- Levels ---

// Open the Levels list and wait for the count line.
async function gotoLevels(page) {
  await gotoWithRetry(page, LEVELS_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Levels/ })).toBeVisible({
    timeout: 25000,
  });
}

// Create a level via the "Add New Level" modal with a unique name. Returns the
// name (Levels has search, so callers find it regardless of page).
async function createLevel(page) {
  await gotoLevels(page);
  await page.waitForTimeout(2000); // let the list settle before opening the modal
  const modal = page.locator('.ant-modal-content');
  // Retry the Add click — the first one can misfire while the list is settling.
  await expect(async () => {
    if (!(await modal.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Add' }).first().click();
    }
    await expect(modal).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 20000 });
  const name = 'QALvl' + uniqueAlpha(6);
  await modal.locator('#name').fill(name);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/levels') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    modal.getByRole('button', { name: 'Add' }).click(),
  ]);
  await page.waitForTimeout(1500);
  return name;
}

// --- School Districts ---

// Open the School Districts list and wait for the count line.
async function gotoSchoolDistricts(page) {
  await gotoWithRetry(page, SCHOOL_DISTRICTS_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ School Districts/ })).toBeVisible({
    timeout: 25000,
  });
}

// Open the Add School District form.
async function gotoAddSchoolDistrict(page) {
  await gotoWithRetry(page, ADD_SCHOOL_DISTRICT_URL, page.getByRole('button', { name: 'Save changes' }));
  await page.waitForTimeout(1500);
}

// Create a school district (name + state + one not-yet-linked school) and Save.
// Returns the name (the list has search, so callers find it).
async function createSchoolDistrict(page) {
  await gotoAddSchoolDistrict(page);
  const name = 'QASD ' + uniqueAlpha(6);
  await page.locator('#name').fill(name);
  await pickSelectById(page, 'school-district-create_stateId', 4);

  // The schools multi-select lists already-"(linked)" schools (unselectable) and
  // free ones — pick the first free one. Retry until a selection chip appears:
  // under load the options can render slowly/partially, leaving nothing picked
  // (which would then fail the "select at least one school" validation).
  const chips = page
    .locator('.ant-select', { has: page.locator('#school-district-create_schoolIds') })
    .locator('.ant-select-selection-item');
  await expect(async () => {
    if ((await chips.count()) > 0) return;
    await page.locator('#school-district-create_schoolIds').click();
    const opts = page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ visible: true });
    await opts.first().waitFor({ state: 'visible', timeout: 15000 });
    const count = await opts.count();
    for (let i = 0; i < count; i++) {
      if (!/linked/i.test((await opts.nth(i).innerText()).trim())) {
        await opts.nth(i).click();
        break;
      }
    }
    await page.locator('#name').click(); // close the dropdown
    await expect(chips).toHaveCount(1, { timeout: 3000 });
  }).toPass({ timeout: 40000 });

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/school-districts') && r.request().method() === 'POST',
      { timeout: 60000 }
    ),
    page.getByRole('button', { name: 'Save changes' }).click(),
  ]);
  await page.waitForTimeout(1500);
  return name;
}

// --- Zenfolio (Browse & Buy) ---

// Open the Zenfolio "Browse & Buy" sales list. The page first renders an Events
// shell, then loads the real Orders list — and the backend is slow here, so
// reload until the "Showing N Orders" count line appears.
async function gotoZenfolio(page) {
  for (let i = 0; i < 4; i++) {
    await page.goto(ZENFOLIO_URL, { waitUntil: 'domcontentloaded' });
    const ready = await page
      .getByRole('heading', { name: /Showing \d+ Orders/ })
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (ready) {
      await page.waitForTimeout(1500);
      return;
    }
  }
  throw new Error('Zenfolio browse-and-buy list did not load');
}

// --- Payouts ---

// Open the Payouts list and wait for the count line.
async function gotoPayouts(page) {
  await gotoWithRetry(page, PAYOUTS_URL, page.getByRole('button', { name: 'View History' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Records/ })).toBeVisible({
    timeout: 25000,
  });
}

// --- Reports ---

// Open the Reports list and wait for it to render.
async function gotoReports(page) {
  await gotoWithRetry(page, REPORTS_URL, page.getByText('Event profitability'));
}

// --- Spotlight Bundles ---

// Open the Bundles list and wait for it to be ready. (The "Bundles" title isn't
// a real heading; the Add button + "Showing N Bundles" count line always render.)
async function gotoBundles(page) {
  await gotoWithRetry(page, BUNDLES_URL, page.getByRole('button', { name: 'Add' }));
  await expect(page.getByRole('heading', { name: /Showing \d+ Bundles/ })).toBeVisible({
    timeout: 25000,
  });
}

// Open the Add Bundle form and wait for it to render.
async function gotoAddBundle(page) {
  await page.goto(ADD_BUNDLE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Save and Publish' })).toBeVisible({
    timeout: 25000,
  });
  await page.waitForTimeout(1500);
}

// Fill every field required to publish a bundle: Team, Sports, Level, an
// "Accept No Orders After" Date and a Time. (Title is read-only — it auto-builds
// from Team/Level/Sport.) Returns the auto-generated title.
async function fillRequiredBundleFields(page) {
  await pickAntOption(page, 'Team', 0);
  await pickAntOption(page, 'Sports', 0);
  await pickAntOption(page, 'Level', 0);

  // Date: pick the last enabled day in view.
  await page.locator('#basic_date').click();
  await page.waitForTimeout(800);
  await page
    .locator('.ant-picker-cell:not(.ant-picker-cell-disabled) .ant-picker-cell-inner')
    .last()
    .click();
  await page.waitForTimeout(500);

  // Time: single picker — choose an hour/minute and confirm.
  await page.locator('#basic_time').click();
  await page.waitForTimeout(700);
  const col = page.locator('.ant-picker-time-panel-column');
  await col.nth(0).locator('.ant-picker-time-panel-cell-inner').nth(9).click();
  await page.waitForTimeout(300);
  await col.nth(1).locator('.ant-picker-time-panel-cell-inner').nth(0).click();
  await page.waitForTimeout(300);
  const ok = page.locator('.ant-picker-ok button');
  if (await ok.isVisible().catch(() => false)) await ok.click();
  await page.waitForTimeout(400);

  return (await page.locator('#seasonPassName').inputValue()).trim();
}

// --- Shared edit/delete helpers ---

// Create + publish a valid event, waiting for the backend to accept it. Used by
// the edit/delete tests so a row is guaranteed to exist (works on a fresh
// sandbox too). If the same event already exists the backend treats it as a
// clash and skips creation — either way an event for the first team exists.
async function createAndPublishEvent(page) {
  await gotoAddEvent(page);
  await fillRequiredEventFields(page);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/events') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save and Publish' }).click(),
  ]);
  await page.waitForTimeout(2000);
}

// Create + publish a valid bundle, waiting for the backend to accept it.
// A bundle only publishes when it has at least one *linked* event (events
// auto-link by matching team/sport/level), so seed a matching event first.
async function createAndPublishBundle(page) {
  await createAndPublishEvent(page);

  await gotoAddBundle(page);
  await fillRequiredBundleFields(page);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/seasons') && r.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: 'Save and Publish' }).click(),
  ]);
  await page.waitForTimeout(2000);
}

// The Events list shows nothing until a filter is applied. Select the first
// Team so event rows appear, then wait for a row. Reloads on the flaky backend.
async function gotoEventsFilteredByFirstTeam(page) {
  for (let i = 0; i < 4; i++) {
    try {
      // goto is inside the try so a slow-load timeout reloads instead of failing.
      await page.goto(EVENTS_URL, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'Add' })).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2500);
      await page.locator('.ant-select').filter({ hasText: 'Teams' }).first().click();
      const option = page
        .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
        .filter({ visible: true })
        .first();
      // The team list loads from the (often slow) backend — give it room.
      await option.waitFor({ state: 'visible', timeout: 18000 });
      await option.click();
      await page.keyboard.press('Escape');
      await page.locator('tr.ant-table-row').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(1000);
      return;
    } catch (err) {
      if (i === 3) throw err;
    }
  }
}

module.exports = {
  ADMIN_BASE,
  EVENTS_URL,
  ADD_EVENT_URL,
  BUNDLES_URL,
  ADD_BUNDLE_URL,
  ORDERS_URL,
  USERS_URL,
  ADD_USER_URL,
  ORGANIZATIONS_URL,
  ADD_ORG_URL,
  PRODUCTS_URL,
  ADD_PRODUCT_URL,
  COUPONS_URL,
  ADD_COUPON_URL,
  GIFTCARDS_URL,
  ADD_GIFTCARD_URL,
  CATEGORIES_URL,
  ADD_CATEGORY_URL,
  LEVELS_URL,
  SCHOOL_DISTRICTS_URL,
  ADD_SCHOOL_DISTRICT_URL,
  ZENFOLIO_URL,
  PAYOUTS_URL,
  REPORTS_URL,
  gotoEvents,
  gotoAddEvent,
  gotoBundles,
  gotoAddBundle,
  gotoOrders,
  openSelectFilter,
  applyOrderDateRange,
  gotoUsers,
  gotoAddUser,
  uniqueAlpha,
  fillUserForm,
  createUser,
  gotoOrgs,
  gotoAddOrg,
  createOrg,
  gotoProducts,
  gotoAddProduct,
  createProduct,
  gotoCoupons,
  gotoAddCoupon,
  createCoupon,
  fillCouponForm,
  pickSelectById,
  pickDateById,
  gotoGiftcards,
  gotoAddGiftcard,
  createGiftcard,
  gotoCategories,
  gotoAddCategory,
  createCategory,
  gotoLevels,
  createLevel,
  gotoSchoolDistricts,
  gotoAddSchoolDistrict,
  createSchoolDistrict,
  gotoZenfolio,
  gotoPayouts,
  gotoReports,
  gotoEventsFilteredByFirstTeam,
  pickAntOption,
  fillRequiredEventFields,
  fillRequiredBundleFields,
  createAndPublishEvent,
  createAndPublishBundle,
};
