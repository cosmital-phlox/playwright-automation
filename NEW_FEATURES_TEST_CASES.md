# UAT — New-Feature Test Cases (13 Jul 2026 deployment gaps)

**Environment:** UAT — https://uat-phlox-admin.netlify.app · **Scope:** Admin
**Purpose:** Cover the scenarios/modules from the 13 Jul deployment (PAS tickets) and new scenarios **not** already in the existing specs (`tests/admin/*.spec.js`).
**Auth:** UAT admin (`dhaval.kukadia@hnrtech.com`, holds `roles.manage` etc.). Cases marked **[non-admin]** need a role-scoped login and can't run as this account.

**Priority key:** P1 critical · P2 high · P3 medium/low.

---

## Coverage status (what already exists vs. this doc)

| Module / feature | Existing spec | This doc adds |
|---|---|---|
| Events, Bundles, Orders, Users, Orgs, School Districts, Products, Coupons, Categories, Levels, Gift Cards, Payouts, Reports, Zenfolio, Roles, Media Day, SOW | ✅ list/CRUD/filter/validation | — |
| **Sales Analysis** (PAS-686) | ❌ none | §1 |
| **Quick-create SOW/Media Day modal** (PAS-680) | ❌ | §2 |
| **Media Day Status filter + Clear All** (PAS-703) | ❌ | §3 |
| **"Edit Vype Media Day" rename + field reorder** (PAS-701) | ❌ | §4 |
| **"Browse & Buy" → "Zenfolio" title** (PAS-705) | ❌ | §5 |
| **SOW contract-file upload styling** (PAS-707) | ❌ | §6 |
| **Staff confirmation workflow/modal** (PAS-633) | ❌ | §7 |
| **Staff-scoped payout/comp visibility** (PAS-692) | ❌ | §8 [non-admin] |
| **Org import — duplicate NCES** (new bug) | partial (CSV parse only) | §9 |
| **Event detail view** (Tracker / Gallery / deliverables) | ❌ | §10 |

---

## 1 · Sales Analysis (PAS-686)

Present on the event detail (`/events/view-event/:id`) and expected for Vype Sideline, Media Day, and SOW.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| SA-01 | Sales Analysis section renders on an event | P1 | Open a Sideline event detail | A "Sales Analysis" section shows Sales and Payout breakdowns |
| SA-02 | Sales breakdown lines | P2 | Inspect the Sales column | Rows: Pre-order sales, Offline sales, Zenfolio B&B, Zenfolio Spotlights, **Total sales** (sum correct) |
| SA-03 | Payout breakdown lines | P2 | Inspect the Payout column | Platform fee + per-staff compensation rows + **Total payout** (sum correct) |
| SA-04 | Totals reconcile | P2 | Compare figures | Total sales = Σ sales rows; Total payout = Σ payout rows |
| SA-05 | Sales Analysis on a Media Day | P2 | Open a Media Day detail | Sales Analysis renders with the same structure |
| SA-06 | Sales Analysis on a SOW | P2 | Open a SOW detail | Sales Analysis renders |
| SA-07 | Zero-sales event | P3 | Open an event with no orders | Section renders with $0 totals, no error |

---

## 2 · Quick-create SOW / Media Day modal (PAS-680)

"Link or create a SOW or Media Day using only basic details, without leaving the current form."

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| QC-01 | Quick-create entry point exists | P1 | On the relevant form (event/Media Day), find the quick-create/link control | A "+ Create / Link" opens a modal without leaving the current form |
| QC-02 | Create with basic details only | P1 | Open modal → fill only the required basic fields → Save | Record is created and auto-linked; modal closes; parent form retains its state |
| QC-03 | Link an existing SOW/Media Day | P2 | Open modal → search/select an existing record → Link | The existing record is linked; no duplicate created |
| QC-04 | Validation in the modal | P2 | Save with required fields blank | Inline validation; modal stays open; nothing created |
| QC-05 | Cancel discards | P2 | Open modal → enter data → Cancel | Modal closes; nothing created; parent form unchanged |
| QC-06 | Parent form not lost | P1 | Enter parent-form data → quick-create → return | Parent-form entries are preserved after the modal closes |

---

## 3 · Media Day Status filter + Clear All (PAS-703)

Verified present on UAT (Status filter + Clear All alongside Teams/Levels filters).

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| MDF-01 | Status filter present | P1 | Events → Vype Media Days tab | A **Status** filter shows next to existing filters (Teams, Levels) |
| MDF-02 | Status options | P2 | Open Status filter | Offers the expected statuses (e.g. Published / Draft / Unfulfilled etc.) |
| MDF-03 | Applying Status filters the list | P1 | Select a status | List narrows to Media Days of that status |
| MDF-04 | Works with existing filters | P2 | Apply Status + Team/Level together | Combined filtering applies (AND) |
| MDF-05 | Clear All resets | P1 | Apply filters → Clear All | All filters (incl. Status) reset; full list returns |

---

## 4 · "Edit Vype Media Day" rename + field reorder (PAS-701)

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| MDR-01 | Edit heading renamed | P1 | Open a Media Day in edit | Heading/breadcrumb reads **"Edit Vype Media Day"** (not "Edit Media Day") |
| MDR-02 | School District below Organization | P1 | Inspect the form field order | **School District** field appears **below** the Organization field |
| MDR-03 | Reorder doesn't break save | P2 | Edit + save after reorder | Values save correctly in the new layout |

---

## 5 · Page title "Browse & Buy" → "Zenfolio" (PAS-705)

> ⚠️ **On UAT this appears NOT applied** — `/browse-and-buy` still shows document title **"Phlox Admin | Browse & Buy"** and the sidebar label "Browse and Buy". Confirm the fix reached UAT.

| ID | Title | Pri | Steps | Expected | Current (UAT) |
|---|---|---|---|---|---|
| ZN-01 | Page title says Zenfolio | P2 | Open the module | Tab/page title reads **"Zenfolio"** | ❌ still "Browse & Buy" |
| ZN-02 | Heading says Zenfolio | P2 | Inspect the page heading | Heading reads "Zenfolio" | ❌ still "Browse & Buy" |
| ZN-03 | Sidebar label (if in scope) | P3 | Check the sidebar item | Consistent naming with the module rename | still "Browse and Buy" |

---

## 6 · SOW contract-file upload styling (PAS-707)

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| SOWF-01 | Upload a contract file | P1 | Add/Edit SOW → upload a contract file → Save | File uploads successfully |
| SOWF-02 | Styled file, not raw URL | P1 | Reopen the SOW | The uploaded file shows with proper file styling (name/icon/link), **not** a raw file URL string |
| SOWF-03 | Replace the file | P2 | Upload a different file | New file replaces the old; styling preserved |
| SOWF-04 | Remove the file | P3 | Remove the uploaded file | File is cleared; no broken/raw URL remnant |

---

## 7 · Staff confirmation workflow / modal (PAS-633)

Media Day staff confirmation-status tracking, resend flow, payout-eligibility.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| SC-01 | Confirmation status visible | P1 | Open a Media Day with assigned staff | Each staff shows a confirmation status (Pending / Confirmed / Rejected) |
| SC-02 | Confirmation modal opens | P2 | Trigger the confirmation modal | Modal shows staff + confirm/reject actions |
| SC-03 | Resend confirmation | P2 | Use the resend action on a pending staff | Resend fires (request succeeds); UI acknowledges |
| SC-04 | Payout eligibility tied to confirmation | P2 | Compare confirmed vs unconfirmed staff | Payout eligibility reflects confirmation state |
| SC-05 | Status persists | P2 | Reload after a status change | Confirmation status persists |

---

## 8 · Staff-scoped payout/comp visibility (PAS-692) — [non-admin]

> Requires logging in as a **staff/non-admin** user. Cannot be verified as Admin (sees full data). Route to the app-repo `test:rbac` suite or manual QA.

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| PS-01 | Admin sees full payout/comp | P1 | As Admin, view an event's payout/comp | Full payout, compensation, and amount details visible |
| PS-02 | Staff sees limited, self-scoped data | P1 [non-admin] | As staff, view the same event | Only the staff's **own** compensation; other payees' amounts hidden |
| PS-03 | Staff cannot see platform fee / totals | P2 [non-admin] | As staff, inspect Sales Analysis/payout | Platform fee and other staff amounts are not exposed |

---

## 9 · Organizations import — duplicate NCES (bug scenario)

> Related bug filed: import creates duplicate orgs for existing NCES (see `RBAC_BUG_REPORT.md` / bug ticket). Product confirmed **NCES must be unique**.

| ID | Title | Pri | Steps | Expected | Current (UAT) |
|---|---|---|---|---|---|
| ORGN-01 | Import a new NCES | P1 | Import a CSV row with a brand-new NCES | Org created; appears in list | ✅ works |
| ORGN-02 | Import a duplicate NCES | P1 | Import a CSV row with an NCES already in the system | Row is **skipped or updated**, and the duplicate is **reported** to the user | ❌ **creates a duplicate org, silently (HTTP 200, no warning)** |
| ORGN-03 | Mixed file (new + duplicate) | P2 | Import a file with some new + some duplicate NCES | New rows import; duplicates flagged/skipped; summary shown | ❌ all imported, no summary |
| ORGN-04 | Import result summary | P2 | After any import | A summary shows counts of created / skipped / errored rows | ❌ no summary/feedback |
| ORGN-05 | Manual Add — duplicate NCES | P2 | Add Organization form with an existing NCES | Blocked with a "NCES already exists" message | ❓ needs verification (duplicates already exist in data) |

---

## 10 · Event detail view — Tracker / Gallery / deliverables (`/events/view-event/:id`)

| ID | Title | Pri | Steps | Expected |
|---|---|---|---|---|
| EV-01 | Detail view opens | P1 | Events → row → view icon | Read-only detail at `/events/view-event/:id` renders |
| EV-02 | Status: Weblink + Zenfolio folder | P2 | Inspect Status section | Weblink (frontend URL) + Zenfolio folder shown |
| EV-03 | Tracker section | P1 | Inspect Tracker | Event status, order status (n/m fulfilled), image count, Browse & Buy Gallery status |
| EV-04 | Gallery / deliverables | P1 | Inspect Gallery (Add Gallery) | Zenfolio gallery deliverable listed with its URL/link |
| EV-05 | Two URL-upload entry points | P2 | Edit the event | Both **Zenfolio B&B** and **Zenfolio Spotlights** URL fields present (deliverables + tracker uploads) |
| EV-06 | Professionals + payout | P2 | Inspect Professionals/Payout | Assigned professional(s), confirmation status, rate, payout balance |

---

## Automation status (`tests/admin/new-features.spec.js`)

Automated and **passing on UAT** (12 tests):
- §1 Sales Analysis (SA-01) + §10 event detail (EV-02/03/04) — verified present.
- §3 Media Day Status filter + Clear All (MDF-01) — verified present.
- §4 "Edit Vype Media Day" rename (MDR-01) — **verified** (breadcrumb + VYPE Media Day type).
- §7 Staff confirmation (SC-01) — **verified** (Staff section has a Confirmation column with status badge, e.g. "Email Sent").
- §2 Quick-create (QC-01/QC-05) — **verified**: SOW form → "Create Media Day" modal (Title/School-Org/Location/Date/Gender/Levels/Sports) + "Link"; Media Day form → SOW field with "Create new" (QC-03).
- §6 SOW contract-file upload (SOWF-01/02) — **verified fixed**: uploaded file shows a styled filename, no raw URL.
- §5 Zenfolio rename (ZN-01) — **`test.fixme` (NOT applied on UAT)**; ZN-01b characterizes the current "Browse & Buy" title.

Not automated here:
- §8 (PAS-692) staff-scoped visibility + staff-login enforcement — need **role-scoped non-admin credentials** (route to app-repo `test:rbac` or manual QA).
- §9 org duplicate-NCES import — covered by the standalone bug ticket + repro (creating orgs each run is avoided in the committed suite).
- Deeper QC/SC flows (actually creating via quick-create, resend confirmation) — left manual to avoid test-data creation; entry points are automated.

## Findings
- 🔴 **PAS-705 not applied on UAT** — module page still titled "Browse & Buy" (should be "Zenfolio").
- 🟠 **Org import allows duplicate NCES** silently (separate bug ticket).
