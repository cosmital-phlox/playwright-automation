const { expect } = require('@playwright/test');

const EVENTS_URL = 'https://uat-phlox-frontend.netlify.app/events-bundles';
const CART_URL = 'https://uat-phlox-frontend.netlify.app/cart';

// The live backend intermittently returns "No Results" / loads the events
// list slowly. Reload the events page until the first event link appears,
// then open it. Throws if it never populates after `attempts` reloads.
async function openFirstEvent(page, { attempts = 4, timeout = 15000 } = {}) {
  const firstEvent = page.getByRole('link', { name: /View Event Details/ }).first();

  for (let i = 0; i < attempts; i++) {
    // domcontentloaded (not full 'load') — the events page loads heavy 3rd-party
    // scripts that can stall 'load'; we wait for our own elements below instead.
    await page.goto(EVENTS_URL, { waitUntil: 'domcontentloaded' });
    try {
      await firstEvent.waitFor({ state: 'visible', timeout });
      await firstEvent.click();
      await expect(page).toHaveURL(/eventDetail/);
      return;
    } catch (err) {
      if (i === attempts - 1) throw err; // out of retries — let the test fail
      // otherwise loop and reload the events page
    }
  }
}

// Open the event at `index` in the list (reloading if the list is empty/slow).
async function openEventByIndex(page, index, { attempts = 4, timeout = 15000 } = {}) {
  const events = page.getByRole('link', { name: /View Event Details/ });
  for (let i = 0; i < attempts; i++) {
    await page.goto(EVENTS_URL, { waitUntil: 'domcontentloaded' });
    try {
      await events.first().waitFor({ state: 'visible', timeout });
      const target = events.nth(index);
      await target.waitFor({ state: 'visible', timeout: 5000 });
      await target.click();
      await expect(page).toHaveURL(/eventDetail/);
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
  }
}

// Billing-form <select>s (State, Team, Graduation year) populate their options
// asynchronously. Wait until enough options exist, then select by index, so
// selectOption doesn't run against an empty/half-loaded dropdown.
async function selectComboByIndex(page, name, index = 1) {
  const combo = page.getByRole('combobox', { name });
  await expect
    .poll(async () => combo.locator('option').count(), { timeout: 15000 })
    .toBeGreaterThan(index);
  await combo.selectOption({ index });
}

// Remove every line item from the cart (used to reset between event attempts).
async function emptyCart(page) {
  await page.goto(CART_URL, { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('heading', { name: 'Your Cart' })
    .waitFor({ state: 'visible', timeout: 20000 })
    .catch(() => {});
  for (let i = 0; i < 15 && (await page.locator('h4.removeProduct').count()) > 0; i++) {
    await page.locator('h4.removeProduct').first().click();
    await page.waitForTimeout(1200);
  }
}

// Remembers the last event index that had teams, so tests after the first don't
// re-walk the polluted leading events (e.g. "Test event Demo 90" has no team).
// Module-scoped: persists across tests within a worker (we run workers: 1).
let lastGoodEventIndex = null;

// Reach the billing-details page on an event whose team dropdown actually has
// teams. Sandbox data drifts — a published event/bundle can have no team, which
// leaves the "What is the name of your team ?" <select> with only its placeholder
// and breaks the checkout/payment flow. Try events in order (starting with the
// last-known-good one), clearing the cart between misses, until one populates the
// team list; leave the page on /billingDetails ready for the caller to fill.
// Throws if none of the first `maxEvents` events qualify (a data problem worth
// surfacing).
async function reachBillingWithTeam(page, { maxEvents = 6 } = {}) {
  // Try the cached good index first, then the rest in order.
  const order = [];
  if (lastGoodEventIndex != null) order.push(lastGoodEventIndex);
  for (let i = 0; i < maxEvents; i++) if (i !== lastGoodEventIndex) order.push(i);

  for (const i of order) {
    try {
      await openEventByIndex(page, i);
    } catch {
      continue; // this index didn't open (e.g. out of range) — try the next
    }

    // The standard product isn't on every event (some only offer High-Res) and
    // the detail page renders its product list a few seconds after load — wait
    // generously, and skip events that genuinely lack the standard product.
    const product = page.getByText('Spotlight Gallery - Standard Resolution').first();
    const hasProduct = await product
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!hasProduct) continue;
    await product.click();
    const addToCart = page.getByRole('button', { name: 'Add to Cart' });
    if (!(await addToCart.isEnabled({ timeout: 15000 }).catch(() => false))) continue;
    await addToCart.click();

    await page.goto(CART_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 25000 });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
    await expect(page).toHaveURL(/billingDetails/);

    // If the team dropdown stays at just the placeholder, this event is unusable
    // — empty the cart and try the next one.
    const team = page.getByRole('combobox', { name: 'What is the name of your team ? *' });
    const ok = await expect
      .poll(async () => team.locator('option').count(), { timeout: 12000 })
      .toBeGreaterThan(1)
      .then(() => true)
      .catch(() => false);
    if (ok) {
      lastGoodEventIndex = i; // remember it so later tests skip straight here
      return; // page is on billingDetails, caller fills the form
    }
    if (i === lastGoodEventIndex) lastGoodEventIndex = null; // cached event went bad
    await emptyCart(page);
  }
  throw new Error(`No event with a populated team dropdown in the first ${maxEvents} events`);
}

module.exports = {
  openFirstEvent,
  openEventByIndex,
  EVENTS_URL,
  CART_URL,
  selectComboByIndex,
  emptyCart,
  reachBillingWithTeam,
};
