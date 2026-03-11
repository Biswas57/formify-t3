// src/app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { token, password } = body as { token?: unknown; password?: unknown };

    // Validate token
    if (!token || typeof token !== "string" || token.trim() === "") {
        return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
    }

    // Validate password
    if (!password || typeof password !== "string" || password.length < 8) {
        return NextResponse.json(
            { error: "Password must be at least 8 characters." },
            { status: 400 }
        );
    }

    // Look up the token — check expiry in the same query
    const resetToken = await db.passwordResetToken.findUnique({
        where: { token: token.trim() },
        select: { id: true, userId: true, expiresAt: true },
    });

    // Always return 400 (not 404) — never leak whether a token ever existed
    if (!resetToken || resetToken.expiresAt < new Date()) {
        return NextResponse.json(
            { error: "This reset link is invalid or has expired." },
            { status: 400 }
        );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // In a single transaction: update the user's password and delete all their reset tokens
    await db.$transaction([
        db.user.update({
            where: { id: resetToken.userId },
            data: { passwordHash },
        }),
        db.passwordResetToken.deleteMany({
            where: { userId: resetToken.userId },
        }),
    ]);

    return NextResponse.json({ ok: true });
}