import "server-only";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";
import type { FeatureKey } from "./features";
import { hasFeature } from "./features";
import type { SubscriptionStatus } from "../../../generated/prisma";

export type { FeatureKey } from "./features";
export { FEATURES, hasFeature } from "./features";

/** Per-request dedup cache — pass ctx.entitlementsCache from tRPC context. */
export type EntitlementsCache = Map<string, Promise<UserEntitlements>>;

// ─── No module-level cache ────────────────────────────────────────────────────
//
// A previous version used a module-level Map + queueMicrotask for in-request
// dedup. This is NOT safe in Next.js / Vercel serverless:
//
//   - Vercel reuses lambda instances ("warm starts") across requests.
//   - The module-level Map therefore persists between requests.
//   - queueMicrotask runs after the current microtask queue drains, but in a
//     warm-start environment that can happen between two different users'
//     requests, leaving stale free-tier entitlements cached for the next caller.
//
// Result: a user who was checked as "free" before their Pro webhook arrived
// would keep getting free-tier results indefinitely on that lambda instance,
// even after the DB was correctly updated — causing Pro subscribers to hit
// the daily recording limit.
//
// The correct dedup layer is the per-HTTP-request entitlementsCache Map that
// lives on the tRPC context object (created fresh in createTRPCContext in
// trpc.ts). That cache is truly request-scoped and GC'd with the request.
// Procedures that need dedup should pass ctx.entitlementsCache here.
// For procedures that don't need it (e.g. the entitlements.me endpoint itself),
// a direct DB read is fine — it only fires once per request anyway.

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
 *
 * Deduplicates DB reads within a single tRPC batch via a request-scoped cache
 * (see comment above). Multiple procedures calling this in the same batch share
 * one DB round-trip instead of each issuing their own.
 */
export async function getUserEntitlements(
    userId: string,
    cache?: Map<string, Promise<UserEntitlements>>
): Promise<UserEntitlements> {
    // If a request-scoped cache is provided, deduplicate concurrent calls for
    // the same userId within one tRPC batch. We store the Promise (not the
    // resolved value) so parallel callers share one in-flight DB query.
    if (cache) {
        const cached = cache.get(userId);
        if (cached) return cached;
        const promise = fetchUserEntitlements(userId);
        cache.set(userId, promise);
        return promise;
    }
    return fetchUserEntitlements(userId);
}

async function fetchUserEntitlements(userId: string): Promise<UserEntitlements> {
    const userPlan = await db.userPlan.findUnique({
        where: { userId },
        // Select only columns we need — avoids pulling stripeSubscriptionId,
        // cancelAtPeriodEnd, etc. on every entitlements check
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

    let result: UserEntitlements;

    if (!userPlan) {
        result = {
            planSlug: "free",
            planName: "Free",
            status: null,
            features: [],
            currentPeriodEnd: null,
        };
    } else {
        const isActive = ACTIVE_STATUSES.includes(userPlan.status);
        const features: FeatureKey[] = isActive
            ? (JSON.parse(userPlan.plan.featuresJson) as FeatureKey[])
            : [];

        result = {
            planSlug: userPlan.plan.slug,
            planName: userPlan.plan.name,
            status: userPlan.status,
            features,
            currentPeriodEnd: userPlan.currentPeriodEnd,
        };
    }

    return result;
}

/**
 * Throws TRPCError FORBIDDEN if the user doesn't have the required feature.
 * Use this in tRPC procedures to gate PRO-only functionality.
 */
export async function requireFeature(
    userId: string,
    featureKey: FeatureKey,
    cache?: EntitlementsCache
): Promise<void> {
    const entitlements = await getUserEntitlements(userId, cache);
    if (!hasFeature(entitlements, featureKey)) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: `This feature requires a PRO subscription. Missing: ${featureKey}`,
        });
    }
}
