import { notFound } from "next/navigation";
import { api, HydrateClient } from "@/trpc/server";
import TemplateBuilderLazy from "../TemplateBuilderLazy";

export const metadata = { title: "Edit Template — Formify" };

export default async function EditTemplatePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    void api.block.listLibrary.prefetch();

    const template = await api.template.get({ id });
    if (!template) notFound();

    return (
        <HydrateClient>
            <TemplateBuilderLazy
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
                initialTemplate={template as any}
                returnTo="/templates"
            />
        </HydrateClient>
    );
}
