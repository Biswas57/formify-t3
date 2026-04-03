import { loadEnvConfig } from "@next/env";
import Stripe from "stripe";
import {
    PrismaClient,
    SubscriptionStatus,
    type SubscriptionStatus as SubscriptionStatusType,
} from "../generated/prisma/index.js";
import { PLAN_FEATURES } from "../src/server/entitlements/features.js";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

const ACTIVE_STATUSES: SubscriptionStatusType[] = [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIALING,
    SubscriptionStatus.PAST_DUE,
];

function buildStripeClient() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) return null;

    return new Stripe(stripeSecretKey, {
        apiVersion: "2026-02-25.clover",
        typescript: true,
    });
}

async function main() {
    const stripe = buildStripeClient();

    const proPlan = await prisma.plan.upsert({
        where: { slug: "pro" },
        update: {
            name: "Pro",
            stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
            featuresJson: JSON.stringify(PLAN_FEATURES.pro ?? []),
        },
        create: {
            name: "Pro",
            slug: "pro",
            stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
            featuresJson: JSON.stringify(PLAN_FEATURES.pro ?? []),
        },
    });

    console.log("[repair-pro-entitlements] Ensured Pro plan", {
        planId: proPlan.id,
        slug: proPlan.slug,
    });

    const plansToRelink = await prisma.userPlan.findMany({
        where: {
            status: { in: ACTIVE_STATUSES },
            planId: { not: proPlan.id },
        },
        select: {
            id: true,
            userId: true,
            status: true,
            stripeSubscriptionId: true,
            plan: { select: { slug: true } },
            user: { select: { email: true, stripeCustomerId: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    const relinkedRows: Array<Record<string, string | null>> = [];

    for (const userPlan of plansToRelink) {
        await prisma.userPlan.update({
            where: { id: userPlan.id },
            data: { planId: proPlan.id },
        });

        const change = {
            userPlanId: userPlan.id,
            userId: userPlan.userId,
            previousPlanSlug: userPlan.plan.slug,
            nextPlanSlug: proPlan.slug,
            status: userPlan.status,
            stripeSubscriptionId: userPlan.stripeSubscriptionId,
            email: userPlan.user.email,
        };
        relinkedRows.push(change);
        console.log("[repair-pro-entitlements] Relinked active subscription", change);
    }

    const customerSyncCandidates = await prisma.userPlan.findMany({
        where: {
            status: { in: ACTIVE_STATUSES },
            stripeSubscriptionId: { not: null },
            user: { is: { stripeCustomerId: null } },
        },
        select: {
            id: true,
            userId: true,
            stripeSubscriptionId: true,
            user: { select: { email: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    const linkedCustomers: Array<Record<string, string | null>> = [];

    if (!stripe) {
        console.warn(
            "[repair-pro-entitlements] STRIPE_SECRET_KEY is missing; skipping customer reconciliation."
        );
    } else {
        for (const userPlan of customerSyncCandidates) {
            if (!userPlan.stripeSubscriptionId) continue;

            const subscription = await stripe.subscriptions.retrieve(
                userPlan.stripeSubscriptionId
            );
            const customerId =
                typeof subscription.customer === "string"
                    ? subscription.customer
                    : subscription.customer?.id ?? null;

            if (!customerId) {
                console.warn(
                    "[repair-pro-entitlements] Subscription had no customer to link",
                    {
                        userPlanId: userPlan.id,
                        userId: userPlan.userId,
                        subscriptionId: userPlan.stripeSubscriptionId,
                    }
                );
                continue;
            }

            const updatedUser = await prisma.user.updateMany({
                where: {
                    id: userPlan.userId,
                    stripeCustomerId: null,
                },
                data: { stripeCustomerId: customerId },
            });

            if (updatedUser.count === 0) continue;

            const change = {
                userPlanId: userPlan.id,
                userId: userPlan.userId,
                stripeSubscriptionId: userPlan.stripeSubscriptionId,
                customerId,
                email: userPlan.user.email,
            };
            linkedCustomers.push(change);
            console.log("[repair-pro-entitlements] Linked Stripe customer", change);
        }
    }

    console.log("[repair-pro-entitlements] Complete", {
        relinkedCount: relinkedRows.length,
        linkedCustomerCount: linkedCustomers.length,
    });
}

main()
    .catch((error: unknown) => {
        console.error("[repair-pro-entitlements] Failed", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
