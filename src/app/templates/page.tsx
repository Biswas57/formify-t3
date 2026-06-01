import { api, HydrateClient } from "@/trpc/server";
import { EXAMPLE_TEMPLATES, SYSTEM_BLOCKS } from "@/server/blocks-library";
import TemplateList from "./TemplateList";

export const metadata = { title: "My Templates — Formify" };

export default async function TemplatesPage() {
    void api.template.listSummary.prefetch();

    return (
        <HydrateClient>
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
                    <TemplateList
                        exampleTemplates={EXAMPLE_TEMPLATES}
                        systemBlocks={SYSTEM_BLOCKS}
                    />
                </div>
            </div>
        </HydrateClient>
    );
}
