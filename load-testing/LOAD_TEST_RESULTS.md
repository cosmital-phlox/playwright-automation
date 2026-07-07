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
