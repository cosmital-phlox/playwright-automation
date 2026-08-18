const { test, expect } = require('@playwright/test');

// SLA / API-latency scripts for the optimization tickets. `admin` project (UAT).
// Measures server think-time (TTFB) from the Resource Timing API after each page load.
// Hard assert: the endpoint responded. Soft assert: median TTFB < 1s (known regressions
// will surface as soft failures — that is the honest, documented result).
const B = 'https://uat-phlox-admin.netlify.app';
const SLA = 1000; // ms

// Navigate, then read TTFB (responseStart - requestStart) for URLs matching `needle`.
async function ttfb(page, path, needle, waitMs = 7000) {
  await page.goto(`${B}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(waitMs);
  const samples = await page.evaluate((needle) => {
    return performance.getEntriesByType('resource')
      .filter((e) => e.name.includes(needle))
      .map((e) => Math.round(e.responseStart - e.requestStart))
      .filter((n) => n >= 0);
  }, needle);
  return samples;
}
const median = (a) => { if (!a.length) return null; const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };

async function checkEndpoint(page, ticket, path, needle) {
  const s = await ttfb(page, path, needle);
  const m = median(s);
  console.log(`${ticket}  ${needle}  samples=${JSON.stringify(s)}  median=${m}ms  ${m!==null?(m<SLA?'<1s OK':'OVER 1s'):'no-sample'}`);
  expect(m, `${needle} must have been called/measured`).not.toBeNull();
  expect.soft(m, `${needle} SLA <1s`).toBeLessThan(SLA);
}

test('PAS-667  Admin Seasons API < 1s', async ({ page }) => {
  test.setTimeout(60000);
  await checkEndpoint(page, 'PAS-667', '/bundles', 'seasons/get-all');
});
test('PAS-668 / PAS-708  Admin Orders APIs < 1s', async ({ page }) => {
  test.setTimeout(60000);
  await checkEndpoint(page, 'PAS-668', '/orders', 'orders/get-all');
});
test('PAS-669  Reporting / Settlements / Payouts v2 < 1s', async ({ page }) => {
  test.setTimeout(70000);
  await checkEndpoint(page, 'PAS-669', '/payout', 'v2/payouts');
});
test('PAS-670  Admin Events API < 1s', async ({ page }) => {
  test.setTimeout(60000);
  await checkEndpoint(page, 'PAS-670', '/events/vype-sideline', 'v3/events');
});
test('PAS-671 / PAS-721  Admin Zenfolio APIs < 1s', async ({ page }) => {
  test.setTimeout(70000);
  await checkEndpoint(page, 'PAS-671', '/browse-and-buy', 'zenfolio/orders');
});
test('PAS-672  CRUD Users API < 1s', async ({ page }) => {
  test.setTimeout(60000);
  await checkEndpoint(page, 'PAS-672', '/users', 'users/get-all');
});
test('PAS-672  CRUD Levels API < 1s', async ({ page }) => {
  test.setTimeout(60000);
  await checkEndpoint(page, 'PAS-672', '/levels', 'levels/get-all');
});
test('PAS-672  CRUD Organizations API < 1s', async ({ page }) => {
  test.setTimeout(60000);
  await checkEndpoint(page, 'PAS-672', '/organizations', 'organizations/get-all');
});
