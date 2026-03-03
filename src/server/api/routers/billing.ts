import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { createCheckoutSession, createPortalSession } from "@/server/billing/stripe";

export const billingRouter = createTRPCRouter({
    /**
     * Create a Stripe Checkout session for upgrading to PRO.
     * Returns the checkout URL to redirect the user to.
     */
    createCheckoutSession: protectedProcedure.mutation(async ({ ctx }) => {
        const url = await createCheckoutSession(ctx.session.user.id);
        return { url };
    }),

    /**
     * Create a Stripe Customer Portal session for managing subscription.
     * Returns the portal URL to redirect the user to.
     */
    createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
        const url = await createPortalSession(ctx.session.user.id);
        return { url };
    }),
});
