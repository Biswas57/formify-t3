import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyWebhookSignature, stripe } from "@/server/billing/stripe";
import { db } from "@/server/db";
import type Stripe from "stripe";
import { SubscriptionStatus } from "../../../../../generated/prisma";
import { PLAN_FEATURES } from "@/server/entitlements/features";

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

        const event = verifyWebhookSignature(body, signature);
        console.log(`[Stripe Webhook] Received event: ${event.type}`);

        switch (event.type) {
            case "checkout.session.completed": {
                await handleCheckoutCompleted(event.data.object);
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated": {
                await handleSubscriptionUpdated(event.data.object);
                break;
            }
            case "customer.subscription.deleted": {
                await handleSubscriptionDeleted(event.data.object);
                break;
            }
            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error("[Stripe Webhook] Error:", err);
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 400 });
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    // Pricing table flow: userId lands in client_reference_id (Stripe never
    // touches metadata for pricing table checkouts).
    // Direct checkout flow: userId is in metadata.userId (set by createCheckoutSession).
    // Fall through both so either path activates the account.
    const userId =
        session.metadata?.userId ??
        session.client_reference_id ??
        null;

    const subscriptionId = session.subscription as string | null;

    if (!userId || !subscriptionId) {
        console.error(
            "[Stripe Webhook] handleCheckoutCompleted: missing userId or subscriptionId",
            { userId, subscriptionId, sessionId: session.id }
        );
        return;
    }

    // --- Fix for pricing table flow ---
    // The pricing table creates a new Stripe customer automatically.
    // Our direct-checkout path writes stripeCustomerId during createCheckoutSession,
    // but the pricing table bypasses that. If we don't write it here, every future
    // customer.subscription.* event will fail the stripeCustomerId lookup and log
    // "Could not find user for subscription".
    if (session.customer) {
        const customerId = session.customer as string;
        await db.user.updateMany({
            where: {
                id: userId,
                // Only write if not already set — avoids overwriting a previously
                // linked customer if someone somehow completes checkout twice.
                stripeCustomerId: null,
            },
            data: { stripeCustomerId: customerId },
        });
        console.log(
            `[Stripe Webhook] Linked stripeCustomerId ${customerId} → userId ${userId}`
        );
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertUserPlan(userId, subscription);

    console.log(
        `[Stripe Webhook] Checkout completed — userId: ${userId}, source: ${session.metadata?.userId ? "metadata" : "client_reference_id"
        }`
    );
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;

    if (!userId) {
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

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await db.userPlan.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: "CANCELED", cancelAtPeriodEnd: true },
    });
    console.log(`[Stripe Webhook] Subscription deleted: ${subscription.id}`);
}

async function upsertUserPlan(userId: string, subscription: Stripe.Subscription) {
    const proPlan =
        (await db.plan.findUnique({ where: { slug: "pro" } })) ??
        (await db.plan.create({
            data: {
                name: "Pro",
                slug: "pro",
                featuresJson: JSON.stringify(PLAN_FEATURES.pro ?? []),
            },
        }));

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const sub = subscription as any;

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        },
    });

    console.log(
        `[Stripe Webhook] UserPlan upserted — userId: ${userId}, status: ${status}`
    );
}