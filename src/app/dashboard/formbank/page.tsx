import { api, HydrateClient } from "@/trpc/server";
import { EXAMPLE_TEMPLATES, SYSTEM_BLOCKS } from "@/server/blocks-library";
import TemplateList from "./TemplateList";

export const metadata = { title: "Formify" };

export default async function TemplatesPage() {
    // Prefetch only what this page actually uses.
    //
    // Removed: entitlements.me — already prefetched by dashboard/layout.tsx,
    //   which wraps this page. Prefetching it again issues a duplicate DB query.
    //
    // Removed: usage.getToday — not used on the form bank page. Was being
    //   prefetched speculatively "in case the user navigates to profile", which
    //   adds server work to an already-slow page for a navigation that may never
    //   happen.
    //
    // Kept: template.listSummary — primary data for this page, now using the
    //   lightweight summary query instead of the full nested list.
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