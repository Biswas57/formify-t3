import { notFound } from "next/navigation";
import { api, HydrateClient } from "@/trpc/server";
import TemplateBuilderLazy from "../../TemplateBuilderLazy";

export const metadata = { title: "Edit Template — Formify" };

export default async function EditTemplatePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Prefetch block library in parallel — dehydrates into the page shell.
    void api.block.listLibrary.prefetch();

    // Fetch template server-side: used for the notFound() guard AND passed
    // as initialTemplate prop. TemplateBuilder initialises canvas state from
    // this prop, so no separate client-side api.template.get.useQuery() call
    // is needed — prefetching it would hit the DB twice for no benefit.
    const template = await api.template.get({ id });
    if (!template) notFound();

    return (
        <HydrateClient>
            <TemplateBuilderLazy
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
                initialTemplate={template as any}
            />
        </HydrateClient>
    );
}