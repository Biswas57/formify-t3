import { PrismaClient } from "../generated/prisma/index.js";
import { PLAN_FEATURES } from "../src/server/entitlements/features.js";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding plans...");

    // Free plan — no features, no Stripe price
    await prisma.plan.upsert({
        where: { slug: "free" },
        create: {
            name: "Free",
            slug: "free",
            stripePriceId: null,
            featuresJson: JSON.stringify(PLAN_FEATURES.free ?? []),
        },
        update: {
            name: "Free",
            featuresJson: JSON.stringify(PLAN_FEATURES.free ?? []),
        },
    });

    // Pro plan — all features, price ID from env
    await prisma.plan.upsert({
        where: { slug: "pro" },
        create: {
            name: "Pro",
            slug: "pro",
            stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
            featuresJson: JSON.stringify(PLAN_FEATURES.pro ?? []),
        },
        update: {
            name: "Pro",
            stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
            featuresJson: JSON.stringify(PLAN_FEATURES.pro ?? []),
        },
    });

    console.log("Plans seeded successfully.");
}

main()
    .then(async () => { await prisma.$disconnect(); })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });