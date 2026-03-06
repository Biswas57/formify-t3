import { api, HydrateClient } from "@/trpc/server";
import TemplateBuilderLazy from "../TemplateBuilderLazy";

export const metadata = { title: "New Template — Formify" };

export default async function NewTemplatePage() {
    // Prefetch block library server-side — dehydrates into HTML.
    // TemplateBuilder reads from cache on mount, no client waterfall.
    void api.block.listLibrary.prefetch();

    return (
        <HydrateClient>
            <TemplateBuilderLazy />
        </HydrateClient>
    );
}