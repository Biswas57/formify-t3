import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json();
        const parsed = registerSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input. Please check your details." },
                { status: 400 }
            );
        }

        const { name, email, password } = parsed.data;

        // Check for existing account
        const existing = await db.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json(
                { error: "An account with this email already exists." },
                { status: 409 }
            );
        }

        // Hash password (12 rounds — good balance of security vs. speed)
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        await db.user.create({
            data: { name, email, passwordHash },
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err) {
        console.error("Registration error:", err);
        return NextResponse.json(
            { error: "Internal server error. Please try again." },
            { status: 500 }
        );
    }
}