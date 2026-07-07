# VYPE — Load Test Plan (JMeter)

**Goal:** simulate **200 concurrent users** each on three flows — **create Event**, **place Order**, **add Spotlight Bundle** — running simultaneously, and measure whether the backend holds up.
**Target:** UAT — `uat-phlox-admin.netlify.app` (admin APIs) + `uat-phlox-frontend.netlify.app` (order flow).
**Tool:** Apache JMeter 5.x (Java 11+).

> ⚠️ **Read the Safety section first.** UAT is a shared, rate-limited environment that — as observed during test authoring — is slow/flaky even for a single user. A 600-concurrent-op blast will very likely degrade or take it down for everyone. Run only in a **coordinated, off-hours window**, ideally against a dedicated load environment, never ad-hoc on shared UAT.

---

## 1. Prerequisites

```bash
# macOS
brew install jmeter            # pulls a JDK
jmeter --version               # verify
```

You also need, captured once from a logged-in browser session (DevTools → Network):
- **Admin auth** for Events/Bundles: the `token` cookie (or `Authorization: Bearer …` header) from an admin login on `uat-phlox-admin.netlify.app`.
- **Customer auth** for Orders: the token from a logged-in customer on `uat-phlox-frontend.netlify.app`.
- The **exact request bodies** (see §3) — copy each as *cURL* from the Network tab of a real create/order/bundle action.

---

## 2. Test model

| Scenario | Thread group | Threads (VUs) | Ramp-up | Loops | Endpoint (observed) |
|---|---|---|---|---|---|
| Create Event | TG-Events | 200 | 30 s | 1 (or duration) | `POST /api/events/create-one` (preceded by `POST /api/events/clash-events`) |
| Place Order | TG-Orders | 200 | 30 s | 1 | Customer checkout flow (multi-step + **Stripe**) — see §4 |
| Add Bundle | TG-Bundles | 200 | 30 s | 1 | `POST /api/seasons` |

- **All three thread groups run in the same test plan** so the 600 ops overlap (true simultaneous load).
- **Ramp-up 30 s** (not 0) so JMeter can actually spawn 200 threads/group without the *client* becoming the bottleneck. For a hard spike test, drop ramp-up toward 0 and use a Synchronizing Timer.
- Start small: **10 → 50 → 100 → 200** VUs per group in successive runs to find the breaking point rather than only testing the ceiling.

---

## 3. Building the plan in JMeter

Fastest reliable path is the **HTTP(S) Test Script Recorder** (record the real browser actions, then parameterize), or build manually:

**Per thread group:**
1. **Thread Group** → Number of Threads = 200, Ramp-Up = 30, Loop Count = 1.
2. **HTTP Request Defaults** → Server Name = `uat-phlox-admin.netlify.app`, Protocol = `https`.
3. **HTTP Header Manager** → `Content-Type: application/json`, `Authorization: Bearer ${AUTH_TOKEN}` **or** a **Cookie Manager** carrying the `token` cookie (match whatever the app uses — capture from DevTools).
4. **HTTP Request** sampler → method `POST`, path per §2, Body Data = the JSON payload with **unique values per VU** (see below).
5. **Response Assertion** → response code `200`/`201`; add a JSON assertion on the created id if desired.

**Unique data per virtual user** (avoid duplicate-name / clash rejections):
- Use JMeter functions in the body, e.g. `"name": "QA LT ${__threadNum}-${__time()}"`.
- For Events, the photographer **schedule-conflict** will reject same-slot creates — vary the date/time per VU (`${__timeShift(...)}`) or expect a high 4xx rate and measure that separately.
- Alternatively drive values from a **CSV Data Set Config** (pre-generated teams/dates/emails).

**Payload placeholders (fill from a real captured request):**
```jsonc
// POST /api/events/create-one   (capture exact shape via DevTools → copy as cURL)
{ "competitionType": "...", "subCategory": ..., "level": ..., "date": "...", "times": [...], "title": "QA LT ${__threadNum}-${__time()}", ... }

// POST /api/seasons  (bundle)
{ "team": ..., "sports": ..., "level": ..., "seasonPassName": "QA LT ${__threadNum}", ... }
```

---

## 4. The Order scenario (special handling)

The customer order/checkout is **not a single API call** — it's cart → billing → **Stripe PaymentIntent** → confirm. Scripting this at 200 VUs has two problems:
1. **Stripe test-mode rate limits** — concurrent PaymentIntents will 429, which is a *Stripe* limit, not your backend's.
2. Multi-step correlation (extract PaymentIntent client secret, etc.) is fragile under load.

**Recommended options (pick one):**
- **(a) Scope to pre-payment:** load-test up to *order creation / billing submit* and stub/skip the Stripe confirm step — measures *your* backend, not Stripe.
- **(b) Mock Stripe** or use a dedicated Stripe test key with raised limits.
- **(c) Lower VU count** for Orders (e.g. 50) while Events/Bundles run at 200.

Document which option you use — it changes what the Order numbers mean.

---

## 5. Metrics & pass/fail thresholds

Add these **Listeners** (or run headless and generate the HTML dashboard):
- **Aggregate Report** (per-sampler: count, avg, median, p90/p95/p99, min/max, error %, throughput/s).
- **Summary Report**, **Response Times Over Time**, **Active Threads Over Time**.

Run headless + dashboard (preferred for the report):
```bash
jmeter -n -t load-testing/vype-load-test.jmx -l results/run.jtl -e -o results/html-report
# open results/html-report/index.html
```

**Suggested thresholds (tune to your SLA):**
| Metric | Target |
|---|---|
| Error rate (5xx / timeouts) | < 1% |
| p95 latency (create/order/bundle) | < 3 s |
| p99 latency | < 8 s |
| Throughput | stable, no collapse as VUs ramp |
| No sustained 5xx / connection resets | ✅ |

Distinguish **client-side** issues (JMeter machine CPU/RAM saturated → not the server) from **server-side** (5xx, resets, latency cliff). Watch the JMeter machine's CPU during the run.

---

## 6. Safety, coordination & cleanup

- **Coordinate**: announce the window; run off-hours; have someone watching UAT dashboards/logs.
- **Kill switch**: be ready to stop the run (Ctrl-C / stop-all) if error rate spikes or UAT stops responding for real users.
- **Data cleanup**: this creates up to ~600 events/orders/bundles per run. Plan deletion (API bulk delete or DB cleanup) or run against a disposable dataset.
- **Blast radius**: prefer a **dedicated/isolated environment** over shared UAT. If it must be UAT, start at low VUs and ramp.
- **Stripe**: use test mode; expect/segment 429s.

---

## 7. Results template (fill after the run)

```
Run: <date/time, window>   Target: <env>   Tool: JMeter <ver>   Client machine: <cpu/ram>

Scenario     VUs  Requests  Error%  Avg   p95    p99    Throughput/s   Notes
Events       200  ____      ____    ____  ____   ____   ____           <clash 4xx?>
Orders       ___  ____      ____    ____  ____   ____   ____           <Stripe option a/b/c>
Bundles      200  ____      ____    ____  ____   ____   ____
--------------------------------------------------------------------------------
Findings: <latency cliff at N VUs? 5xx? resets? which endpoint broke first?>
Bottleneck: <server / db / stripe / client>
Recommendation: <capacity, scaling, rate-limit needs>
```

---

## 8. Status / next steps
- This plan is **ready to configure**; the exact request bodies + auth token must be captured from a live logged-in session (§1, §3) — UAT was too flaky during authoring to auto-capture them.
- Recommended sequence: install JMeter → capture payloads/token → build/record the `.jmx` → **smoke run (5–10 VUs)** to validate → ramp **50 → 100 → 200** in a coordinated window → generate the HTML dashboard → fill §7.
