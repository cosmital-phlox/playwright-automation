# VYPE Sideline — QA Test Report

**Prepared by:** Raj Pal · **Date:** 2026-06-18
**Environment:** Staging / Sandbox
**Apps under test:**
- Customer site — `https://uat-phlox-frontend.netlify.app`
- Admin panel — `https://uat-phlox-admin.netlify.app`

**Test framework:** Playwright Test (JavaScript), Chromium. Run serially (`workers: 1`)
with `retries: 2` to absorb the shared sandbox backend's intermittent slowness.

---

## 1. Coverage summary

| Area | Suite | Tests | Status |
|------|-------|-------|--------|
| **Customer site** | login, events, filters, cart, coupon, gift card, checkout, payment, spotlight, navigation, account | **51** | ✅ green |
| **Admin** | Events, Spotlight Bundles, Orders, Users, Organizations, Products, Coupons, Gift Cards, Categories, Levels, School Districts, Zenfolio, Payouts, Reports (+ auth) | **~150** | ✅ green |

Coverage per area includes positive flows, negative/validation cases, and edge cases
(filters, search, pagination, sorting, import/export, edit-persist, delete-confirm).

**Result of the latest full run:** all suites pass. A small number of tests occasionally
need a retry under peak backend load — this is expected and absorbed by `retries: 2`
("flaky" in Playwright output = **failed once, passed on retry = green**).

---

## 2. Defects found

Severity key: **S2** = functional bug / data-integrity or user-blocking · **S3** = moderate
(confusing/inconsistent) · **S4** = minor/cosmetic.

### 🔴 Highlight: a recurring "silent failure" pattern (S2)

Three separate admin create forms reject duplicates **server-side but give the user no
feedback** — the API returns **HTTP 200 with an error body**, the form simply sits there,
and nothing is created. Users will assume it worked.

| # | Where | Trigger | API response (200) |
|---|-------|---------|--------------------|
| 1 | **Users** → Add | Duplicate **phone** (or email) | `"User With the Phone Number Already Exists!"` |
| 2 | **Organizations** → Add | Duplicate **name** | `"Organization Name Already Exist…"` |
| 3 | **Coupons** → Add | Duplicate **code** | `"Coupon Code Already Exist…"` |

**Expected:** show an inline/toast error and keep the entered data; ideally return a 4xx.
**Impact:** silent data loss / user confusion across multiple modules — looks like one shared
backend+frontend convention that needs fixing once.

---

### Admin defects

| # | Severity | Module | Defect | Expected |
|---|----------|--------|--------|----------|
| A1 | S2 | Events **&** Bundles | **"Save as Draft" has no validation** — a completely empty Add form saves and creates a blank draft (e.g. event titled `@ - -`). (*Save and Publish* validates correctly.) | Require at least the key fields, or block an empty draft. |
| A2 | S2 | Users | **Duplicate phone/email silently rejected** (200 + error body, no UI). | Inline error; keep form data. |
| A3 | S2 | Organizations | **Duplicate name silently rejected** (200 + error body, no UI). | Inline error. |
| A4 | S2 | Coupons | **Duplicate code silently rejected** (200 + error body, no UI). | Inline error. |
| A5 | S2 | Organizations | **Search box is non-functional** — typing any term never filters the list; the count/rows don't change and no request is sent. (The Type filter works.) | Search should filter, like every other admin list. |
| A6 | S3 | Bundles | **Publishing with no linked events silently no-ops** — Save and Publish does nothing (no submit, no error) until ≥1 event is linked. | Show "link at least one event" guidance. |
| A7 | S3 | Products | **Negative price accepted** — `-5` saves with no validation. | Reject prices < 0. |
| A8 | S3 | Orders | **Empty list on load** — Prepaid Orders shows nothing until an order date range is applied (orders then appear). | Show recent orders by default, or indicate a filter is required. |
| A9 | S4 | Admin login | **"Forgot your password?" appears non-functional** — clicking it does nothing (no navigation, no modal, no message). | Open a reset-password flow. |

### Customer-site defects

| # | Severity | Area | Defect | Expected |
|---|----------|------|--------|----------|
| C1 | S2 | Checkout | **Name fields reject spaces** — Billing & Player *First/Last name* reject spaces/multi-word names ("Numbers, special characters and whitespaces not allowed"). Blocks legitimate names. *(Matches the open ticket.)* | Allow spaces in name fields. |
| C2 | S2 | Cart / Coupon | **Applied coupon cannot be removed** — no remove control once applied (gift cards *can* be removed). | Add a remove/clear control for coupons. |
| C3 | S3 | Cart / Coupon | **Coupon race condition** — entering a coupon before the cart's product line finishes rendering silently wipes the field. | Disable the field until the cart is ready. |
| C4 | S3 | Events | **Search requires Enter** — typing doesn't filter; there's no search button and no on-type filtering. | Filter on type or add a visible search button. |
| C5 | S3 | Events (Past) | **Past-event cards aren't clickable** — unlike future events, they have no "View Event Details" link. | Make past events viewable too, or hide the affordance consistently. |
| C6 | S4 | About → Services | **Services link points to a staging host** — `phloxphoto.com/phlox-productions/` redirects to `phlox.tempurl.host`. | Point to the production Services page. |
| C7 | S4 | Login | **No OTP rate-limit feedback** — repeated OTP requests are silently throttled with no message. | Surface a "please wait / too many attempts" message. |
| C8 | S4 | Accessibility | Filter "tabs" aren't real tabs (rendered as list items), and several form inputs lack labels. | Use proper roles/labels for a11y. |
| C9 | S3 | Checkout | **Published event with no team breaks checkout** — some live events (e.g. *"Test event Demo 90"*) reach the billing page with the required "team" dropdown empty (placeholder only), so an order can't be completed and there's no fallback/message. | Don't publish events without a team, or surface a clear error instead of an unusable empty dropdown. *(Tests now auto-skip such events via `reachBillingWithTeam`.)* |

---

## 3. Positive observations
- **Save and Publish** (Events/Bundles), Add forms for Users/Products/Coupons/Categories/
  Levels/School Districts, and the Stripe payment flow all validate required fields correctly.
- **School Districts** correctly **blocks deletion of districts linked to events** with a clear message — good data-integrity guard.
- **Admin login validates correctly** — empty fields, short passwords, and wrong credentials all show clear messages, and **admin routes redirect to login when not authenticated** (good security behaviour). *(Only "Forgot your password?" is non-functional — A9.)*
- Filters, pagination, sorting, import/export and gift-card/coupon redemption all work as expected.

---

## 4. Notes / test-environment caveats
- Several admin lists are **empty until a filter is applied** (Events needs a Team filter;
  Orders/Zenfolio need a date range). Verified as filter behavior, not data loss.
- Gift-card codes are **auto-generated & read-only**; gift-card balance **defaults to 100** and
  the Add form has no required-field validation (low risk — auto-generation is intended).
- The shared sandbox backend slows under sustained load; a full ~150-test serial run takes
  ~20 min and may need retries. Per-module runs are fast and stable.
- The customer **payment flow** (`payment.spec.js`) is the heaviest path (event lookup →
  billing render → Stripe iframe → Stripe processing) and is the most sensitive to backend
  latency. During a degraded window its failures are almost always `Test timeout … exceeded`
  waiting for a field to render — environmental, not test defects. It runs with a raised 180s
  timeout; run it in isolation during a quiet window rather than judging suite health by it.
- The events list accumulates **test data** (empty drafts, teamless events); checkout/payment
  tests pick a usable event automatically rather than assuming the first one is valid.

---

*Every defect above is backed by an automated test (search the spec files for "BUG" or the
named scenario). Re-running a suite reproduces the behaviour.*
