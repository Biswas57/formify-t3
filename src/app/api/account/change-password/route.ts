// src/app/api/account/change-password/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // If the user already has a password, verify the current one first
    if (user.passwordHash) {
        if (!parsed.data.currentPassword) {
            return NextResponse.json({ error: "Current password is required" }, { status: 400 });
        }
        const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
        if (!valid) {
            return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
        }
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({ where: { id: session.user.id }, data: { passwordHash } });

    // If this is a Google-only user setting a password for the first time,
    // also create a credentials account entry so they can sign in with email+password
    if (!user.passwordHash && user.email) {
        const existingCredentials = await db.account.findFirst({
            where: { userId: user.id, provider: "credentials" },
        });
        if (!existingCredentials) {
            await db.account.create({
                data: {
                    userId: user.id,
                    type: "credentials",
                    provider: "credentials",
                    providerAccountId: user.id,
                },
            });
        }
    }

    return NextResponse.json({ success: true });
}