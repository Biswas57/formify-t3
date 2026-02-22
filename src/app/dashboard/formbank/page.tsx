import { api } from "@/trpc/server";
import { EXAMPLE_TEMPLATES, SYSTEM_BLOCKS } from "@/server/blocks-library";
import TemplateList from "./TemplateList";

export const metadata = { title: "Formify" };

export default async function TemplatesPage() {
    const templates = await api.template.list();

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
                <TemplateList
                    initialTemplates={templates}
                    exampleTemplates={EXAMPLE_TEMPLATES}
                    systemBlocks={SYSTEM_BLOCKS}
                />
            </div>
        </div>
    );
}