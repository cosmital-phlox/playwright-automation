const { test, expect } = require('@playwright/test');

// These tests exercise the login flow itself, so they must start logged out —
// override the saved session applied by the project config.
test.use({ storageState: { cookies: [], origins: [] } });

test('Invalid email validation', async ({ page }) => {
  await page.goto('https://uat-phlox-frontend.netlify.app/');

  await page.getByText('Login').nth(1).click();

  await page.getByRole('textbox').fill('raj');

  await page.getByRole('button', { name: 'Login' }).click();

  await expect(
    page.getByText('Please enter a valid email')
  ).toBeVisible();
});

// Skipped by default: this requests a fresh OTP every run, and the backend
// rate-limits repeated requests (the verification screen then never appears).
// To run it on demand: npx playwright test -g "OTP screen opens" --headed
test.skip('OTP screen opens for valid email', async ({ page }) => {
  await page.goto('https://uat-phlox-frontend.netlify.app/');

  await page.getByText('Login').nth(1).click();

  await page.getByRole('textbox').fill('raj.pal@hnrtech.com');

  await page.getByRole('button', { name: 'Login' }).click();

  await expect(
    page.getByText('Enter Verification Code')
  ).toBeVisible();
   // Stop here and enter OTP manually
  await page.pause();

});
// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
