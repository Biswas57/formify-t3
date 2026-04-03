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
    const userId =
        session.metadata?.userId ??
        session.client_reference_id ??
        null;
    const subscriptionId = session.subscription as string | null;

    if (!userId || !subscriptionId) {
        console.error("[Stripe Webhook] Missing checkout user mapping", {
            sessionId: session.id,
            userId,
            subscriptionId,
            hasMetadataUserId: !!session.metadata?.userId,
            clientReferenceId: session.client_reference_id,
        });
        return;
    }

    const customerId =
        typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

    if (customerId) {
        const linkedCustomer = await db.user.updateMany({
            where: {
                id: userId,
                stripeCustomerId: null,
            },
            data: { stripeCustomerId: customerId },
        });

        if (linkedCustomer.count > 0) {
            console.log("[Stripe Webhook] Linked customer to user", {
                userId,
                customerId,
                source: session.metadata?.userId ? "metadata" : "client_reference_id",
            });
        }
    }

    // Fetch full subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertUserPlan(userId, subscription);

    console.log("[Stripe Webhook] Checkout completed", {
        userId,
        subscriptionId,
        source: session.metadata?.userId ? "metadata" : "client_reference_id",
    });
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
            console.error("[Stripe Webhook] Could not find user for subscription", {
                subscriptionId: subscription.id,
                customerId: subscription.customer,
            });
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
    // Get-or-create the Pro plan atomically.
    // The old findUnique ?? create pattern is not safe under concurrent webhooks —
    // two simultaneous events can both see null and both try to create, crashing
    // on the unique constraint for slug. upsert is a single atomic operation.
    // The update side also keeps featuresJson in sync with the code definition.
    const proPlan = await db.plan.upsert({
        where: { slug: "pro" },
        update: {
            featuresJson: JSON.stringify(PLAN_FEATURES.pro ?? []),
        },
        create: {
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

    // Upsert UserPlan.
    // planId MUST appear in the update block as well as create.
    // Without it, users who already have a UserPlan row (e.g. anyone who
    // existed before subscribing) never get their planId switched to pro —
    // their row stays pointing at whatever plan it was before, so
    // getUserEntitlements reads the wrong featuresJson and returns [] features,
    // causing Pro subscribers to incorrectly hit the free-tier daily limit.
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

    console.log("[Stripe Webhook] Activated Pro entitlements", {
        userId,
        subscriptionId: subscription.id,
        status,
        planSlug: proPlan.slug,
    });
}
