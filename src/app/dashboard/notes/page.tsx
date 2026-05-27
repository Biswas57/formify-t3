// src/app/dashboard/notes/page.tsx

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import NotesClient from "./NotesClient";

export const metadata = { title: "Voice Notes — Formify" };

export default async function NotesPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    return <NotesClient user={session.user} />;
}
