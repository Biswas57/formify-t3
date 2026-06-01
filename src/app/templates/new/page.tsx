import { api, HydrateClient } from "@/trpc/server";
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
    void api.block.listLibrary.prefetch();

    const params = await searchParams;
    const returnTo = safeReturnTo(params.returnTo);

    return (
        <HydrateClient>
            <TemplateBuilderLazy returnTo={returnTo} />
        </HydrateClient>
    );
}
