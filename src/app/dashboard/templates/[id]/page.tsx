import { notFound } from "next/navigation";
import { api } from "@/trpc/server";
import TemplateBuilder from "../../TemplateBuilder";

export const metadata = { title: "Edit Template — Formify" };

export default async function EditTemplatePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [template, library] = await Promise.all([
        api.template.get({ id }),
        api.block.listLibrary(),
    ]);

    if (!template) notFound();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const templateAny = template as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const userBlocksAny = library.userBlocks as any;

    return (
        <TemplateBuilder
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            initialTemplate={templateAny}
            systemBlocks={library.systemBlocks}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            userBlocks={userBlocksAny}
        />
    );
}