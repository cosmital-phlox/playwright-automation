# Roles & Access — Test Cases

**Feature:** Dynamic Roles & Access Control (PAS-583)
**Environment:** UAT — https://uat-phlox-admin.netlify.app
**Scope:** Admin (Super Admin drives builder/CRUD; per-role *enforcement* noted separately in §I)
**Pages:** `/roles` (list) · `/roles/add-role` (create) · `/roles/edit-role/:id` (edit)
**Design refs:** [Figma design](https://www.figma.com/design/4MmK0UN9LVlUqlhny3VMjl/Vype-Admin-2.0?node-id=21104-50174) · [Figma interactive v2](https://www.figma.com/design/4MmK0UN9LVlUqlhny3VMjl/Vype-Admin-2.0?node-id=22119-52062)
**Auth:** Super Admin (`dhaval.kukadia@hnrtech.com`) — wildcard access

---

## Model under test

- **5 domains**, **17 resources**. Each resource has **exactly one tier** (None / View / Manage) plus **optional add-ons**.
- **None** → no access, resource hidden, add-ons locked/hidden.
- **View** → read-only.
- **Manage** → full CRUD, automatically includes View.
- **Add-ons** → opt-in, off by default, selectable **only** when tier = View or Manage.
- A **role** = the set of {tier per resource + enabled add-ons}, persisted on **Save**.

### Reference matrix (expected tiers + add-ons per resource)

| # | Domain | Resource | Tiers available | Add-ons |
|---|---|---|---|---|
| 1 | Sales & Operations | Events | None / View / Manage | Staff · Offline sales · Galleries |
| 2 | Sales & Operations | Media Days | None / View / Manage | SoW · Offline sales · Staff |
| 3 | Sales & Operations | Bundles | None / View / Manage | Linked events |
| 4 | Sales & Operations | Orders | None / View / Manage | Archive · Order status · Galleries · Upload status |
| 5 | Sales & Operations | Browse & Buy | None / View / Manage | Import |
| 6 | Catalog | Products | None / View / Manage | — |
| 7 | Catalog | Sport Categories | None / View / Manage | — |
| 8 | Catalog | Levels | None / View / Manage | — |
| 9 | Catalog | Coupons | None / View / Manage | — |
| 10 | Catalog | Giftcards | None / View / Manage | — |
| 11 | Organizations & Districts | Organizations | None / View / Manage | — |
| 12 | Organizations & Districts | School Districts | None / View / Manage | — |
| 13 | Finance | **Billing** | **None / Manage** (no View) | — |
| 14 | Finance | **Payouts** | **None / View** (no Manage) | Settle payout |
| 15 | Finance | **Reports** | **None / View** (no Manage) | Download |
| 16 | Administration | Users | None / View / Manage | Assign roles · Archive user |
| 17 | Administration | **Platform** | **None / View** (no Manage) | Reports · Communications |
| 18 | Administration | **Roles** ⚠️ | None / View / Manage | — |

> The **bold** rows are the non-standard tier sets — highest-value checks.
>
> ⚠️ **Discrepancy (found on UAT):** the builder exposes an **18th resource, "Roles"** (Administration, None/View/Manage) that is **not** in the spec's 17-resource list. Confirmed live via the automated suite. Tier button counts on UAT are **None×18, View×17, Manage×15** (View absent on Billing; Manage absent on Payouts/Reports/Platform). Confirm with product whether "Roles" is intended in the matrix.

**Priority key:** P1 = critical (blocks release) · P2 = high · P3 = medium/low.

---

## A. List page & layout

| ID | Title | Pri | Preconditions | Steps | Expected result |
|---|---|---|---|---|---|
| ROLES-A01 | Roles list loads | P1 | Logged in as Admin | Navigate to `/roles` | List renders with an **Add** button and columns: ID, Role Title, Users, Created Date, Modified Date, Actions |
| ROLES-A02 | Existing roles listed | P2 | Roles exist | Open `/roles` | System roles (Super Admin, Admin, Photographer) + custom roles appear; each row shows a user count |
| ROLES-A03 | Sort by column | P3 | ≥2 roles | Click ID / Role Title / Created Date headers | Rows re-sort ascending/descending on toggle |
| ROLES-A04 | Pagination | P3 | > 1 page of roles | Use pagination control | Navigates pages; row set updates |
| ROLES-A05 | Super Admin row protected | P1 | — | Inspect Super Admin row actions | Super Admin is **not editable and not deletable** (by design) |
| ROLES-A06 | Open builder via Add | P1 | — | Click **Add** | Navigates to `/roles/add-role` with the empty builder (all resources default to None) |

---

## B. Builder layout & structure

| ID | Title | Pri | Steps | Expected result |
|---|---|---|---|---|
| ROLES-B01 | Role name field present | P1 | Open Add Role | A required **Role name** text field is shown |
| ROLES-B02 | 5 domains render | P1 | Open Add Role | All 5 domain groups shown: Sales & Operations, Catalog, Organizations & Districts, Finance, Administration |
| ROLES-B03 | All 17 resources render | P1 | Open Add Role | Each domain lists its resources exactly per the reference matrix (17 total) |
| ROLES-B04 | Default tier is None | P1 | Open Add Role | Every resource defaults to **None**; no add-ons enabled |
| ROLES-B05 | Tier control shows correct options | P1 | Inspect each resource's tier control | Options match the matrix — standard resources show None/View/Manage; **Billing** shows None/Manage only; **Payouts, Reports, Platform** show None/View only |
| ROLES-B06 | Save button present | P1 | Open Add Role | A **Save** action is visible |

---

## C. Access tier behavior

| ID | Title | Pri | Steps | Expected result |
|---|---|---|---|---|
| ROLES-C01 | Select View | P1 | On Events, click **View** | Tier set to View; resource marked read-only; add-ons become **selectable** |
| ROLES-C02 | Select Manage | P1 | On Events, click **Manage** | Tier set to Manage; add-ons selectable; Manage implies View |
| ROLES-C03 | Manage includes View | P2 | Set Manage, then inspect | Behaviour/label confirms Manage encompasses read access (no separate View needed) |
| ROLES-C04 | Set back to None locks add-ons | P1 | Set Events=Manage, enable an add-on, set Events=None | Add-ons for Events become **locked/hidden** and are cleared/disabled |
| ROLES-C05 | Tier is single-select | P1 | Click View then Manage on same resource | Only the latest tier is active (mutually exclusive), not both |
| ROLES-C06 | Billing has no View | P1 | Inspect Billing tier control | Only **None** and **Manage** offered; there is **no View** option |
| ROLES-C07 | Payouts has no Manage | P1 | Inspect Payouts tier control | Only **None** and **View** offered; there is **no Manage** option |
| ROLES-C08 | Reports has no Manage | P1 | Inspect Reports tier control | Only **None** and **View** offered |
| ROLES-C09 | Platform has no Manage | P1 | Inspect Platform tier control | Only **None** and **View** offered |
| ROLES-C10 | Tiers independent per resource | P2 | Set Events=Manage, Orders=View, Products=None | Each resource holds its own tier independently |

---

## D. Add-on gating & toggles

| ID | Title | Pri | Steps | Expected result |
|---|---|---|---|---|
| ROLES-D01 | Add-ons locked at None | P1 | On Events (tier=None), attempt to toggle an add-on | Add-ons are **not selectable** (disabled/hidden) |
| ROLES-D02 | Add-ons unlock at View | P1 | Set Events=View | Events add-ons (Staff, Offline sales, Galleries) become selectable |
| ROLES-D03 | Add-ons unlock at Manage | P1 | Set Events=Manage | Events add-ons become selectable |
| ROLES-D04 | Add-ons default off | P1 | Set any resource to View/Manage | All its add-ons start **off** |
| ROLES-D05 | Toggle add-on on | P1 | Set Events=Manage, enable **Staff** | Staff add-on shows enabled state |
| ROLES-D06 | Toggle add-on off | P2 | Enable then disable **Staff** | Reverts to off |
| ROLES-D07 | Multiple add-ons independent | P2 | Enable Staff + Galleries, leave Offline sales off | Only the two enabled; others unaffected |
| ROLES-D08 | Resources without add-ons | P2 | Set Products / Levels / Organizations to Manage | **No add-on panel** appears (matrix: none) |
| ROLES-D09 | Add-ons cleared when tier→None | P1 | Enable add-ons, then set tier=None | Enabled add-ons are cleared and locked |

### Per-resource add-on coverage (verify the exact add-on set)

| ID | Resource | Pri | Expected add-ons (at View/Manage) |
|---|---|---|---|
| ROLES-D10 | Events | P2 | Staff, Offline sales, Galleries |
| ROLES-D11 | Media Days | P2 | SoW, Offline sales, Staff |
| ROLES-D12 | Bundles | P2 | Linked events |
| ROLES-D13 | Orders | P2 | Archive, Order status, Galleries, Upload status |
| ROLES-D14 | Browse & Buy | P2 | Import |
| ROLES-D15 | Payouts | P2 | Settle payout (only when View selected) |
| ROLES-D16 | Reports | P2 | Download (only when View selected) |
| ROLES-D17 | Users | P2 | Assign roles, Archive user |
| ROLES-D18 | Platform | P2 | Reports, Communications (only when View selected) |
| ROLES-D19 | No-add-on resources | P3 | Products, Sport Categories, Levels, Coupons, Giftcards, Organizations, School Districts, Billing → **no add-ons** |

---

## E. Row expand / collapse

| ID | Title | Pri | Steps | Expected result |
|---|---|---|---|---|
| ROLES-E01 | Expand via chevron | P2 | Click a resource's chevron/name | Add-on panel expands beneath the row |
| ROLES-E02 | Collapse | P2 | Click again | Panel collapses |
| ROLES-E03 | Expand independent of tier | P3 | Expand a resource still at None | Row expands; add-ons visible but locked (per D01) |
| ROLES-E04 | Multiple rows expandable | P3 | Expand two resources | Both stay expanded independently |

---

## F. Save & persistence

| ID | Title | Pri | Preconditions | Steps | Expected result |
|---|---|---|---|---|---|
| ROLES-F01 | Save a role | P1 | On Add Role | Enter unique name, set a few tiers + add-ons, click **Save** | Success; redirect to `/roles`; new role appears in list |
| ROLES-F02 | Tiers persist | P1 | Role saved (F01) | Open the role via Edit | Every tier is exactly as saved |
| ROLES-F03 | Add-ons persist | P1 | Role saved with add-ons | Open via Edit | Enabled add-ons still enabled; others off |
| ROLES-F04 | Non-standard tiers persist | P1 | Save role with Billing=Manage, Payouts=View+Settle, Platform=View+Reports | Reopen via Edit | Values persist correctly |
| ROLES-F05 | Reload persistence | P2 | Save + hard refresh Edit page | Reload `/roles/edit-role/:id` | State survives reload (server-persisted) |
| ROLES-F06 | Edit an existing role | P1 | A custom role exists | Change a tier + add-on, Save | Change persists on reopen |
| ROLES-F07 | Save API contract | P2 | DevTools open | Save | `POST /api/v2/roles` (create) / `PUT` (edit) returns 2xx with the role payload |

---

## G. Role CRUD

| ID | Title | Pri | Steps | Expected result |
|---|---|---|---|---|
| ROLES-G01 | Create custom role | P1 | Add Role → name + perms → Save | Role created and listed |
| ROLES-G02 | Edit role name | P1 | Edit a custom role, change name, Save | New name persists on reopen and in list |
| ROLES-G03 | Edit role permissions | P1 | Edit role, change tiers/add-ons, Save | Updated permissions persist |
| ROLES-G04 | Delete role | P1 | Click trash on a custom role | "Delete Role" confirmation modal → confirm → `DELETE /api/v2/roles/:id` → row removed |
| ROLES-G05 | Cancel delete | P2 | Open delete modal, cancel | Role retained; no delete call |
| ROLES-G06 | Delete modal centered | P3 | Open delete modal | Modal is centered, consistent with other confirm dialogs |
| ROLES-G07 | Assign role to a user | P1 | Users → Add/Edit User | Custom role appears in the role field and is assignable |
| ROLES-G08 | Assigned role persists | P1 | Assign custom role, save user, reopen | Role shown on the user; multi-role supported |

---

## H. Validation & negative cases

| ID | Title | Pri | Steps | Expected result |
|---|---|---|---|---|
| ROLES-H01 | Empty name blocked | P1 | Save with blank name | Save blocked with a **visible** "enter role name" message |
| ROLES-H02 | Spaces-only name | P2 | Name = only spaces → Save | Blocked **with a validation message** *(regression: previously failed silently)* |
| ROLES-H03 | Duplicate name | P1 | Name = an existing role → Save | Rejected with a **visible error/toast** e.g. "Role name already exists" *(regression: API 400 was silent)* |
| ROLES-H04 | Role requires ≥1 permission | P1 | Name set, all resources = None → Save | Blocked with inline message; **no zero-access role created** *(regression: was allowed)* |
| ROLES-H05 | Special-chars-only name | P3 | Name = `@@@###$$$` → Save | Rejected (invalid) *(regression: was accepted)* |
| ROLES-H06 | Max length enforced | P3 | ~200-char name → Save | Length capped/rejected with message *(regression: was accepted)* |
| ROLES-H07 | Cancel builder | P3 | In builder, use Cancel/back | Returns to list, discards unsaved changes *(check Cancel exists — previously missing)* |
| ROLES-H08 | Search roles | P3 | Use search on `/roles` | Filters list by title *(check search exists — previously missing)* |

---

## I. Enforcement (requires a non-Super-Admin login — out of Admin-builder scope)

> These verify the role actually *takes effect* for a user assigned to it. They **cannot** be run as Super Admin (wildcard). Execute with a test user per role, or via the app repo's `test:rbac` suite.

| ID | Title | Pri | Steps | Expected result |
|---|---|---|---|---|
| ROLES-I01 | None hides resource | P1 | Login as user whose role has Events=None | Events nav/route hidden; direct `/events` → 403 |
| ROLES-I02 | View is read-only | P1 | Role has Orders=View | Order list visible; create/edit/delete controls hidden or blocked (API 401/403) |
| ROLES-I03 | Manage allows CRUD | P1 | Role has Events=Manage | Create/edit/delete events all succeed |
| ROLES-I04 | Add-on gates capability | P1 | Events=Manage without "Staff" add-on | Staff management is unavailable; enabling the add-on exposes it |
| ROLES-I05 | Tier boundary — no escalation | P1 | Payouts=View | Cannot settle a payout unless "Settle payout" add-on is on |
| ROLES-I06 | Union of multiple roles | P2 | User with two roles | Effective permissions = union of both |
| ROLES-I07 | Post-login landing | P2 | User without Events access | Lands on first *permitted* module (not a 403 dead-end) |
| ROLES-I08 | Change reflects after re-login | P2 | Change a role's tier, user re-logs in | New permissions apply |

---

## Notes / assumptions
- Expected tiers/add-ons are taken from the PAS-583 spec + Figma; ROLES-B05/C06–C09 are the authoritative checks that UAT matches the spec's **non-standard** tier sets.
- Regression cases in §H reference previously-reported behaviour (see `RBAC_BUG_REPORT.md`) — re-run to confirm fixes on UAT.
- §I enforcement needs role-scoped test logins; flag any missing credentials to the team.
