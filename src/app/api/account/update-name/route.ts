// src/app/api/account/update-name/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1).max(100) });

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

    await db.user.update({
        where: { id: session.user.id },
        data: { name: parsed.data.name },
    });

    return NextResponse.json({ success: true });
}