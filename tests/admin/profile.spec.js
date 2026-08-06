const { test, expect } = require('@playwright/test');

// PAS-696 — Profile setup. Runs under the `admin` project (UAT admin session).
// The avatar dropdown now opens a real Profile page (previously "coming soon").
// Manual matrix: NEW_TICKETS_TEST_CASES.md §1 (PROF-01 … PROF-06).

const BASE = 'https://uat-phlox-admin.netlify.app';

// Opens the header user-menu (name + role, top-right) and clicks Profile.
async function openProfileFromMenu(page) {
  await page.goto(`${BASE}/events/vype-sideline`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const trigger = page.locator('div.cursor-pointer.select-none').filter({ hasText: /Admin|Photographer/i }).first();
  await trigger.click();
  await page.getByText('Profile', { exact: false }).first().click();
  await expect(page).toHaveURL(/\/profile/, { timeout: 20000 });
}

// Puts the page into edit mode and returns once fields are editable.
async function enterEditMode(page) {
  await page.getByRole('button', { name: /^edit$/i }).first().click();
  await expect(page.locator('#firstName')).toBeEnabled({ timeout: 10000 });
}

test.describe('PAS-696 — Profile', () => {
  test('PROF-01 Profile opens from the avatar menu (not "coming soon")', async ({ page }) => {
    await openProfileFromMenu(page);
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Basic' })).toBeVisible();
  });

  test.describe('on the profile page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#firstName')).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(1000);
    });

    test('PROF-02 shows the logged-in user\'s details', async ({ page }) => {
      // Sections render
      for (const h of ['Basic', "Photographer's Details", 'Admin Account']) {
        await expect(page.getByRole('heading', { name: h })).toBeVisible();
      }
      // Identity fields are populated for the current user
      await expect(page.locator('#firstName')).toHaveValue(/.+/);
      await expect(page.locator('#lastName')).toHaveValue(/.+/);
      await expect(page.locator('#email')).toHaveValue(/@/);
      await expect(page.locator('#phone')).toHaveValue(/.+/);
    });

    test('PROF-03 Edit enables fields, Save persists a change on reopen', async ({ page }) => {
      const original = await page.locator('#shortNote').inputValue();
      const marker = 'DK-qa';

      await enterEditMode(page);
      await expect(page.getByRole('button', { name: /^save/i })).toBeVisible();
      await page.locator('#shortNote').fill(marker);
      await page.getByRole('button', { name: /^save/i }).first().click();
      await page.waitForTimeout(2500);

      // Reopen and confirm the change stuck
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#shortNote')).toHaveValue(marker, { timeout: 20000 });

      // Restore the original value so the run is side-effect free
      await enterEditMode(page);
      await page.locator('#shortNote').fill(original);
      await page.getByRole('button', { name: /^save/i }).first().click();
      await page.waitForTimeout(2000);
    });

    test('PROF-04 required-field validation blocks save', async ({ page }) => {
      await enterEditMode(page);
      await page.locator('#firstName').fill('');
      await page.getByRole('button', { name: /^save/i }).first().click();
      await expect(page.getByText(/please enter a first name/i).first()).toBeVisible({ timeout: 8000 });
    });

    test('PROF-06 Email is not editable even in edit mode (identity field)', async ({ page }) => {
      await enterEditMode(page);
      // firstName is editable, but email stays locked
      await expect(page.locator('#email')).toBeDisabled();
    });

    // PROF-05 Change password — no change-password flow exists on this page
    // (verified during authoring). Password is managed elsewhere; tracked as
    // out of scope for the Profile page in NEW_TICKETS_TEST_CASES.md §1.
    test.skip('PROF-05 change password from profile', async () => {});
  });
});
