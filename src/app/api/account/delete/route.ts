// src/app/api/account/delete/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { stripe } from "@/server/billing/stripe";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const user = await db.user.findUnique({
        where: { id: userId },
        include: { userPlan: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Cancel Stripe subscription if active, so the customer isn't billed again
    if (user.userPlan?.stripeSubscriptionId) {
        try {
            await stripe.subscriptions.cancel(user.userPlan.stripeSubscriptionId);
        } catch (err) {
            // Log but don't block deletion — subscription may already be canceled
            console.error("[delete-account] Stripe cancel error:", err);
        }
    }

    // Cascade deletes handle templates, blocks, userPlan, transcriptionUsage via FK
    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
}