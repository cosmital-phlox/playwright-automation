# RBAC / Roles Module — QA Bug Report

**Environment:** Staging — https://phlox-admin.netlify.app
**Tested as:** QA Super Admin (`qa.superadmin@testlify.com`) — wildcard access
**Module:** Roles / Dynamic Roles & Access Control (`/roles`, `/roles/add-role`, `/roles/edit-role/:id`)
**Automated coverage:** `tests/staging/roles.spec.js` (run: `npx playwright test tests/staging/roles.spec.js --project=staging`)
**Scope note:** Findings below are from the Super-Admin-drivable UI/builder/CRUD flows. Server-side enforcement (per-role nav/button/API gating, 403, union of roles) is covered by the app repo's `test:rbac` suite and requires non-Super-Admin logins.

---

## Open bugs

### BUG-1 — Duplicate role name fails silently *(Functionality · Medium)*
- **Steps:** Add Role → name = an existing role (e.g. "Admin") → set any tier → Save.
- **Actual:** API returns **HTTP 400**; UI shows **no error/toast** — the form just sits on `/roles/add-role`.
- **Expected:** Inline/toast error, e.g. "Role name already exists."
- **Note:** Same silent-duplicate pattern seen elsewhere (users/orgs/coupons).

### BUG-2 — Role with no permissions can be created *(Functionality · Medium)*
- **Steps:** Add Role → enter a name → leave every resource on **None** → Save.
- **Actual:** Saves successfully (**HTTP 200**) — creates a zero-access role.
- **Expected:** Block it, or require at least one permission.

### BUG-3 — Weak role-name validation *(Functionality · Low/Medium)*
- **Steps:** Create a role named `@@@###$$$`, and separately a ~200-character name.
- **Actual:** Both are **accepted** (HTTP 200).
- **Expected:** Reject special-character-only names; enforce a max length.

### BUG-4 — Spaces-only name fails silently *(Functionality · Low)*
- **Steps:** Add Role → name = only spaces → Save.
- **Actual:** Does not submit, but shows **no validation message**.
- **Expected:** "Please enter a role name."

### BUG-5 — No "Cancel" button on the Add/Edit Role builder *(UI · Low)*
- **Actual:** The builder has only **Save** — no way to discard changes and return to the list.
- **Expected:** A Cancel button (per the QA spec's "Cancel changes").

### BUG-6 — No search on the Roles list *(UI · Low)*
- **Actual:** The list has pagination and sortable columns, but **no search box**.
- **Expected:** Search roles by title (QA spec lists "Verify search").

### BUG-7 — Add-on toggles use no standard control *(UI / Accessibility · Low)*
- **Actual:** Add-ons render as styled `<span>`s — no switch/checkbox/ARIA role; the on/off state ("N on") is not a real toggle element.
- **Expected:** A proper toggle (switch/checkbox), keyboard- and screen-reader-accessible.

---

## Verified FIXED (regression-checked)
- **Delete role** — trash icon → "Delete Role" confirmation modal → **`DELETE /api/v2/roles/:id`** → row removed. ✅
- **Footer whitespace** — table fills the card; empty block gone. ✅ (reporter-confirmed)
- **Roles tab hidden from Photographer / `/roles` → 403** — fix applied; needs a Photographer login to auto-verify (manual/`test:rbac`).
- **Add-User Role dropdown is dynamic** (lists custom roles) — fix applied; manually confirmed (field is a custom combobox, not auto-drivable here).

## Verified CORRECT (not bugs)
- **Permission matrix** — all 17 spec resources expose the correct **tiers** and **add-ons** (Events/Media Days 3, Bundles 1, Orders 4, Browse&Buy 1, Payouts/Reports 1, Users/Platform 2; Catalog + Orgs + Districts none). Tier restrictions correct: **Billing = None/Manage**, **Payouts/Reports/Platform = None/View**.
- **Add-on gating** — add-ons are locked at tier=None and become toggleable at View/Manage.
- **Edit** — opens the populated builder; **Super Admin** row is non-editable/non-deletable by design.

## Not verifiable here (needs non-Super-Admin logins → app repo `test:rbac`)
- Per-role navigation & button visibility, API 401/200 enforcement, route → 403, 403 page, union of two roles, cross-login persistence.

---
*Generated from the automated exploration in `tests/staging/roles.spec.js`.*
