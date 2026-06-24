const { test, expect } = require('@playwright/test');
const { openFirstEvent } = require('./helpers');

const GIFT_CARD = 'J9IAGME9FL';

test('Apply a gift card and see the discount', async ({ page }) => {
  // Already logged in via saved session (see auth.setup.js).
  // First add a product so the cart has something to discount.
  await openFirstEvent(page);

  await page.getByText('Spotlight Gallery - Standard Resolution').click();
  const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  await expect(addToCart).toBeEnabled();
  await addToCart.click();

  // Go to the cart and wait until it fully loads.
  await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  ).toBeVisible();

  // Open the gift card panel.
  await page.getByText('Redeem gift card').click();

  // Enter the gift card code (its field has a distinct placeholder/name).
  await page.getByRole('textbox', { name: 'Enter your gift card here' }).fill(GIFT_CARD);

  // There are two "Apply" buttons: 0 = coupon, 1 = gift card.
  const giftApply = page.getByRole('button', { name: 'Apply' }).nth(1);
  await expect(giftApply).toBeEnabled();
  await giftApply.click();

  // The gift card is applied: confirmation message shows and the gift card
  // line in the summary now shows a deduction (a negative dollar amount).
  await expect(page.getByText('Verified! Gift card has been applied.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^- \$/ })).toBeVisible();
});

// Negative: an invalid gift card shows an error and applies no deduction.
test('Invalid gift card shows an error and no deduction', async ({ page }) => {
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

  await page.getByText('Redeem gift card').click();
  await page.getByRole('textbox', { name: 'Enter your gift card here' }).fill('BADCARD000');
  await page.getByRole('button', { name: 'Apply' }).nth(1).click();

  // Error message appears and no deduction is applied.
  await expect(page.getByText(/Invalid gift card/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^- \$/ })).toHaveCount(0);
});

// Apply a valid gift card, then remove it — the deduction goes away.
test('Remove an applied gift card', async ({ page }) => {
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

  await page.getByText('Redeem gift card').click();
  await page.getByRole('textbox', { name: 'Enter your gift card here' }).fill(GIFT_CARD);
  await page.getByRole('button', { name: 'Apply' }).nth(1).click();
  await expect(page.getByRole('heading', { name: /^- \$/ })).toBeVisible();

  // Remove the gift card (its remove control is a <span>Remove</span>, unlike the
  // cart line item's <h4>). The deduction should disappear.
  await page.locator('span:text-is("Remove")').click();
  await expect(page.getByRole('heading', { name: /^- \$/ })).toHaveCount(0);
});

// A coupon and a gift card can be applied together (they stack).
test('Coupon and gift card stack together', async ({ page }) => {
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

  // Apply the coupon (50% off).
  await page.getByRole('textbox', { name: 'Enter coupon code' }).fill('Flat50');
  await page.getByRole('button', { name: 'Apply' }).nth(0).click();
  await expect(page.getByRole('heading', { name: /^- \$/ })).toBeVisible();

  // Then apply the gift card ($10 off).
  await page.getByText('Redeem gift card').click();
  await page.getByRole('textbox', { name: 'Enter your gift card here' }).fill(GIFT_CARD);
  await page.getByRole('button', { name: 'Apply' }).nth(1).click();
  await expect(page.getByText('Verified! Gift card has been applied.')).toBeVisible();

  // Both reductions show together: the coupon discount and the gift card line.
  await expect(page.getByRole('heading', { name: '- $31.50' })).toBeVisible();
  await expect(page.getByText('Gift Card: J9IAGME9FL')).toBeVisible();
  await expect(page.getByRole('heading', { name: '- $10.00' })).toBeVisible();
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
