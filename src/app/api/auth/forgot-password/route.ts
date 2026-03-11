// src/app/api/auth/forgot-password/route.ts

import { NextResponse } from "next/server";
import { db } from "@/server/db";
import crypto from "crypto";

// Token TTL: 1 hour
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const email = typeof body === "object" && body !== null && "email" in body
        ? String((body as { email: unknown }).email)
        : null;

    if (!email?.includes("@")) {
        return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    // Always return 200 — never confirm whether an email exists in the system.
    // This prevents email enumeration attacks.
    const successResponse = NextResponse.json({ ok: true });

    try {
        const user = await db.user.findUnique({
            where: { email: email.toLowerCase().trim() },
            select: { id: true, email: true, name: true, passwordHash: true },
        });

        // If no user, or user signed up via Google (no passwordHash), silently return.
        if (!user?.passwordHash) return successResponse;

        // Generate a cryptographically secure token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        // Delete any existing tokens for this user before creating a new one
        // Requires PasswordResetToken table — this will throw if migration not run yet.
        // Wrapped in try/catch so it degrades gracefully pre-migration.
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await (db as any).passwordResetToken.deleteMany({ where: { userId: user.id } });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await (db as any).passwordResetToken.create({
                data: { userId: user.id, token: rawToken, expiresAt },
            });
        } catch (dbErr) {
            // Table doesn't exist yet — log and return success without sending email
            console.warn("[forgot-password] PasswordResetToken table not found — run the migration.");
            console.warn("[forgot-password] Error:", dbErr);
            return successResponse;
        }

        // Build reset URL
        const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

        // Send email — uses Resend if configured, logs the URL otherwise
        // If you have Resend configured (RESEND_API_KEY), swap in the send call here.
        // For now, we log the URL — this is intentional for environments without email configured.
        if (process.env.RESEND_API_KEY) {
            const { Resend } = await import("resend");
            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
                from: process.env.EMAIL_FROM ?? "Formify <noreply@formify.app>",
                to: user.email!,
                subject: "Reset your Formify password",
                html: `
                    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                        <div style="background: #2149A1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Formify</h1>
                        </div>
                        <h2 style="color: #0f172a; font-size: 20px; margin-bottom: 12px;">Reset your password</h2>
                        <p style="color: #475569; margin-bottom: 24px;">
                            Hi ${user.name ?? "there"},<br><br>
                            We received a request to reset your Formify password. Click the button below to choose a new password.
                        </p>
                        <a href="${resetUrl}" style="display: inline-block; background: #2149A1; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
                            Reset password
                        </a>
                        <p style="color: #94a3b8; font-size: 13px;">
                            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                        <p style="color: #94a3b8; font-size: 12px;">
                            If the button doesn't work, copy this URL: <a href="${resetUrl}" style="color: #2149A1;">${resetUrl}</a>
                        </p>
                    </div>
                `,
            });

            console.log(`[forgot-password] Reset email sent to ${user.email}`);
        } else {
            // Development fallback: log the reset URL to the server console
            console.log(`[forgot-password] No email provider configured. Reset URL for ${user.email}:`);
            console.log(`[forgot-password] ${resetUrl}`);
        }
    } catch (err) {
        console.error("[forgot-password] Error:", err);
        // Return success regardless — prevents email enumeration
    }

    return successResponse;
}