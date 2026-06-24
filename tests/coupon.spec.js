const { test, expect } = require('@playwright/test');
const { openFirstEvent } = require('./helpers');

// TODO: replace with a real, working coupon code that produces a discount.
const COUPON = 'Flat50';

test('Apply a coupon code and see the discount', async ({ page }) => {
  // Already logged in via saved session (see auth.setup.js).
  // First add a product so the cart has something to discount.
  // Opens the first event, reloading if the events list is empty/slow.
  await openFirstEvent(page);

  await page.getByText('Spotlight Gallery - Standard Resolution').click();
  const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  await expect(addToCart).toBeEnabled();
  await addToCart.click();

  // Go to the cart and wait until it fully loads (the product line renders
  // a moment after the page; entering the coupon before that wipes the field).
  await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  ).toBeVisible();

  // Enter the coupon code — the Apply button is disabled until text is entered.
  await page.getByRole('textbox', { name: 'Enter coupon code' }).fill(COUPON);
  const applyButton = page.getByRole('button', { name: 'Apply' });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  // The coupon is applied: the Discount line now shows a reduction
  // (a negative dollar amount instead of $0.00).
  await expect(page.getByRole('heading', { name: /^- \$\d/ })).toBeVisible();
});

// Negative: an invalid coupon shows an error and applies no discount.
test('Invalid coupon shows an error and no discount', async ({ page }) => {
  await openFirstEvent(page);
  await page.getByText('Spotlight Gallery - Standard Resolution').click();
  const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  await expect(addToCart).toBeEnabled();
  await addToCart.click();

  await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  ).toBeVisible();

  await page.getByRole('textbox', { name: 'Enter coupon code' }).fill('NOTREAL999');
  await page.getByRole('button', { name: 'Apply' }).click();

  // Error message appears and there is no discount (no negative amount).
  await expect(page.getByText(/Invalid or Expired coupon/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^- \$\d/ })).toHaveCount(0);
});

// Documents a product gap: once a coupon is applied there is NO way to remove it
// (the coupon card only has the input + Apply + a success notice — no remove
// control, unlike the gift card). This test will fail if a remove control is
// ever added, prompting us to write the real "remove coupon" test.
test('Applied coupon has no remove control (known gap)', async ({ page }) => {
  await openFirstEvent(page);
  await page.getByText('Spotlight Gallery - Standard Resolution').click();
  const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  await expect(addToCart).toBeEnabled();
  await addToCart.click();

  await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  ).toBeVisible();

  await page.getByRole('textbox', { name: 'Enter coupon code' }).fill('Flat50');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('heading', { name: /^- \$\d/ })).toBeVisible(); // discount applied

  // The coupon card (.couponBox + notification) offers no remove control.
  const couponCard = page.locator('.card', { hasText: 'Do you have coupon code?' });
  await expect(couponCard.getByText(/remove/i)).toHaveCount(0);
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
