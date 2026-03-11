import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getUserEntitlements } from "@/server/entitlements";

export const entitlementsRouter = createTRPCRouter({
    /**
     * Get current user's entitlements (plan, features, etc.).
     */
    me: protectedProcedure.query(async ({ ctx }) => {
        return getUserEntitlements(ctx.session.user.id, ctx.entitlementsCache);
    }),
});