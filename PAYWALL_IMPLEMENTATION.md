# Formify Paywall Architecture - Implementation Guide

## Overview

This document describes the complete paywall architecture implementation for Formify, restricting custom block creation to PRO users only.

## 🎯 Features Implemented

### ✅ Backend Architecture

1. **Entitlements System** (`src/server/entitlements/`)
   - Feature-based permissions system
   - `getUserEntitlements(userId)` - Get user's plan and features
   - `hasFeature(entitlements, featureKey)` - Check feature access
   - `requireFeature(userId, featureKey)` - Enforce feature requirement (throws FORBIDDEN)

2. **Stripe Billing Integration** (`src/server/billing/stripe.ts`)
   - `createCheckoutSession(userId)` - Generate Stripe checkout URL
   - `createPortalSession(userId)` - Generate billing portal URL
   - `verifyWebhookSignature(payload, signature)` - Secure webhook verification

3. **Database Schema** (Prisma)
   - `Plan` table - Define plans (free, pro) with feature flags
   - `UserPlan` table - Track user subscriptions and status
   - `CustomBlock` table - Store user-created custom blocks
   - User model extended with `stripeCustomerId`

4. **Webhook Handler** (`src/app/api/stripe/webhook/route.ts`)
   - Handles `checkout.session.completed`
   - Handles `customer.subscription.created/updated/deleted`
   - Automatically updates `UserPlan` records
   - Secure signature verification

5. **tRPC Routers**
   - `entitlements.me` - Get current user's plan and features
   - `billing.createCheckoutSession` - Initiate upgrade flow
   - `billing.createPortalSession` - Manage subscription
   - `customBlock.create` - Create custom block (PRO-only)
   - `customBlock.list` - List user's custom blocks
   - `customBlock.delete` - Delete custom block (PRO-only)

### ✅ Frontend Implementation

1. **Template Builder Integration**
   - Fetches entitlements on component mount
   - Shows lock icon on "Create Custom Block" for FREE users
   - Opens upgrade modal for FREE users
   - Allows custom block creation for PRO users

2. **Upgrade Modal** (`src/app/dashboard/_components/UpgradeModal.tsx`)
   - Clean, branded design matching Formify theme
   - Lists PRO features with checkmarks
   - Shows pricing ($9/month)
   - Handles checkout session creation
   - Redirects to Stripe checkout

## 📁 File Structure

```
src/
├── app/
│   ├── api/
│   │   └── stripe/
│   │       └── webhook/
│   │           └── route.ts          # Stripe webhook handler
│   └── dashboard/
│       ├── _components/
│       │   └── UpgradeModal.tsx      # Upgrade modal component
│       └── TemplateBuilder.tsx       # Updated with paywall logic
├── server/
│   ├── api/
│   │   └── routers/
│   │       ├── billing.ts            # Billing tRPC router
│   │       ├── entitlements.ts       # Entitlements tRPC router
│   │       └── customBlock.ts        # Custom blocks tRPC router
│   ├── billing/
│   │   └── stripe.ts                 # Stripe utilities
│   └── entitlements/
│       ├── features.ts               # Feature definitions
│       └── index.ts                  # Entitlements helpers
prisma/
├── schema.prisma                     # Updated with billing tables
└── seed.ts                           # Seed Free & Pro plans
```

## 🚀 Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 2. Database Migration

Run the migration to create billing tables:

```bash
npx prisma migrate dev --name add_billing_and_custom_blocks
```

### 3. Seed Plans

Seed the database with Free and Pro plans:

```bash
npm run db:seed
```

This creates:
- **Free Plan**: No features
- **Pro Plan**: `custom_blocks:create`, `custom_blocks:delete`, `templates:unlimited`

### 4. Stripe Configuration

#### Create a Product and Price

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a **Product** (e.g., "Formify Pro")
3. Add a **Price** (e.g., $9/month recurring)
4. Copy the Price ID and set as `STRIPE_PRO_PRICE_ID`

#### Set Up Webhook

1. Go to **Developers → Webhooks** in Stripe Dashboard
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook signing secret and set as `STRIPE_WEBHOOK_SECRET`

**Local Testing (Stripe CLI):**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the webhook secret (whsec_...) to .env
```

### 5. Test the Paywall

1. **Start app**: `npm run dev`
2. **Sign in** as a user
3. **Go to Template Builder**
4. **Click "Create Custom Block"**
5. **You should see the upgrade modal** (FREE users)
6. **Click "Upgrade to Pro"** → redirects to Stripe checkout
7. **Complete test payment** (use test card `4242 4242 4242 4242`)
8. **Return to app** → you're now PRO
9. **Click "Create Custom Block"** → modal opens (PRO users)

## 🔒 Security Features

1. **Server-Side Enforcement**: All feature checks happen server-side via `requireFeature()`
2. **Webhook Signature Verification**: All webhooks are cryptographically verified
3. **Database as Source of Truth**: User plan status is always checked from DB, never client state
4. **tRPC Protected Procedures**: All routes require authentication

## 🎨 Design System Compliance

The implementation maintains Formify's existing design:

- **Colors**: `#FBFBFB` (background), `#2149A1` (primary), `#868C94` (gray)
- **Typography**: Existing font stack and sizing
- **Components**: Rounded corners (`rounded-lg`, `rounded-xl`), subtle borders, minimal shadows
- **Icons**: Lucide React icons (Lock, Check, etc.)
- **No new UI libraries**: Pure Tailwind CSS

## 📊 Feature Flags

Defined in `src/server/entitlements/features.ts`:

```typescript
export const FEATURES = {
  CUSTOM_BLOCKS_CREATE: "custom_blocks:create",
  CUSTOM_BLOCKS_DELETE: "custom_blocks:delete",
  TEMPLATES_UNLIMITED: "templates:unlimited",
} as const;
```

To add new features:

1. Add to `FEATURES` object
2. Update `PLAN_FEATURES` mapping
3. Use `requireFeature()` in tRPC procedures
4. Update plan seed data

## 🧪 Testing Checklist

- [ ] FREE user sees upgrade modal when clicking "Create Custom Block"
- [ ] Upgrade modal redirects to Stripe checkout
- [ ] Webhook updates `UserPlan` on successful payment
- [ ] PRO user can create custom blocks
- [ ] Custom blocks appear in Template Builder sidebar
- [ ] FREE user cannot call `customBlock.create` (returns FORBIDDEN)
- [ ] Subscription cancellation reverts user to FREE
- [ ] Stripe portal allows subscription management

## 📝 Notes

- **Migration**: The migration was created but may need to be applied with `--create-only` if there are existing users with duplicate `stripeCustomerId` values (unlikely in fresh DB)
- **Pricing**: Update `UpgradeModal.tsx` if you change the price
- **Features**: Pro plan features are stored as JSON in the `Plan` table for flexibility
- **Existing Blocks**: The old `BlockDefinition` system still works alongside the new `CustomBlock` system

## 🔧 Troubleshooting

**Issue**: Webhook signature verification fails  
**Solution**: Ensure `STRIPE_WEBHOOK_SECRET` matches the endpoint in Stripe Dashboard

**Issue**: User doesn't become PRO after payment  
**Solution**: Check webhook logs, ensure `checkout.session.completed` is handled

**Issue**: TypeScript errors on Stripe types  
**Solution**: Ensure Stripe SDK is latest version, types are auto-generated

**Issue**: Migration fails on existing data  
**Solution**: Handle duplicate `stripeCustomerId` values or use `--create-only` flag

## 🚢 Deployment

1. Set environment variables on hosting platform
2. Run migrations: `npx prisma migrate deploy`
3. Run seed: `npm run db:seed`
4. Update Stripe webhook URL to production domain
5. Verify webhook events are received
6. Test checkout flow end-to-end

## 📚 Additional Resources

- [Stripe Subscriptions Docs](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [tRPC Error Handling](https://trpc.io/docs/server/error-handling)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
