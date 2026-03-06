-- Add missing nullable column to Plan
ALTER TABLE "Plan" ADD COLUMN "stripePriceId" TEXT;

-- Add unique constraint for Plan.stripePriceId
CREATE UNIQUE INDEX "Plan_stripePriceId_key" ON "Plan"("stripePriceId");

-- Add missing nullable column to CustomBlock
ALTER TABLE "CustomBlock" ADD COLUMN "description" TEXT;

-- Add missing index on CustomBlock.ownerId
CREATE INDEX "CustomBlock_ownerId_idx" ON "CustomBlock"("ownerId");

-- Add missing unique constraint on UserPlan.stripeSubscriptionId
CREATE UNIQUE INDEX "UserPlan_stripeSubscriptionId_key" ON "UserPlan"("stripeSubscriptionId");

-- Add missing indexes on UserPlan
CREATE INDEX "UserPlan_userId_idx" ON "UserPlan"("userId");
CREATE INDEX "UserPlan_planId_idx" ON "UserPlan"("planId");

-- CreateTable: TranscriptionUsage
CREATE TABLE "TranscriptionUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: compound unique key queried by usage router
CREATE UNIQUE INDEX "TranscriptionUsage_userId_date_key" ON "TranscriptionUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "TranscriptionUsage_userId_idx" ON "TranscriptionUsage"("userId");

-- AddForeignKey
ALTER TABLE "TranscriptionUsage" ADD CONSTRAINT "TranscriptionUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
