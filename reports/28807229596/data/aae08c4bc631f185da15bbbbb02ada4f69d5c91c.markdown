# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin/events.spec.js >> Delete removes an event (with confirmation)
- Location: tests/admin/events.spec.js:159:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.goto: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [ref=e7]:
  - img "Vype Logo" [ref=e10]
  - generic [ref=e12]:
    - heading "Log in" [level=1] [ref=e13]
    - generic [ref=e14]:
      - generic "Email" [ref=e16]
      - textbox "Email" [ref=e20]:
        - /placeholder: Enter Your Email
    - generic [ref=e21]:
      - generic "Password" [ref=e23]
      - generic [ref=e27]:
        - textbox "Password" [ref=e28]:
          - /placeholder: Enter Your Password
        - img "eye-invisible" [ref=e30] [cursor=pointer]:
          - img [ref=e31]
    - generic [ref=e34]:
      - generic [ref=e35] [cursor=pointer]:
        - checkbox "Remember me" [checked] [ref=e37]
        - generic [ref=e39]: Remember me
      - button "Forgot your password?" [ref=e40] [cursor=pointer]:
        - generic [ref=e41]: Forgot your password?
    - button "Login" [ref=e42] [cursor=pointer]:
      - generic [ref=e43]: Login
```

# Test source

```ts
  574 | // Open the Reports list and wait for it to render.
  575 | async function gotoReports(page) {
  576 |   await gotoWithRetry(page, REPORTS_URL, page.getByText('Event profitability'));
  577 | }
  578 | 
  579 | // --- Spotlight Bundles ---
  580 | 
  581 | // Open the Bundles list and wait for it to be ready. (The "Bundles" title isn't
  582 | // a real heading; the Add button + "Showing N Bundles" count line always render.)
  583 | async function gotoBundles(page) {
  584 |   await gotoWithRetry(page, BUNDLES_URL, page.getByRole('button', { name: 'Add' }));
  585 |   await expect(page.getByRole('heading', { name: /Showing \d+ Bundles/ })).toBeVisible({
  586 |     timeout: 25000,
  587 |   });
  588 | }
  589 | 
  590 | // Open the Add Bundle form and wait for it to render.
  591 | async function gotoAddBundle(page) {
  592 |   await page.goto(ADD_BUNDLE_URL, { waitUntil: 'domcontentloaded' });
  593 |   await expect(page.getByRole('button', { name: 'Save and Publish' })).toBeVisible({
  594 |     timeout: 25000,
  595 |   });
  596 |   await page.waitForTimeout(1500);
  597 | }
  598 | 
  599 | // Fill every field required to publish a bundle: Team, Sports, Level, an
  600 | // "Accept No Orders After" Date and a Time. (Title is read-only — it auto-builds
  601 | // from Team/Level/Sport.) Returns the auto-generated title.
  602 | async function fillRequiredBundleFields(page) {
  603 |   await pickAntOption(page, 'Team', 0);
  604 |   await pickAntOption(page, 'Sports', 0);
  605 |   await pickAntOption(page, 'Level', 0);
  606 | 
  607 |   // Date: pick the last enabled day in view.
  608 |   await page.locator('#basic_date').click();
  609 |   await page.waitForTimeout(800);
  610 |   await page
  611 |     .locator('.ant-picker-cell:not(.ant-picker-cell-disabled) .ant-picker-cell-inner')
  612 |     .last()
  613 |     .click();
  614 |   await page.waitForTimeout(500);
  615 | 
  616 |   // Time: single picker — choose an hour/minute and confirm.
  617 |   await page.locator('#basic_time').click();
  618 |   await page.waitForTimeout(700);
  619 |   const col = page.locator('.ant-picker-time-panel-column');
  620 |   await col.nth(0).locator('.ant-picker-time-panel-cell-inner').nth(9).click();
  621 |   await page.waitForTimeout(300);
  622 |   await col.nth(1).locator('.ant-picker-time-panel-cell-inner').nth(0).click();
  623 |   await page.waitForTimeout(300);
  624 |   const ok = page.locator('.ant-picker-ok button');
  625 |   if (await ok.isVisible().catch(() => false)) await ok.click();
  626 |   await page.waitForTimeout(400);
  627 | 
  628 |   return (await page.locator('#seasonPassName').inputValue()).trim();
  629 | }
  630 | 
  631 | // --- Shared edit/delete helpers ---
  632 | 
  633 | // Create + publish a valid event, waiting for the backend to accept it. Used by
  634 | // the edit/delete tests so a row is guaranteed to exist (works on a fresh
  635 | // sandbox too). If the same event already exists the backend treats it as a
  636 | // clash and skips creation — either way an event for the first team exists.
  637 | async function createAndPublishEvent(page) {
  638 |   await gotoAddEvent(page);
  639 |   await fillRequiredEventFields(page);
  640 |   await Promise.all([
  641 |     page.waitForResponse(
  642 |       (r) => r.url().includes('/api/events') && r.request().method() === 'POST',
  643 |       { timeout: 30000 }
  644 |     ),
  645 |     page.getByRole('button', { name: 'Save and Publish' }).click(),
  646 |   ]);
  647 |   await page.waitForTimeout(2000);
  648 | }
  649 | 
  650 | // Create + publish a valid bundle, waiting for the backend to accept it.
  651 | // A bundle only publishes when it has at least one *linked* event (events
  652 | // auto-link by matching team/sport/level), so seed a matching event first.
  653 | async function createAndPublishBundle(page) {
  654 |   await createAndPublishEvent(page);
  655 | 
  656 |   await gotoAddBundle(page);
  657 |   await fillRequiredBundleFields(page);
  658 |   await Promise.all([
  659 |     page.waitForResponse(
  660 |       (r) => r.url().includes('/api/seasons') && r.request().method() === 'POST',
  661 |       { timeout: 30000 }
  662 |     ),
  663 |     page.getByRole('button', { name: 'Save and Publish' }).click(),
  664 |   ]);
  665 |   await page.waitForTimeout(2000);
  666 | }
  667 | 
  668 | // The Events list shows nothing until a filter is applied. Select the first
  669 | // Team so event rows appear, then wait for a row. Reloads on the flaky backend.
  670 | async function gotoEventsFilteredByFirstTeam(page) {
  671 |   for (let i = 0; i < 4; i++) {
  672 |     try {
  673 |       // goto is inside the try so a slow-load timeout reloads instead of failing.
> 674 |       await page.goto(EVENTS_URL, { waitUntil: 'domcontentloaded' });
      |                  ^ Error: page.goto: Target page, context or browser has been closed
  675 |       await expect(page.getByRole('button', { name: 'Add' })).toBeVisible({ timeout: 15000 });
  676 |       await page.waitForTimeout(2500);
  677 |       await page.locator('.ant-select').filter({ hasText: 'Teams' }).first().click();
  678 |       const option = page
  679 |         .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
  680 |         .filter({ visible: true })
  681 |         .first();
  682 |       // The team list loads from the (often slow) backend — give it room.
  683 |       await option.waitFor({ state: 'visible', timeout: 18000 });
  684 |       await option.click();
  685 |       await page.keyboard.press('Escape');
  686 |       await page.locator('tr.ant-table-row').first().waitFor({ state: 'visible', timeout: 15000 });
  687 |       await page.waitForTimeout(1000);
  688 |       return;
  689 |     } catch (err) {
  690 |       if (i === 3) throw err;
  691 |     }
  692 |   }
  693 | }
  694 | 
  695 | module.exports = {
  696 |   ADMIN_BASE,
  697 |   EVENTS_URL,
  698 |   ADD_EVENT_URL,
  699 |   BUNDLES_URL,
  700 |   ADD_BUNDLE_URL,
  701 |   ORDERS_URL,
  702 |   USERS_URL,
  703 |   ADD_USER_URL,
  704 |   ORGANIZATIONS_URL,
  705 |   ADD_ORG_URL,
  706 |   PRODUCTS_URL,
  707 |   ADD_PRODUCT_URL,
  708 |   COUPONS_URL,
  709 |   ADD_COUPON_URL,
  710 |   GIFTCARDS_URL,
  711 |   ADD_GIFTCARD_URL,
  712 |   CATEGORIES_URL,
  713 |   ADD_CATEGORY_URL,
  714 |   LEVELS_URL,
  715 |   SCHOOL_DISTRICTS_URL,
  716 |   ADD_SCHOOL_DISTRICT_URL,
  717 |   ZENFOLIO_URL,
  718 |   PAYOUTS_URL,
  719 |   REPORTS_URL,
  720 |   gotoEvents,
  721 |   gotoAddEvent,
  722 |   gotoBundles,
  723 |   gotoAddBundle,
  724 |   gotoOrders,
  725 |   openSelectFilter,
  726 |   applyOrderDateRange,
  727 |   gotoUsers,
  728 |   gotoAddUser,
  729 |   uniqueAlpha,
  730 |   fillUserForm,
  731 |   createUser,
  732 |   gotoOrgs,
  733 |   gotoAddOrg,
  734 |   createOrg,
  735 |   gotoProducts,
  736 |   gotoAddProduct,
  737 |   createProduct,
  738 |   gotoCoupons,
  739 |   gotoAddCoupon,
  740 |   createCoupon,
  741 |   fillCouponForm,
  742 |   pickSelectById,
  743 |   pickDateById,
  744 |   gotoGiftcards,
  745 |   gotoAddGiftcard,
  746 |   createGiftcard,
  747 |   gotoCategories,
  748 |   gotoAddCategory,
  749 |   createCategory,
  750 |   gotoLevels,
  751 |   createLevel,
  752 |   gotoSchoolDistricts,
  753 |   gotoAddSchoolDistrict,
  754 |   createSchoolDistrict,
  755 |   gotoZenfolio,
  756 |   gotoPayouts,
  757 |   gotoReports,
  758 |   gotoEventsFilteredByFirstTeam,
  759 |   pickAntOption,
  760 |   fillRequiredEventFields,
  761 |   fillRequiredBundleFields,
  762 |   createAndPublishEvent,
  763 |   createAndPublishBundle,
  764 | };
  765 | 
```