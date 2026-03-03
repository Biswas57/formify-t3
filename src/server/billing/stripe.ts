import "server-only";
import Stripe from "stripe";
import { env } from "@/env";
import { db } from "@/server/db";

// Initialize Stripe client
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
    typescript: true,
});

/**
 * Create a Stripe Checkout Session for a user to subscribe to PRO.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckoutSession(userId: string): Promise<string> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.email) {
        throw new Error("User email not found");
    }

    // Create or fetch Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: { userId },
        });
        customerId = customer.id;

        // Store customer ID on user
        await db.user.update({
            where: { id: userId },
            data: { stripeCustomerId: customerId },
        });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
            {
                price: env.STRIPE_PRO_PRICE_ID,
                quantity: 1,
            },
        ],
        success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=canceled`,
        metadata: { userId },
    });

    if (!session.url) {
        throw new Error("Failed to create checkout session URL");
    }

    return session.url;
}

/**
 * Create a Stripe Customer Portal session for a user to manage their subscription.
 * Returns the portal URL to redirect the user to.
 */
export async function createPortalSession(userId: string): Promise<string> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
        throw new Error("User has no Stripe customer ID");
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/profile`,
    });

    return session.url;
}

/**
 * Verify the webhook signature from Stripe.
 * Throws an error if the signature is invalid.
 */
export function verifyWebhookSignature(
    payload: string | Buffer,
    signature: string
): Stripe.Event {
    try {
        return stripe.webhooks.constructEvent(
            payload,
            signature,
            env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Webhook signature verification failed: ${errorMessage}`);
    }
}
