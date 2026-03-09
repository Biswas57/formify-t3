import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import NotesClient from "./NotesClient";

export const metadata = {
    title: "Notes — Formify",
    description: "Voice-powered note taking",
};

export default async function NotesPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    return <NotesClient user={session.user} />;
}
