import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

function todayUTC(): string {
    return new Date().toISOString().split("T")[0]!;
}

export const usageRouter = createTRPCRouter({
    getToday: protectedProcedure.query(async ({ ctx }) => {
        try {
            const today = todayUTC();
            const usage = await ctx.db.transcriptionUsage.findUnique({
                where: { userId_date: { userId: ctx.session.user.id, date: today } },
            });

            return {
                count: usage?.count ?? 0,
                limit: null as number | null,
                isPro: true,
                canRecord: true,
            };
        } catch (error) {
            console.warn("[Usage] Usage analytics read failed; returning non-blocking state.", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
            return { count: 0, limit: null as number | null, isPro: true, canRecord: true };
        }
    }),

    // TODO: Legacy mutation. Recording usage is now analytics-only and is
    // counted when transcription.getSessionToken mints a WS token; keep this
    // uncalled compatibility surface until older clients are confirmed gone.
    recordSession: protectedProcedure.mutation(async ({ ctx }) => {
        try {
            const today = todayUTC();
            await ctx.db.transcriptionUsage.upsert({
                where: { userId_date: { userId: ctx.session.user.id, date: today } },
                create: { userId: ctx.session.user.id, date: today, count: 1 },
                update: { count: { increment: 1 } },
            });
        } catch (error) {
            console.warn("[Usage] Legacy usage analytics write failed.", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
        return { success: true };
    }),
});
