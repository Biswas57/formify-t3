import "server-only";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";
import type { FeatureKey } from "./features";
import { hasFeature } from "./features";
import type { SubscriptionStatus } from "../../../generated/prisma";

export type { FeatureKey } from "./features";
export { FEATURES, hasFeature } from "./features";

/**
 * User entitlements object containing plan info and feature flags.
 */
export interface UserEntitlements {
    planSlug: string;
    planName: string;
    status: SubscriptionStatus | null;
    features: FeatureKey[];
    currentPeriodEnd: Date | null;
}

/**
 * Statuses that grant active feature access.
 *
 * PAST_DUE is included intentionally: Stripe retries payment for several days
 * before moving to UNPAID/CANCELED. Cutting access immediately on first missed
 * payment is poor UX — keep Pro alive during the retry window.
 *
 * CANCELED, INCOMPLETE_EXPIRED, UNPAID → drop to Free immediately.
 * INCOMPLETE → payment never completed, never grant Pro.
 */
const ACTIVE_STATUSES: string[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

/**
 * Get entitlements for a user by ID.
 * Returns the user's current plan and available features.
 * If no subscription exists, or the subscription is not in an active state,
 * defaults to Free (empty features array).
 */
export async function getUserEntitlements(
    userId: string
): Promise<UserEntitlements> {
    const userPlan = await db.userPlan.findUnique({
        where: { userId },
        include: { plan: true },
    });

    // No subscription row at all → Free.
    // features: [] is correct today because the free plan has no features.
    // If the free plan ever gains features, update PLAN_FEATURES.free in
    // features.ts, re-run the seed to write them into the Plan row, and
    // replace [] here with JSON.parse(freePlan.featuresJson) after a
    // db.plan.findUnique({ where: { slug: "free" } }) lookup.
    if (!userPlan) {
        return {
            planSlug: "free",
            planName: "Free",
            status: null,
            features: [],
            currentPeriodEnd: null,
        };
    }

    // Gate features on subscription status.
    // Canceled / expired / incomplete subscriptions get no Pro features —
    // the plan row still exists (for display/history) but access is revoked.
    const isActive = ACTIVE_STATUSES.includes(userPlan.status);
    const features: FeatureKey[] = isActive
        ? (JSON.parse(userPlan.plan.featuresJson) as FeatureKey[])
        : [];

    return {
        planSlug: userPlan.plan.slug,
        planName: userPlan.plan.name,
        status: userPlan.status,
        features,
        currentPeriodEnd: userPlan.currentPeriodEnd,
    };
}

/**
 * Throws TRPCError FORBIDDEN if the user doesn't have the required feature.
 * Use this in tRPC procedures to gate PRO-only functionality.
 */
export async function requireFeature(
    userId: string,
    featureKey: FeatureKey
): Promise<void> {
    const entitlements = await getUserEntitlements(userId);

    if (!hasFeature(entitlements, featureKey)) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: `This feature requires a PRO subscription. Missing: ${featureKey}`,
        });
    }
}