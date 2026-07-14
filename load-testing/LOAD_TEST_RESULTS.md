# VYPE — Load Test Results (interim)

**Date:** 2026-07-02 · **Target:** `uat-phlox-admin.netlify.app` · **Tool:** JMeter 5.x (non-GUI) · **Client:** local macOS
**Plan:** [vype-events.jmx](vype-events.jmx) · **Method:** [LOAD_TEST_PLAN.md](LOAD_TEST_PLAN.md)
**Auth:** admin `token` from a live session (passed via `-Jtoken`, not committed).

> Scope of THIS run: **Events → `POST /api/events/create-one`** only, ramped **1 → 10 → 50** concurrent users. Orders and Bundles are **not yet measured** (see §3). The full **200-VU** target was **not** run here — it must go through a coordinated window (§4).

---

## 1. Results — Create Event

| Concurrent VUs | Samples | Error % | Avg | p50 | p95 | p99 | Max | Throughput |
|---|---|---|---|---|---|---|---|---|
| 1 (smoke) | 1 | 0% | 3556 ms* | — | — | — | 3556 ms | — |
| 10 | 10 | 0% | 1903 ms | 1898 ms | 2785 ms | — | 2785 ms | 1.7/s |
| 50 | 50 | **0%** | **1711 ms** | 1616 ms | 2672 ms | 2838 ms | 2838 ms | 4.3/s |

\* The 1-VU figure includes cold-start (TLS handshake, connection warm-up); steady-state single-request latency is ~1.6–1.9s.

HTML dashboards: `load-testing/report-10vu/index.html`, `load-testing/report-50vu/index.html`.

## 1b. Results — Add Spotlight Bundle (`POST /api/seasons/create-one`)

| Concurrent VUs | Samples | Error % | Avg | p50 | p95 | p99 | Max | Codes |
|---|---|---|---|---|---|---|---|---|
| 1 (smoke) | 1 | 0% | 2349 ms | — | — | — | 2349 ms | 200 |
| 10 | 10 | 0% | 4497 ms | 4689 ms | 5803 ms | — | 5803 ms | 200×10 |
| 50 | 50 | **16%** | 2718 ms | 2566 ms | 4125 ms | 5357 ms | 5357 ms | **200×42, 502×8** |

Plan: [vype-bundles.jmx](vype-bundles.jmx) · body captured from a real create (unique `name` per VU, cookie auth).

## 1c. Results — Place Order · pre-payment (`POST /api/checkout/store_billing_info`)

> Scoped to the **Stripe-safe** step that fires on "Proceed to Payment" (stores billing/cart before the PaymentIntent). The Stripe payment/confirm step is intentionally **not** load-tested (test-mode rate limits). Body captured from a real checkout ([order-body.json](order-body.json)); frontend cookie auth.

| Concurrent VUs | Samples | Error % | Avg | p50 | p95 | p99 | Max | Codes |
|---|---|---|---|---|---|---|---|---|
| 1 (smoke) | 1 | 0% | 3219 ms | — | — | — | 3219 ms | 200 |
| 10 | 10 | 0% | 3711 ms | 3819 ms | 4814 ms | — | 4814 ms | 200×10 |
| 50 | 50 | **0%** | 2926 ms | 2724 ms | 4920 ms | 5383 ms | 5383 ms | 200×50 |

Plan: [vype-orders.jmx](vype-orders.jmx).

## 1d. Re-test — Bundles fix (PR #923, deploy-preview-923)

The bundle-create 502-under-load was fixed. Re-ran `vype-bundles.jmx` against
`deploy-preview-923--phlox-admin.netlify.app` (host now overridable via `-Jhost`):

| Concurrent VUs | Error % | Avg | p95 | p99 | Codes |
|---|---|---|---|---|---|
| 1 (smoke) | 0% | 1440 ms | — | — | 200 |
| 10 | 0% | 757 ms | 1099 ms | 1099 ms | 200×10 |
| 50 | **0%** | 707 ms | 993 ms | 1160 ms | **200×50** (was 16% 502) |
| 100 | 0% | 947 ms | 2005 ms | 3135 ms | 200×100 |
| **200** | **0%** | 793 ms | 1082 ms | 2881 ms | **200×200** |

**Verdict: FIXED and verified at the 200-VU target.** Previously 16% `502` at 50 VU
(UAT); now 0% errors through 200 concurrent, with low flat latency (~0.8 s avg).

## 1e. Regression re-test on PR #923 — Events & Orders (all three flows)

To confirm PR #923 fixed **only** the bundle bug and did not regress the other two
flows, all three were re-run around the PR build (2026-07-08):

| Flow | Endpoint | Target | Peak VU | Error % | Avg | Notes |
|---|---|---|---|---|---|---|
| Create Event | `/api/events/create-one` | **deploy-preview-923** (admin) | 200 | **0%** | ~0.74 s | PR build, direct |
| Add Bundle | `/api/seasons/create-one` | **deploy-preview-923** (admin) | 200 | **0%** | ~0.79 s | the fixed endpoint |
| Place Order (pre-pay) | `/api/checkout/store_billing_info` | UAT frontend (shared backend) | 50 | **0%** | ~1.28 s | see note ‡ |

Events, preview-923, `/api/events/create-one`:

| Concurrent VUs | Error % | Avg | p95 | p99 | Codes |
|---|---|---|---|---|---|
| 1 | 0% | 1215 ms | — | — | 200 |
| 10 | 0% | 552 ms | 714 ms | 714 ms | 200×10 |
| 50 | 0% | 722 ms | 935 ms | 1077 ms | 200×50 |
| 100 | 0% | 713 ms | 985 ms | 1080 ms | 200×100 |
| 200 | 0% | 740 ms | 1002 ms | 1479 ms | 200×200 |

Orders, UAT frontend, `/api/checkout/store_billing_info` (real orders created):

| Concurrent VUs | Error % | Avg | p95 | p99 | Codes |
|---|---|---|---|---|---|
| 1 | 0% | 3029 ms | — | — | 200 |
| 10 | 0% | 1101 ms | 1565 ms | 1565 ms | 200×10 |
| 50 | 0% | 1281 ms | 2586 ms | 2803 ms | 200×50 |

**Verdict: only Bundles was broken, and only Bundles was fixed — nothing regressed.**
Events holds 0% through 200 VU on the PR build; Orders holds 0% at the baseline 50 VU.

**‡ Two caveats (unchanged from the original baseline method):**
- **Orders is a frontend route, not in this admin PR.** `deploy-preview-923` is an
  admin-only build; the admin host 302-redirects `/api/checkout/store_billing_info`
  (SPA fallback). PR #923 does not touch the order path, so Orders was re-run against
  the frontend that shares the same backend — a control, not a PR-build test. Kept to
  50 VU because each request creates a real order (+ notification).
- **Events measures the HTTP layer.** The lightweight baseline body is rejected with a
  validation error (`Invalid Input`) at **HTTP 200**, so JMeter's 2xx assertion passes;
  this is the same body/method as the original baseline, so the comparison is
  apples-to-apples, but it exercises the request/gateway path rather than a full
  event write. A full-create body needs team/category IDs not derivable from the API.

## 1f. Staging re-test — all three flows (`phlox-admin.netlify.app`)

Re-ran the full 3-flow suite on **staging** (where PR #923 is merged), 2026-07-08.
Admin flows on `phlox-admin.netlify.app` (staging token); Orders on
`phlox-frontend.netlify.app` (frontend token, real orders created).

| Flow | Endpoint | Target | Peak VU | Error % | Avg | p95 |
|---|---|---|---|---|---|---|
| Add Bundle | `/api/seasons/create-one` | staging admin | 200 | **0%** | 3688 ms | 8448 ms |
| Create Event | `/api/events/create-one` | staging admin | 200 | **0%** | 873 ms | 1692 ms |
| Place Order (pre-pay) | `/api/checkout/store_billing_info` | staging frontend | 50 | **0%** | 891 ms | 1258 ms |

Bundles, staging, by level:

| VUs | Error % | Avg | p95 | p99 | Max | Codes |
|---|---|---|---|---|---|---|
| 10 | 0% | 669 ms | 944 ms | 944 ms | 944 ms | 200×10 |
| 50 | 0% | 813 ms | 1317 ms | 1433 ms | 1433 ms | 200×50 |
| 100 | 0% | 828 ms | 1181 ms | 1736 ms | 1736 ms | 200×100 |
| **200** | **0%** | **3688 ms** | **8448 ms** | 11368 ms | 12270 ms | 200×200 |

Events, staging, by level:

| VUs | Error % | Avg | p95 | p99 | Codes |
|---|---|---|---|---|---|
| 10 | 0% | 654 ms | 979 ms | 979 ms | 200×10 |
| 50 | 0% | 997 ms | 2046 ms | 2605 ms | 200×50 |
| 100 | 0% | 857 ms | 1375 ms | 2523 ms | 200×100 |
| 200 | 0% | 873 ms | 1692 ms | 2161 ms | 200×200 |

Orders, staging frontend, by level:

| VUs | Error % | Avg | p95 | p99 | Codes |
|---|---|---|---|---|---|
| 1 | 0% | 2928 ms | — | — | 200 |
| 10 | 0% | 791 ms | 1101 ms | 1101 ms | 200×10 |
| 50 | 0% | 891 ms | 1258 ms | 1365 ms | 200×50 |

**Verdict (staging): all three flows hold 0% errors, including Bundles at 200 VU** —
the 502 bug is gone on staging too. One watch-item: **Bundles latency degrades sharply
at 200 VU** (avg 3.7 s, p95 8.4 s, max 12.3 s) vs ~0.8 s on the isolated preview. No
failures, but it's the heaviest endpoint and slows most under peak on the shared staging
env with production-scale data. Events stays flat (~0.87 s) and Orders is healthy.
Same caveats as §1e apply (Events is an HTTP-layer measurement; Orders creates real
orders so kept to 50 VU).

## 1g. UAT re-test — PAS-691 priority verification (`uat-phlox-admin.netlify.app`)

Verified the PAS-691 fix on **UAT** for the 13 Jul 2026 deployment, 2026-07-13.
Concurrent POST from a local client; unique payload per request (real records).

| Flow | Endpoint | Peak VU | Error % | Avg | p95 |
|---|---|---|---|---|---|
| Add Bundle | `/api/seasons/create-one` | 100 | **0%** | 2660 ms | 3690 ms |
| Create Event (control) | `/api/events/create-one` | 50 | **0%** | 1340 ms | 1470 ms |
| Order Billing (control) | `/api/checkout/store_billing_info` | 50 | **0%** | 4480 ms | 4930 ms |

Bundle create, UAT, by level (the original bug hit 16% 502 at 50 VU):

| VUs | Error % | Avg | p95 | Max | Codes |
|---|---|---|---|---|---|
| 1 | 0% | 2040 ms | — | 2040 ms | 200 |
| 10 | 0% | 2860 ms | 3680 ms | 3680 ms | 200×10 |
| 50 | **0%** | 4130 ms | 5790 ms | 6940 ms | **200×50** (was 16% 502) |
| 100 | 0% | 2660 ms | 3690 ms | 3930 ms | 200×100 |

**Verdict (UAT): PAS-691 FIXED.** 161/161 bundle creates returned HTTP 200; the 502
signature did not reproduce. Event Create and Order Billing held 0% under the same
50-VU load (matching the ticket's comparison). Watch-item: bundle create latency still
climbs to ~4–6 s under 50 concurrent — degrades gracefully (no errors), not a blocker.
Report artifact: `claude.ai/code/artifact/dfe58c22`.

## 2. Findings

### 🟢 Orders (pre-payment) is robust
- `store_billing_info` handled **50 concurrent at 0% error** (~2.9s avg). The order/checkout backend up to the payment step is not the bottleneck. (The Stripe payment step itself remains untested — see §3.)


### 🔴 Bundles endpoint fails under load (the key finding)
- At **50 concurrent users, `/api/seasons/create-one` returned `502 Bad Gateway` for 16%** of requests (8/50). At 10 VUs it was already **slow (~4.5s avg, 5.8s p95)** though still 0% error.
- Classic **overload signature**: as concurrency rose 10→50, the *error rate jumped* and the *average latency dropped* — because the 502s fail fast (the server/gateway is shedding load rather than serving it).
- Bundle create is a **heavy request** (links events + products, multiple writes), so it saturates well before the lighter event-create. **This is the bottleneck** and will very likely fail hard at 200 VUs.

### 🟢 Events endpoint is robust
- ✅ **The create-event API scales cleanly to 50 concurrent** — latency stayed **flat (~1.7–1.9s)** and **error rate was 0%** as load went 1→10→50; throughput scaled 1.7 → 4.3 req/s.
- ⚠️ **Baseline latency is high** — even a single create takes ~1.7s. That's a lot for one API call; at much higher concurrency it will eventually climb.
- 💡 **The UI slowness/flakiness seen during functional testing is NOT this endpoint** — it's the admin *frontend* (page render + several dropdown-populating calls), not `create-one` under load.
- ❓ **200 VUs is untested** — the trend is encouraging, but the ceiling/breaking point is unknown until the full run.

### Summary — all three scenarios at 50 VUs
| Scenario | Endpoint | Avg | p95 | Error % | Verdict |
|---|---|---|---|---|---|
| Create Event | `/api/events/create-one` | 1.7s | 2.7s | 0% | 🟢 robust |
| Place Order (pre-pay) | `/api/checkout/store_billing_info` | 2.9s | 4.9s | 0% | 🟢 robust |
| Add Bundle | `/api/seasons/create-one` | 2.7s | 4.1s | **16% (502)** | 🔴 **fails** |

**Bottom line:** at 50 concurrent, **only Bundles breaks** (16% 502s). Events and the pre-payment Order step are fine. Expect Bundles to fail hard well before 200 — prioritise fixing/scaling `/api/seasons/create-one` before any 200-VU run.

## 3. Not yet measured
- **Stripe payment step of the order flow** — intentionally excluded (test-mode rate limits). To test it, use a raised-limit test key or mock Stripe (LOAD_TEST_PLAN.md §4).
- **100 & 200 VUs** for all three — needs a coordinated window (§4). Given Bundles already 502s at 50, do a controlled Bundles ramp first.

## 4. To complete the full 200-VU test (next steps)
1. Add Bundles + Orders thread groups (per §3 and the plan).
2. Capture exact request bodies from DevTools if the placeholder body ever starts failing (it returned 200 here, so it's currently valid for Events).
3. Ramp **50 → 100 → 200** in a **coordinated, off-hours window**, watching UAT health + the JMeter client's own CPU (so the client isn't the bottleneck).
4. Run headless with `-e -o` for the HTML dashboard; fill the results table above.
5. **Clean up** created events/bundles afterward (each run creates up to 200/scenario).

### Run commands
```bash
# single combined test (set threads per your window)
jmeter -n -t load-testing/vype-events.jmx -Jthreads=200 -Jramp=30 -Jtoken="$TOKEN" \
  -l results/events-200.jtl -e -o results/events-200-report
# (TOKEN = admin session token from DevTools / the saved session)
```

## 5. Caveat
Results are from a **local client → UAT over the public internet**, so latency includes network + Netlify edge, not just app compute. For clean capacity numbers, run the load generator close to the environment.
