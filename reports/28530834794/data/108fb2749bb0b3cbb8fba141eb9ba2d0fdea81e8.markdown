# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend/giftcard.spec.js >> Coupon and gift card stack together
- Location: tests/frontend/giftcard.spec.js:89:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /^- \$/ })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: /^- \$/ })

```

```yaml
- navigation:
  - link "ratio image":
    - /url: /
    - img "ratio image"
  - link "Future Events":
    - /url: /events-bundles?search_type=Future+events
  - link "Spotlight Bundles":
    - /url: /bundles
  - link "Past Events":
    - /url: /events-bundles?search_type=Past+events
  - link "FAQ":
    - /url: https://phloxphoto.com/faqs/
  - link "Contact Us":
    - /url: https://phloxphoto.com/contact-us/
  - text: About
  - link "Cart 1":
    - /url: /cart
  - text: raj.pal@hnrtech.com
- text: 1 product added to cart
- alert: Cart
- heading "Your Cart" [level=1]
- paragraph: You have total 1 items in your cart
- heading "Order Summary" [level=3]
- text: Products Subtotal
- link "Spotlight Gallery - Standard Resolution Test event Demo 901 Jun 26 - Jul 03, 2026 @ 1:00 am - 2:00 am $63.00 Remove":
  - /url: /eventDetail/4846
  - figure:
    - img
  - heading "Spotlight Gallery - Standard Resolution" [level=4]
  - heading "Test event Demo 901" [level=3]
  - heading "Jun 26 - Jul 03, 2026 @ 1:00 am - 2:00 am" [level=4]
  - heading "$63.00" [level=4]
  - heading "Remove" [level=4]
- heading "Do you have coupon code?" [level=4]
- textbox "Enter coupon code": Flat50
- button "Apply"
- text: Invalid or Expired coupon applied
- paragraph: Redeem gift card
- heading "Total Price" [level=4]
- heading "$63.00" [level=4]
- heading "Discount" [level=4]
- heading "$0.00" [level=4]
- heading "Tax" [level=4]
- heading "$5.20" [level=4]
- heading "Order Total" [level=4]
- heading "$68.20" [level=4]
- heading "Gift Card" [level=4]
- heading "$0.00" [level=4]
- paragraph: Payable:$68.20
- text: By clicking on ‘Proceed to Checkout button, I declare that I have read and agree with all the terms & conditions.
- link "Proceed to Checkout":
  - /url: /checkOut/billingDetails
  - button "Proceed to Checkout"
- text: 1 product added to cart
- img
- img
- contentinfo:
  - list:
    - listitem:
      - link "Events":
        - /url: /events-bundles
    - listitem:
      - link "Spotlight Bundles":
        - /url: /bundles
    - listitem:
      - link "Find Your Photos":
        - /url: https://phloxphotos.com/sports
    - listitem:
      - link "Services":
        - /url: https://phloxphoto.com/phlox-productions/
    - listitem:
      - link "About":
        - /url: https://phloxphoto.com/about/
  - list:
    - listitem:
      - link "Photographers":
        - /url: https://phloxphoto.com/about/
    - listitem:
      - link "Contact us":
        - /url: https://phloxphoto.com/contact-us/
    - listitem: Terms & Conditions
    - listitem:
      - link "Policy":
        - /url: https://phloxphoto.com/fulfillment-policy/
  - link "Footer logo Logo":
    - /url: "#"
    - img "Footer logo"
    - text: Logo
  - paragraph: Vype Photography is a collective of talented sports, commercial and personal portrait photographers, many of whom are nationally credentialed.
  - link "Facebook":
    - /url: https://www.facebook.com/phlox.photos/
  - link "Twitter":
    - /url: https://twitter.com/phloxphotos
  - link "Instagram":
    - /url: https://www.instagram.com/phlox.photo
  - img "copyright": ©
  - text: 2026 VYPE Sideline Photography. All rights reserved.
```

# Test source

```ts
  5   | 
  6   | test('Apply a gift card and see the discount', async ({ page }) => {
  7   |   // Already logged in via saved session (see auth.setup.js).
  8   |   // First add a product so the cart has something to discount.
  9   |   await openFirstEvent(page);
  10  | 
  11  |   await page.getByText('Spotlight Gallery - Standard Resolution').click();
  12  |   const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  13  |   await expect(addToCart).toBeEnabled();
  14  |   await addToCart.click();
  15  | 
  16  |   // Go to the cart and wait until it fully loads.
  17  |   await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  18  |   await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  19  |   await expect(
  20  |     page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  21  |   ).toBeVisible();
  22  | 
  23  |   // Open the gift card panel.
  24  |   await page.getByText('Redeem gift card').click();
  25  | 
  26  |   // Enter the gift card code (its field has a distinct placeholder/name).
  27  |   await page.getByRole('textbox', { name: 'Enter your gift card here' }).fill(GIFT_CARD);
  28  | 
  29  |   // There are two "Apply" buttons: 0 = coupon, 1 = gift card.
  30  |   const giftApply = page.getByRole('button', { name: 'Apply' }).nth(1);
  31  |   await expect(giftApply).toBeEnabled();
  32  |   await giftApply.click();
  33  | 
  34  |   // The gift card is applied: confirmation message shows and the gift card
  35  |   // line in the summary now shows a deduction (a negative dollar amount).
  36  |   await expect(page.getByText('Verified! Gift card has been applied.')).toBeVisible();
  37  |   await expect(page.getByRole('heading', { name: /^- \$/ })).toBeVisible();
  38  | });
  39  | 
  40  | // Negative: an invalid gift card shows an error and applies no deduction.
  41  | test('Invalid gift card shows an error and no deduction', async ({ page }) => {
  42  |   await openFirstEvent(page);
  43  |   await page.getByText('Spotlight Gallery - Standard Resolution').click();
  44  |   const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  45  |   await expect(addToCart).toBeEnabled();
  46  |   await addToCart.click();
  47  | 
  48  |   await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  49  |   await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  50  |   await expect(
  51  |     page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  52  |   ).toBeVisible();
  53  | 
  54  |   await page.getByText('Redeem gift card').click();
  55  |   await page.getByRole('textbox', { name: 'Enter your gift card here' }).fill('BADCARD000');
  56  |   await page.getByRole('button', { name: 'Apply' }).nth(1).click();
  57  | 
  58  |   // Error message appears and no deduction is applied.
  59  |   await expect(page.getByText(/Invalid gift card/i)).toBeVisible();
  60  |   await expect(page.getByRole('heading', { name: /^- \$/ })).toHaveCount(0);
  61  | });
  62  | 
  63  | // Apply a valid gift card, then remove it — the deduction goes away.
  64  | test('Remove an applied gift card', async ({ page }) => {
  65  |   await openFirstEvent(page);
  66  |   await page.getByText('Spotlight Gallery - Standard Resolution').click();
  67  |   const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  68  |   await expect(addToCart).toBeEnabled();
  69  |   await addToCart.click();
  70  | 
  71  |   await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  72  |   await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  73  |   await expect(
  74  |     page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  75  |   ).toBeVisible();
  76  | 
  77  |   await page.getByText('Redeem gift card').click();
  78  |   await page.getByRole('textbox', { name: 'Enter your gift card here' }).fill(GIFT_CARD);
  79  |   await page.getByRole('button', { name: 'Apply' }).nth(1).click();
  80  |   await expect(page.getByRole('heading', { name: /^- \$/ })).toBeVisible();
  81  | 
  82  |   // Remove the gift card (its remove control is a <span>Remove</span>, unlike the
  83  |   // cart line item's <h4>). The deduction should disappear.
  84  |   await page.locator('span:text-is("Remove")').click();
  85  |   await expect(page.getByRole('heading', { name: /^- \$/ })).toHaveCount(0);
  86  | });
  87  | 
  88  | // A coupon and a gift card can be applied together (they stack).
  89  | test('Coupon and gift card stack together', async ({ page }) => {
  90  |   await openFirstEvent(page);
  91  |   await page.getByText('Spotlight Gallery - Standard Resolution').click();
  92  |   const addToCart = page.getByRole('button', { name: 'Add to Cart' });
  93  |   await expect(addToCart).toBeEnabled();
  94  |   await addToCart.click();
  95  | 
  96  |   await page.goto('https://uat-phlox-frontend.netlify.app/cart');
  97  |   await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
  98  |   await expect(
  99  |     page.getByRole('heading', { name: 'Spotlight Gallery - Standard Resolution' }).first()
  100 |   ).toBeVisible();
  101 | 
  102 |   // Apply the coupon (50% off).
  103 |   await page.getByRole('textbox', { name: 'Enter coupon code' }).fill('Flat50');
  104 |   await page.getByRole('button', { name: 'Apply' }).nth(0).click();
> 105 |   await expect(page.getByRole('heading', { name: /^- \$/ })).toBeVisible();
      |                                                              ^ Error: expect(locator).toBeVisible() failed
  106 | 
  107 |   // Then apply the gift card ($10 off).
  108 |   await page.getByText('Redeem gift card').click();
  109 |   await page.getByRole('textbox', { name: 'Enter your gift card here' }).fill(GIFT_CARD);
  110 |   await page.getByRole('button', { name: 'Apply' }).nth(1).click();
  111 |   await expect(page.getByText('Verified! Gift card has been applied.')).toBeVisible();
  112 | 
  113 |   // Both reductions show together: the coupon discount and the gift card line.
  114 |   await expect(page.getByRole('heading', { name: '- $31.50' })).toBeVisible();
  115 |   await expect(page.getByText('Gift Card: J9IAGME9FL')).toBeVisible();
  116 |   await expect(page.getByRole('heading', { name: '- $10.00' })).toBeVisible();
  117 | });
  118 | 
  119 | // Demo pause between tests: set DEMO_PAUSE=3000 (ms). No-op otherwise.
  120 | test.afterEach(async ({ page }) => {
  121 |   const ms = Number(process.env.DEMO_PAUSE || 0);
  122 |   if (ms) await page.waitForTimeout(ms);
  123 | });
  124 | 
```