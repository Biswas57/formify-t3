# Quick Start - Paywall Implementation

## ✅ What's Been Implemented

The complete paywall architecture is now in place:

- ✅ Prisma schema updated with billing tables
- ✅ Entitlements system with feature flags
- ✅ Stripe billing integration
- ✅ Webhook handler for subscription events
- ✅ tRPC routers for billing and custom blocks
- ✅ Template Builder with upgrade modal
- ✅ All TypeScript errors resolved

## ⚠️ Action Required

### 1. Run the Migration

The Prisma schema has been updated but the migration needs to be applied:

```bash
npx prisma migrate dev --name add_billing_and_custom_blocks
```

**Note**: If you have existing users, this might fail on the unique constraint for `stripeCustomerId`. In that case, check for duplicates first.

### 2. Seed the Database

Create the Free and Pro plans:

```bash
npm run db:seed
```

### 3. Configure Stripe

Add these to your `.env` file:

```bash
STRIPE_SECRET_KEY="sk_test_..."           # From Stripe Dashboard
STRIPE_WEBHOOK_SECRET="whsec_..."         # From webhook endpoint
STRIPE_PRO_PRICE_ID="price_..."           # Create a product + price in Stripe
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Test Locally

Start the app and test the flow:

```bash
npm run dev
```

1. Sign in
2. Go to Template Builder (create or update)
3. Click "Create Custom Block" button
4. Upgrade modal should appear
5. Click "Upgrade to Pro"
6. You'll be redirected to Stripe checkout

### 5. Set Up Stripe Webhook (Local Testing)

Use Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the webhook secret (whsec_...) to .env as STRIPE_WEBHOOK_SECRET
```

## 🎯 Key Files

- **Upgrade Modal**: `src/app/dashboard/_components/UpgradeModal.tsx`
- **Entitlements**: `src/server/entitlements/index.ts`
- **Stripe Utils**: `src/server/billing/stripe.ts`
- **Webhook**: `src/app/api/stripe/webhook/route.ts`
- **Custom Blocks Router**: `src/server/api/routers/customBlock.ts`

## 📖 Full Documentation

See `PAYWALL_IMPLEMENTATION.md` for complete architecture details, testing checklist, and deployment guide.
