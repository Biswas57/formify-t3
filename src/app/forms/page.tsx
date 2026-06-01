import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";
import TranscriptionClient from "@/app/transcription/TranscriptionClient";

export const metadata = { title: "Forms — Formify" };

export default async function FormsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/login?callbackUrl=/forms");

    void api.template.listSummary.prefetch();

    const params = await searchParams;
    const templateId = Array.isArray(params.templateId) ? params.templateId[0] : params.templateId;
    if (templateId) {
        void api.template.get.prefetch({ id: templateId });
    }

    return (
        <HydrateClient>
            <Suspense fallback={<div className="flex-1 bg-[#FBFBFB] dark:bg-slate-950" />}>
                <TranscriptionClient user={session.user} />
            </Suspense>
        </HydrateClient>
    );
}
