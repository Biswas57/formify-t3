import { Suspense } from "react";
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

    return (
        <Suspense fallback={<div className="min-h-screen bg-[#FBFBFB]" />}>
            <TranscriptionClient user={session.user} />
        </Suspense>
    );
}