/**
 * src/server/api/routers/transcription.ts
 *
 * Mints short-lived WS session tokens.
 * This is the ONLY server-side gate for:
 *   - authentication (must be signed in)
 *   - plan/usage enforcement (free tier daily limit)
 *   - usage recording (counted here at token mint, not on client)
 *
 * The WS server validates the token but does NOT touch the DB directly —
 * it trusts the token was minted after a successful limit check.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getUserEntitlements, hasFeature, FEATURES } from "@/server/entitlements";
import { PLAN_LIMITS } from "@/server/entitlements/features";
import { mintWSToken } from "@/server/ws-token";

function todayUTC(): string {
    return new Date().toISOString().split("T")[0]!;
}

export const transcriptionRouter = createTRPCRouter({
    /**
     * Mint a short-lived WS session token.
     *
     * Enforces:
     *   - Authentication (protectedProcedure)
     *   - Free tier daily transcription limit
     *
     * Records usage BEFORE returning the token so the count is authoritative
     * even if the user closes the browser before the session ends.
     *
     * Returns { token } — the client sends this in the WS start payload.
     */
    getSessionToken: protectedProcedure
        .input(z.object({
            mode: z.enum(["forms", "notes"]),
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const today = todayUTC();

            // Check entitlements — Pro users skip limit check
            const entitlements = await getUserEntitlements(userId, ctx.entitlementsCache);
            const isPro = hasFeature(entitlements, FEATURES.TRANSCRIPTION_UNLIMITED);

            if (!isPro) {
                // Read current usage
                const usage = await ctx.db.transcriptionUsage.findUnique({
                    where: { userId_date: { userId, date: today } },
                });
                const count = usage?.count ?? 0;
                const limit = PLAN_LIMITS.FREE_DAILY_TRANSCRIPTIONS;

                if (count >= limit) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: `Daily transcription limit reached (${limit}/day on Free plan). Upgrade to Pro for unlimited sessions.`,
                    });
                }

                // Increment usage NOW — before handing over the token.
                // This prevents race conditions where a user spams getSessionToken
                // to bypass the check before any session actually starts.
                await ctx.db.transcriptionUsage.upsert({
                    where: { userId_date: { userId, date: today } },
                    create: { userId, date: today, count: 1 },
                    update: { count: { increment: 1 } },
                });
            }

            const token = mintWSToken(userId, input.mode);
            return { token };
        }),
});
