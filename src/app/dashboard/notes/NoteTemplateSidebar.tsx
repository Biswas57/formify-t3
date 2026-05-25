"use client";

import { useState } from "react";
import {
    BookMarked, Check, Loader2, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { api } from "@/trpc/react";

type NoteStyle = "general" | "clinical" | "meeting" | "study";

interface NoteTemplateSummary {
    id: string;
    title: string;
    noteStyle: string;
    sections: string;
}

interface NoteTemplateSidebarProps {
    currentTitle: string;
    currentNoteStyle: NoteStyle;
    currentSectionsRaw: string;
    canSelect: boolean;
    onSelect: (title: string, noteStyle: NoteStyle, sections: string) => void;
    onClose?: () => void;
}

const NOTE_STYLE_LABELS: Record<NoteStyle, string> = {
    general: "General",
    clinical: "Clinical",
    meeting: "Meeting",
    study: "Study",
};

const NOTE_TEMPLATE_LIMIT = 10;
const NOTE_STYLE_VALUES = ["general", "clinical", "meeting", "study"] as const;

function toNoteStyle(value: string): NoteStyle {
    return NOTE_STYLE_VALUES.includes(value as NoteStyle) ? (value as NoteStyle) : "general";
}

export default function NoteTemplateSidebar({
    currentTitle,
    currentNoteStyle,
    currentSectionsRaw,
    canSelect,
    onSelect,
    onClose,
}: NoteTemplateSidebarProps) {
    const utils = api.useUtils();
    const [isSaving, setIsSaving] = useState(false);
    const [templateTitle, setTemplateTitle] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data: templates = [], isLoading } = api.noteTemplate.list.useQuery(undefined, {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
    });

    const createMutation = api.noteTemplate.create.useMutation();
    const renameMutation = api.noteTemplate.rename.useMutation();
    const deleteMutation = api.noteTemplate.delete.useMutation();

    const openSaveForm = () => {
        setTemplateTitle(currentTitle.trim() || "Untitled notes");
        setFormError(null);
        setActionError(null);
        setIsSaving(true);
    };

    const handleCreate = async () => {
        const title = templateTitle.trim();
        if (!title) {
            setFormError("Template name is required.");
            return;
        }

        setFormError(null);
        setActionError(null);
        try {
            await createMutation.mutateAsync({
                title,
                noteStyle: currentNoteStyle,
                sections: currentSectionsRaw,
            });
            await utils.noteTemplate.list.invalidate();
            setIsSaving(false);
            setTemplateTitle("");
        } catch (error) {
            setFormError(error instanceof Error ? error.message : "Could not save template.");
        }
    };

    const startRename = (template: NoteTemplateSummary) => {
        setConfirmDeleteId(null);
        setEditingId(template.id);
        setEditingTitle(template.title);
    };

    const commitRename = async () => {
        if (!editingId) return;
        const title = editingTitle.trim();
        if (!title) {
            setEditingId(null);
            setEditingTitle("");
            return;
        }

        setActionError(null);
        try {
            await renameMutation.mutateAsync({ id: editingId, title });
            await utils.noteTemplate.list.invalidate();
            setEditingId(null);
            setEditingTitle("");
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not rename template.");
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        setActionError(null);
        try {
            await deleteMutation.mutateAsync({ id });
            await utils.noteTemplate.list.invalidate();
            setConfirmDeleteId(null);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not delete template.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <BookMarked className="h-4 w-4 text-[#2149A1]" />
                            <span className="text-sm font-semibold text-slate-900">Templates</span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                {templates.length}/{NOTE_TEMPLATE_LIMIT}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={openSaveForm}
                            disabled={!canSelect}
                            className="flex items-center gap-1 rounded-lg bg-[#2149A1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a3a87] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Save
                        </button>
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 md:hidden"
                                aria-label="Close templates"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {isSaving && (
                    <div className="mt-3 space-y-2">
                        <input
                            type="text"
                            value={templateTitle}
                            onChange={(e) => setTemplateTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void handleCreate();
                                if (e.key === "Escape") setIsSaving(false);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20"
                            placeholder="Template name"
                        />
                        {formError && <p className="text-xs text-red-600">{formError}</p>}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void handleCreate()}
                                disabled={!canSelect || createMutation.isPending}
                                className="flex items-center gap-1 rounded-lg bg-[#2149A1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a3a87] disabled:opacity-50"
                            >
                                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsSaving(false)}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
                {actionError && (
                    <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                        {actionError}
                    </p>
                )}
                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                        <BookMarked className="mx-auto mb-3 h-8 w-8 text-slate-200" />
                        <p className="text-sm font-medium text-slate-600">No templates yet</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">
                            Save a notes setup to reuse its style and sections.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {(templates as NoteTemplateSummary[]).map((template) => {
                            const style = toNoteStyle(template.noteStyle);
                            const isEditing = editingId === template.id;
                            const isConfirmingDelete = confirmDeleteId === template.id;
                            const isDeleting = deletingId === template.id;

                            return (
                                <div
                                    key={template.id}
                                    className="group rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50"
                                >
                                    {isEditing ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingTitle}
                                            onChange={(e) => setEditingTitle(e.target.value)}
                                            onBlur={() => void commitRename()}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    e.currentTarget.blur();
                                                }
                                                if (e.key === "Escape") {
                                                    setEditingId(null);
                                                    setEditingTitle("");
                                                }
                                            }}
                                            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20"
                                        />
                                    ) : (
                                        <div className="flex items-start gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!canSelect) return;
                                                    onSelect(template.title, style, template.sections);
                                                    onClose?.();
                                                }}
                                                disabled={!canSelect}
                                                className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <p className="truncate text-sm font-medium text-slate-800">{template.title}</p>
                                                <p className="mt-0.5 truncate text-xs text-slate-400">
                                                    {NOTE_STYLE_LABELS[style]}{template.sections ? ` · ${template.sections}` : ""}
                                                </p>
                                            </button>
                                            {isConfirmingDelete ? (
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <span className="text-[11px] font-medium text-red-600">Delete?</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDelete(template.id)}
                                                        disabled={isDeleting}
                                                        className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-white disabled:opacity-50"
                                                        aria-label={`Confirm delete ${template.title}`}
                                                    >
                                                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                                                        aria-label={`Cancel delete ${template.title}`}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => startRename(template)}
                                                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-[#2149A1]"
                                                        aria-label={`Rename ${template.title}`}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeleteId(template.id)}
                                                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-red-600"
                                                        aria-label={`Delete ${template.title}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
