"use client";

// `ssr: false` is only valid inside a Client Component (Next.js 15 rule).
// This thin wrapper owns the dynamic() call so that Server Component pages
// (create/page.tsx, templates/[id]/page.tsx) can still defer the JS bundle.

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

function TemplateBuilderSkeleton() {
    return (
        <div className="flex flex-col flex-1 min-h-0 bg-[#FBFBFB]">
            {/* Top bar skeleton */}
            <div className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-3.5 border-b border-slate-200 bg-white">
                <div className="w-24 h-5 bg-slate-200 rounded animate-pulse" />
                <div className="w-px h-5 bg-slate-200" />
                <div className="flex-1 h-6 bg-slate-200 rounded animate-pulse max-w-xs" />
                <div className="w-20 h-9 bg-slate-200 rounded-lg animate-pulse ml-auto" />
            </div>
            {/* Body skeleton */}
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
                {/* Library panel skeleton — desktop only */}
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

const DynamicTemplateBuilder = dynamic(() => import("./TemplateBuilder"), {
    loading: () => <TemplateBuilderSkeleton />,
    ssr: false, // TemplateBuilder uses DnD refs and browser-only APIs
});

export default function TemplateBuilderLazy(
    props: ComponentProps<typeof DynamicTemplateBuilder>
) {
    return <DynamicTemplateBuilder {...props} />;
}
