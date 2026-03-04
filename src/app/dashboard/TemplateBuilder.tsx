"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import {
    ChevronDown, ChevronUp, X, Plus, Save, ArrowLeft,
    GripVertical, Loader2, Check, Lock,
} from "lucide-react";
import type { SystemBlock } from "@/server/blocks-library";
import UpgradeModal from "./_components/UpgradeModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = "TEXT" | "NUMBER" | "DATE" | "EMAIL" | "PHONE" | "TEXTAREA" | "SELECT";
type BlockSource = "SYSTEM" | "USER" | "CUSTOM_INLINE";

interface CanvasField {
    key: string;
    label: string;
    fieldType: FieldType;
    required: boolean;
    order: number;
}

interface CanvasBlock {
    instanceId: string;
    title: string;
    sourceType: BlockSource;
    sourceBlockId?: string;
    fields: CanvasField[];
    collapsed: boolean;
}

interface LibraryBlock {
    id: string;
    name: string;
    sourceType: BlockSource;
    fields: CanvasField[];
}

interface DBTemplate {
    id: string;
    name: string;
    blocks: {
        id: string;
        title: string;
        sourceType: string;
        sourceBlockId: string | null;
        order: number;
        fields: {
            key: string;
            label: string | null;
            fieldType: string;
            required: boolean;
            order: number;
        }[];
    }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
    TEXT: "Text",
    NUMBER: "Number",
    DATE: "Date",
    EMAIL: "Email",
    PHONE: "Phone",
    TEXTAREA: "Long text",
    SELECT: "Select",
};

function makeInstanceId() {
    return Math.random().toString(36).slice(2);
}

function dbBlocksToCanvas(template: DBTemplate): CanvasBlock[] {
    return template.blocks.map((b) => ({
        instanceId: makeInstanceId(),
        title: b.title,
        sourceType: b.sourceType as BlockSource,
        sourceBlockId: b.sourceBlockId ?? undefined,
        collapsed: false,
        fields: b.fields.map((f) => ({
            key: f.key,
            label: f.label ?? f.key,
            fieldType: f.fieldType as FieldType,
            required: f.required,
            order: f.order,
        })),
    }));
}

function canvasToSavePayload(name: string, blocks: CanvasBlock[]) {
    return {
        name,
        blocks: blocks.map((b, idx) => ({
            title: b.title,
            sourceType: b.sourceType,
            sourceBlockId: b.sourceBlockId,
            order: idx,
            fields: b.fields.map((f, fi) => ({
                key: f.key,
                label: f.label,
                fieldType: f.fieldType,
                required: f.required,
                order: fi,
            })),
        })),
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    initialTemplate?: DBTemplate;
    systemBlocks: SystemBlock[];
    userBlocks: LibraryBlock[];
}

export default function TemplateBuilder({ initialTemplate, systemBlocks, userBlocks }: Props) {
    const router = useRouter();

    // Canvas state
    const [templateName, setTemplateName] = useState(initialTemplate?.name ?? "Untitled Template");
    const [blocks, setBlocks] = useState<CanvasBlock[]>(
        initialTemplate ? dbBlocksToCanvas(initialTemplate) : []
    );
    const [saved, setSaved] = useState(false);

    // Drag state
    const dragIndex = useRef<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Custom block modal
    const [modalOpen, setModalOpen] = useState(false);
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const [modalName, setModalName] = useState("");
    const [modalFields, setModalFields] = useState<
        { key: string; label: string; fieldType: FieldType }[]
    >([{ key: "", label: "", fieldType: "TEXT" }]);

    const utils = api.useUtils();

    // Check user entitlements
    const { data: entitlements } = api.entitlements.me.useQuery();
    const isPro = entitlements?.planSlug === "pro";

    const createMutation = api.template.create.useMutation({
        onSuccess: (t: { id: string }) => {
            setSaved(true);
            setTimeout(() => router.push(`/dashboard/templates/${t.id}`), 600);
        },
    });

    const updateMutation = api.template.update.useMutation({
        onSuccess: () => {
            setSaved(true);
            void utils.template.list.invalidate();
            setTimeout(() => setSaved(false), 2000);
        },
    });

    const createBlockMutation = api.customBlock.create.useMutation({
        onSuccess: (newBlock) => {
            void utils.block.listLibrary.invalidate();
            // Also add it to canvas immediately
            addBlockToCanvas({
                id: newBlock.id,
                name: newBlock.title,
                sourceType: "USER",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                fields: newBlock.fields.map((f: { key: string; label: string; fieldType: string; required: boolean }, i: number) => ({
                    key: f.key,
                    label: f.label,
                    fieldType: f.fieldType as FieldType,
                    required: f.required,
                    order: i,
                })),
            });
            setModalOpen(false);
            setModalName("");
            setModalFields([{ key: "", label: "", fieldType: "TEXT" }]);
        },
    });

    // ── Library for right panel ───────────────────────────────────────────────

    const { data: libraryData } = api.block.listLibrary.useQuery(undefined, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        initialData: { systemBlocks, userBlocks } as any,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const allLibraryBlocks: LibraryBlock[] = [
        ...(libraryData?.systemBlocks ?? systemBlocks).map((b: SystemBlock) => ({
            id: b.id,
            name: b.name,
            sourceType: "SYSTEM" as const,
            fields: b.fields as CanvasField[],
        })),
        ...(libraryData?.userBlocks ?? userBlocks),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any;

    // ── Canvas operations ─────────────────────────────────────────────────────

    const addBlockToCanvas = useCallback((lib: LibraryBlock) => {
        setBlocks((prev) => [
            ...prev,
            {
                instanceId: makeInstanceId(),
                title: lib.name,
                sourceType: lib.sourceType,
                sourceBlockId: lib.id,
                collapsed: false,
                fields: lib.fields.map((f, i) => ({ ...f, order: i })),
            },
        ]);
    }, []);

    const removeBlock = (instanceId: string) => {
        setBlocks((prev) => prev.filter((b) => b.instanceId !== instanceId));
    };

    const toggleCollapse = (instanceId: string) => {
        setBlocks((prev) =>
            prev.map((b) =>
                b.instanceId === instanceId ? { ...b, collapsed: !b.collapsed } : b
            )
        );
    };

    // ── Drag and drop ─────────────────────────────────────────────────────────

    const handleDragStart = (idx: number) => {
        dragIndex.current = idx;
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        setDragOverIndex(idx);
    };

    const handleDrop = (e: React.DragEvent, dropIdx: number) => {
        e.preventDefault();
        const from = dragIndex.current;
        if (from === null || from === dropIdx) {
            setDragOverIndex(null);
            return;
        }
        setBlocks((prev) => {
            const next = [...prev];
            const [item] = next.splice(from, 1);
            next.splice(dropIdx, 0, item!);
            return next;
        });
        dragIndex.current = null;
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        dragIndex.current = null;
        setDragOverIndex(null);
    };

    const moveBlock = useCallback((idx: number, direction: -1 | 1) => {
        setBlocks((prev) => {
            const next = [...prev];
            const targetIdx = idx + direction;
            if (targetIdx < 0 || targetIdx >= next.length) return prev;
            [next[idx], next[targetIdx]] = [next[targetIdx]!, next[idx]!];
            return next;
        });
    }, []);

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = () => {
        const payload = canvasToSavePayload(templateName, blocks);
        if (initialTemplate) {
            updateMutation.mutate({ id: initialTemplate.id, ...payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    // ── Custom block modal ────────────────────────────────────────────────────

    const handleAddModalField = () => {
        setModalFields((prev) => [...prev, { key: "", label: "", fieldType: "TEXT" }]);
    };

    const handleModalFieldChange = (
        idx: number,
        field: Partial<{ key: string; label: string; fieldType: FieldType }>
    ) => {
        setModalFields((prev) =>
            prev.map((f, i) => (i === idx ? { ...f, ...field } : f))
        );
    };

    const handleRemoveModalField = (idx: number) => {
        setModalFields((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSaveCustomBlock = () => {
        const validFields = modalFields.filter((f) => f.key.trim());
        if (!modalName.trim() || validFields.length === 0) return;
        createBlockMutation.mutate({
            title: modalName.trim(),
            fields: validFields.map((f) => ({
                key: f.key.trim().toLowerCase().replace(/\s+/g, "_"),
                label: f.label.trim() || f.key.trim(),
                fieldType: f.fieldType,
                required: false,
            })),
        });
    };

    // Handler for clicking "Create" button - check if PRO or show upgrade modal
    const handleCreateBlockClick = () => {
        if (isPro) {
            setModalOpen(true);
        } else {
            setUpgradeModalOpen(true);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-[#FBFBFB]">
            {/* ── Top bar ── */}
            <header className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-3.5 border-b border-slate-200 bg-white sticky top-0 z-30 md:static">
                <Link
                    href="/dashboard/formbank"
                    className="flex items-center gap-1.5 text-sm text-[#868C94] hover:text-slate-700 transition-colors flex-shrink-0"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Form Bank</span>
                </Link>

                <div className="w-px h-5 bg-slate-200 flex-shrink-0" />

                <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="flex-1 min-w-0 text-base font-semibold text-slate-900 bg-transparent border-none outline-none placeholder-slate-300"
                />

                <button
                    onClick={handleSave}
                    disabled={isSaving || blocks.length === 0 || !templateName.trim()}
                    className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 flex-shrink-0"
                >
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                        <Check className="w-4 h-4" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {isSaving ? "Saving…" : saved ? "Saved" : "Save"}
                </button>
            </header>

            {/* ── Body: canvas + library ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* ── Canvas ── */}
                <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-28 md:pb-6">
                    {blocks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-20">
                            <div className="w-16 h-16 bg-[#e8eef9] rounded-2xl flex items-center justify-center mb-4">
                                <Plus className="w-7 h-7 text-[#2149A1]" />
                            </div>
                            <p className="text-slate-700 font-medium mb-1">No blocks yet</p>
                            <p className="text-sm text-[#868C94]">
                                <span className="hidden md:inline">Add blocks from the library on the right →</span>
                                <span className="md:hidden">Tap &ldquo;Add Block&rdquo; below to get started</span>
                            </p>
                        </div>
                    ) : (
                        <div className="max-w-2xl space-y-3">
                            {blocks.map((block, idx) => (
                                <div
                                    key={block.instanceId}
                                    draggable
                                    onDragStart={() => handleDragStart(idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    className={`bg-white border rounded-xl overflow-hidden transition-all duration-150 ${dragOverIndex === idx
                                        ? "border-[#2149A1] shadow-md"
                                        : "border-slate-200"
                                        }`}
                                >
                                    {/* Block header */}
                                    <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 bg-white">
                                        {/* Drag handle — desktop only */}
                                        <div className="hidden md:block cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0">
                                            <GripVertical className="w-4 h-4" />
                                        </div>

                                        {/* Up/down reorder — mobile only */}
                                        <div className="flex md:hidden flex-col flex-shrink-0">
                                            <button
                                                onClick={() => moveBlock(idx, -1)}
                                                disabled={idx === 0}
                                                className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-25 transition-colors"
                                                title="Move up"
                                            >
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => moveBlock(idx, 1)}
                                                disabled={idx === blocks.length - 1}
                                                className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-25 transition-colors"
                                                title="Move down"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-slate-800">{block.title}</p>
                                            <p className="text-xs text-[#868C94]">
                                                {block.fields.length} field{block.fields.length !== 1 ? "s" : ""}
                                                {block.sourceType === "SYSTEM" && (
                                                    <span className="ml-1.5 text-[#2149A1]">· System</span>
                                                )}
                                                {block.sourceType === "USER" && (
                                                    <span className="ml-1.5 text-emerald-600">· Custom</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-0.5">
                                            <button
                                                onClick={() => toggleCollapse(block.instanceId)}
                                                className="flex items-center justify-center w-9 h-9 rounded-lg text-[#868C94] hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                                title={block.collapsed ? "Expand" : "Collapse"}
                                            >
                                                {block.collapsed ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronUp className="w-4 h-4" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => removeBlock(block.instanceId)}
                                                className="flex items-center justify-center w-9 h-9 rounded-lg text-[#868C94] hover:bg-red-50 hover:text-red-500 transition-colors"
                                                title="Remove block"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Fields */}
                                    {!block.collapsed && (
                                        <div className="border-t border-slate-100 px-4 py-3 grid grid-cols-2 gap-2 bg-slate-50/50">
                                            {block.fields.map((field) => (
                                                <div
                                                    key={field.key}
                                                    className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2"
                                                >
                                                    <div className="w-1.5 h-1.5 bg-[#2149A1]/40 rounded-full flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-slate-700 truncate">
                                                            {field.label}
                                                        </p>
                                                        <p className="text-xs text-[#868C94]">
                                                            {FIELD_TYPE_LABELS[field.fieldType]}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Block Library (right panel) ── */}
                <aside className="hidden md:flex md:flex-col w-72 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
                    <div className="px-4 py-4 border-b border-slate-100">
                        <h2 className="text-xs font-semibold text-[#868C94] uppercase tracking-widest">
                            Block Library
                        </h2>
                    </div>

                    {/* System blocks */}
                    <div className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-500 mb-2">System Blocks</p>
                        <div className="space-y-1.5">
                            {allLibraryBlocks
                                .filter((b) => b.sourceType === "SYSTEM")
                                .map((lib) => (
                                    <LibraryBlockRow
                                        key={lib.id}
                                        block={lib}
                                        onAdd={() => addBlockToCanvas(lib)}
                                    />
                                ))}
                        </div>
                    </div>

                    {/* Custom blocks */}
                    <div className="px-4 py-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-slate-500">My Blocks</p>
                            <button
                                onClick={handleCreateBlockClick}
                                className="flex items-center gap-1 text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] transition-colors"
                            >
                                {!isPro && <Lock className="w-3 h-3" />}
                                <Plus className="w-3 h-3" />
                                Create
                            </button>
                        </div>
                        {allLibraryBlocks.filter((b) => b.sourceType === "USER").length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-xs text-[#868C94] mb-3">No custom blocks yet</p>
                                <button
                                    onClick={handleCreateBlockClick}
                                    className="text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] transition-colors inline-flex items-center gap-1"
                                >
                                    {!isPro && <Lock className="w-3 h-3" />}
                                    Create your first block →
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {allLibraryBlocks
                                    .filter((b) => b.sourceType === "USER")
                                    .map((lib) => (
                                        <LibraryBlockRow
                                            key={lib.id}
                                            block={lib}
                                            onAdd={() => addBlockToCanvas(lib)}
                                        />
                                    ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* ── Custom Block Modal ── */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setModalOpen(false)}
                    />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h2 className="font-semibold text-slate-900">Create Custom Block</h2>
                                <p className="text-xs text-[#868C94] mt-0.5">Saved to your block library</p>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 rounded-lg text-[#868C94] hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Block name */}
                            <div>
                                <label className="block text-xs font-medium text-[#868C94] mb-1.5">
                                    Block Name
                                </label>
                                <input
                                    type="text"
                                    value={modalName}
                                    onChange={(e) => setModalName(e.target.value)}
                                    placeholder="e.g. Insurance Details"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 transition-all"
                                />
                            </div>

                            {/* Fields */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium text-[#868C94]">Fields</label>
                                    <button
                                        onClick={handleAddModalField}
                                        className="flex items-center gap-1 text-xs text-[#2149A1] hover:text-[#1a3a87] font-medium transition-colors"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Add field
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {modalFields.map((field, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={field.label}
                                                onChange={(e) =>
                                                    handleModalFieldChange(idx, {
                                                        label: e.target.value,
                                                        key: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                                                    })
                                                }
                                                placeholder="Field name"
                                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 transition-all"
                                            />
                                            <select
                                                value={field.fieldType}
                                                onChange={(e) =>
                                                    handleModalFieldChange(idx, { fieldType: e.target.value as FieldType })
                                                }
                                                className="border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#2149A1] transition-all bg-white"
                                            >
                                                {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
                                                    <option key={v} value={v}>{l}</option>
                                                ))}
                                            </select>
                                            {modalFields.length > 1 && (
                                                <button
                                                    onClick={() => handleRemoveModalField(idx)}
                                                    className="p-1.5 rounded text-[#868C94] hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-sm font-medium text-[#868C94] hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCustomBlock}
                                disabled={
                                    !modalName.trim() ||
                                    modalFields.every((f) => !f.label.trim()) ||
                                    createBlockMutation.isPending
                                }
                                className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-all"
                            >
                                {createBlockMutation.isPending && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                )}
                                Save Block
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Upgrade Modal ── */}
            <UpgradeModal isOpen={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />

            {/* ── Mobile sticky bottom bar ── */}
            <div
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 bg-white border-t border-slate-200 px-4 py-3"
                style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowLibrary(true)}
                        className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-700 text-sm font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Block
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || blocks.length === 0 || !templateName.trim()}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl transition-all"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isSaving ? "Saving…" : saved ? "Saved" : "Save"}
                    </button>
                </div>
            </div>

            {/* ── Mobile block library bottom sheet ── */}
            {showLibrary && (
                <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowLibrary(false)}
                    />
                    {/* Sheet */}
                    <div className="relative bg-white rounded-t-2xl flex flex-col max-h-[75vh]">
                        {/* Pull indicator */}
                        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                            <div className="w-10 h-1 bg-slate-200 rounded-full" />
                        </div>
                        {/* Sheet header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
                            <h2 className="font-semibold text-slate-900">Block Library</h2>
                            <button
                                onClick={() => setShowLibrary(false)}
                                className="flex items-center justify-center w-9 h-9 rounded-lg text-[#868C94] hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Sheet content */}
                        <div
                            className="overflow-y-auto flex-1 px-4"
                            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
                        >
                            {/* System blocks */}
                            <div className="py-3">
                                <p className="text-xs font-medium text-slate-500 mb-2">System Blocks</p>
                                <div className="space-y-1.5">
                                    {allLibraryBlocks
                                        .filter((b) => b.sourceType === "SYSTEM")
                                        .map((lib) => (
                                            <LibraryBlockRow
                                                key={lib.id}
                                                block={lib}
                                                onAdd={() => { addBlockToCanvas(lib); setShowLibrary(false); }}
                                            />
                                        ))}
                                </div>
                            </div>
                            {/* Custom blocks */}
                            <div className="py-3 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium text-slate-500">My Blocks</p>
                                    <button
                                        onClick={() => { setShowLibrary(false); handleCreateBlockClick(); }}
                                        className="flex items-center gap-1 text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] transition-colors"
                                    >
                                        {!isPro && <Lock className="w-3 h-3" />}
                                        <Plus className="w-3 h-3" />
                                        Create
                                    </button>
                                </div>
                                {allLibraryBlocks.filter((b) => b.sourceType === "USER").length === 0 ? (
                                    <div className="text-center py-6">
                                        <p className="text-xs text-[#868C94] mb-3">No custom blocks yet</p>
                                        <button
                                            onClick={() => { setShowLibrary(false); handleCreateBlockClick(); }}
                                            className="text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] transition-colors inline-flex items-center gap-1"
                                        >
                                            {!isPro && <Lock className="w-3 h-3" />}
                                            Create your first block →
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {allLibraryBlocks
                                            .filter((b) => b.sourceType === "USER")
                                            .map((lib) => (
                                                <LibraryBlockRow
                                                    key={lib.id}
                                                    block={lib}
                                                    onAdd={() => { addBlockToCanvas(lib); setShowLibrary(false); }}
                                                />
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Library Block Row ────────────────────────────────────────────────────────

function LibraryBlockRow({
    block,
    onAdd,
}: {
    block: LibraryBlock;
    onAdd: () => void;
}) {
    return (
        <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-100 hover:border-[#2149A1]/30 hover:bg-[#e8eef9]/40 transition-all group cursor-default"
        >
            <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{block.name}</p>
                <p className="text-xs text-[#868C94]">
                    {block.fields.length} field{block.fields.length !== 1 ? "s" : ""}
                </p>
            </div>
            <button
                onClick={onAdd}
                className="ml-2 flex items-center justify-center w-8 h-8 rounded-lg bg-[#2149A1] text-white flex-shrink-0 hover:bg-[#1a3a87] transition-colors"
                title="Add to template"
            >
                <Plus className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}