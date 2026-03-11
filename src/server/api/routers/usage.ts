import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getUserEntitlements, hasFeature, FEATURES } from "@/server/entitlements";
import { PLAN_LIMITS } from "@/server/entitlements/features";

function todayUTC(): string {
    return new Date().toISOString().split("T")[0]!;
}

export const usageRouter = createTRPCRouter({
    getToday: protectedProcedure.query(async ({ ctx }) => {
        const entitlements = await getUserEntitlements(ctx.session.user.id, ctx.entitlementsCache);
        const isPro = hasFeature(entitlements, FEATURES.TRANSCRIPTION_UNLIMITED);

        if (isPro) {
            return { count: 0, limit: null as number | null, isPro: true, canRecord: true };
        }

        const today = todayUTC();
        const usage = await ctx.db.transcriptionUsage.findUnique({
            where: { userId_date: { userId: ctx.session.user.id, date: today } },
        });

        const count = usage?.count ?? 0;
        const limit = PLAN_LIMITS.FREE_DAILY_TRANSCRIPTIONS;
        return { count, limit, isPro: false, canRecord: count < limit };
    }),

    recordSession: protectedProcedure.mutation(async ({ ctx }) => {
        const today = todayUTC();
        await ctx.db.transcriptionUsage.upsert({
            where: { userId_date: { userId: ctx.session.user.id, date: today } },
            create: { userId: ctx.session.user.id, date: today, count: 1 },
            update: { count: { increment: 1 } },
        });
        return { success: true };
    }),
});