-- Remove billing/paywall schema residue now that Formify is a free app.
-- Historical migrations are retained; this migration drops the active billing tables/fields.

ALTER TABLE "UserPlan" DROP CONSTRAINT "UserPlan_planId_fkey";
ALTER TABLE "UserPlan" DROP CONSTRAINT "UserPlan_userId_fkey";

DROP TABLE "UserPlan";
DROP TABLE "Plan";

DROP INDEX "User_stripeCustomerId_key";
ALTER TABLE "User" DROP COLUMN "stripeCustomerId";

DROP TYPE "SubscriptionStatus";
