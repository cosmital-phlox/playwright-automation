# UAT Deployment — New-Feature Test Cases

**Environment:** UAT — https://uat-phlox-admin.netlify.app · **Scope:** Admin
**Deployment tickets:** PAS-660, 664, 696, 698, 702, 718, 721, 722, 728, 732, 734, 736, 737.
**Priority:** P1 critical · P2 high · P3 low. ✅ verified live · ⬜ to execute.

## Coverage triage
| Ticket | Feature | Status |
|---|---|---|
| PAS-660 | Prisma Accelerate (pooling) | already tested (load/pooling report) |
| PAS-664 | Events UI redesign | already tested (PAS-664 doc) |
| PAS-698 | Default staff filter | already tested (PAS-698 report) |
| PAS-721 / PAS-722 | API optimization | already tested (perf audit) |
| **PAS-696** | Profile setup | **§1** 🆕 |
| **PAS-702** | Zip code at user level | **§2** 🆕 |
| **PAS-728** | Zip mandatory for all locations | **§3** 🆕 |
| **PAS-718** | Roles & permissions new UI | **§4** 🆕 |
| **PAS-732** | Cancel button + warning modal | **§5** 🆕 |
| **PAS-734** | SOW logs (like Media Days) | **§6** 🆕 |
| **PAS-736** | Edit save → back to list w/ filters | **§7** 🆕 |
| **PAS-737** | Org "View linked events" → filtered list | **§8** 🆕 |

---

## 1 · Profile setup (PAS-696)
Verified: the avatar dropdown now shows a real **Profile** item (previously "coming soon").

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| PROF-01 | Profile opens from avatar | P1 | Click avatar → Profile | Navigates to a profile page (not "coming soon") |
| PROF-02 | Profile shows current user | P1 | Open profile | Shows the logged-in user's details (name, email, role, etc.) |
| PROF-03 | Edit + save profile | P1 | Change an editable field → Save | Change persists on reopen; success feedback |
| PROF-04 | Field validation | P2 | Submit invalid values (email/phone format, empty required) | Inline errors; blocked |
| PROF-05 | Change password (if present) | P2 | Use change-password flow | Old→new works; weak/mismatch rejected |
| PROF-06 | Cancel/back | P3 | Cancel edits | Discards; returns without saving |

## 2 · Zip code at user level (PAS-702)
Verified: Add User has a **"ZIP / Postal code"** field.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| UZIP-01 | Zip field present on Add/Edit User | P1 | Open Add User & Edit User | "ZIP / Postal code" field shown |
| UZIP-02 | Valid zip saves + persists | P1 | Enter a valid zip, save, reopen | Zip persists |
| UZIP-03 | Zip format validation | P2 | Enter letters / wrong length | Rejected with message (numeric/length rule) |
| UZIP-04 | Optional vs required | P2 | Save user with zip blank | Matches spec (if PAS-702 makes it optional at user level, saves; else message) |
| UZIP-05 | Existing users editable | P3 | Edit a user created before the change | Zip field editable/populated |

## 3 · Zip code mandatory for all locations while adding (PAS-728)
The zip becomes **required** wherever a location/address is entered (Organizations, Event location, School Districts, etc.).

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| LZIP-01 | Zip required — Organization | P1 | Add Organization, leave Postal/Zip blank → Save | Blocked with "zip required" message |
| LZIP-02 | Zip required — School District | P1 | Add School District without zip → Save | Blocked with message |
| LZIP-03 | Zip required — Event/Media Day location | P1 | Add event with a location but no zip | Blocked with message |
| LZIP-04 | Valid zip proceeds | P1 | Provide a valid zip on each form | Saves successfully |
| LZIP-05 | Zip format on location forms | P2 | Invalid zip (letters/length) | Rejected with message |
| LZIP-06 | Existing records without zip | P2 | Edit a location saved before the rule | Prompts for zip on save (or flags it) |

## 4 · Roles & Permissions — new UI (PAS-718)
Verified: the permission builder was redesigned. Each resource row now has an **add-on count badge** (e.g. `Orders 0/4`), an **expand chevron**, and **icon tier controls** — a toggle (None), an **eye** (View), and a **pencil** (Manage). Domains: Sales & Operations, Catalog, Organizations & Districts, Finance, Administration. Cancel + Save at top.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| RUI-01 | Builder renders new UI | P1 | Open Add Role | Role name field + Permissions grouped by 5 domains; each resource has count badge + eye + pencil + toggle |
| RUI-02 | Tier via icons | P1 | Click eye (View) / pencil (Manage) / toggle (None) on a resource | Tier state updates accordingly; mutually exclusive |
| RUI-03 | Add-on count badge | P1 | Enable add-ons on a resource (e.g. Orders) | Badge updates (e.g. `0/4` → `2/4`) |
| RUI-04 | Expand/collapse add-ons | P2 | Click the resource chevron | Add-on panel expands/collapses |
| RUI-05 | Add-ons gated by tier | P1 | Add-ons at None vs View/Manage | Locked at None; selectable at View/Manage |
| RUI-06 | Non-standard tiers | P1 | Inspect Billing / Payouts / Reports / Platform | Correct available tiers (Billing no View; Payouts/Reports/Platform no Manage) |
| RUI-07 | Create + persist | P1 | Set tiers/add-ons, name, Save | Role created; reopen shows same selections |
| RUI-08 | Edit + delete | P2 | Edit a role; delete via confirm modal | Changes persist; delete removes it |
| RUI-09 | Validation | P2 | Empty name / zero-permission role | Blocked with messages |
| RUI-10 | Cancel (see PAS-732) | P2 | Make changes → Cancel | Warning modal → discard returns to list |

## 5 · Cancel button + warning modal (PAS-732)
Verified: forms now have a **Cancel** button (previously missing on the builder). Fixes the old "no Cancel button" gap.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| CAN-01 | Cancel present on forms | P1 | Open Add/Edit forms (event, product, role, user, org, SOW, etc.) | A Cancel button is present |
| CAN-02 | Cancel with **no** changes | P2 | Open form, click Cancel without editing | Returns to list immediately (no modal, or modal optional) |
| CAN-03 | Cancel with **unsaved** changes → warning | P1 | Edit a field → Cancel | A **warning/confirm modal** appears ("Discard changes?") |
| CAN-04 | Warning modal — Discard | P1 | Confirm discard | Leaves the form; changes lost; returns to list |
| CAN-05 | Warning modal — Keep editing | P1 | Dismiss the modal | Stays on the form; entered data preserved |
| CAN-06 | Browser back / nav-away | P2 | Navigate away with unsaved changes | Same warning fires (if in scope) |

## 6 · SOW logs (PAS-734)
Create an activity **Logs** section for SOW, mirroring the Media Day logs.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| SOWL-01 | Logs section on SOW | P1 | Open a SOW detail/edit | A **Logs / History** section is present (like Media Days) |
| SOWL-02 | Create logged | P1 | Create a SOW | A "created" log entry with user + timestamp |
| SOWL-03 | Edit logged | P1 | Edit the SOW, save | An "updated" log entry appears |
| SOWL-04 | Status change logged | P2 | Change SOW status (Active/Inactive/Draft) | Logged |
| SOWL-05 | Log format matches Media Days | P2 | Compare to a Media Day's logs | Same structure (actor, action, timestamp) |
| SOWL-06 | Chronological order | P3 | Multiple actions | Logs ordered newest/oldest consistently |

## 7 · Edit save → return to list with previous filters (PAS-736)
After saving on an edit page, redirect to the list page **with the filters/search/page that were applied before opening the record**.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| RDR-01 | Filters preserved after edit-save | P1 | On a list, apply filters (e.g. Events: Status + Team) → open a record → edit → Save | Returns to the list with the **same filters still applied** |
| RDR-02 | Search term preserved | P1 | Apply a search → open → edit → Save | Search term still active on return |
| RDR-03 | Page/pagination preserved | P2 | Go to page 2 → open a record → Save | Returns to page 2 (or the same scroll position) |
| RDR-04 | Works across modules | P2 | Repeat on Users, Organizations, Products, Orders | Same behavior everywhere |
| RDR-05 | Save-as-Draft / Cancel | P2 | Draft-save / Cancel | Draft → same redirect+filters; Cancel → returns without saving, filters intact |
| RDR-06 | No filters applied | P3 | Edit-save with no filters | Returns to the unfiltered list normally |

## 8 · Organization "View linked events" → filtered Event list (PAS-737)
Clicking **"View linked events"** on an organization navigates to the **Event List filtered to that org's linked events**.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| LNK-01 | Control present | P1 | Open an Organization (detail/edit) | A "View linked events" control is shown |
| LNK-02 | Navigates to filtered Event list | P1 | Click "View linked events" | Lands on the Event List **pre-filtered** to that organization |
| LNK-03 | Only that org's events shown | P1 | Inspect the filtered list | Every row belongs to the selected organization (count matches the org's linked events) |
| LNK-04 | Org with zero events | P2 | Use an org with no linked events | Empty/"no events" state, no error |
| LNK-05 | Filter is clearable | P2 | Clear the applied filter | Full event list returns |
| LNK-06 | Deep-link / back | P3 | Back button after viewing | Returns to the organization |

---

## Notes
- Verified live during authoring: PAS-696 (Profile item present), PAS-702 (ZIP/Postal field on Add User), PAS-718 (redesigned icon-based permission builder), PAS-732 (Cancel button on forms).
- To confirm on execution: PAS-728 (zip-required enforcement per location form), PAS-734 (SOW Logs section), PAS-736 (redirect-with-filters behavior), PAS-737 (org "View linked events" entry point — check the org **detail/edit** page).
- Regression tie-in: PAS-732 fixes the previously-reported "no Cancel button" gap (RBAC_BUG_REPORT.md BUG-5); PAS-718 supersedes the tier-button UI covered in `tests/admin/roles-access.spec.js` — that suite's selectors will need updating for the new icon controls.
