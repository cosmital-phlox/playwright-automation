const { test, expect } = require('@playwright/test');
const { openFirstEvent, openEventByIndex } = require('./helpers');

const CART_URL = 'https://uat-phlox-frontend.netlify.app/cart';

test('Add a single product to cart', async ({ page }) => {
  // Already logged in via saved session (see auth.setup.js).
  // Opens the first event, reloading if the events list is empty/slow.
  await openFirstEvent(page);

  // Select a product under "Choose Product" — this enables the Add to Cart button.
  await page.getByText('Spotlight Gallery - Standard Resolution').click();

  // The button is disabled until a product is selected.
  const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  await expect(addToCart).toBeEnabled();
  await addToCart.click();

  // A confirmation toast appears after adding.
  await expect(page.getByText('1 product added to cart', { exact: true })).toBeVisible();

  // Open the cart and confirm the product is there.
  await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  ).toBeVisible();
});

// Negative: the "Add to Cart" button stays disabled until a product is chosen.
test('Add to Cart is disabled before selecting a product', async ({ page }) => {
  await openFirstEvent(page);
  // Wait for the product section to render (the event-detail page loads slowly),
  // then assert the button is present but disabled before any selection.
  await expect(
    page.getByText('Spotlight Gallery - Standard Resolution')
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeDisabled();
});

// Adds a product and lands on the cart with its line item visible.
async function addProductAndOpenCart(page, productName = 'Spotlight Gallery - Standard Resolution') {
  await openFirstEvent(page);
  await page.getByText(productName).click();
  const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  await expect(addToCart).toBeEnabled();
  await addToCart.click();
  await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  await expect(page.getByRole('heading', { name: productName }).first()).toBeVisible();
}

test('Cart badge shows a count after adding a product', async ({ page }) => {
  await addProductAndOpenCart(page);
  // The nav cart link shows a positive item count, e.g. "Cart 1".
  await expect(page.getByRole('link', { name: /Cart\s*[1-9]/ }).first()).toBeVisible();
});

test('Remove the only item empties the cart', async ({ page }) => {
  await addProductAndOpenCart(page);

  // Remove the line item (the cart-item remove control is an h4.removeProduct).
  await page.locator('h4.removeProduct').first().click();

  // The cart now shows the empty state.
  await expect(page.getByText('Your cart is empty !')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to Events' })).toBeVisible();
});

test('Add a High Resolution product to cart', async ({ page }) => {
  await addProductAndOpenCart(page, 'Spotlight Gallery - High Resolution');
  // The high-resolution product is the one in the cart.
  await expect(
    page.getByRole('heading', { name: 'Spotlight Gallery - High Resolution' }).first()
  ).toBeVisible();
});

// Empties the cart by removing every line item (cart persists per account).
async function emptyCart(page) {
  await page.goto(CART_URL);
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 20000 });
  for (let i = 0; i < 15 && (await page.locator('h4.removeProduct').count()) > 0; i++) {
    await page.locator('h4.removeProduct').first().click();
    await page.waitForTimeout(1200);
  }
  await expect(page.getByText('Your cart is empty !')).toBeVisible({ timeout: 10000 });
}

test('Cart reflects multiple products', async ({ page }) => {
  // Start from an empty cart so the count is deterministic.
  await emptyCart(page);

  // Add the same product from two different events -> two distinct line items.
  for (const idx of [0, 1]) {
    await openEventByIndex(page, idx);
    await page.getByText('Spotlight Gallery - Standard Resolution').click();
    const addToCart = page.getByRole('button', { name: 'Add to Cart' });
    await expect(addToCart).toBeEnabled();
    await addToCart.click();
    await expect(page.getByText('1 product added to cart', { exact: true })).toBeVisible();
  }

  // The cart shows two items and the nav badge reads 2.
  await page.goto(CART_URL);
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  await expect(page.locator('h4.removeProduct')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Cart\s*2/ }).first()).toBeVisible();
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
