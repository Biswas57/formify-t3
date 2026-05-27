// src/app/api/account/delete/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Cascade deletes handle templates, blocks, transcriptionUsage, and notes.
    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
}
