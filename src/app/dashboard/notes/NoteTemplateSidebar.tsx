"use client";

import { useRef, useState } from "react";
import {
    BookMarked, Check, Loader2, PanelLeftClose, Pencil, Plus, Trash2, X,
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
    onToggleSidebar?: () => void;
    onClose?: () => void;
}

const NOTE_STYLE_LABELS: Record<NoteStyle, string> = {
    general: "General",
    clinical: "Clinical",
    meeting: "Meeting",
    study: "Study",
};

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
    onToggleSidebar,
    onClose,
}: NoteTemplateSidebarProps) {
    const utils = api.useUtils();
    const [isSaving, setIsSaving] = useState(false);
    const [templateTitle, setTemplateTitle] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [editingOriginalTitle, setEditingOriginalTitle] = useState("");
    const [renameError, setRenameError] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const skipNextRenameBlurRef = useRef(false);
    const renameCommitInFlightRef = useRef(false);

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
        skipNextRenameBlurRef.current = false;
        setConfirmDeleteId(null);
        setActionError(null);
        setRenameError(null);
        setEditingId(template.id);
        setEditingTitle(template.title);
        setEditingOriginalTitle(template.title);
    };

    const cancelRename = () => {
        skipNextRenameBlurRef.current = true;
        setEditingId(null);
        setEditingTitle("");
        setEditingOriginalTitle("");
        setRenameError(null);
    };

    const commitRename = async (rawTitle = editingTitle) => {
        if (!editingId) return;
        if (renameCommitInFlightRef.current) return;

        const id = editingId;
        const title = rawTitle.trim();
        if (!title) {
            cancelRename();
            return;
        }

        if (title === editingOriginalTitle.trim()) {
            cancelRename();
            return;
        }

        renameCommitInFlightRef.current = true;
        setActionError(null);
        setRenameError(null);
        try {
            await renameMutation.mutateAsync({ id, title });
            await utils.noteTemplate.list.invalidate();
            skipNextRenameBlurRef.current = true;
            setEditingId(null);
            setEditingTitle("");
            setEditingOriginalTitle("");
        } catch (error) {
            setRenameError(error instanceof Error ? error.message : "Could not rename template.");
        } finally {
            renameCommitInFlightRef.current = false;
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
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white dark:bg-slate-950">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                            <BookMarked className="h-4 w-4 flex-shrink-0 text-[#2149A1] dark:text-blue-300" />
                            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Templates</span>
                        </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={openSaveForm}
                            disabled={!canSelect}
                            className="mr-2 flex items-center gap-1 rounded-lg bg-[#2149A1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors active:scale-[0.98] active:opacity-90 hover:bg-[#1a3a87] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Save
                        </button>
                        {onToggleSidebar && (
                            <button
                                type="button"
                                onClick={onToggleSidebar}
                                className="hidden rounded-lg p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-[#2149A1] md:inline-flex dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-blue-300"
                                aria-label="Hide templates sidebar"
                                title="Hide templates sidebar"
                            >
                                <PanelLeftClose className="h-4 w-4" />
                            </button>
                        )}
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-slate-600 md:hidden dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
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
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                            placeholder="Template name"
                        />
                        {formError && <p className="text-xs text-red-600">{formError}</p>}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void handleCreate()}
                                disabled={!canSelect || createMutation.isPending}
                                className="flex items-center gap-1 rounded-lg bg-[#2149A1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors active:scale-[0.98] active:opacity-90 hover:bg-[#1a3a87] disabled:opacity-50"
                            >
                                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsSaving(false)}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors active:scale-[0.98] active:opacity-80 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
                {actionError && (
                    <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        {actionError}
                    </p>
                )}
                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-slate-400 dark:text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                        <BookMarked className="mx-auto mb-3 h-8 w-8 text-slate-200 dark:text-slate-700" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No templates yet</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
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
                                    className="group relative min-w-0 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50 focus-within:border-slate-200 focus-within:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:focus-within:border-slate-700 dark:focus-within:bg-slate-900"
                                >
                                    {isEditing ? (
                                        <div className="space-y-1">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onBlur={(e) => {
                                                    if (skipNextRenameBlurRef.current) {
                                                        skipNextRenameBlurRef.current = false;
                                                        return;
                                                    }
                                                    void commitRename(e.currentTarget.value);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        void commitRename(e.currentTarget.value);
                                                    }
                                                    if (e.key === "Escape") {
                                                        e.preventDefault();
                                                        cancelRename();
                                                    }
                                                }}
                                                disabled={renameMutation.isPending}
                                                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                                            />
                                            {renameError && <p className="text-xs text-red-600">{renameError}</p>}
                                        </div>
                                    ) : (
                                        <div className="relative min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!canSelect) return;
                                                    onSelect(template.title, style, template.sections);
                                                    onClose?.();
                                                }}
                                                disabled={!canSelect}
                                                className={`block w-full min-w-0 text-left transition-[padding] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${isConfirmingDelete
                                                    ? "pr-28"
                                                    : "pr-16 md:pr-1 md:group-hover:pr-16 md:group-focus-within:pr-16"
                                                    }`}
                                            >
                                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200" title={template.title}>{template.title}</p>
                                                <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-400" title={template.sections || NOTE_STYLE_LABELS[style]}>
                                                    {template.sections || NOTE_STYLE_LABELS[style]}
                                                </p>
                                            </button>
                                            {isConfirmingDelete ? (
                                                <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1">
                                                    <span className="text-[11px] font-medium text-red-600 dark:text-red-400">Delete?</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDelete(template.id)}
                                                        disabled={isDeleting}
                                                        className="rounded-md p-1.5 text-red-600 transition-colors active:scale-95 active:opacity-80 hover:bg-white disabled:opacity-50 dark:text-red-400 dark:hover:bg-slate-800"
                                                        aria-label={`Confirm delete ${template.title}`}
                                                    >
                                                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className="rounded-md p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-white hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                                        aria-label={`Cancel delete ${template.title}`}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="pointer-events-auto absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-100 transition-opacity md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => startRename(template)}
                                                        className="rounded-md p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-white hover:text-[#2149A1] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                                                        aria-label={`Rename ${template.title}`}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeleteId(template.id)}
                                                        className="rounded-md p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-white hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"
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
