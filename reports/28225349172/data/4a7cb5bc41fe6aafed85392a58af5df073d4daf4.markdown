# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend/navigation.spec.js >> Spotlight Bundles page loads its content
- Location: tests/frontend/navigation.spec.js:49:1

# Error details

```
TimeoutError: page.goto: Timeout 60000ms exceeded.
Call log:
  - navigating to "https://uat-phlox-frontend.netlify.app/bundles", waiting until "load"

```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | const FUTURE_EVENTS_URL = 'https://uat-phlox-frontend.netlify.app/events-bundles';
  4   | 
  5   | // Start on the Future Events page with the nav ready.
  6   | async function gotoFutureEvents(page) {
  7   |   await page.goto(FUTURE_EVENTS_URL);
  8   |   await expect(
  9   |     page.getByRole('navigation').getByRole('link', { name: 'Future Events' }).first()
  10  |   ).toBeVisible({ timeout: 20000 });
  11  | }
  12  | 
  13  | // A visible nav link by its exact name.
  14  | function navLink(page, name) {
  15  |   return page.getByRole('navigation').getByRole('link', { name, exact: true }).first();
  16  | }
  17  | 
  18  | test('Future Events -> Spotlight Bundles', async ({ page }) => {
  19  |   await gotoFutureEvents(page);
  20  |   await navLink(page, 'Spotlight Bundles').click();
  21  |   await expect(page).toHaveURL(/\/bundles/);
  22  | });
  23  | 
  24  | test('Future Events -> Past Events', async ({ page }) => {
  25  |   await gotoFutureEvents(page);
  26  |   await navLink(page, 'Past Events').click();
  27  |   await expect(page).toHaveURL(/search_type=Past\+events/);
  28  | });
  29  | 
  30  | test('Logo navigates to home', async ({ page }) => {
  31  |   await gotoFutureEvents(page);
  32  |   await page.getByRole('navigation').getByRole('link', { name: 'ratio image' }).first().click();
  33  |   await expect(page).toHaveURL(/phlox-frontend\.netlify\.app\/?$/);
  34  | });
  35  | 
  36  | test('Cart icon navigates to the cart', async ({ page }) => {
  37  |   await gotoFutureEvents(page);
  38  |   await page.getByRole('navigation').getByRole('link', { name: /^Cart/ }).first().click();
  39  |   await expect(page).toHaveURL(/\/cart/);
  40  |   await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 15000 });
  41  | });
  42  | 
  43  | // Negative: an unknown route shows the 404 "Page not found" screen.
  44  | test('Invalid route shows a 404 page', async ({ page }) => {
  45  |   await page.goto('https://uat-phlox-frontend.netlify.app/this-page-does-not-exist-123');
  46  |   await expect(page.getByText(/Page not found/i)).toBeVisible({ timeout: 15000 });
  47  | });
  48  | 
  49  | test('Spotlight Bundles page loads its content', async ({ page }) => {
  50  |   const count = page.getByText(/\d+ Spotlight Bundle/i).first();
  51  |   // The page sometimes loads empty/slow — reload until the count appears.
  52  |   let loaded = false;
  53  |   for (let i = 0; i < 3; i++) {
> 54  |     await page.goto('https://uat-phlox-frontend.netlify.app/bundles');
      |                ^ TimeoutError: page.goto: Timeout 60000ms exceeded.
  55  |     if (await count.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)) {
  56  |       loaded = true;
  57  |       break;
  58  |     }
  59  |   }
  60  |   expect(loaded, 'spotlight bundles count should load').toBe(true);
  61  | });
  62  | 
  63  | test('Past Events page loads past events', async ({ page }) => {
  64  |   const url = 'https://uat-phlox-frontend.netlify.app/events-bundles?search_type=Past+events';
  65  |   const count = page.getByText(/\d+ Events/i).first();
  66  | 
  67  |   // The page sometimes loads empty/slow — reload until the events count appears.
  68  |   let loaded = false;
  69  |   for (let i = 0; i < 3; i++) {
  70  |     await page.goto(url);
  71  |     if (await count.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)) {
  72  |       loaded = true;
  73  |       break;
  74  |     }
  75  |   }
  76  |   expect(loaded, 'past events count should load').toBe(true);
  77  | 
  78  |   // Past events render as cards (note: unlike future events, past-event cards
  79  |   // have no "View Event Details" link).
  80  |   await expect.poll(async () => page.locator('h4').count(), { timeout: 20000 }).toBeGreaterThan(2);
  81  | });
  82  | 
  83  | test('Browser back and forward navigation', async ({ page }) => {
  84  |   await page.goto('https://uat-phlox-frontend.netlify.app/events-bundles');
  85  |   await expect(page).toHaveURL(/events-bundles/);
  86  |   await page.goto('https://uat-phlox-frontend.netlify.app/bundles');
  87  |   await expect(page).toHaveURL(/\/bundles/);
  88  | 
  89  |   await page.goBack();
  90  |   await expect(page).toHaveURL(/events-bundles/);
  91  |   await page.goForward();
  92  |   await expect(page).toHaveURL(/\/bundles/);
  93  | });
  94  | 
  95  | test('Mobile hamburger opens the nav menu', async ({ page }) => {
  96  |   await page.setViewportSize({ width: 390, height: 844 });
  97  |   await page.goto('https://uat-phlox-frontend.netlify.app/events-bundles');
  98  | 
  99  |   const burger = page.locator('.navbar-burger').first();
  100 |   await expect(burger).toBeVisible({ timeout: 20000 });
  101 |   await burger.click();
  102 | 
  103 |   // The menu opens, revealing the nav links.
  104 |   await expect(
  105 |     page.getByRole('link', { name: 'Future Events' }).filter({ visible: true }).first()
  106 |   ).toBeVisible();
  107 | });
  108 | 
  109 | test('Nav -> FAQ (external page)', async ({ page }) => {
  110 |   await gotoFutureEvents(page);
  111 |   await navLink(page, 'FAQ').click();
  112 |   await expect(page).toHaveURL(/phloxphoto\.com\/faqs/, { timeout: 30000 });
  113 | });
  114 | 
  115 | test('Nav -> Contact Us (external page)', async ({ page }) => {
  116 |   await gotoFutureEvents(page);
  117 |   await navLink(page, 'Contact Us').click();
  118 |   await expect(page).toHaveURL(/phloxphoto\.com\/contact-us/, { timeout: 30000 });
  119 | });
  120 | 
  121 | // The About menu is a Bulma/Vue hover dropdown: hovering renders its items into
  122 | // the DOM, but they stay CSS-hidden so they can't be clicked headlessly. We
  123 | // hover to reveal them and assert they route to the correct pages (href).
  124 | function aboutMenu(page) {
  125 |   return page
  126 |     .locator('.navbar-item.has-dropdown.is-hoverable:not(.mobile-menu)')
  127 |     .filter({ hasText: 'About' });
  128 | }
  129 | 
  130 | // The About dropdown opens on CLICK under automation. The page content can
  131 | // overlap the nav and intercept pointer events, so force the toggle click,
  132 | // then return the requested menu item once it's rendered.
  133 | async function openAboutItem(page, name) {
  134 |   await page.waitForLoadState('networkidle').catch(() => {});
  135 |   await page.evaluate(() => window.scrollTo(0, 0));
  136 |   const about = aboutMenu(page);
  137 |   await about.locator('a.navbar-link').click({ force: true });
  138 |   const item = about.getByText(name, { exact: true });
  139 |   await expect(item).toBeVisible({ timeout: 10000 });
  140 |   return item;
  141 | }
  142 | 
  143 | // We verify the dropdown opens and its items route to the correct pages (href).
  144 | // The actual cross-site navigation click is too flaky here (a page-content
  145 | // overlay intercepts it), and the href is the meaningful routing assertion.
  146 | test('Nav -> About -> Photographers routes correctly', async ({ page }) => {
  147 |   await gotoFutureEvents(page);
  148 |   const photographers = await openAboutItem(page, 'Photographers');
  149 |   await expect(photographers).toHaveAttribute('href', /phloxphoto\.com\/about/);
  150 | });
  151 | 
  152 | test('Nav -> About -> Services routes correctly', async ({ page }) => {
  153 |   await gotoFutureEvents(page);
  154 |   const services = await openAboutItem(page, 'Services');
```