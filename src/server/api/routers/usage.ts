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
});
