import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import TranscriptionClient from "./TranscriptionClient";

export const metadata = {
    title: "Recording — Formify",
};

export default async function TranscriptionPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/transcription");
    }

    return <TranscriptionClient user={session.user} />;
}