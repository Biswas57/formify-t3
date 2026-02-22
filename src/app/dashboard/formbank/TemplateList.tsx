"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import {
    Plus, Mic, Pencil, Copy, Trash2, FileText,
    ChevronRight, Sparkles, MoreHorizontal, Search
} from "lucide-react";
import type { SystemBlock } from "@/server/blocks-library";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateField {
    key: string;
    label: string | null;
    fieldType: string;
    required: boolean;
    order: number;
}

interface TemplateBlock {
    id: string;
    title: string;
    sourceType: string;
    order: number;
    fields: TemplateField[];
}

interface Template {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    blocks: TemplateBlock[];
}

interface ExampleTemplate {
    id: string;
    name: string;
    blockIds: string[];
}

interface Props {
    initialTemplates: Template[];
    exampleTemplates: ExampleTemplate[];
    systemBlocks: SystemBlock[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TemplateList({ initialTemplates, exampleTemplates, systemBlocks }: Props) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    const utils = api.useUtils();

    const { data: templates = initialTemplates } = api.template.list.useQuery(undefined, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        initialData: initialTemplates as any,
    });

    const deleteMutation = api.template.delete.useMutation({
        onSuccess: () => void utils.template.list.invalidate(),
    });

    const duplicateMutation = api.template.duplicate.useMutation({
        onSuccess: () => void utils.template.list.invalidate(),
    });

    const createFromExample = api.template.create.useMutation({
        onSuccess: (t: Template) => router.push(`/dashboard/templates/${t.id}`),
    });

    const filtered = templates.filter((t: Template) =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = (id: string) => {
        deleteMutation.mutate({ id });
        setDeleteConfirm(null);
        setOpenMenu(null);
    };

    const handleDuplicate = (id: string) => {
        duplicateMutation.mutate({ id });
        setOpenMenu(null);
    };

    const handleUseExample = (ex: ExampleTemplate) => {
        const blocks = ex.blockIds
            .map((bid, idx) => {
                const sysBlock = systemBlocks.find((b) => b.id === bid);
                if (!sysBlock) return null;
                return {
                    title: sysBlock.name,
                    sourceType: "SYSTEM" as const,
                    sourceBlockId: bid,
                    order: idx,
                    fields: sysBlock.fields,
                };
            })
            .filter(Boolean) as {
                title: string;
                sourceType: "SYSTEM";
                sourceBlockId: string;
                order: number;
                fields: { key: string; label: string; fieldType: "TEXT" | "NUMBER" | "DATE" | "EMAIL" | "PHONE" | "TEXTAREA" | "SELECT"; required: boolean; order: number }[];
            }[];

        createFromExample.mutate({ name: ex.name, blocks });
    };

    const formatDate = (d: Date) =>
        new Date(d).toLocaleDateString("en-AU", {
            day: "numeric", month: "short", year: "numeric",
        });

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Form Bank</h1>
                    <p className="text-sm text-[#868C94] mt-1">Your saved templates</p>
                </div>
                <Link href="/dashboard/create">
                    <button className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all duration-200 hover:scale-[1.02]">
                        <Plus className="w-4 h-4" />
                        New Template
                    </button>
                </Link>
            </div>

            {/* Search */}
            {templates.length > 3 && (
                <div className="relative mb-5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#868C94]" />
                    <input
                        type="text"
                        placeholder="Search templates…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 transition-all"
                    />
                </div>
            )}

            {/* My Templates */}
            {filtered.length > 0 ? (
                <div className="space-y-2 mb-10">
                    {filtered.map((template: Template) => (
                        <TemplateRow
                            key={template.id}
                            template={template}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            deleteConfirm={deleteConfirm}
                            setDeleteConfirm={setDeleteConfirm}
                            onDelete={handleDelete}
                            onDuplicate={handleDuplicate}
                            isDeleting={deleteMutation.isPending}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center mb-10">
                    <div className="w-14 h-14 bg-[#e8eef9] rounded-xl flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-7 h-7 text-[#2149A1]" />
                    </div>
                    <p className="text-slate-600 font-medium mb-1">No templates yet</p>
                    <p className="text-sm text-[#868C94] mb-5">
                        Create your first template or start from an example below.
                    </p>
                    <Link href="/dashboard/create">
                        <button className="bg-[#2149A1] hover:bg-[#1a3a87] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200">
                            Create Template
                        </button>
                    </Link>
                </div>
            )}

            {/* Example Templates */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-[#868C94]" />
                    <h2 className="text-sm font-semibold text-[#868C94] uppercase tracking-widest">
                        Starter Templates
                    </h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {exampleTemplates.map((ex) => {
                        const previewBlocks = ex.blockIds
                            .map((bid) => systemBlocks.find((b) => b.id === bid)?.name)
                            .filter(Boolean);
                        return (
                            <div
                                key={ex.id}
                                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-[#2149A1]/30 hover:shadow-sm transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-9 h-9 bg-[#e8eef9] rounded-lg flex items-center justify-center">
                                        <FileText className="w-4 h-4 text-[#2149A1]" />
                                    </div>
                                </div>
                                <p className="font-semibold text-slate-800 text-sm mb-2">{ex.name}</p>
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {previewBlocks.map((name) => (
                                        <span key={name} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                            {name}
                                        </span>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleUseExample(ex)}
                                    disabled={createFromExample.isPending}
                                    className="flex items-center gap-1.5 text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] transition-colors disabled:opacity-50"
                                >
                                    Use this template <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Template Row ─────────────────────────────────────────────────────────────

function TemplateRow({
    template,
    openMenu,
    setOpenMenu,
    deleteConfirm,
    setDeleteConfirm,
    onDelete,
    onDuplicate,
    isDeleting,
}: {
    template: Template;
    openMenu: string | null;
    setOpenMenu: (id: string | null) => void;
    deleteConfirm: string | null;
    setDeleteConfirm: (id: string | null) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    isDeleting: boolean;
}) {
    const router = useRouter();
    const blockCount = template.blocks.length;
    const fieldCount = template.blocks.reduce((sum, b) => sum + b.fields.length, 0);

    const formatDate = (d: Date) =>
        new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

    return (
        <div className="group bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-[#2149A1]/30 hover:shadow-sm transition-all relative">
            <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="w-9 h-9 bg-[#e8eef9] rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#2149A1]" />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 text-sm">{template.name}</p>
                        {/* Block chips — show on hover via group */}
                        <div className="hidden group-hover:flex items-center gap-1.5 flex-wrap">
                            {template.blocks.map((b) => (
                                <span key={b.id} className="text-xs bg-[#e8eef9] text-[#2149A1] px-2 py-0.5 rounded-full border border-[#2149A1]/20">
                                    {b.title}
                                </span>
                            ))}
                        </div>
                    </div>
                    <p className="text-xs text-[#868C94] mt-0.5">
                        {blockCount} block{blockCount !== 1 ? "s" : ""} · {fieldCount} field{fieldCount !== 1 ? "s" : ""} · Updated {formatDate(template.updatedAt)}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/transcription?templateId=${template.id}`}>
                        <button className="flex items-center gap-1.5 bg-[#2149A1] hover:bg-[#1a3a87] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                            <Mic className="w-3 h-3" />
                            Record
                        </button>
                    </Link>
                    <Link href={`/dashboard/templates/${template.id}`}>
                        <button className="flex items-center gap-1.5 border border-slate-200 hover:border-[#2149A1] hover:text-[#2149A1] text-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                            <Pencil className="w-3 h-3" />
                            Edit
                        </button>
                    </Link>

                    {/* More menu */}
                    <div className="relative">
                        <button
                            onClick={() => setOpenMenu(openMenu === template.id ? null : template.id)}
                            className="p-1.5 rounded-lg text-[#868C94] hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openMenu === template.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                                <button
                                    onClick={() => onDuplicate(template.id)}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    Duplicate
                                </button>
                                {deleteConfirm === template.id ? (
                                    <div className="px-3 py-2">
                                        <p className="text-xs text-red-600 mb-2">Delete this template?</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onDelete(template.id)}
                                                disabled={isDeleting}
                                                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium py-1 rounded transition-colors disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="flex-1 border border-slate-200 text-slate-600 text-xs font-medium py-1 rounded transition-colors hover:bg-slate-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeleteConfirm(template.id)}
                                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}