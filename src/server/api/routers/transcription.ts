/**
 * src/server/api/routers/transcription.ts
 *
 * Mints short-lived WS session tokens.
 * This is the server-side gate for authentication (must be signed in).
 * Usage is recorded here as best-effort analytics, but it no longer blocks
 * recording now that Formify is moving to the free-app model.
 *
 * The WS server validates the token but does NOT touch the DB directly —
 * it trusts the token was minted by this authenticated web app.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
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
     *
     * Records usage as non-blocking analytics. Analytics failures must not
     * prevent a signed-in user from starting a recording session.
     *
     * Returns { token } — the client sends this in the WS start payload.
     */
    getSessionToken: protectedProcedure
        .input(z.object({
            mode: z.enum(["forms", "notes"]),
            recordingSessionId: z.string().uuid().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const recordingSessionId = input.mode === "notes"
                ? input.recordingSessionId ?? randomUUID()
                : undefined;

            try {
                const today = todayUTC();
                await ctx.db.transcriptionUsage.upsert({
                    where: { userId_date: { userId, date: today } },
                    create: { userId, date: today, count: 1 },
                    update: { count: { increment: 1 } },
                });
            } catch (error) {
                console.warn("[Transcription] Usage analytics write failed; token still minted.", {
                    mode: input.mode,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }

            const token = mintWSToken(userId, input.mode, recordingSessionId);
            return { token, recordingSessionId };
        }),
});
