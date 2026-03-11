import "server-only";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";
import type { FeatureKey } from "./features";
import { hasFeature } from "./features";
import type { SubscriptionStatus } from "../../../generated/prisma";

export type { FeatureKey } from "./features";
export { FEATURES, hasFeature } from "./features";

// ─── Request-scoped dedup cache ───────────────────────────────────────────────
//
// Problem: tRPC batches multiple procedures into one HTTP request. A single page
// load calls entitlements.me + usage.getToday + template.create in one batch —
// 3 identical DB reads for the same userId in the same Node.js tick.
// Each one costs 850–2100ms in the logs.
//
// Fix: cache per userId within a single tick. queueMicrotask clears the map
// after all parallel awaits in the batch resolve, so:
//   - within one request batch → 1 DB query total (cache hits for subsequent calls)
//   - next request → fresh cold start (cache already cleared)
//
// This is NOT a cross-request cache. Each new HTTP request starts cold.

const _reqCache = new Map<string, UserEntitlements>();
let _clearScheduled = false;

function scheduleCleanup() {
    if (_clearScheduled) return;
    _clearScheduled = true;
    queueMicrotask(() => {
        _reqCache.clear();
        _clearScheduled = false;
    });
}

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
    userId: string
): Promise<UserEntitlements> {
    // Return cached result if already fetched this request
    const hit = _reqCache.get(userId);
    if (hit) return hit;

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

    _reqCache.set(userId, result);
    scheduleCleanup();

    return result;
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