import nextEnv from "@next/env";
import { PrismaClient, SubscriptionStatus } from "../generated/prisma/index.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const targetEmail = "bissi.sim@gmail.com";

async function main() {
    await prisma.$transaction(async (tx) => {
        const proPlan = await tx.plan.findUnique({
            where: { slug: "pro" },
            select: { id: true, slug: true, name: true },
        });

        if (!proPlan) {
            throw new Error('Required Plan row with slug "pro" was not found.');
        }

        const user = await tx.user.findUnique({
            where: { email: targetEmail },
            select: { id: true, email: true },
        });

        if (!user) {
            throw new Error(`User with email "${targetEmail}" was not found.`);
        }

        const currentUserPlan = await tx.userPlan.findUnique({
            where: { userId: user.id },
            select: {
                id: true,
                userId: true,
                planId: true,
                status: true,
                plan: {
                    select: {
                        slug: true,
                    },
                },
            },
        });

        console.log("Current UserPlan state:");
        if (!currentUserPlan) {
            console.log({
                userId: user.id,
                email: user.email,
                planId: null,
                status: null,
                planSlug: null,
            });
        } else {
            console.log({
                userPlanId: currentUserPlan.id,
                userId: currentUserPlan.userId,
                email: user.email,
                planId: currentUserPlan.planId,
                status: currentUserPlan.status,
                planSlug: currentUserPlan.plan.slug,
            });
        }

        const updatedUserPlan = currentUserPlan
            ? await tx.userPlan.update({
                where: { id: currentUserPlan.id },
                data: {
                    planId: proPlan.id,
                    status: SubscriptionStatus.ACTIVE,
                },
                select: {
                    id: true,
                    userId: true,
                    planId: true,
                    status: true,
                    plan: {
                        select: {
                            slug: true,
                        },
                    },
                },
            })
            : await tx.userPlan.create({
                data: {
                    userId: user.id,
                    planId: proPlan.id,
                    status: SubscriptionStatus.ACTIVE,
                },
                select: {
                    id: true,
                    userId: true,
                    planId: true,
                    status: true,
                    plan: {
                        select: {
                            slug: true,
                        },
                    },
                },
            });

        console.log("Updated UserPlan state:");
        console.log({
            userPlanId: updatedUserPlan.id,
            userId: updatedUserPlan.userId,
            email: user.email,
            planId: updatedUserPlan.planId,
            status: updatedUserPlan.status,
            planSlug: updatedUserPlan.plan.slug,
        });
    });
}

main()
    .catch((error: unknown) => {
        console.error("[fix-pro-plan] Failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
