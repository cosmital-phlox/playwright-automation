const { test, expect } = require('@playwright/test');

test('account dropdown -> spotlights -> contact support', async ({ page }) => {
  // Already logged in via saved session (see auth.setup.js).
  // The account dropdown's "Spotlight" option leads here; navigate directly
  // (the dropdown is a hover/mobile menu that doesn't automate reliably).
  await page.goto('https://uat-phlox-frontend.netlify.app/spotlights');

  await expect(page.getByRole('heading', { name: 'My Spotlights' })).toBeVisible({ timeout: 20000 });

  // Spotlights load slowly — wait for the first "Contact support" action.
  const contactSupport = page.getByText('Contact support').first();
  await expect(contactSupport).toBeVisible({ timeout: 25000 });

  // "Contact support" opens the contact page in a new browser tab.
  const [tab] = await Promise.all([
    page.context().waitForEvent('page'),
    contactSupport.click(),
  ]);
  await tab.waitForLoadState();
  await expect(tab).toHaveURL(/phloxphoto\.com\/contact-us/);
  await expect(tab.getByRole('button', { name: 'Send message' })).toBeVisible({ timeout: 20000 });
});

// Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
test.afterEach(async ({ page }) => {
  const ms = Number(process.env.DEMO_PAUSE || 0);
  if (ms) await page.waitForTimeout(ms);
});
