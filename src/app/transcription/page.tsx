import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";
import TranscriptionClient from "./TranscriptionClient";

export const metadata = {
    title: "Formify",
};

export default async function TranscriptionPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/transcription");
    }

    // Prefetch the template server-side so TranscriptionClient reads from the
    // dehydrated cache on first render instead of firing a cold client-side fetch.
    //
    // Without this: TranscriptionClient mounts → useQuery fires → 600–2271ms round-trip
    // → template arrives → WS start payload sent. User sees a blank/loading state
    // for the full duration of that fetch before anything can happen.
    //
    // With this: template data is already in the hydrated cache when the component
    // mounts, so useQuery resolves synchronously and the WS start fires immediately.
    //
    // We read templateId from searchParams here (server side) so we can prefetch
    // the right template. If no templateId, nothing to prefetch — the client uses
    // DEFAULT_TEMPLATE immediately.
    const params = await searchParams;
    const templateId = params.templateId;
    if (templateId) {
        // Prefetch in parallel with auth — both resolve before the page streams.
        // Ownership is enforced inside template.get (ownerId check), so a spoofed
        // templateId in the URL just results in a null cache entry, not a leak.
        void api.template.get.prefetch({ id: templateId });
    }

    return (
        <HydrateClient>
            <Suspense fallback={<div className="min-h-screen bg-[#FBFBFB]" />}>
                <TranscriptionClient user={session.user} />
            </Suspense>
        </HydrateClient>
    );
}