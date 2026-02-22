import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export const metadata = { title: "Profile — Formify" };

export default async function ProfilePage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
            accounts: { select: { provider: true } },
            _count: { select: { templates: true } },
        },
    });

    if (!user) redirect("/login");

    return <ProfileClient user={user} />;
}