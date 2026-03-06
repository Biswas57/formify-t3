import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            passwordHash: true,
            accounts: { select: { provider: true } },
        },
    });

    if (!user) redirect("/login");

    return (
        <ProfileClient
            user={{
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                // Pass whether they have a password without exposing the hash
                accounts: [
                    ...user.accounts,
                    // If passwordHash exists, represent it as a credentials account
                    // even if no Account row exists (legacy credential users)
                    ...(user.passwordHash && !user.accounts.find(a => a.provider === "credentials")
                        ? [{ provider: "credentials" }]
                        : []),
                ],
            }}
        />
    );
}