import "server-only";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";
import type { FeatureKey } from "./features";
import { hasFeature } from "./features";
import type { SubscriptionStatus } from "../../../generated/prisma";

export type { FeatureKey } from "./features";
export { FEATURES, hasFeature } from "./features";

export interface UserEntitlements {
    planSlug: string;
    planName: string;
    status: SubscriptionStatus | null;
    features: FeatureKey[];
    currentPeriodEnd: Date | null;
}

const ACTIVE_STATUSES: string[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

// ── Cache type ────────────────────────────────────────────────────────────────
// Exported so trpc.ts can type the ctx field without a circular import.
export type EntitlementsCache = Map<string, Promise<UserEntitlements>>;

// ── Core DB fetch (no caching — always hits DB) ───────────────────────────────

async function fetchUserEntitlements(userId: string): Promise<UserEntitlements> {
    const userPlan = await db.userPlan.findUnique({
        where: { userId },
        select: {
            status: true,
            currentPeriodEnd: true,
            plan: {
                select: {
                    slug: true,
                    name: true,
                    featuresJson: true,
                },
            },
        },
    });

    if (!userPlan) {
        return {
            planSlug: "free",
            planName: "Free",
            status: null,
            features: [],
            currentPeriodEnd: null,
        };
    }

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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get entitlements for a user, deduplicating concurrent DB reads within a
 * single tRPC request via the request-scoped cache on ctx.
 *
 * Pass `cache` from `ctx.entitlementsCache`. The cache is a Map of
 * userId → Promise<UserEntitlements> created fresh per request in
 * createTRPCContext, so there is no cross-request bleed.
 *
 * Storing the Promise (not the resolved value) means two concurrent callers
 * in the same batch both await the same in-flight query — one DB round-trip.
 *
 * @param userId  - the user to look up
 * @param cache   - ctx.entitlementsCache from the tRPC procedure context
 */
export async function getUserEntitlements(
    userId: string,
    cache: EntitlementsCache,
): Promise<UserEntitlements> {
    const cached = cache.get(userId);
    if (cached) return cached;

    // Store the Promise immediately — before awaiting — so concurrent callers
    // in the same batch pick up the same in-flight query rather than starting
    // their own.
    const promise = fetchUserEntitlements(userId);
    cache.set(userId, promise);
    return promise;
}

/**
 * Throws TRPCError FORBIDDEN if the user doesn't have the required feature.
 */
export async function requireFeature(
    userId: string,
    cache: EntitlementsCache,
    featureKey: FeatureKey
): Promise<void> {
    const entitlements = await getUserEntitlements(userId, cache);
    if (!hasFeature(entitlements, featureKey)) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: `This feature requires a PRO subscription. Missing: ${featureKey}`,
        });
    }
}