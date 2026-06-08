import { HydrateClient } from "@/trpc/server";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import TemplateBuilderLazy from "../TemplateBuilderLazy";

export const metadata = { title: "New Template — Formify" };

function safeReturnTo(value: string | string[] | undefined): "/templates" | "/forms" {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate === "/forms" || candidate === "/templates" ? candidate : "/templates";
}

export default async function NewTemplatePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const returnTo = safeReturnTo(params.returnTo);
    const callbackUrl = returnTo === "/forms" ? "/templates/new?returnTo=/forms" : "/templates/new";

    const session = await auth();
    if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

    return (
        <HydrateClient>
            <TemplateBuilderLazy returnTo={returnTo} />
        </HydrateClient>
    );
}
