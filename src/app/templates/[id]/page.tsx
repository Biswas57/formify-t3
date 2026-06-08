import { notFound, redirect } from "next/navigation";
import { api, HydrateClient } from "@/trpc/server";
import { auth } from "@/server/auth";
import TemplateBuilderLazy from "../TemplateBuilderLazy";

export const metadata = { title: "Edit Template — Formify" };

export default async function EditTemplatePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user) {
        redirect(`/login?callbackUrl=${encodeURIComponent(`/templates/${id}`)}`);
    }

    const template = await api.template.getForBuilder({ id });
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
