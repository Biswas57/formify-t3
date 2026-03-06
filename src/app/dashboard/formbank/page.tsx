import { api, HydrateClient } from "@/trpc/server";
import { EXAMPLE_TEMPLATES, SYSTEM_BLOCKS } from "@/server/blocks-library";
import TemplateList from "./TemplateList";

export const metadata = { title: "Formify" };

export default async function TemplatesPage() {
    // Prefetch in parallel — HTML streams immediately, data dehydrates into it.
    // The client reads from the hydrated cache, no extra round-trips.
    void api.template.list.prefetch();

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