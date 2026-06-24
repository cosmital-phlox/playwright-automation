const { test, expect } = require('@playwright/test');
const { openFirstEvent, selectComboByIndex, reachBillingWithTeam } = require('./helpers');

// Reaching a team-bearing event (skipping polluted leading events) plus the
// billing flow can exceed the default 120s — give this file more headroom.
test.describe.configure({ timeout: 180000 });

test('Fill billing details and proceed to checkout', async ({ page }) => {
  // Already logged in via saved session (see auth.setup.js).
  // Add a product and reach the billing page on an event that has teams.
  await reachBillingWithTeam(page);

  // --- Billing Details (field names are distinct from the player section) ---
  await page.getByRole('textbox', { name: 'First Name', exact: true }).fill('John');
  await page.getByRole('textbox', { name: 'Last Name', exact: true }).fill('Doe');
  await page.getByRole('textbox', { name: 'E.g. 67061 Eugenia Streets' }).fill('123 Main Street');
  await page.getByRole('textbox', { name: 'Town/City' }).fill('Austin');
  await selectComboByIndex(page, 'State *');
  await page.getByRole('textbox', { name: 'E.g. 50613' }).fill('78701');
  await page.getByRole('textbox', { name: 'Your 10 digit phone number' }).fill('1234567890');
  await page.getByRole('textbox', { name: 'Your email address' }).fill('raj.pal@hnrtech.com');

  // --- Player Details ---
  await page.getByRole('textbox', { name: 'First name of player' }).fill('Mike');
  await page.getByRole('textbox', { name: 'Last Name of player' }).fill('Smith');
  await selectComboByIndex(page, 'What is the name of your team ? *');
  await selectComboByIndex(page, 'Graduation year *');

  // Form is complete: the "Proceed to Payment" button should be ready.
  // (We stop here rather than submitting, to avoid creating a real order.)
  await expect(page.getByRole('button', { name: 'Proceed to Payment' })).toBeEnabled();
});

test('Billing details shows validation errors when empty', async ({ page }) => {
  // Already logged in via saved session (see auth.setup.js).
  // Add a product and reach the billing page without filling anything.
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

  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await expect(page).toHaveURL(/billingDetails/);

  // Submit with empty fields to trigger validation.
  await page.getByRole('button', { name: 'Proceed to Payment' }).click();

  // Required-field errors appear (using unique messages so billing vs. player
  // "first name" errors don't both match the same text).
  await expect(page.getByText('Street address is required')).toBeVisible();
  await expect(page.getByText('Town/City is required')).toBeVisible();
  await expect(page.getByText('Zip code is required')).toBeVisible();
  await expect(page.getByText('Phone number is required')).toBeVisible();
  await expect(page.getByText('team name is required')).toBeVisible();
  await expect(page.getByText('graduation year is required')).toBeVisible();

  // Validation blocked submission — we're still on the billing page.
  await expect(page).toHaveURL(/billingDetails/);
});

// Negative: malformed email / phone are rejected with format-specific errors.
test('Billing details rejects invalid email and phone formats', async ({ page }) => {
  await reachBillingWithTeam(page);

  // Fill everything validly EXCEPT a malformed email and a too-short phone.
  await page.getByRole('textbox', { name: 'First Name', exact: true }).fill('John');
  await page.getByRole('textbox', { name: 'Last Name', exact: true }).fill('Doe');
  await page.getByRole('textbox', { name: 'E.g. 67061 Eugenia Streets' }).fill('123 Main Street');
  await page.getByRole('textbox', { name: 'Town/City' }).fill('Austin');
  await selectComboByIndex(page, 'State *');
  await page.getByRole('textbox', { name: 'E.g. 50613' }).fill('abc'); // bad zip
  await page.getByRole('textbox', { name: 'Your 10 digit phone number' }).fill('abc12');
  await page.getByRole('textbox', { name: 'Your email address' }).fill('notanemail');
  await page.getByRole('textbox', { name: 'First name of player' }).fill('Mike');
  await page.getByRole('textbox', { name: 'Last Name of player' }).fill('Smith');
  await selectComboByIndex(page, 'What is the name of your team ? *');
  await selectComboByIndex(page, 'Graduation year *');

  await page.getByRole('button', { name: 'Proceed to Payment' }).click();

  // Format-specific errors and submission is blocked.
  await expect(page.getByText(/this must be a valid email/i)).toBeVisible();
  await expect(page.getByText(/Phone number is too short/i)).toBeVisible();
  await expect(page.getByText(/Zip code should be 5 digits/i)).toBeVisible();
  await expect(page).toHaveURL(/billingDetails/);
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
