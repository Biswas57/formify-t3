import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { api, HydrateClient } from "@/trpc/server";
import { SYSTEM_BLOCKS } from "@/server/blocks-library";

export const metadata = { title: "Edit Template — Formify" };

// Fix 4: Same lazy-load as create page — defer TemplateBuilder JS parse.
const TemplateBuilder = dynamic(() => import("../../TemplateBuilder"), {
    loading: () => <TemplateBuilderSkeleton />,
    ssr: false,
});

function TemplateBuilderSkeleton() {
    return (
        <div className="flex flex-col flex-1 min-h-0 bg-[#FBFBFB]">
            <div className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-3.5 border-b border-slate-200 bg-white">
                <div className="w-24 h-5 bg-slate-200 rounded animate-pulse" />
                <div className="w-px h-5 bg-slate-200" />
                <div className="flex-1 h-6 bg-slate-200 rounded animate-pulse max-w-xs" />
                <div className="w-20 h-9 bg-slate-200 rounded-lg animate-pulse ml-auto" />
            </div>
            <div className="flex flex-1 min-h-0">
                <div className="flex-1 px-4 md:px-6 py-6 space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-32 mb-3" />
                            <div className="grid grid-cols-2 gap-2">
                                {[1, 2, 3, 4].map((j) => (
                                    <div key={j} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="hidden md:flex md:flex-col w-72 border-l border-slate-200 bg-white px-4 py-4 space-y-2">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-24 mb-2" />
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

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
            <TemplateBuilder
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                initialTemplate={template as any}
            />
        </HydrateClient>
    );
}