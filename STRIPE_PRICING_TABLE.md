# Stripe Pricing Table Implementation

## ✅ What Changed

The custom upgrade modal has been replaced with Stripe's embedded Pricing Table component. This provides a native Stripe checkout experience directly in your app.

## 📝 Changes Made

### 1. Updated `UpgradeModal.tsx`
- Removed custom pricing UI and checkout button
- Replaced with `<stripe-pricing-table>` web component
- Modal now displays Stripe's pricing table with all configured plans
- Increased modal width to `max-w-4xl` to accommodate pricing table

### 2. Updated `layout.tsx`
- Added Stripe Pricing Table script to `<head>`:
  ```html
  <script async src="https://js.stripe.com/v3/pricing-table.js"></script>
  ```

### 3. Updated Environment Configuration

**`src/env.js`** - Added client-side variables:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID`

**`.env.example`** - Updated with new variables:
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID="prctbl_..."
```

### 4. Created Type Definition
- `src/types/stripe-pricing-table.d.ts` - Type definitions for the custom element

## 🚀 Setup Required

### 1. Create a Pricing Table in Stripe

1. Go to [Stripe Dashboard → Pricing Tables](https://dashboard.stripe.com/test/pricing-tables)
2. Click "Create pricing table"
3. Add your Pro plan (the one with `STRIPE_PRO_PRICE_ID`)
4. Customize appearance to match Formify branding
5. Copy the Pricing Table ID (starts with `prctbl_`)

### 2. Update Environment Variables

Add to your `.env` file:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_51T6jjQRpdqDZ13UB9j2oJYsfYqjUs4s4OBNuXX6YzUa8ofBJrLEbvGGoxddAO1v9udeAhRqB9WlI2jBxRlzXvloU00rb34qzYN"
NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID="prctbl_1T6kLgRpdqDZ13UBCMsRyoev"
```

⚠️ **Important**: Use your actual keys from the example you provided.

### 3. Test the Integration

1. Start the app: `npm run dev`
2. Sign in as a FREE user
3. Go to Template Builder
4. Click "Create Custom Block"
5. The modal should show the Stripe Pricing Table
6. Complete checkout through Stripe's native flow

## 🎯 Benefits of This Approach

✅ **Native Stripe Experience**: Users see Stripe's familiar checkout UI
✅ **Automatic Updates**: Change pricing in Stripe Dashboard without code changes
✅ **Multi-Plan Support**: Easily add multiple tiers (Monthly/Yearly) in Stripe
✅ **Built-in Features**: Coupon codes, trial periods, etc. configured in Stripe
✅ **Mobile Optimized**: Stripe's pricing table is responsive
✅ **Reduced Maintenance**: No need to update pricing UI in code

## 🔄 How It Works Now

```
FREE user clicks "Create Custom Block"
    ↓
UpgradeModal opens with Stripe Pricing Table
    ↓
User selects plan and clicks "Subscribe" in pricing table
    ↓
Redirected to Stripe Checkout (same as before)
    ↓
On success: Webhook updates UserPlan → User becomes PRO
    ↓
User can now create custom blocks
```

## 📋 Stripe Dashboard Configuration

Configure your pricing table to match Formify's design:

- **Primary Color**: `#2149A1` (Formify primary)
- **Button Text**: "Upgrade to Pro" or "Get Started"
- **Features**: List the same features:
  - Create custom blocks
  - Unlimited templates
  - Priority support

## 🔧 Previous Implementation

The old implementation used:
- Custom modal with hardcoded pricing
- Manual checkout session creation via tRPC
- Required code changes for pricing updates

These files are no longer needed but the backend (`billing.createCheckoutSession`) remains as a fallback.

## 📚 Resources

- [Stripe Pricing Tables Docs](https://stripe.com/docs/payments/checkout/pricing-table)
- [Pricing Table Customization](https://dashboard.stripe.com/test/pricing-tables)
- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
