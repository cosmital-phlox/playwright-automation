# Playwright Test — Command Reference

End-to-end test suite for **VYPE Sideline** — the customer site
(**uat-phlox-frontend.netlify.app**) and the **admin panel**
(**uat-phlox-admin.netlify.app**) — built with **Playwright Test**
(`@playwright/test`) in JavaScript. The frontend suite covers login, events,
filters, cart, coupon, gift card, checkout, payment, spotlight, navigation, and
account flows; the admin suite (under `tests/admin/`) covers Events, Spotlight
Bundles, Orders, Users, Organizations, Products, Coupons, Gift Cards,
Categories, Levels, School Districts, Zenfolio (Browse & Buy), Payouts and
Reports management. All with positive, negative, and edge cases.

---

## 1. One-time setup

| Command | What it does |
|---------|--------------|
| `npm install` | Install project dependencies |
| `npx playwright install` | Download all browser binaries |
| `npx playwright install chromium` | Download just Chromium (what we run by default) |

---

## 2. Run the whole suite

```bash
npx playwright test --project=chromium
```
Runs every test on Chromium. The `setup` (login) project runs first and **auto-skips**
while a saved session exists.

```bash
npx playwright test --project=chromium --headed   # watch in a visible browser
npx playwright test                                # all browsers (chromium + firefox + webkit)
```

---

## 🎬 Demo / presentation mode

Runs **headed on real Google Chrome**, with every action **slowed down** (`slowMo`) so an
audience can watch, and a **pause between tests** so each result is visible. Tests
auto-advance — no manual stepping. Controlled by two env vars (off in normal runs):

| Env var | Effect |
|---------|--------|
| `DEMO=1` | Headed + real Chrome + `slowMo: 800` |
| `DEMO_PAUSE=3000` | Pause N ms after each test (3s here) |

**Before the demo** — refresh the login once so it won't stall on OTP mid-demo:
```bash
npx playwright test --project=setup --headed     # enter the OTP at the pause, then resume
```

**The happy-path tour** (add to cart → coupon → gift card → full payment + receipt).
These run in file order, which is already a clean story arc:
```bash
DEMO=1 DEMO_PAUSE=3000 npx playwright test --project=chromium --no-deps \
  -g "Add a single product to cart|Apply a coupon code and see|Apply a gift card and see|Pay with a card"
```

**Add a couple of negative cases** for variety (invalid coupon + checkout validation):
```bash
DEMO=1 DEMO_PAUSE=3000 npx playwright test --project=chromium --no-deps \
  -g "Add a single product to cart|Apply a coupon code and see|Invalid coupon shows|validation errors when empty|Pay with a card"
```

**One single flow** (e.g. just the payment story), slowed and paused:
```bash
DEMO=1 DEMO_PAUSE=3000 npx playwright test tests/payment.spec.js --project=chromium --no-deps -g "Pay with a card"
```

> Tips: don't run all 53 tests in demo mode (headed + slowMo + pauses ≈ 30+ min). Pick a
> few flows with `-g`. Adjust pace via `DEMO_PAUSE` or the `slowMo: 800` value in
> `playwright.config.js`.

---

## 3. Run a single test file (Chromium)

```bash
npx playwright test tests/login.spec.js      --project=chromium --no-deps
npx playwright test tests/event.spec.js      --project=chromium --no-deps
npx playwright test tests/filter.spec.js     --project=chromium --no-deps
npx playwright test tests/cart.spec.js       --project=chromium --no-deps
npx playwright test tests/coupon.spec.js     --project=chromium --no-deps
npx playwright test tests/giftcard.spec.js   --project=chromium --no-deps
npx playwright test tests/checkout.spec.js   --project=chromium --no-deps
npx playwright test tests/payment.spec.js    --project=chromium --no-deps
npx playwright test tests/spotlight.spec.js  --project=chromium --no-deps
npx playwright test tests/navigation.spec.js --project=chromium --no-deps
npx playwright test tests/account.spec.js    --project=chromium --no-deps
```
`--no-deps` skips the login setup and reuses the already-saved session.

---

## 3a. Admin panel (uat-phlox-admin.netlify.app)

The admin tests live under `tests/admin/` and run as their own project with a
**separate login** (email + password — fully automated, no OTP) and a separate
saved session (`playwright/.auth/admin.json`).

```bash
npx playwright test --project=admin                 # run the admin suite
npx playwright test --project=admin -g "Create"     # one admin test by name
npx playwright test --project=admin --headed        # watch it
```

Refresh the admin session if tests start failing as if logged out:
```bash
npx playwright test --project=admin-setup
```
Credentials default to the sandbox account; override with env vars if needed:
```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret npx playwright test --project=admin-setup
```

> The admin login auto-skips while a valid saved session exists (same pattern as
> the frontend). The frontend projects (`chromium`/`firefox`/`webkit`) ignore the
> `tests/admin/` folder, so they're unaffected.

---

## 3b. Run on other browsers (Firefox / WebKit)

Whole suite per browser:
```bash
npx playwright test --project=firefox     # Firefox only
npx playwright test --project=webkit       # WebKit (Safari engine) only
```

Any single file on another browser — just swap the project:
```bash
npx playwright test tests/cart.spec.js       --project=firefox --no-deps
npx playwright test tests/navigation.spec.js --project=webkit  --no-deps
# ...same file list as section 3, with --project=firefox or --project=webkit
```

> The saved login session works across all browsers (each project loads the same
> `storageState`). If a run fails as if logged out, refresh once with
> `npx playwright test --project=setup --headed`.

---

## 4. Run a single test by name

```bash
npx playwright test --project=chromium --no-deps -g "Apply a coupon code"
```
`-g` (grep) runs only tests whose title matches the text.

---

## 5. Watch / debug a test

```bash
npx playwright test tests/payment.spec.js --project=chromium --no-deps --headed   # visible browser
npx playwright test tests/payment.spec.js --project=chromium --no-deps --debug    # step through (Inspector)
npx playwright test --ui                                                          # UI Mode (visual runner)
```

---

## 6. Authentication (login session)

```bash
npx playwright test --project=setup --headed
```
Refreshes the saved login session. Enter the **OTP** manually at the pause, then resume.
Run this **only when the session has expired** (tests start failing as if logged out).

---

## 7. Reports & results

```bash
npx playwright show-report                          # HTML report of the LAST run
npx playwright show-trace test-results/<folder>/trace.zip   # trace viewer for a failed test
```
> `show-report` always replays the **last saved run** — it does not re-run tests. Run the
> suite again to refresh it.

---

## 8. Record new tests (codegen)

```bash
npx playwright codegen https://uat-phlox-frontend.netlify.app/
```

---

## Useful flags (add to any `test` command)

| Flag | Meaning |
|------|---------|
| `--project=chromium\|firefox\|webkit` | Choose the browser |
| `--headed` | Show the browser window |
| `--debug` | Step through with the Inspector |
| `--no-deps` | Skip the login `setup` project (reuse saved session) |
| `-g "text"` | Run only tests matching the title |
| `--repeat-each=N` | Run each selected test N times (flakiness check) |
| `--workers=1` | Run serially (already the project default) |
| `--reporter=line` | Compact one-line output |

---

## Test files & what they cover

| File | Tests |
|------|-------|
| `tests/auth.setup.js` | One-time login; saves session (auto-skips when valid) |
| `tests/login.spec.js` | Invalid email validation; OTP screen (skipped) |
| `tests/event.spec.js` | All tabs visible |
| `tests/filter.spec.js` | Tabs, Team/Sport/Level dropdowns, search (+/−), Clear all, combined filters, tab+filter |
| `tests/cart.spec.js` | Add product, Add-to-Cart disabled, badge count, remove→empty, multiple products, High-Res product |
| `tests/coupon.spec.js` | Apply coupon, invalid coupon, no-remove gap |
| `tests/giftcard.spec.js` | Apply gift card, invalid gift card, remove, coupon+gift stack |
| `tests/checkout.spec.js` | Billing happy path, empty-form validation, email/phone/zip format validation |
| `tests/payment.spec.js` | Valid card → confirmation → receipt tab; declined / insufficient / expired / wrong-CVC / empty card |
| `tests/spotlight.spec.js` | My Spotlights → Contact support (new tab) |
| `tests/navigation.spec.js` | Header links, About menu, logo, cart icon, 404, bundles, past events, back/forward, mobile nav |
| `tests/account.spec.js` | Logout, My Orders, session expiry |
| `tests/helpers.js` | Shared helpers (`openFirstEvent`, `openEventByIndex`, `selectComboByIndex`) — not a test file |
| `tests/admin/admin.setup.js` | One-time **admin** login (email + password); saves session (auto-skips when valid) |
| `tests/admin/auth.spec.js` | Admin auth: login page, empty / short-password / wrong-credentials validation, protected-route redirect when logged out, logout |
| `tests/admin/navigation.spec.js` | Admin sidebar navigation — every sidebar link routes to its module |
| `tests/admin/events.spec.js` | Admin Events: list UI, Add form + defaults, auto-title, create & publish, required-field validation, empty-draft bug, search, edit & delete, Status/Type filters, Import dialog, schedule-conflict (clash) modal |
| `tests/admin/bundles.spec.js` | Admin Spotlight Bundles: list UI, existing row, Add form + defaults, auto-title, create & publish, search (+/−), required-field validation, empty-draft bug, edit & delete, Status/Category filters, sorting |
| `tests/admin/orders.spec.js` | Admin Orders (Prepaid Orders, read-only): list UI, Status/Order Type/Team/Category/Photographer filters, search, Event filter, date-range, Export download, sorting |
| `tests/admin/users.spec.js` | Admin Users: list UI, search (+/−), Role filter, Add form, required + format validation, duplicate-phone bug, create, edit (+persist), delete, Clear All, pagination, sorting |
| `tests/admin/organizations.spec.js` | Admin Organizations: list UI, broken-search bug, Type + City filters, Import dialog + CSV-template download + **real CSV upload (parse/validate)**, Add form + validation (incl. zip/URL formats), duplicate-name bug, create, edit (+persist), delete, Export download, Clear All, pagination, sorting (reorder) |
| `tests/admin/products.spec.js` | Admin Products: list UI, search (+/−), Category filter, Add form + validation, negative-price bug, description persists, create, edit (+persist), delete, Clear All, pagination, sorting (reorder) |
| `tests/admin/coupons.spec.js` | Admin Coupons: list UI, search (+/−), Discount Type filter, date-range filter, Add form + validation, create (Flat + Percentage), duplicate-code bug, edit (+persist), delete, Clear All, pagination, sorting (reorder) |
| `tests/admin/giftcards.spec.js` | Admin Gift Cards: list UI, search (+/−), auto-generated read-only code, create, edit (+persist), delete, Clear All, sorting |
| `tests/admin/categories.spec.js` | Admin Categories: list UI, expand sub-categories, Add form + validation, create, edit (+persist), delete |
| `tests/admin/levels.spec.js` | Admin Levels: list UI, search (+/−), Add modal + validation, create, **inline edit** (+persist), delete, pagination, sorting (reorder) |
| `tests/admin/school-districts.spec.js` | Admin School Districts: list UI, search (+/−), State filter, Add form + validation, create, edit (+persist), delete, linked-district delete-blocked, Import dialog, pagination, sorting (reorder) |
| `tests/admin/zenfolio.spec.js` | Admin Zenfolio / Browse & Buy (read-only sales matching): list UI, Event Match + Order Source filters, search, Clear All, Import (Upload CSV) dialog |
| `tests/admin/payouts.spec.js` | Admin Payouts (read-only): list UI, Role filter, View History reveals records, Download CSV, search |
| `tests/admin/reports.spec.js` | Admin Reports: list of downloadable reports, date-range download dialog, report file download |
| `tests/admin/helpers.js` | Admin helpers (`gotoEvents`/`gotoAddEvent`, `gotoBundles`/`gotoAddBundle`, `gotoOrders`/`openSelectFilter`, `gotoUsers`/`createUser`, `gotoOrgs`/`createOrg`, `gotoProducts`/`createProduct`, `gotoEventsFilteredByFirstTeam`, `pickAntOption`, `fillRequired*Fields`, `createAndPublish*`) — not a test file |

---

## Notes

- **Flaky live backend:** the app uses a shared live backend that intermittently returns
  empty pages / loads slowly. The config compensates with `workers: 1` (no parallel
  overload), `retries: 2`, a global 15s assertion timeout, and reload loops in helpers.
  A **"flaky"** result means the test **passed on retry** — the suite is still green.
- **`--no-deps`:** use it for single-file runs so the login setup doesn't re-run.
- **OTP test is skipped** by default (live OTP endpoint rate-limits). Run on demand:
  `npx playwright test -g "OTP screen opens" --headed`.
- **Payment uses Stripe test mode** (`4242 4242 4242 4242`) — creates a test-mode order
  each run but charges nothing real. Failing-card tests use Stripe's decline test cards.
- **Cart persists per account** — the "multiple products" test empties the cart first for
  a deterministic count.
- **Checkout/payment pick a team-bearing event automatically** — the events list accumulates
  test data, and some published events have **no team** (e.g. *"Test event Demo 90"*), which
  leaves the billing "team" dropdown empty. The `reachBillingWithTeam` helper walks the events
  list until it finds one whose team dropdown populates, clearing the cart between misses, and
  caches that index so later tests skip straight to it. So checkout/payment no longer depend on
  which event happens to be first.
- **`payment.spec.js` is the most backend-latency-sensitive spec** — its flow is the heaviest
  (event lookup → billing render → Stripe iframe → Stripe processing), so it's the first to time
  out when the shared backend is slow. `checkout.spec.js` and `payment.spec.js` run with a
  raised 180s timeout. During a degraded backend window, failures here are almost always
  `Test timeout … exceeded` waiting for a field to render — environmental, not test bugs. Run it
  **in isolation during a quiet window** rather than judging suite health by it under load:
  `npx playwright test tests/payment.spec.js --project=chromium --no-deps`

---

## Known product issues surfaced by these tests

- **Coupon can't be removed** — once applied there's no remove control (gift cards can be removed). See `coupon.spec.js` "no remove control (known gap)".
- **Services link → staging host** — the About → Services link points to `phloxphoto.com/phlox-productions/` which redirects to `phlox.tempurl.host`.
- **Search needs Enter** — typing in the events search doesn't filter until you press Enter (no search button).
- **Past-event cards aren't clickable** — unlike future events, they have no "View Event Details" link.
- **Admin: "Save as Draft" has no validation** — on both the Add **Event** and Add **Bundle** forms, an entirely empty form saves successfully and creates a blank draft. See "BUG: Save as Draft accepts a completely empty form/bundle" in `tests/admin/events.spec.js` and `tests/admin/bundles.spec.js`. (Save and Publish *does* validate the required fields on both.)
- **Admin: duplicate user phone/email fails silently** — adding a user whose phone (or email) already exists returns **HTTP 200 with an error body** (`"User With the Phone Number Already Exists!"`) but shows **no UI feedback** — the form just sits there as if nothing happened. See `tests/admin/users.spec.js` "BUG: duplicate phone is rejected silently".
- **Admin: publishing a bundle with no linked events does nothing** — Save and Publish silently no-ops (no submit, no error) until at least one event is linked. See the bundle create test.
- **Admin: empty Orders list until a date range is set** — the Prepaid Orders list shows nothing on load; applying an order date range surfaces the seeded orders.
- **Admin: Organizations search box is non-functional** — typing any term (even gibberish) never filters the list; the count and rows stay unchanged and no request fires. (The Type filter does work.) See `tests/admin/organizations.spec.js` "BUG: the search box does not filter the list".
- **Admin: duplicate organization name fails silently** — adding an org whose name already exists returns **HTTP 200 with an error body** (`"Organization Name Already Exist…"`) with **no UI feedback** (same pattern as the duplicate-user bug). See `tests/admin/organizations.spec.js` "BUG: duplicate organization name is rejected silently".
- **Admin: products accept a negative price** — the Add/Edit Product form has no validation that price ≥ 0, so a price of `-5` saves successfully. See `tests/admin/products.spec.js` "BUG: a negative price is accepted".
- **Admin: duplicate coupon code fails silently** — adding a coupon whose code already exists returns **HTTP 200 with an error body** (`"Coupon Code Already Exist…"`) with **no UI feedback** (same pattern as the duplicate user/org bugs). See `tests/admin/coupons.spec.js` "BUG: duplicate coupon code is rejected silently".
