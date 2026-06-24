const { test, expect } = require('@playwright/test');
const { selectComboByIndex, reachBillingWithTeam } = require('./helpers');

// These flows are long: reaching a team-bearing event + Stripe processing can
// exceed the default 120s, especially the first test (which discovers the good
// event). Give the whole file more headroom.
test.describe.configure({ timeout: 180000 });

// Fills billing + player details and opens the payment modal.
async function reachPaymentModal(page) {
  // Reach the billing page on an event that actually has teams.
  await reachBillingWithTeam(page);

  // Billing Details
  await page.getByRole('textbox', { name: 'First Name', exact: true }).fill('John');
  await page.getByRole('textbox', { name: 'Last Name', exact: true }).fill('Doe');
  await page.getByRole('textbox', { name: 'E.g. 67061 Eugenia Streets' }).fill('123 Main Street');
  await page.getByRole('textbox', { name: 'Town/City' }).fill('Austin');
  await selectComboByIndex(page, 'State *');
  await page.getByRole('textbox', { name: 'E.g. 50613' }).fill('78701');
  await page.getByRole('textbox', { name: 'Your 10 digit phone number' }).fill('1234567890');
  await page.getByRole('textbox', { name: 'Your email address' }).fill('raj.pal@hnrtech.com');

  // Player Details
  await page.getByRole('textbox', { name: 'First name of player' }).fill('Mike');
  await page.getByRole('textbox', { name: 'Last Name of player' }).fill('Smith');
  await selectComboByIndex(page, 'What is the name of your team ? *');
  await selectComboByIndex(page, 'Graduation year *');

  await page.getByRole('button', { name: 'Proceed to Payment' }).click();
}

test('Pay with a card', async ({ page }) => {
  await reachPaymentModal(page);

  // Fill the Stripe card fields (test mode — 4242 card charges nothing).
  const stripe = page.frameLocator('iframe[title="Secure payment input frame"]');
  await stripe.getByPlaceholder('1234 1234 1234 1234').fill('4242 4242 4242 4242');
  await stripe.getByPlaceholder('MM / YY').fill('12 / 34');
  await stripe.getByPlaceholder('CVC').fill('123');

  await page.getByRole('button', { name: /^Pay \$/ }).click();

  // Payment succeeds and we land on the order confirmation page.
  // (Stripe processing + redirect can take several seconds.)
  await expect(page).toHaveURL(/orderStatus.*redirect_status=succeeded/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Your order is confirmed' })).toBeVisible();
  await expect(page.getByText(/Order Number: #\d+/)).toBeVisible();
  await expect(page.getByText(/Thank you for placing an order/)).toBeVisible();

  // The confirmation page offers two actions.
  await expect(page.getByRole('button', { name: 'Go to Home Page' })).toBeVisible();
  const viewReceipt = page.getByRole('link', { name: 'View Receipt' }).first();
  await expect(viewReceipt).toBeVisible();

  // "View Receipt" opens the receipt in a new browser tab.
  const [receiptTab] = await Promise.all([
    page.context().waitForEvent('page'),
    viewReceipt.click(),
  ]);
  await receiptTab.waitForLoadState();
  await expect(receiptTab).toHaveURL(/orderReceipt/);

  // The receipt tab has a "Print Receipt" button (SPA — give it time to render).
  await expect(receiptTab.getByRole('button', { name: 'Print Receipt' })).toBeVisible({
    timeout: 15000,
  });
});

// Negative: a declined card (Stripe test card 4000...0002) does NOT create an
// order — the payment is rejected and we stay on the billing page.
test('Declined card does not complete the order', async ({ page }) => {
  await reachPaymentModal(page);

  const stripe = page.frameLocator('iframe[title="Secure payment input frame"]');
  await stripe.getByPlaceholder('1234 1234 1234 1234').fill('4000 0000 0000 0002'); // always declined
  await stripe.getByPlaceholder('MM / YY').fill('12 / 34');
  await stripe.getByPlaceholder('CVC').fill('123');

  await page.getByRole('button', { name: /^Pay \$/ }).click();

  // Give Stripe time to process and reject, then confirm no order was placed.
  await page.waitForTimeout(8000);
  await expect(page).toHaveURL(/billingDetails/);
  await expect(page.getByRole('heading', { name: 'Your order is confirmed' })).toHaveCount(0);
});

// Other Stripe test cards that fail server-side. Each should surface its error
// in the payment element and leave the order uncreated.
const FAILING_CARDS = [
  { name: 'insufficient funds', number: '4000 0000 0000 9995', error: /insufficient funds/i },
  { name: 'expired card', number: '4000 0000 0000 0069', error: /expired/i },
  { name: 'incorrect CVC', number: '4000 0000 0000 0127', error: /security code is (incorrect|invalid)/i },
];

for (const card of FAILING_CARDS) {
  test(`Payment fails with ${card.name}`, async ({ page }) => {
    await reachPaymentModal(page);

    const stripe = page.frameLocator('iframe[title="Secure payment input frame"]');
    await stripe.getByPlaceholder('1234 1234 1234 1234').fill(card.number);
    await stripe.getByPlaceholder('MM / YY').fill('12 / 34');
    await stripe.getByPlaceholder('CVC').fill('123');
    await page.getByRole('button', { name: /^Pay \$/ }).click();

    // The payment element shows the specific error and no order is created.
    await expect(stripe.getByText(card.error)).toBeVisible({ timeout: 25000 });
    await expect(page).toHaveURL(/billingDetails/);
    await expect(page.getByRole('heading', { name: 'Your order is confirmed' })).toHaveCount(0);
  });
}

// Clicking Pay with empty card fields does not place an order — Stripe's own
// validation blocks submission, so we stay on the billing page.
test('Payment with empty card fields is rejected', async ({ page }) => {
  await reachPaymentModal(page);
  await page.getByRole('button', { name: /^Pay \$/ }).click();

  await page.waitForTimeout(5000);
  await expect(page).toHaveURL(/billingDetails/);
  await expect(page.getByRole('heading', { name: 'Your order is confirmed' })).toHaveCount(0);
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
