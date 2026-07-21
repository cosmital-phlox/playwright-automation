# API Optimization — Round 2 audit (UAT)

**Goal:** re-audit admin APIs after the first optimization pass (PAS-667…674, 708) and report **every endpoint still taking > 1s** — split into *previously-optimized-but-still-slow*, *left to optimize*, and *newly-added*.

**Environment:** UAT — `uat-phlox-admin.netlify.app` · **Date:** 21 Jul 2026
**Method:** each endpoint hit 5× warm; **server think-time = TTFB** (time-to-first-byte, excludes connection setup); `total` = TTFB + response download. Client → UAT over the internet, so TTFB includes ~1 network hop to the Netlify edge (~0.1–0.2s) — the true server time is slightly lower, but the over-SLA endpoints are clearly over even after that.
**Scope:** 33 endpoints discovered by crawling every admin page/form/detail. SLA target: **< 1s**.

---

## 🔴 Over SLA — need optimization (TTFB ≥ 1.0s)

| Endpoint | TTFB (server) | Total | Prior ticket | Category |
|---|---|---|---|---|
| `GET /api/zenfolio/get-all` | **1.97s** | 3.72s | PAS-671 | ⬅️ **previously optimized — still slowest** |
| `GET /api/v3/orders/filters` | **1.49s** | 1.83s | (v3) | 🆕 newly-added filter endpoint |
| `GET /api/events/get-one/:id` | **1.43s** | 1.43s | PAS-670* | left out — detail (`get-one`), not the optimized list |
| `GET /api/events/get-one-event-galleries/:id` | **1.37s** | 1.37s | PAS-670/671* | left out — event-detail gallery sub-call |
| `GET /api/v2/settlements` | **1.11s** | 1.55s | PAS-669 | ⬅️ **previously optimized — still over** |
| `GET /api/media-days/get-form-options` | **1.03s** | 1.53s | (Media Day) | 🆕 newer module — form options |
| `GET /api/users/get-all` | **1.02s** | 1.46s | PAS-672 | ⬅️ **previously optimized — just over** |
| `GET /api/v2/payouts?date=…` | ~1.20s | ~1.36s | PAS-669 | ⬅️ **previously optimized — still over** |

\* PAS-670 optimized the Events **list/create** path (now `/api/v3/events` ≈ 0.81s ✅); the **`get-one` detail** endpoints powering `view-event` were not in that scope and are the new slow spots.

## 🟠 Borderline (TTFB 0.85–1.0s — watch / light optimization)

| Endpoint | TTFB | Total | Prior ticket | Note |
|---|---|---|---|---|
| `GET /api/seasons/get-all` | 0.99s | **2.02s** | PAS-667 | server ~ok but **total 2s** — heavy response payload |
| `GET /api/orders/get-all` | 0.98s | 1.06s | PAS-668/708 | just under; keep an eye |

## 🟢 Within SLA (representative)

`/api/v3/events` 0.81s · `/api/organizations/get-all` 0.82s · `/api/coupon/get-all` 0.77s · `/api/v2/events/filters` 0.73s · `/api/media-days/get-all` 0.65s · `/api/school-districts/get-all` 0.61s · `/api/products/get-all` 0.58s · `/api/categories/get-all` 0.58s · `/api/sow/get-all` 0.56s · `/api/levels/get-all` 0.56s · storefront cart/checkout/auth/master all < 0.7s (PAS-673/674 ✅).

---

## Summary for the optimization ticket

**Previously optimized but STILL > 1s (regression / incomplete):**
- `zenfolio/get-all` (PAS-671) — **1.97s, worst offender**
- `v2/settlements` (PAS-669) — 1.11s
- `v2/payouts` (PAS-669) — ~1.2s
- `users/get-all` (PAS-672) — 1.02s
- `seasons/get-all` (PAS-667) — TTFB ok but **2.0s total** (payload size)

**Left to optimize (in an optimized area but not the specific endpoint):**
- `events/get-one/:id` — 1.43s (event detail)
- `events/get-one-event-galleries/:id` — 1.37s

**Newly-added, never optimized:**
- `v3/orders/filters` — 1.49s
- `media-days/get-form-options` — 1.03s

**Recommended priority:** ① Zenfolio get-all (2s) · ② v3/orders/filters (1.5s) · ③ events get-one + galleries (detail page) · ④ settlements/payouts · ⑤ users get-all · ⑥ seasons payload trimming.

**Notes:** `/api/events/get-all` (legacy) still 502s (26s timeout) but is unused by the UI — remove rather than optimize. `get-one` payout/gallery sub-calls on the event-detail page compound (several 0.6–1.4s calls load together), so the *perceived* page load is slower than any single number.

---

## Coverage (two crawl passes)

44 read endpoints across all 15 modules — lists, add/edit forms, detail/view pages, filter dropdowns, `get-form-options`, and modals (incl. the new features). The 2nd pass added 11 edit/detail (`get-one`) + `get-form-options` endpoints — **all within SLA (0.57–0.78s)** — so the over-1s list above is complete for the read/GET surface.

## Write path — create endpoints (verifies PAS-668/670 async offloading)

| Endpoint | Server (TTFB) | Note |
|---|---|---|
| `POST /api/seasons/create-one` | 0.96s | heavy multi-write (ex-502 bundle create) — **under SLA** |
| `POST /api/checkout/store_billing_info` | 0.85s | order create — under SLA |
| `POST /api/events/create-one` | 0.63s | HTTP-layer (validation-200, not full write) |

No write create exceeds 1s → async offloading (gallery/email off the request) is working.

## Exports / downloads (file generation, different class from the <1s read SLA)

| Action | End-to-end | Note |
|---|---|---|
| Organizations export (.csv) | ~2.32s | slowest export — worth trimming |
| Orders export (.xlsx) | ~1.33s | file generation |
| Payouts download (.csv) | ~0.05s | client-side, instant |
| Reports download | — | needs a date-range selection first (manual) |

**Not benchmarked:** PUT/DELETE update endpoints (similar cost to creates, which are covered as a proxy).
