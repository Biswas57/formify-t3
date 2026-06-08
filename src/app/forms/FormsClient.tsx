"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import Link from "next/link";
import {
    Mic, Square, Wifi, WifiOff, RotateCcw, ChevronDown,
    Lock, AlertCircle, RefreshCw, Loader2,
    Download, X, FileText, Plus, Check, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { formatFieldLabel } from "@/lib/format-field-label";
import { exportFormPdf } from "@/lib/pdf";
import { env } from "@/env";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

interface ServerMessage {
    type?: "started" | "attributes_update" | "final_attributes" | "error";
    mode?: "forms" | "notes";
    // forms mode
    attributes?: Record<string, string>;
    template_size?: number;
    // error
    error?: string;
    code?: string;
    message?: string;
}

type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
type RecordStatus = "idle" | "recording" | "finalizing" | "paused";
type RestoredRecordStatus = "idle" | "paused";

interface TemplateSummary {
    id: string;
    name: string;
    updatedAt: Date;
    blockCount: number;
    fieldCount: number;
    previewTitles: string[];
}

type FormsDraft = {
    version: 1;
    templateId: string;
    templateTitle: string;
    attributes: Record<string, string>;
    lockedFields: string[];
    recordStatus: RestoredRecordStatus;
    updatedAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Canonical internal key format: lowercase snake_case.
 * "Date of Birth" → "date_of_birth", "chief-complaint" → "chief_complaint"
 * This must be applied consistently: when parsing templates, sending to server,
 * AND when receiving attributes back from the server.
 */
function normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/[\s\-]+/g, "_");
}

function parseBlocks(raw: string): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed?.includes(":")) continue;
        const colonIdx = trimmed.indexOf(":");
        const blockName = trimmed.slice(0, colonIdx).trim();
        const fields = trimmed
            .slice(colonIdx + 1)
            .split(",")
            .map((f) => normalizeKey(f))  // normalize to snake_case
            .filter(Boolean);
        if (blockName && fields.length > 0) result[blockName] = fields;
    }
    return result;
}

function getWSUrl(): string {
    return env.NEXT_PUBLIC_WS_URL;
}

const SUPPORTED_MIME =
    typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

const DEFAULT_TEMPLATE = `ID: name, date of birth, email, phone
Medical: chief complaint, medications, allergies
Social: occupation, address`;

const FORMS_DRAFT_STORAGE_PREFIX = "formify:forms:draft:v1";
const FORMS_DRAFT_SAVE_DEBOUNCE_MS = 300;

function getFormsDraftStorageKey(user: User): string | null {
    const stableIdentifier = user.id ?? user.email;
    return stableIdentifier ? `${FORMS_DRAFT_STORAGE_PREFIX}:${stableIdentifier}` : null;
}

function parseFormsDraft(raw: string | null): FormsDraft | null {
    if (!raw) return null;

    try {
        const value = JSON.parse(raw) as Partial<FormsDraft>;
        if (value.version !== 1) return null;
        if (typeof value.templateId !== "string" || !value.templateId) return null;

        const attributes: Record<string, string> = {};
        if (value.attributes && typeof value.attributes === "object" && !Array.isArray(value.attributes)) {
            for (const [key, val] of Object.entries(value.attributes)) {
                if (typeof key === "string" && typeof val === "string") {
                    attributes[normalizeKey(key)] = val;
                }
            }
        }

        return {
            version: 1,
            templateId: value.templateId,
            templateTitle: typeof value.templateTitle === "string" ? value.templateTitle : "",
            attributes,
            lockedFields: Array.isArray(value.lockedFields)
                ? value.lockedFields.filter((field): field is string => typeof field === "string").map(normalizeKey)
                : [],
            recordStatus: value.recordStatus === "paused" ? "paused" : "idle",
            updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

function TemplateSelector({
    templates,
    selectedTemplateId,
    loading,
    disabled,
    onSelect,
    onToggleSidebar,
    onClose,
}: {
    templates: TemplateSummary[];
    selectedTemplateId: string | null;
    loading: boolean;
    disabled: boolean;
    onSelect: (id: string) => void;
    onToggleSidebar?: () => void;
    onClose?: () => void;
}) {
    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white dark:bg-slate-950">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-xs font-semibold uppercase tracking-widest text-[#868C94] dark:text-slate-400">
                            Form Templates
                        </h2>
                        <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                            Select one before recording.
                        </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                        {disabled ? (
                            <button
                                type="button"
                                disabled
                                className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg text-slate-300 dark:text-slate-700"
                                title="Stop recording before creating a new template"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        ) : (
                            <Link
                                href="/templates/new?returnTo=/forms"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#2149A1] transition-colors hover:bg-[#e8eef9] active:scale-95 active:opacity-80 dark:text-blue-300 dark:hover:bg-blue-500/15"
                                title="New template"
                                aria-label="New form template"
                            >
                                <Plus className="h-4 w-4" />
                            </Link>
                        )}
                        {onToggleSidebar && (
                            <button
                                type="button"
                                onClick={onToggleSidebar}
                                className="hidden rounded-lg p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-[#2149A1] md:inline-flex dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-blue-300"
                                aria-label="Hide form templates sidebar"
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
                                aria-label="Close form templates"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
                {loading ? (
                    <div className="flex items-center justify-center py-10 text-slate-400 dark:text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                        <FileText className="mx-auto mb-3 h-8 w-8 text-slate-200 dark:text-slate-700" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No templates yet</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
                            Create a form template before recording.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {templates.map((template) => {
                            const selected = template.id === selectedTemplateId;
                            return (
                                <button
                                    key={template.id}
                                    type="button"
                                    disabled={disabled && !selected}
                                    onClick={() => onSelect(template.id)}
                                    className={`group block w-full min-w-0 rounded-lg border px-2 py-2 text-left transition-[border-color,background-color,opacity,transform] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${selected
                                        ? "border-[#2149A1]/30 bg-[#e8eef9] text-[#2149A1] dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-200"
                                        : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 focus-visible:border-slate-200 focus-visible:bg-slate-50 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:focus-visible:border-slate-700 dark:focus-visible:bg-slate-900"
                                        }`}
                                >
                                    <div className="flex min-w-0 items-start gap-2">
                                        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-[#2149A1] dark:text-slate-500 dark:group-hover:text-blue-300" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium" title={template.name}>{template.name}</p>
                                            <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-400">
                                                {template.blockCount} block{template.blockCount !== 1 ? "s" : ""} · {template.fieldCount} field{template.fieldCount !== 1 ? "s" : ""}
                                            </p>
                                            <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500" title={template.previewTitles.join(", ")}>
                                                {template.previewTitles.length > 0 ? template.previewTitles.slice(0, 2).join(", ") : "No sections"}
                                            </p>
                                        </div>
                                        {selected && <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormsClient({ user }: { user: User }) {
    const router = useRouter();
    const formsDraftStorageKey = getFormsDraftStorageKey(user);
    // Connection
    const wsRef = useRef<WebSocket | null>(null);
    const [wsStatus, setWsStatus] = useState<WSStatus>("disconnected");
    const [wsError, setWsError] = useState<string | null>(null);

    // Recording
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [recordStatus, setRecordStatus] = useState<RecordStatus>("idle");
    const [micError, setMicError] = useState<string | null>(null);
    const blocksReadyRef = useRef(false);
    const [isSessionReady, setSessionReady] = useState(false);
    const [isStartingRecording, setIsStartingRecording] = useState(false);

    // Template
    const [templateRaw, setTemplateRaw] = useState("");
    // Ref so the WS onmessage closure always sees the current template,
    // even though connectWS has [] deps and can't re-capture templateRaw state.
    const templateRawRef = useRef(templateRaw);
    useEffect(() => { templateRawRef.current = templateRaw; }, [templateRaw]);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [formTitle, setFormTitle] = useState("");
    const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
    const [templateDrawerVisible, setTemplateDrawerVisible] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
    const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
    const [restoredDraft, setRestoredDraft] = useState<FormsDraft | null>(null);
    const draftHydratedRef = useRef(false);
    const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressNextEmptyDraftSaveRef = useRef(false);
    const draftReplaceTemplateIdRef = useRef<string | null>(null);

    // Form data
    const [attributes, setAttributes] = useState<Record<string, string>>({});
    // lockedFields: keys the user has manually edited — AI updates must not overwrite these.
    // A ref mirror is kept so the WS onmessage closure ([] deps) always reads the current set.
    const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
    const lockedFieldsRef = useRef<Set<string>>(new Set());
    useEffect(() => { lockedFieldsRef.current = lockedFields; }, [lockedFields]);

    const getSessionToken = api.transcription.getSessionToken.useMutation();
    const utils = api.useUtils();

    // (Session usage is counted server-side at token mint time)

    // ── Template preload from query param ────────────────────────────────────────
    const searchParams = useSearchParams();
    const templateId = searchParams.get("templateId");
    const [shouldLoadTemplateSummaries, setShouldLoadTemplateSummaries] = useState(() => !templateId);

    // Forms mode requires a saved template. With no templateId, the workspace
    // stays in the select-template state and never falls back to a default form.
    const { data: preloadedTemplate, isLoading: templateLoading } = api.template.getForForms.useQuery(
        { id: templateId! },
        {
            enabled: !!templateId,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            staleTime: Infinity,
        }
    );

    const { data: templateSummaries = [], isLoading: templatesLoading } = api.template.listSummary.useQuery(undefined, {
        enabled: shouldLoadTemplateSummaries,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
    const templateSummariesList = templateSummaries as TemplateSummary[];
    const templateSummariesLoading = shouldLoadTemplateSummaries && templatesLoading;
    const templateSelectorLoading = !shouldLoadTemplateSummaries || templatesLoading;

    const hasTemplateId = Boolean(templateId);
    const hasValidTemplate = Boolean(preloadedTemplate);
    const templateReady = hasTemplateId && !templateLoading;
    const templateNotFound = hasTemplateId && !templateLoading && !preloadedTemplate;
    const hasRestorableDraft =
        !templateId &&
        Boolean(restoredDraft) &&
        (templateSummariesLoading ||
            templateSummariesList.some((template) => template.id === restoredDraft?.templateId));

    // Derived
    const blocks = parseBlocks(templateRaw);
    const allFields = Object.values(blocks).flat();
    const isConnected = wsStatus === "connected" && isSessionReady;
    const isRecording = recordStatus === "recording";
    const isFinalizing = recordStatus === "finalizing";
    const isPaused = recordStatus === "paused";
    const canRecord = !isStartingRecording && !isFinalizing && hasValidTemplate;
    const errorMessage = wsError ?? micError;
    const hasFilledContent =
        Object.values(attributes).some((value) => value.trim().length > 0) ||
        lockedFields.size > 0;
    const templateSwitchDisabled = isStartingRecording || isRecording || isFinalizing;
    const showConnectionPill = isStartingRecording || isRecording || isFinalizing || (wsStatus === "error" && recordStatus !== "idle");
    const connectionPillClasses =
        isStartingRecording || wsStatus === "connecting" || wsStatus === "reconnecting" || (wsStatus === "connected" && !isSessionReady)
            ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200"
            : isConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "bg-red-50 text-red-600 border-red-200 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200";
    const connectionPillLabel =
        isStartingRecording || wsStatus === "connecting" || (wsStatus === "connected" && !isSessionReady)
            ? "Connecting…"
            : wsStatus === "reconnecting"
                ? "Reconnecting…"
                : isConnected
                    ? "Connected"
                    : "Disconnected";
    const showAdvancedTemplateEditor = false;

    const readFormsDraft = useCallback((): FormsDraft | null => {
        if (!formsDraftStorageKey || typeof window === "undefined") {
            return null;
        }

        return parseFormsDraft(window.localStorage.getItem(formsDraftStorageKey));
    }, [formsDraftStorageKey]);

    useEffect(() => {
        if (!templateId) {
            setShouldLoadTemplateSummaries(true);
            return;
        }

        if (templateDrawerVisible) {
            setShouldLoadTemplateSummaries(true);
        }
    }, [templateDrawerVisible, templateId]);

    useEffect(() => {
        if (!templateId || shouldLoadTemplateSummaries || typeof window === "undefined") return;

        const desktopQuery = window.matchMedia("(min-width: 768px)");
        const enableDesktopSummaries = () => {
            if (desktopQuery.matches) {
                setShouldLoadTemplateSummaries(true);
            }
        };

        const frameId = window.requestAnimationFrame(enableDesktopSummaries);

        if (typeof desktopQuery.addEventListener === "function") {
            desktopQuery.addEventListener("change", enableDesktopSummaries);
            return () => {
                window.cancelAnimationFrame(frameId);
                desktopQuery.removeEventListener("change", enableDesktopSummaries);
            };
        }

        desktopQuery.addListener(enableDesktopSummaries);
        return () => {
            window.cancelAnimationFrame(frameId);
            desktopQuery.removeListener(enableDesktopSummaries);
        };
    }, [shouldLoadTemplateSummaries, templateId]);

    const clearFormsDraft = useCallback(() => {
        if (draftSaveTimerRef.current) {
            clearTimeout(draftSaveTimerRef.current);
            draftSaveTimerRef.current = null;
        }

        if (formsDraftStorageKey && typeof window !== "undefined") {
            window.localStorage.removeItem(formsDraftStorageKey);
        }

        setRestoredDraft(null);
        suppressNextEmptyDraftSaveRef.current = true;
    }, [formsDraftStorageKey]);

    useEffect(() => {
        if (!formsDraftStorageKey) {
            draftHydratedRef.current = true;
            return;
        }

        const draft = readFormsDraft();
        setRestoredDraft(draft);
        draftHydratedRef.current = true;
    }, [formsDraftStorageKey, readFormsDraft]);

    useEffect(() => {
        if (templateId || !shouldLoadTemplateSummaries || templateSummariesLoading) return;

        const latestDraft = readFormsDraft();
        setRestoredDraft(latestDraft);
        if (!latestDraft) return;

        const draftTemplateExists = templateSummariesList.some(
            (template) => template.id === latestDraft.templateId
        );
        if (!draftTemplateExists) return;
        if (draftReplaceTemplateIdRef.current === latestDraft.templateId) return;

        draftReplaceTemplateIdRef.current = latestDraft.templateId;
        router.replace(`/forms?templateId=${encodeURIComponent(latestDraft.templateId)}`);
    }, [
        readFormsDraft,
        router,
        shouldLoadTemplateSummaries,
        templateId,
        templateSummariesList,
        templateSummariesLoading,
    ]);

    useEffect(() => {
        if (!preloadedTemplate) {
            if (!templateId || (!templateLoading && !preloadedTemplate)) {
                setFormTitle("");
                setTemplateRaw("");
            }
            return;
        }
        setFormTitle(preloadedTemplate.name);
        // Build raw template string — field keys will be normalized by parseBlocks
        const raw = [...preloadedTemplate.blocks]
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
            .map((b: { title: string; fields: { key: string; order: number }[] }) =>
                `${b.title}: ${[...b.fields]
                    .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
                    .map((f: { key: string }) => f.key)
                    .join(", ")}`
            )
            .join("\n");
        setTemplateRaw(raw);
    }, [preloadedTemplate, templateId, templateLoading]);

    // ── Re-initialise fields when template changes ────────────────────────────

    useEffect(() => {
        const empty: Record<string, string> = {};
        allFields.forEach((f) => { empty[f] = ""; });
        const draftForTemplate = readFormsDraft();
        const shouldRestoreDraft = Boolean(draftForTemplate && templateId && draftForTemplate.templateId === templateId);
        const nextAttributes = { ...empty };
        const nextLocked = new Set<string>();

        if (shouldRestoreDraft && draftForTemplate) {
            const allowedFields = new Set(allFields);
            for (const [field, value] of Object.entries(draftForTemplate.attributes)) {
                if (allowedFields.has(field)) {
                    nextAttributes[field] = value;
                }
            }
            for (const field of draftForTemplate.lockedFields) {
                if (allowedFields.has(field)) {
                    nextLocked.add(field);
                }
            }
            const restoredStatus =
                Object.values(nextAttributes).some((value) => value.trim().length > 0) || nextLocked.size > 0
                    ? draftForTemplate.recordStatus
                    : "idle";
            setRecordStatus(restoredStatus);
            recordStatusRef.current = restoredStatus;
        } else {
            setRecordStatus("idle");
            recordStatusRef.current = "idle";
        }

        setAttributes(nextAttributes);
        lockedFieldsRef.current = nextLocked;
        setLockedFields(nextLocked);
        blocksReadyRef.current = false;
        setSessionReady(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateRaw, readFormsDraft, templateId]);

    // ── WebSocket ─────────────────────────────────────────────────────────────

    // WebSocket state — sockets are opened only for an active recording session.
    const recordStatusRef = useRef<RecordStatus>("idle");
    const wsSessionReadyRef = useRef(false);
    const intentionalCloseRef = useRef(false);
    const sessionGenerationRef = useRef(0);
    const activeSessionGenerationRef = useRef<number | null>(null);
    const startInFlightRef = useRef(false);
    const stopInFlightRef = useRef(false);
    // Short-lived WS session token minted by the server just before recording starts.
    // Stored in a ref so sendBlocks can include it without a stale closure.
    const wsTokenRef = useRef<string | null>(null);

    const markSessionInactive = useCallback(() => {
        wsSessionReadyRef.current = false;
        blocksReadyRef.current = false;
        setSessionReady(false);
        activeSessionGenerationRef.current = null;
        wsTokenRef.current = null;
    }, []);

    const stopLocalRecorder = useCallback(() => {
        const recorder = recorderRef.current;
        const stream = streamRef.current ?? recorder?.stream ?? null;

        if (recorder && recorder.state !== "inactive") {
            try {
                recorder.stop();
            } catch {
                // Ignore stop races if the recorder already became inactive.
            }
        }

        stream?.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        streamRef.current = null;
    }, []);

    const waitForSessionStarted = useCallback((sessionGeneration: number) => (
        new Promise<void>((resolve, reject) => {
            const startedAt = Date.now();
            const interval = setInterval(() => {
                if (activeSessionGenerationRef.current !== sessionGeneration) {
                    clearInterval(interval);
                    reject(new Error("session-ended"));
                    return;
                }

                if (wsSessionReadyRef.current) {
                    clearInterval(interval);
                    resolve();
                    return;
                }

                if (Date.now() - startedAt > 8000) {
                    clearInterval(interval);
                    reject(new Error("session-start-timeout"));
                }
            }, 50);
        })
    ), []);

    const connectWS = useCallback((): Promise<WebSocket> => {
        const existing = wsRef.current;
        if (existing?.readyState === WebSocket.OPEN) {
            return Promise.resolve(existing);
        }

        return new Promise<WebSocket>((resolve, reject) => {
            intentionalCloseRef.current = false;
            wsSessionReadyRef.current = false;
            setSessionReady(false);
            setWsStatus("connecting");
            setWsError(null);

            let settled = false;
            const ws = new WebSocket(getWSUrl());
            ws.binaryType = "arraybuffer";
            wsRef.current = ws;

            // 8s connection timeout — gives enough time for slow cold-starts
            const connectionTimeout = setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    intentionalCloseRef.current = true;
                    ws.close();
                }
            }, 8000);

            ws.onopen = () => {
                clearTimeout(connectionTimeout);
                setWsStatus("connected");
                setWsError(null);
                settled = true;
                resolve(ws);
            };

            ws.onclose = () => {
                clearTimeout(connectionTimeout);
                markSessionInactive();
                startInFlightRef.current = false;
                stopInFlightRef.current = false;
                setIsStartingRecording(false);
                if (wsRef.current === ws) wsRef.current = null;

                const wasIntentional = intentionalCloseRef.current;
                intentionalCloseRef.current = false;

                if (!settled) {
                    settled = true;
                    setWsStatus("disconnected");
                    reject(new Error("connection-failed"));
                    return;
                }

                if (wasIntentional) {
                    setWsStatus("disconnected");
                    return;
                }

                const currentStatus = recordStatusRef.current;
                if (currentStatus === "recording" || currentStatus === "finalizing") {
                    stopLocalRecorder();
                    setRecordStatus("paused");
                    recordStatusRef.current = "paused";
                    setWsStatus("error");
                    setWsError("Connection lost during recording. Your form so far is preserved. Start a new recording segment to continue.");
                    return;
                }

                setWsStatus("disconnected");
            };

            ws.onerror = () => {
                // onerror always fires before onclose — let onclose handle transitions
            };

            ws.onmessage = (ev: MessageEvent) => {
                if (wsRef.current !== ws) return;

                try {
                    const msg = JSON.parse(ev.data as string) as ServerMessage;
                    const serverError =
                        msg.error ?? (msg.type === "error" ? msg.code ?? msg.message ?? "server-error" : null);

                    if (serverError) {
                        console.warn("[Formify] Server error:", serverError);
                        // If token was rejected, surface it clearly
                        if (serverError === "invalid-token" || serverError === "missing-token") {
                            setMicError("Session expired. Please try starting again.");
                        } else {
                            setMicError(msg.message ?? "The transcription session ended unexpectedly. Please try again.");
                        }

                        if (
                            activeSessionGenerationRef.current !== null ||
                            recordStatusRef.current === "recording" ||
                            recordStatusRef.current === "finalizing"
                        ) {
                            stopLocalRecorder();
                            setRecordStatus("paused");
                            recordStatusRef.current = "paused";
                        }

                        markSessionInactive();
                        startInFlightRef.current = false;
                        stopInFlightRef.current = false;
                        setIsStartingRecording(false);
                        setWsStatus("error");
                        intentionalCloseRef.current = true;
                        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                            ws.close(1000, "server-error");
                        }
                        return;
                    }

                    // Session confirmed by server
                    if (msg.type === "started") {
                        if (activeSessionGenerationRef.current !== null) {
                            wsSessionReadyRef.current = true;
                            blocksReadyRef.current = true;
                            setSessionReady(true);
                        }
                        return;
                    }

                    // Incremental attribute update
                    if (msg.type === "attributes_update" && msg.attributes !== undefined) {
                        if (activeSessionGenerationRef.current === null) return;

                        setAttributes((prev) => {
                            const allowedKeys = new Set(Object.values(parseBlocks(templateRawRef.current)).flat());
                            const locked = lockedFieldsRef.current;
                            const normalized: Record<string, string> = {};
                            for (const [rawKey, val] of Object.entries(msg.attributes!)) {
                                const key = normalizeKey(rawKey);
                                // Skip locked fields — user correction takes precedence over AI
                                if (locked.has(key)) continue;
                                if (allowedKeys.has(key) && val) {
                                    normalized[key] = val;
                                }
                            }
                            return { ...prev, ...normalized };
                        });
                        return;
                    }

                    // Final attributes — stop finalizing state
                    if (msg.type === "final_attributes" && msg.attributes !== undefined) {
                        if (activeSessionGenerationRef.current === null) return;

                        setAttributes((prev) => {
                            const allowedKeys = new Set(Object.values(parseBlocks(templateRawRef.current)).flat());
                            const locked = lockedFieldsRef.current;
                            const normalized: Record<string, string> = {};
                            for (const [rawKey, val] of Object.entries(msg.attributes!)) {
                                const key = normalizeKey(rawKey);
                                // Skip locked fields — user correction takes precedence over AI
                                if (locked.has(key)) continue;
                                if (allowedKeys.has(key) && val) normalized[key] = val;
                            }
                            return { ...prev, ...normalized };
                        });
                        setRecordStatus((s) => {
                            const next = s === "finalizing" ? "paused" : s;
                            recordStatusRef.current = next;
                            return next;
                        });
                        markSessionInactive();
                        stopInFlightRef.current = false;
                        intentionalCloseRef.current = true;
                        ws.close(1000, "forms-final");
                        return;
                    }
                } catch {
                    console.warn("[Formify] Non-JSON WS message");
                }
            };
        });
    }, [markSessionInactive, stopLocalRecorder]);

    useEffect(() => {
        return () => {
            stopLocalRecorder();
            const ws = wsRef.current;
            if (activeSessionGenerationRef.current !== null && ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "stop" }));
            }
            markSessionInactive();
            startInFlightRef.current = false;
            stopInFlightRef.current = false;
            intentionalCloseRef.current = true;
            ws?.close(1000, "client-unmount");
        };
    }, [markSessionInactive, stopLocalRecorder]);

    // ── Auto-send blocks once connected AND template is ready ────────────────

    const sendBlocks = useCallback((token: string, targetWs = wsRef.current): boolean => {
        const ws = targetWs;
        if (ws?.readyState !== WebSocket.OPEN) return false;
        const parsed = parseBlocks(templateRaw);
        if (Object.keys(parsed).length === 0) return false;

        // Filter out locked field keys — do not ask the server to fill user-corrected fields.
        // Values are never included in this payload; only field keys are sent.
        const locked = lockedFieldsRef.current;
        const filtered: Record<string, string[]> = {};
        for (const [block, fields] of Object.entries(parsed)) {
            const unlocked = fields.filter((f) => !locked.has(f));
            if (unlocked.length > 0) filtered[block] = unlocked;
        }

        // If every field in the template is locked, there is nothing for the server to fill.
        if (Object.keys(filtered).length === 0) return false;

        ws.send(JSON.stringify({ action: "start", mode: "forms", blocks: filtered, token }));
        return true;
    }, [templateRaw]);

    // Note: sendBlocks is no longer called automatically on connect.
    // It is called inside startRecording after a session token is minted.
    // This ensures the server only receives a start payload from authenticated,
    // usage-checked sessions.

    // ── Recording ─────────────────────────────────────────────────────────────

    const startRecording = useCallback(async () => {
        if (startInFlightRef.current || recordStatusRef.current === "recording" || recordStatusRef.current === "finalizing") {
            return;
        }

        startInFlightRef.current = true;
        setMicError(null);

        if (!hasValidTemplate) {
            setMicError("Select a template before recording.");
            startInFlightRef.current = false;
            return;
        }

        // ── Pre-mint check: bail early if every field is already locked ────
        // Avoids opening the mic or minting a token when there are no unlocked
        // fields for the server to fill.
        const parsed = parseBlocks(templateRaw);
        const locked = lockedFieldsRef.current;
        const hasUnlocked = Object.values(parsed).some((fields) =>
            fields.some((f) => !locked.has(f))
        );
        if (!hasUnlocked) {
            setMicError("All fields are locked. Unlock a field to continue AI filling.");
            startInFlightRef.current = false;
            return;
        }

        setIsStartingRecording(true);
        setWsError(null);
        setWsStatus("disconnected");
        markSessionInactive();

        let stream: MediaStream | null = null;
        let recorder: MediaRecorder | null = null;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            recorder = new MediaRecorder(stream, { mimeType: SUPPORTED_MIME });
        } catch (err) {
            stream?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            const msg = err instanceof Error ? err.message : String(err);
            setMicError(
                msg.toLowerCase().includes("permission")
                    ? "Microphone permission was denied. Please allow microphone access in your browser and retry."
                    : `Could not start recording: ${msg}`
            );
            startInFlightRef.current = false;
            setIsStartingRecording(false);
            return;
        }

        // ── Mint session token (auth + analytics only; no paywall gate) ──
        let token: string;
        try {
            const result = await getSessionToken.mutateAsync({ mode: "forms" });
            token = result.token;
            wsTokenRef.current = token;
            // Refresh usage display so the profile page count stays fresh.
            void utils.usage.getToday.invalidate();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to start session";
            stopLocalRecorder();
            setMicError(msg);
            startInFlightRef.current = false;
            setIsStartingRecording(false);
            return;
        }

        let ws: WebSocket;
        try {
            ws = await connectWS();
        } catch {
            stopLocalRecorder();
            wsTokenRef.current = null;
            setWsError("Could not connect to the transcription service. Please try again.");
            setWsStatus("error");
            startInFlightRef.current = false;
            setIsStartingRecording(false);
            return;
        }

        const sessionGeneration = sessionGenerationRef.current + 1;
        sessionGenerationRef.current = sessionGeneration;
        activeSessionGenerationRef.current = sessionGeneration;
        wsSessionReadyRef.current = false;
        blocksReadyRef.current = false;
        setSessionReady(false);

        // ── Send start payload with token ──────────────────────────────────
        if (!sendBlocks(token, ws)) {
            markSessionInactive();
            stopLocalRecorder();
            setMicError("All fields are locked. Unlock a field to continue AI filling.");
            intentionalCloseRef.current = true;
            ws.close(1000, "start-aborted");
            startInFlightRef.current = false;
            setIsStartingRecording(false);
            return;
        }

        if (!stream || !recorder) {
            markSessionInactive();
            stopLocalRecorder();
            setMicError("Could not start recording. Please try again.");
            intentionalCloseRef.current = true;
            ws.close(1000, "start-aborted");
            startInFlightRef.current = false;
            setIsStartingRecording(false);
            return;
        }

        const activeStream = stream;
        const activeRecorder = recorder;

        try {
            recorderRef.current = activeRecorder;

            activeRecorder.ondataavailable = (e) => {
                if (
                    e.data.size > 0 &&
                    recordStatusRef.current === "recording" &&
                    activeSessionGenerationRef.current === sessionGeneration &&
                    wsRef.current === ws &&
                    ws.readyState === WebSocket.OPEN &&
                    wsSessionReadyRef.current
                ) {
                    void e.data.arrayBuffer().then((buf) => {
                        if (
                            recordStatusRef.current === "recording" &&
                            activeSessionGenerationRef.current === sessionGeneration &&
                            wsRef.current === ws &&
                            ws.readyState === WebSocket.OPEN &&
                            wsSessionReadyRef.current
                        ) {
                            ws.send(buf);
                        }
                    });
                }
            };

            activeRecorder.onstop = () => activeStream.getTracks().forEach((track) => track.stop());

            await waitForSessionStarted(sessionGeneration);

            activeRecorder.start(1000); // 1s chunks — aligns with notes mode, reduces WS message overhead.
            setRecordStatus("recording");
            recordStatusRef.current = "recording";
            setIsStartingRecording(false);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (activeSessionGenerationRef.current === sessionGeneration && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "stop" }));
            }
            intentionalCloseRef.current = true;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close(1000, "start-aborted");
            }
            markSessionInactive();
            stopLocalRecorder();
            setMicError(
                msg === "session-start-timeout"
                    ? "The transcription session did not start in time. Please try again."
                    : `Could not start recording: ${msg}`
            );
            setIsStartingRecording(false);
        } finally {
            startInFlightRef.current = false;
        }
    }, [connectWS, getSessionToken, hasValidTemplate, markSessionInactive, sendBlocks, stopLocalRecorder, templateRaw, utils, waitForSessionStarted]);

    // ── Stop ──────────────────────────────────────────────────────────────────

    const pauseRecording = useCallback(() => {
        if (stopInFlightRef.current || recordStatusRef.current !== "recording") return;

        stopInFlightRef.current = true;
        wsSessionReadyRef.current = false;
        blocksReadyRef.current = false;
        setSessionReady(false);
        setRecordStatus("finalizing");
        recordStatusRef.current = "finalizing";
        setIsStartingRecording(false);
        stopLocalRecorder();
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN && activeSessionGenerationRef.current !== null) {
            ws.send(JSON.stringify({ action: "stop" }));
        } else {
            markSessionInactive();
            stopInFlightRef.current = false;
            setRecordStatus("paused");
            recordStatusRef.current = "paused";
            setWsError("The recording connection was unavailable. Your form so far is preserved.");
            setWsStatus("error");
        }
        // Usage was already counted when the session token was minted in startRecording.
        // No additional mutation needed here.
    }, [markSessionInactive, stopLocalRecorder]);

    // ── Per-field edit and lock ────────────────────────────────────────────────

    // Called on every input change. Updates the displayed value immediately and
    // locks the field so AI updates cannot overwrite the user's correction.
    const handleFieldChange = useCallback((field: string, value: string) => {
        setAttributes((prev) => ({ ...prev, [field]: value }));
        setLockedFields((prev) => {
            if (prev.has(field)) return prev; // already locked — avoid creating a new Set
            const next = new Set(prev);
            next.add(field);
            lockedFieldsRef.current = next;
            return next;
        });
    }, []);

    // Removes a field from the locked set so AI updates can fill it again.
    const unlockField = useCallback((field: string) => {
        setLockedFields((prev) => {
            if (!prev.has(field)) return prev;
            const next = new Set(prev);
            next.delete(field);
            lockedFieldsRef.current = next;
            return next;
        });
    }, []);

    // ── Reset ─────────────────────────────────────────────────────────────────

    const handleReset = () => {
        const ws = wsRef.current;
        const hadActiveSession = activeSessionGenerationRef.current !== null;

        clearFormsDraft();
        sessionGenerationRef.current += 1;
        startInFlightRef.current = false;
        stopInFlightRef.current = false;
        setIsStartingRecording(false);
        stopLocalRecorder();

        if (hadActiveSession && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "stop" }));
        }
        markSessionInactive();
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            intentionalCloseRef.current = true;
            ws.close(1000, "form-reset");
        }
        setWsStatus("disconnected");
        setRecordStatus("idle");
        recordStatusRef.current = "idle";
        setMicError(null);
        setWsError(null);
        const empty: Record<string, string> = {};
        allFields.forEach((f) => { empty[f] = ""; });
        setAttributes(empty);
        const emptyLocked = new Set<string>();
        lockedFieldsRef.current = emptyLocked;
        setLockedFields(emptyLocked);
        blocksReadyRef.current = false;
        setSessionReady(false);
    };

    const openTemplateDrawer = () => {
        setShouldLoadTemplateSummaries(true);
        setTemplateDrawerVisible(true);
        requestAnimationFrame(() => setTemplateDrawerOpen(true));
    };

    const closeTemplateDrawer = () => {
        setTemplateDrawerOpen(false);
        window.setTimeout(() => setTemplateDrawerVisible(false), 200);
    };

    useEffect(() => {
        if (templateDrawerVisible) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [templateDrawerVisible]);

    useEffect(() => {
        return () => {
            if (draftSaveTimerRef.current) {
                clearTimeout(draftSaveTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!draftHydratedRef.current || !formsDraftStorageKey || !templateId || !hasValidTemplate) return;

        if (draftSaveTimerRef.current) {
            clearTimeout(draftSaveTimerRef.current);
            draftSaveTimerRef.current = null;
        }

        if (!hasFilledContent) {
            if (suppressNextEmptyDraftSaveRef.current) {
                suppressNextEmptyDraftSaveRef.current = false;
            }
            return;
        }

        suppressNextEmptyDraftSaveRef.current = false;
        draftSaveTimerRef.current = setTimeout(() => {
            const draft: FormsDraft = {
                version: 1,
                templateId,
                templateTitle: formTitle,
                attributes,
                lockedFields: Array.from(lockedFields),
                recordStatus: recordStatus === "idle" ? "idle" : "paused",
                updatedAt: new Date().toISOString(),
            };

            try {
                window.localStorage.setItem(formsDraftStorageKey, JSON.stringify(draft));
            } catch (error) {
                console.warn("[Forms] Could not save local form draft:", error);
            }
        }, FORMS_DRAFT_SAVE_DEBOUNCE_MS);

        return () => {
            if (draftSaveTimerRef.current) {
                clearTimeout(draftSaveTimerRef.current);
                draftSaveTimerRef.current = null;
            }
        };
    }, [
        attributes,
        formTitle,
        formsDraftStorageKey,
        hasFilledContent,
        hasValidTemplate,
        lockedFields,
        recordStatus,
        templateId,
    ]);

    const switchToTemplate = (nextTemplateId: string) => {
        handleReset();
        setShowSwitchConfirm(false);
        setPendingTemplateId(null);
        closeTemplateDrawer();
        router.push(`/forms?templateId=${nextTemplateId}`);
    };

    const cancelTemplateSwitch = useCallback(() => {
        setShowSwitchConfirm(false);
        setPendingTemplateId(null);
    }, []);

    const requestTemplateSwitch = (nextTemplateId: string) => {
        if (nextTemplateId === templateId) {
            closeTemplateDrawer();
            return;
        }
        if (templateSwitchDisabled) return;
        if (hasFilledContent) {
            setPendingTemplateId(nextTemplateId);
            setShowSwitchConfirm(true);
            return;
        }
        switchToTemplate(nextTemplateId);
    };

    useEffect(() => {
        if (!showSwitchConfirm) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                cancelTemplateSwitch();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [cancelTemplateSwitch, showSwitchConfirm]);


    // ── PDF Export ────────────────────────────────────────────────────────────

    const handleSavePDF = async () => {
        try {
            await exportFormPdf({
                title: formTitle,
                blocks: Object.entries(blocks).map(([blockName, fields]) => ({
                    title: blockName,
                    fields: fields.map((field) => ({
                        key: field,
                        label: formatFieldLabel(field),
                        value: attributes[field] ?? "",
                    })),
                })),
            });
        } catch (error) {
            console.error("PDF generation error:", error);
            alert("Failed to generate PDF. Please try again.");
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="flex min-h-0 flex-1 bg-[#FBFBFB] dark:bg-slate-950 dark:text-slate-100">
            <aside className={`hidden flex-none overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200 ease-out dark:border-slate-800 dark:bg-slate-950 md:flex ${isSidebarCollapsed ? "w-12" : "w-72"}`}>
                {isSidebarCollapsed ? (
                    <div className="flex h-full w-full flex-col items-center py-3">
                        <button
                            type="button"
                            onClick={() => setIsSidebarCollapsed(false)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-[#2149A1] dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-blue-300"
                            aria-label="Show form templates sidebar"
                            title="Show form templates sidebar"
                        >
                            <PanelLeftOpen className="h-4 w-4" />
                        </button>
                        <div className="mt-3 h-px w-6 bg-slate-200 dark:bg-slate-800" />
                        <FileText className="mt-4 h-4 w-4 text-[#2149A1] dark:text-blue-300" />
                    </div>
                ) : (
                    <TemplateSelector
                        templates={templateSummariesList}
                        selectedTemplateId={templateId}
                        loading={templateSelectorLoading}
                        disabled={templateSwitchDisabled}
                        onSelect={requestTemplateSwitch}
                        onToggleSidebar={() => setIsSidebarCollapsed(true)}
                    />
                )}
            </aside>

            {templateDrawerVisible && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <button
                        type="button"
                        aria-label="Close template drawer"
                        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 dark:bg-black/50 ${templateDrawerOpen ? "opacity-100" : "opacity-0"}`}
                        onClick={closeTemplateDrawer}
                    />
                    <div
                        className={`absolute inset-y-0 left-0 flex w-80 max-w-[86vw] transform flex-col bg-white shadow-2xl transition-transform duration-200 ease-out dark:bg-slate-950 ${templateDrawerOpen ? "translate-x-0" : "-translate-x-full"}`}
                    >
                        <TemplateSelector
                            templates={templateSummariesList}
                            selectedTemplateId={templateId}
                            loading={templateSelectorLoading}
                            disabled={templateSwitchDisabled}
                            onSelect={requestTemplateSwitch}
                            onClose={closeTemplateDrawer}
                        />
                    </div>
                </div>
            )}

            <section className="min-w-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8 lg:px-10">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={openTemplateDrawer}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[border-color,color,transform,opacity] active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:hidden"
                        >
                            <FileText className="h-4 w-4" />
                            Form Templates
                        </button>
                        <div className="ml-auto flex items-center gap-3">
                            {showConnectionPill && (
                                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${connectionPillClasses}`}>
                                    {isConnected && !isStartingRecording ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                    {connectionPillLabel}
                                </div>
                            )}
                        </div>
                    </div>

                {/* Template loading state — only shown when waiting for a preloaded/restored template */}
                {((Boolean(templateId) && !templateReady) || hasRestorableDraft) && (
                    <div className="mb-6 flex items-center gap-2.5 bg-[#e8eef9] border border-[#2149A1]/20 text-[#2149A1] text-sm rounded-lg px-4 py-3 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        {hasRestorableDraft ? "Restoring form draft…" : "Loading template…"}
                    </div>
                )}

                {!templateLoading && !hasValidTemplate && !hasRestorableDraft ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8eef9] dark:bg-blue-500/15">
                            <FileText className="h-7 w-7 text-[#2149A1] dark:text-blue-300" />
                        </div>
                        {templateNotFound && (
                            <p className="mb-2 text-sm font-semibold text-red-600 dark:text-red-300">
                                Template not found.
                            </p>
                        )}
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            No form template selected.
                        </h1>
                        <p className="mx-auto mt-3 max-w-md text-sm text-[#868C94] dark:text-slate-400">
                            {templateNotFound
                                ? "Select another template to start filling a form, or create a new template first."
                                : "Select a template to start filling a form, or create a new template first."}
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                            <button
                                type="button"
                                onClick={openTemplateDrawer}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#2149A1] px-4 py-2.5 text-sm font-medium text-white transition-[background-color,transform,opacity] hover:bg-[#1a3a87] active:scale-[0.98] active:opacity-90 md:hidden"
                            >
                                <FileText className="h-4 w-4" />
                                Form Templates
                            </button>
                            <Link
                                href="/templates/new?returnTo=/forms"
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-[border-color,color,transform,opacity] hover:border-[#2149A1] hover:text-[#2149A1] active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                            >
                                <Plus className="h-4 w-4" />
                                New Template
                            </Link>
                        </div>
                        <p className="mt-5 hidden text-xs text-slate-500 dark:text-slate-400 md:block">
                            Choose a saved template from the sidebar to enable recording.
                        </p>
                    </div>
                ) : hasValidTemplate ? (
                    <>

                {/* Error banner */}
                {errorMessage && (
                    <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="flex-1">{errorMessage}</p>
                        <button
                            onClick={() => { setWsError(null); setMicError(null); }}
                            className="flex items-center gap-1 font-medium text-xs text-red-600 hover:text-red-800 whitespace-nowrap transition-opacity active:opacity-80 dark:text-red-300 dark:hover:text-red-200"
                        >
                            <RotateCcw className="w-3 h-3" /> Retry
                        </button>
                    </div>
                )}

                {/* Finalizing banner */}
                {isFinalizing && (
                    <div className="mb-6 flex items-center gap-2.5 bg-[#e8eef9] border border-[#2149A1]/20 text-[#2149A1] text-sm rounded-lg px-4 py-3 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        Running final extraction — fields will update in a moment…
                    </div>
                )}

                {/* ── Form title ── */}
                <div className="mb-6">
                    <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="text-2xl font-bold text-slate-900 bg-transparent border-none outline-none w-full placeholder-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
                        placeholder="Form title"
                    />
                    <p className="text-sm text-[#868C94] mt-1 dark:text-slate-400">
                        {isRecording
                            ? "Recording — fields are filling automatically."
                            : isPaused
                                ? "Paused — review or edit fields below."
                                : isFinalizing
                                    ? "Processing final output…"
                                    : "Press Start Recording when you're ready."}
                    </p>
                </div>

                {/* ── Controls ── */}
                <div className="flex flex-wrap items-center gap-3 mb-8">
                    {isRecording ? (
                        <button
                            onClick={pauseRecording}
                            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors duration-150 active:scale-[0.98] active:opacity-90"
                        >
                            <Square className="w-4 h-4 fill-white" />
                            Stop
                        </button>
                    ) : isFinalizing ? (
                        <button
                            type="button"
                            disabled
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-700 dark:text-slate-400"
                        >
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Finalizing…
                        </button>
                    ) : (
                        <button
                            onClick={startRecording}
                            disabled={!canRecord || getSessionToken.isPending}
                            className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-[background-color,color,transform,opacity] duration-150 hover:scale-[1.02] active:scale-[0.98] active:opacity-90"
                        >
                            {isStartingRecording || getSessionToken.isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                                : <><Mic className="w-4 h-4" />{isPaused ? "Resume Recording" : "Start Recording"}</>
                            }
                        </button>
                    )}

                    {isRecording && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-500 ml-1">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            Recording
                        </span>
                    )}

                    {/* PDF Export — only show when paused */}
                    {isPaused && (
                        <button
                            onClick={handleSavePDF}
                            className="flex items-center gap-2 border border-slate-300 hover:border-[#2149A1] hover:text-[#2149A1] text-slate-600 text-sm font-medium px-4 py-2.5 rounded-lg transition-[border-color,color,transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-300"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Save as PDF
                        </button>
                    )}

                    {/* Reset — only show once something has happened */}
                    {(isPaused || hasFilledContent) && !isRecording && !isFinalizing && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors active:scale-[0.98] active:opacity-80 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reset Form
                        </button>
                    )}
                </div>

                {/* ── Form blocks ── */}
                <div className="space-y-5">
                    {/* Form Title for PDF */}
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formTitle}</h2>
                        <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                            {new Date().toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                    </div>

                    {Object.entries(blocks).map(([blockName, fields]) => (
                        <div key={blockName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-slate-950/20">
                            {/* Block header */}
                            <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900">
                                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-200">{blockName}</h3>
                            </div>

                            {/* Fields grid */}
                            <div
                                className="grid gap-x-6 gap-y-4 px-6 py-5"
                                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))" }}
                            >
                                {fields.map((field) => {
                                    const isLocked = lockedFields.has(field);
                                    const value = attributes[field] ?? "";
                                    const isFilled = Boolean(value);

                                    return (
                                        <div key={field}>
                                            <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2">
                                                <label className="min-w-0 truncate text-xs font-medium text-[#868C94] dark:text-slate-400">
                                                    {formatFieldLabel(field)}
                                                </label>
                                                <div className="flex h-7 w-20 flex-shrink-0 items-center justify-end">
                                                    {isLocked ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => unlockField(field)}
                                                            title="Unlock field"
                                                            aria-label={`Unlock ${formatFieldLabel(field)}`}
                                                            className="group/unlock inline-flex h-7 w-20 items-center justify-end overflow-hidden rounded-md text-xs font-medium text-slate-500 transition-[color,opacity,transform] duration-150 active:scale-[0.98] active:opacity-75 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70 dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-slate-600"
                                                        >
                                                            <Lock className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150 md:group-hover/unlock:-translate-x-0.5 md:group-focus-visible/unlock:-translate-x-0.5" />
                                                            <span className="ml-1 max-w-[3.5rem] whitespace-nowrap opacity-100 transition-[max-width,opacity,transform] duration-150 md:max-w-0 md:translate-x-1 md:opacity-0 md:group-hover/unlock:max-w-[3.5rem] md:group-hover/unlock:translate-x-0 md:group-hover/unlock:opacity-100 md:group-focus-visible/unlock:max-w-[3.5rem] md:group-focus-visible/unlock:translate-x-0 md:group-focus-visible/unlock:opacity-100">
                                                                Unlock
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <span aria-hidden="true" className="h-7 w-20" />
                                                    )}
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                value={value}
                                                autoComplete="off"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck={false}
                                                onChange={(e) => handleFieldChange(field, e.target.value)}
                                                placeholder={isRecording ? "" : "—"}
                                                className={`w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-all duration-200
                                                    ${isLocked
                                                        ? "border-slate-300 bg-slate-50 text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-500/20"
                                                        : isFilled
                                                            ? "border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-[#2149A1]/20 focus:border-[#2149A1] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                                                            : "border-slate-200 bg-slate-50 text-slate-400 focus:ring-2 focus:ring-[#2149A1]/20 focus:border-[#2149A1] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                                                    }`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Advanced accordion ── */}
                {showAdvancedTemplateEditor && (
                <div className="mt-8 rounded-xl border border-slate-200 overflow-hidden dark:border-slate-800">
                    <button
                        onClick={() => setTemplateOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 text-sm text-[#868C94] hover:text-slate-700 transition-colors active:opacity-80 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <span className="font-medium">Advanced — Template Editor</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${templateOpen ? "rotate-180" : ""}`} />
                    </button>

                    {templateOpen && (
                        <div className="px-5 pb-5 pt-2 bg-white border-t border-slate-100 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs text-[#868C94] mb-3 dark:text-slate-400">
                                Format: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono dark:bg-slate-800 dark:text-slate-300">BlockName: field1, field2</code>
                            </p>
                            <textarea
                                value={templateRaw}
                                onChange={(e) => setTemplateRaw(e.target.value)}
                                rows={6}
                                disabled={isRecording}
                                placeholder={DEFAULT_TEMPLATE}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-700 resize-none focus:outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 disabled:opacity-50 transition-all dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                            />
                            <div className="flex items-center justify-between mt-3">
                                <p className="text-xs text-[#868C94] dark:text-slate-400">
                                    Changes reset the form fields.
                                </p>
                                <button
                                    onClick={() => { setTemplateOpen(false); blocksReadyRef.current = false; setSessionReady(false); }}
                                    disabled={!isConnected || isRecording}
                                    className="text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity active:opacity-80"
                                >
                                    Apply template →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                )}

                {/* ── Footer ── */}
                <p className="text-xs text-slate-400 text-center mt-8 pb-4 dark:text-slate-400">
                    Saved locally in this browser until you reset or switch forms.
                </p>
                    </>
                ) : null}
                </div>
            </section>

            {showSwitchConfirm && pendingTemplateId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Cancel template switch"
                        className="absolute inset-0 bg-black/50"
                        onClick={cancelTemplateSwitch}
                    />
                    <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-slate-950/60">
                        <button
                            type="button"
                            onClick={cancelTemplateSwitch}
                            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            aria-label="Cancel template switch"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <h3 className="pr-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Switch templates?</h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            Your current filled values will be cleared.
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => switchToTemplate(pendingTemplateId)}
                                className="flex-1 rounded-lg bg-[#2149A1] px-4 py-2 text-sm font-medium text-white transition-[background-color,transform,opacity] hover:bg-[#1a3a87] active:scale-[0.98] active:opacity-90"
                            >
                                Switch Template
                            </button>
                            <button
                                type="button"
                                onClick={cancelTemplateSwitch}
                                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-[background-color,transform,opacity] hover:bg-slate-50 active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
