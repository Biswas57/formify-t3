import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyWebhookSignature, stripe } from "@/server/billing/stripe";
import { db } from "@/server/db";
import type Stripe from "stripe";
import { SubscriptionStatus } from "../../../../../generated/prisma";
import { PLAN_FEATURES } from "@/server/entitlements/features";

/**
 * Stripe webhook handler.
 * Processes subscription events and updates the database accordingly.
 */
export async function POST(req: Request) {
    try {
        const body = await req.text();
        const signature = (await headers()).get("stripe-signature");

        if (!signature) {
            return NextResponse.json(
                { error: "Missing stripe-signature header" },
                { status: 400 }
            );
        }

        // Verify webhook signature
        const event = verifyWebhookSignature(body, signature);

        console.log(`[Stripe Webhook] Received event: ${event.type}`);

        // Handle different event types
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                await handleCheckoutCompleted(session);
                break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const subscription = event.data.object;
                await handleSubscriptionUpdated(subscription);
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                await handleSubscriptionDeleted(subscription);
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error("[Stripe Webhook] Error:", err);
        return NextResponse.json(
            { error: "Webhook handler failed" },
            { status: 400 }
        );
    }
}

/**
 * Handle checkout.session.completed event.
 * Creates initial subscription record in the database.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const subscriptionId = session.subscription as string;

    if (!userId || !subscriptionId) {
        console.error("[Stripe Webhook] Missing userId or subscriptionId");
        return;
    }

    // Fetch full subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertUserPlan(userId, subscription);

    console.log(`[Stripe Webhook] Checkout completed for user ${userId}`);
}

/**
 * Handle subscription.created or subscription.updated events.
 * Updates or creates the UserPlan record.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;

    if (!userId) {
        // Try to find user by customer ID
        const customer = await db.user.findUnique({
            where: { stripeCustomerId: subscription.customer as string },
            select: { id: true },
        });

        if (!customer) {
            console.error("[Stripe Webhook] Could not find user for subscription");
            return;
        }

        await upsertUserPlan(customer.id, subscription);
    } else {
        await upsertUserPlan(userId, subscription);
    }

    console.log(`[Stripe Webhook] Subscription updated: ${subscription.id}`);
}

/**
 * Handle subscription.deleted event.
 * Sets subscription status to CANCELED.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await db.userPlan.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
            status: "CANCELED",
            cancelAtPeriodEnd: true,
        },
    });

    console.log(`[Stripe Webhook] Subscription deleted: ${subscription.id}`);
}

/**
 * Upsert UserPlan record based on Stripe subscription data.
 */
async function upsertUserPlan(userId: string, subscription: Stripe.Subscription) {
    // Find or create the PRO plan
    const proPlan = await db.plan.findUnique({ where: { slug: "pro" } }) ??
        await db.plan.create({
            data: {
                name: "Pro",
                slug: "pro",
                featuresJson: JSON.stringify(PLAN_FEATURES.pro ?? []),
            },
        });

    // Map Stripe status to our enum
    const statusMap: Record<string, SubscriptionStatus> = {
        active: SubscriptionStatus.ACTIVE,
        trialing: SubscriptionStatus.TRIALING,
        past_due: SubscriptionStatus.PAST_DUE,
        canceled: SubscriptionStatus.CANCELED,
        incomplete: SubscriptionStatus.INCOMPLETE,
        incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
        unpaid: SubscriptionStatus.UNPAID,
    };

    const status = statusMap[subscription.status] ?? SubscriptionStatus.INCOMPLETE;

    // Type assertion for subscription properties (Stripe API may have different property names)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const sub = subscription as any;

    // Upsert UserPlan
    await db.userPlan.upsert({
        where: { userId },
        update: {
            planId: proPlan.id,
            status,
            stripeSubscriptionId: subscription.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        },
        create: {
            userId,
            planId: proPlan.id,
            status,
            stripeSubscriptionId: subscription.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        },
    });
}