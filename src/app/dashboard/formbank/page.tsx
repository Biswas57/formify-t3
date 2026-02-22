import { api } from "@/trpc/server";
import { EXAMPLE_TEMPLATES, SYSTEM_BLOCKS } from "@/server/blocks-library";
import TemplateList from "./TemplateList";

export const metadata = { title: "Formify" };

export default async function TemplatesPage() {
    const templates = await api.template.list();

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-8 md:pt-8 pt-16">
                <TemplateList
                    initialTemplates={templates}
                    exampleTemplates={EXAMPLE_TEMPLATES}
                    systemBlocks={SYSTEM_BLOCKS}
                />
            </div>
        </div>
    );
}