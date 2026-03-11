import { api, HydrateClient } from "@/trpc/server";
import { EXAMPLE_TEMPLATES, SYSTEM_BLOCKS } from "@/server/blocks-library";
import TemplateList from "./TemplateList";

export const metadata = { title: "Formify" };

export default async function TemplatesPage() {
    // Prefetch all three in parallel so the page dehydrates a complete cache
    // snapshot into the HTML stream. Without this, each useQuery on the client
    // fires a separate round-trip on mount, causing the waterfall seen in logs.
    //
    // entitlements.me  → feeds Pro badge + feature gates in TemplateList
    // usage.getToday   → warms cache for profile/billing card navigation
    // template.list    → primary page data
    void Promise.all([
        api.template.list.prefetch(),
        api.entitlements.me.prefetch(),
        api.usage.getToday.prefetch(),
    ]);

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