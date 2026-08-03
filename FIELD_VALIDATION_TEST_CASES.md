# Admin — Field & Dropdown Validation Test Cases

**Environment:** UAT — `uat-phlox-admin.netlify.app` · **Scope:** Admin create/edit forms
**Goal:** thorough **positive + negative** coverage of every field and dropdown on the admin side.
**Legend:** P1 critical · P2 high · P3 low. ✅ verified · ⚠️ verified gap · 🔴 verified bug · ⬜ to execute.

---

## Cross-cutting patterns (apply to the field types below)

**Text fields**
- ✅POS: valid value saves and persists on reopen.
- ⬜NEG: **empty** (if required) → inline "required" message, no submit.
- ⬜NEG: **whitespace-only** → treated as empty; message shown (not a silent no-op).
- ⬜NEG: **special-chars-only** (`@@@###`) → rejected for name-type fields.
- ⬜NEG: **max length** (e.g. 300 chars) → capped or rejected with a message.
- ⬜NEG: **leading/trailing spaces** → trimmed, not stored raw.
- ⬜NEG: **duplicate** (unique fields: name/code/NCES/email/phone) → rejected **with a visible message** (not silent 200+error).
- ⬜NEG: XSS/script (`<script>`) → escaped/rejected, never executed.

**Number fields** (price, rate, balance, amount, discount, limit)
- ✅POS: valid positive number saves.
- ⬜NEG: **negative** → rejected with a message.
- ⬜EDGE: **zero** → defined behavior (accept or reject, with message).
- ⬜NEG: **non-numeric** (`abc`) → rejected.
- ⬜NEG: **huge** (e.g. 999999999) / too many decimals → sane cap.
- ⬜NEG: **out-of-range** (e.g. discount % > 100) → rejected.

**Format fields**
- ⬜Email → reject `notanemail`, missing `@`, spaces.
- ⬜Phone → reject letters / wrong length.
- ⬜URL (website, mapLink, contractUrl) → reject non-URL text.
- ⬜Postal/ZIP → reject letters / wrong length.

**Dropdowns / selects**
- ⬜NEG: **required dropdown left unselected** → "required" message.
- ✅POS: selecting an option applies + persists.
- ⬜Multi-select → add/remove multiple; empty when required → message.
- ⬜Dependent dropdowns (e.g. Sub-category depends on Sport/Category) → child resets when parent changes; child disabled until parent chosen.
- ⬜Search/typeahead selects (Team, Location) → filter works; no-match state.

**Date/time**
- ⬜Required date empty → message.
- ⬜End before Start (Duration/Event times/Coupon start-expiry) → rejected.
- ⬜Past date where future required (expiry) → message.

---

## 1 · Add Event (`/events/add-event`)
Fields: Event Title, Description, Individual limit, Date, Times. Dropdowns: **Event Type, Is Private, Visiting Team, Home Team, Sports, Gender, Level, Location**.
- ⬜ Event Type drives the form (Game → Visiting/Home Team; Media Day → Participating Teams). Verify fields swap correctly.
- ⬜ Required: Title, Type, teams, Sports, date/time → messages when empty.
- ⬜ Visiting Team == Home Team (same team both sides) → rejected?
- ⬜ Individual limit: negative / 0 / non-numeric.
- ⬜ Event time End < Start → rejected.
- ⬜ Schedule conflict (same teams/time) → conflict modal *(covered in events.spec)*.
- ⬜ Save-as-Draft with empty form → 🔴 known: **accepts an empty draft** (events.spec bug).

## 2 · Add Bundle (`/bundles/add-bundle`)
Fields: Season Pass Name (auto?), Description, Date, Time. Dropdowns: **Team, Sports, Level, Gender**.
- ⬜ Title auto-generated + read-only *(bundles.spec)*.
- ⬜ Required dropdowns empty → messages.
- ⬜ Save-as-Draft empty → 🔴 known: **accepts empty draft** (bundles.spec bug).
- ⬜ Products/linked-events with 0 items → allowed? price/discount negative in products grid.

## 3 · Add User (`/users/add-user`)
Fields: First/Last Name, Phone, Email, City, Website, Rate, Short Note. Dropdowns: **Role, State, Level, Compensation Type**.
- 🔴 **Duplicate phone** → server 400 + **no UI message** (users.spec bug).
- ⬜ Email format (`notanemail`) → message *(users.spec covers format)*.
- ⬜ First/Last name with numbers (`Bad123`) → rejected *(users.spec)*.
- ⬜ Duplicate email → message (verify not silent).
- ⬜ Rate: negative / non-numeric / 0.
- ⬜ Role required (multi-select) empty → message; assign multiple roles.
- ⬜ State/Level/Compensation Type required → messages.

## 4 · Add Organization (`/organizations/add-organization`)
Fields: Name, Short Name, **NCES ID**, Notes, Address, Apartment, City, Postal Code, Map Link, Phone, Website. Dropdowns: **State, School District**. Checkboxes: Team / Venue / Booster Club.
- 🔴 **Duplicate NCES** (import & likely manual) → creates duplicate / silent *(verified via import)*.
- 🔴 **Duplicate name** → server 400 + **no UI message** (organizations.spec bug).
- ⬜ Postal code + Website format → messages *(organizations.spec covers)*.
- ⬜ Phone format → letters/short.
- ⬜ Map Link non-URL → message.
- ⬜ Booster Club checked → Parent Org becomes required.
- ⬜ School District dropdown required? dependent on State?

## 5 · Add Product (`/products/add-product`)
Fields: Name, **Price**, Description. Dropdown: **Category**.
- ✅ Empty → messages ("Product Name / Category / Price").
- ⚠️ **Special-char name `@@@###` → blocked, NO message** (silent UX gap).
- ⚠️ **Negative price `-5` → blocked, NO message** (silent). *(Re-verify server side with a valid category.)*
- ⬜ Price: 0 / non-numeric / huge / many decimals.
- ⬜ Duplicate product name → message (verify not silent).
- ⬜ 300-char name → capped/rejected.

## 6 · Add Coupon (`/coupons/add-coupon`)
Fields: Coupon Code, Description, **Discount Rate**, Start/Expiry dates. Dropdowns: **Discount Type, Coupon Usage Type**.
- 🔴 **Duplicate coupon code** → server 200 + error body, **no UI** (coupons.spec bug).
- ⬜ Percentage discount **> 100** → rejected.
- ⬜ Discount negative / 0 / non-numeric.
- ⬜ Expiry **before** Start date → rejected.
- ⬜ Past expiry date → message.
- ⬜ Discount Type / Usage Type required → messages.

## 7 · Add Gift Card (`/giftcards/add-giftcard`)
Fields: Gift Card Code (auto-gen, read-only), **Balance**, Description.
- ⬜ Balance: **negative** / 0 / non-numeric / huge → rejected with message.
- ⬜ Code auto-generated + read-only *(giftcards.spec)*.
- ⬜ Empty balance → message.

## 8 · Add School District (`/school-districts/add`)
Fields: Name, District Code. Dropdowns: **State, Status**.
- ✅ Empty → "Invalid Input - District Name".
- ⬜ Duplicate district code / name → message (verify not silent).
- ⬜ Special-char / long name.
- ⬜ State / Status required → messages.
- ⬜ District linked to events cannot be deleted *(school-districts.spec)*.

## 9 · Add SOW (`/events/add-sow`)
Fields: Title, Start/End date, **Contract file (PDF/DOC/DOCX)**, Amount. Dropdowns: **School District, Status**.
- ✅ Empty → "title, start_date, end_date, and agreed_on are required".
- ✅ Contract file upload → styled filename, not raw URL (PAS-707).
- ⬜ Upload wrong file type (e.g. .exe/.png) → rejected (only PDF/DOC/DOCX).
- ⬜ End date before Start → rejected.
- ⬜ Amount: negative / non-numeric.
- ⬜ Quick-create/Link Media Day modal (PAS-680) → its own field validation.

---

## Verified findings (this audit)
| # | Area | Finding | Sev |
|---|---|---|---|
| 1 | Org import | Duplicate **NCES** creates a duplicate org, silently (HTTP 200, no warning) | 🔴 High |
| 2 | Product | Special-char name + negative price **blocked without any message** | ⚠️ Low (UX) |
| 3 | Users | Duplicate **phone** rejected silently (400 + no UI) | 🔴 Med |
| 4 | Organizations | Duplicate **name** rejected silently (400 + no UI) | 🔴 Med |
| 5 | Coupons | Duplicate **code** rejected silently (200+error, no UI) | 🔴 Med |
| 6 | Events / Bundles | **Save-as-Draft accepts a completely empty** form | 🔴 Med |

**Common theme:** several forms **reject on the server but show nothing in the UI** ("silent rejection"). The recurring recommendation: surface a visible inline/toast error for every server-side validation failure.

## Execution status
Required-field validation confirmed working (server) on Product, Coupon, School District, SOW, Organization. Create endpoints: `products/create-one`, `coupon/create-one`, `school-districts/create-one`, `sow/create-one`, `organizations/create-one`, `users/create-one`, `seasons/create-one`, `events/create-one`. Remaining negative/format/dropdown cases (⬜) execute module-by-module (each needs the form's real request body captured to drive server-side negatives, plus a UI pass for the message behavior).
