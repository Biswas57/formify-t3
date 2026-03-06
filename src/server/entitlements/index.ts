import "server-only";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";
import type { FeatureKey } from "./features";
import type { SubscriptionStatus } from "../../../generated/prisma";

export type { FeatureKey } from "./features";
export { FEATURES } from "./features";

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
 * Get entitlements for a user by ID.
 * Returns the user's current plan and available features.
 * If no subscription exists, defaults to "free".
 */
export async function getUserEntitlements(
    userId: string
): Promise<UserEntitlements> {
    // Fetch user's current plan + subscription status
    const userPlan = await db.userPlan.findUnique({
        where: { userId },
        include: { plan: true },
    });

    // Default to free plan if no subscription
    if (!userPlan) {
        return {
            planSlug: "free",
            planName: "Free",
            status: null,
            features: [],
            currentPeriodEnd: null,
        };
    }

    // Return user's actual plan — features come from the DB row, not hardcoded
    const planSlug = userPlan.plan.slug;
    const features = JSON.parse(userPlan.plan.featuresJson) as FeatureKey[];

    return {
        planSlug,
        planName: userPlan.plan.name,
        status: userPlan.status,
        features,
        currentPeriodEnd: userPlan.currentPeriodEnd,
    };
}

/**
 * Check if entitlements include a specific feature.
 */
export function hasFeature(
    entitlements: UserEntitlements,
    featureKey: FeatureKey
): boolean {
    return entitlements.features.includes(featureKey);
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
