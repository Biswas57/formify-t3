"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import Link from "next/link";
import {
    Mic, Square, Wifi, WifiOff, RotateCcw, ChevronDown,
    Lock, AlertCircle, RefreshCw, Loader2,
    Download, Mail, X, FileText, Plus, Check
} from "lucide-react";
import { formatFieldLabel } from "@/lib/format-field-label";
import { env } from "@/env";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
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

interface TemplateSummary {
    id: string;
    name: string;
    updatedAt: Date;
    blockCount: number;
    fieldCount: number;
    previewTitles: string[];
}

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

function TemplateSelector({
    templates,
    selectedTemplateId,
    loading,
    disabled,
    onSelect,
}: {
    templates: TemplateSummary[];
    selectedTemplateId: string | null;
    loading: boolean;
    disabled: boolean;
    onSelect: (id: string) => void;
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                <div>
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-[#868C94] dark:text-slate-400">
                        Form Templates
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Select one before recording.
                    </p>
                </div>
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
                    >
                        <Plus className="h-4 w-4" />
                    </Link>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {loading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading templates…
                    </div>
                ) : templates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900">
                        <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No templates yet</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create one before filling forms.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {templates.map((template) => {
                            const selected = template.id === selectedTemplateId;
                            return (
                                <button
                                    key={template.id}
                                    type="button"
                                    disabled={disabled && !selected}
                                    onClick={() => onSelect(template.id)}
                                    className={`w-full rounded-xl border px-3 py-3 text-left transition-[border-color,background-color,opacity,transform] active:scale-[0.99] ${selected
                                        ? "border-[#2149A1] bg-[#e8eef9] text-[#2149A1] dark:border-blue-400/60 dark:bg-blue-500/15 dark:text-blue-200"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-[#2149A1]/30 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-400/30 dark:hover:bg-slate-800"
                                        }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-semibold">{template.name}</p>
                                                {selected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                                            </div>
                                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                {template.blockCount} block{template.blockCount !== 1 ? "s" : ""} · {template.fieldCount} field{template.fieldCount !== 1 ? "s" : ""}
                                            </p>
                                            {template.previewTitles.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {template.previewTitles.slice(0, 2).map((title) => (
                                                        <span
                                                            key={title}
                                                            className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                        >
                                                            {title}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
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

export default function TranscriptionClient({ user }: { user: User }) {
    const router = useRouter();
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
    const [, setBlocksReady] = useState(false);

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
    const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
    const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

    // Form data
    const [attributes, setAttributes] = useState<Record<string, string>>({});
    // lockedFields: keys the user has manually edited — AI updates must not overwrite these.
    // A ref mirror is kept so the WS onmessage closure ([] deps) always reads the current set.
    const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
    const lockedFieldsRef = useRef<Set<string>>(new Set());
    useEffect(() => { lockedFieldsRef.current = lockedFields; }, [lockedFields]);

    // Export features
    const formContainerRef = useRef<HTMLDivElement>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailOption, setEmailOption] = useState<"self" | "custom">("self");
    const [customEmail, setCustomEmail] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const getSessionToken = api.transcription.getSessionToken.useMutation();
    const utils = api.useUtils();

    // (Session usage is counted server-side at token mint time)

    // ── Template preload from query param ────────────────────────────────────────
    const searchParams = useSearchParams();
    const templateId = searchParams.get("templateId");

    // Forms mode requires a saved template. With no templateId, the workspace
    // stays in the select-template state and never falls back to a default form.
    const { data: preloadedTemplate, isLoading: templateLoading } = api.template.get.useQuery(
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
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const hasTemplateId = Boolean(templateId);
    const hasValidTemplate = Boolean(preloadedTemplate);
    const templateReady = hasTemplateId && !templateLoading;
    const templateNotFound = hasTemplateId && !templateLoading && !preloadedTemplate;

    // Derived
    const blocks = parseBlocks(templateRaw);
    const allFields = Object.values(blocks).flat();
    const isConnected = wsStatus === "connected";
    const isRecording = recordStatus === "recording";
    const isFinalizing = recordStatus === "finalizing";
    const isPaused = recordStatus === "paused";
    const canRecord = isConnected && !isFinalizing && hasValidTemplate;
    const errorMessage = wsError ?? micError;
    const hasFilledContent =
        Object.values(attributes).some((value) => value.trim().length > 0) ||
        lockedFields.size > 0;
    const templateSwitchDisabled = isRecording || isFinalizing;
    const showAdvancedTemplateEditor = false;

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
        const raw = preloadedTemplate.blocks
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
            .map((b: { title: string; fields: { key: string; order: number }[] }) =>
                `${b.title}: ${b.fields
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
        setAttributes(empty);
        const emptyLocked = new Set<string>();
        lockedFieldsRef.current = emptyLocked;
        setLockedFields(emptyLocked);
        blocksReadyRef.current = false;
        setBlocksReady(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateRaw]);

    // ── WebSocket ─────────────────────────────────────────────────────────────

    // Auto-reconnect state — mirrors NotesClient pattern
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordStatusRef = useRef<RecordStatus>("idle");
    const wsSessionReadyRef = useRef(false);
    const intentionalCloseRef = useRef(false);
    const reconnectAfterIntentionalCloseRef = useRef(false);
    const sessionGenerationRef = useRef(0);
    const activeSessionGenerationRef = useRef<number | null>(null);
    const startInFlightRef = useRef(false);
    const stopInFlightRef = useRef(false);
    // Short-lived WS session token minted by the server just before recording starts.
    // Stored in a ref so sendBlocks can include it without a stale closure.
    const wsTokenRef = useRef<string | null>(null);
    const MAX_RECONNECT_ATTEMPTS = 4;

    const markSessionInactive = useCallback(() => {
        wsSessionReadyRef.current = false;
        blocksReadyRef.current = false;
        setBlocksReady(false);
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

    const connectWS = useCallback((isReconnect = false) => {
        if (
            wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING
        ) return;

        if (isReconnect) {
            setWsStatus("reconnecting");
        } else {
            setWsStatus("connecting");
            setWsError(null);
            reconnectAttemptsRef.current = 0;
            intentionalCloseRef.current = false;
            reconnectAfterIntentionalCloseRef.current = false;
        }

        const ws = new WebSocket(getWSUrl());
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        // 8s connection timeout — gives enough time for slow cold-starts
        const connectionTimeout = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                // onclose will handle reconnect logic
            }
        }, 8000);

        ws.onopen = () => {
            clearTimeout(connectionTimeout);
            setWsStatus("connected");
            setWsError(null);
            reconnectAttemptsRef.current = 0;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };

        ws.onclose = () => {
            clearTimeout(connectionTimeout);
            markSessionInactive();
            startInFlightRef.current = false;
            stopInFlightRef.current = false;
            if (wsRef.current === ws) wsRef.current = null;

            const wasIntentional = intentionalCloseRef.current;
            const shouldReconnect = reconnectAfterIntentionalCloseRef.current;
            intentionalCloseRef.current = false;
            reconnectAfterIntentionalCloseRef.current = false;

            if (wasIntentional) {
                setWsStatus("disconnected");
                if (shouldReconnect) connectWS();
                return;
            }

            const currentStatus = recordStatusRef.current;

            // Disconnect during active recording is a real failure
            if (currentStatus === "recording" || currentStatus === "finalizing") {
                stopLocalRecorder();
                setRecordStatus("paused");
                recordStatusRef.current = "paused";
                setWsStatus("error");
                setWsError("Connection lost during recording. Your form so far is preserved. Start a new recording segment to continue.");
                return;
            }

            // Otherwise attempt quiet auto-reconnect
            const attempt = ++reconnectAttemptsRef.current;
            if (attempt <= MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
                reconnectTimerRef.current = setTimeout(() => connectWS(true), delay);
            } else {
                setWsStatus("error");
                setWsError("Could not reconnect. Click Retry to try again.");
            }
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
                    setWsStatus("error");
                    intentionalCloseRef.current = true;
                    reconnectAfterIntentionalCloseRef.current = false;
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
                        setBlocksReady(true);
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
                    return;
                }
            } catch {
                console.warn("[Formify] Non-JSON WS message");
            }
        };
    }, [markSessionInactive, stopLocalRecorder]);

    useEffect(() => {
        connectWS();
        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            stopLocalRecorder();
            const ws = wsRef.current;
            if (activeSessionGenerationRef.current !== null && ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "stop" }));
            }
            markSessionInactive();
            startInFlightRef.current = false;
            stopInFlightRef.current = false;
            intentionalCloseRef.current = true;
            reconnectAfterIntentionalCloseRef.current = false;
            ws?.close(1000, "client-unmount");
        };
    }, [connectWS, markSessionInactive, stopLocalRecorder]);

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

        const initialWs = wsRef.current;
        if (initialWs?.readyState !== WebSocket.OPEN) {
            setMicError("Could not connect to the transcription service. Please try again.");
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
            return;
        }

        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) {
            stopLocalRecorder();
            wsTokenRef.current = null;
            setMicError("The transcription connection changed while starting. Please try again.");
            startInFlightRef.current = false;
            return;
        }

        const sessionGeneration = sessionGenerationRef.current + 1;
        sessionGenerationRef.current = sessionGeneration;
        activeSessionGenerationRef.current = sessionGeneration;
        wsSessionReadyRef.current = false;
        blocksReadyRef.current = false;
        setBlocksReady(false);

        // ── Send start payload with token ──────────────────────────────────
        if (!sendBlocks(token, ws)) {
            markSessionInactive();
            stopLocalRecorder();
            setMicError("All fields are locked. Unlock a field to continue AI filling.");
            startInFlightRef.current = false;
            return;
        }

        if (!stream || !recorder) {
            markSessionInactive();
            stopLocalRecorder();
            setMicError("Could not start recording. Please try again.");
            startInFlightRef.current = false;
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
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (activeSessionGenerationRef.current === sessionGeneration && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "stop" }));
            }
            markSessionInactive();
            stopLocalRecorder();
            setMicError(
                msg === "session-start-timeout"
                    ? "The transcription session did not start in time. Please try again."
                    : `Could not start recording: ${msg}`
            );
        } finally {
            startInFlightRef.current = false;
        }
    }, [getSessionToken, hasValidTemplate, markSessionInactive, sendBlocks, stopLocalRecorder, templateRaw, utils, waitForSessionStarted]);

    // ── Pause ─────────────────────────────────────────────────────────────────

    const pauseRecording = useCallback(() => {
        if (stopInFlightRef.current || recordStatusRef.current !== "recording") return;

        stopInFlightRef.current = true;
        wsSessionReadyRef.current = false;
        blocksReadyRef.current = false;
        setBlocksReady(false);
        setRecordStatus("finalizing");
        recordStatusRef.current = "finalizing";
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

        sessionGenerationRef.current += 1;
        startInFlightRef.current = false;
        stopInFlightRef.current = false;
        stopLocalRecorder();

        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        reconnectAttemptsRef.current = 0;
        if (hadActiveSession && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "stop" }));
        }
        markSessionInactive();
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            intentionalCloseRef.current = true;
            reconnectAfterIntentionalCloseRef.current = true;
            ws.close(1000, "form-reset");
        } else {
            connectWS();
        }
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
        // Setting blocksReadyRef to false is enough — the useEffect watching
        // wsStatus + blocksReady will fire and call sendBlocks() once.
        blocksReadyRef.current = false;
        setBlocksReady(false);
    };

    const openTemplateDrawer = () => {
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

    const switchToTemplate = (nextTemplateId: string) => {
        handleReset();
        setShowSwitchConfirm(false);
        setPendingTemplateId(null);
        closeTemplateDrawer();
        router.push(`/forms?templateId=${nextTemplateId}`);
    };

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


    // ── PDF Export ────────────────────────────────────────────────────────────

    const handleSavePDF = async () => {
        try {
            const { default: jsPDF } = await import("jspdf");

            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

            // ── Constants ──────────────────────────────────────────────────────
            const PAGE_W = 210;
            const PAGE_H = 297;
            const MARGIN = 14;
            const CONTENT_W = PAGE_W - MARGIN * 2;
            const COL_W = (CONTENT_W - 6) / 2; // 6mm gutter

            // Colours
            const BRAND_BLUE: [number, number, number] = [33, 73, 161];
            const HEADER_BG: [number, number, number] = [245, 247, 252];
            const BLOCK_HDR_BG: [number, number, number] = [248, 249, 251];
            const BORDER_COL: [number, number, number] = [220, 224, 232];
            const LABEL_COL: [number, number, number] = [134, 140, 148];
            const VALUE_COL: [number, number, number] = [15, 23, 42];
            const EMPTY_COL: [number, number, number] = [190, 194, 200];
            const WHITE: [number, number, number] = [255, 255, 255];

            // Helper: filled rounded rect
            const filledRect = (
                x: number, y: number, w: number, h: number, r: number,
                fill: [number, number, number], stroke?: [number, number, number]
            ) => {
                pdf.setFillColor(...fill);
                pdf.setDrawColor(...(stroke ?? fill));
                pdf.roundedRect(x, y, w, h, r, r, stroke ? "FD" : "F");
            };

            // Helper: clamp text to width with ellipsis
            const clampText = (text: string, maxW: number, fs: number) => {
                pdf.setFontSize(fs);
                if (pdf.getTextWidth(text) <= maxW) return text;
                while (text.length > 1 && pdf.getTextWidth(text + "…") > maxW) {
                    text = text.slice(0, -1);
                }
                return text + "…";
            };

            let y = 0;

            // Page-break guard — redraws top stripe on new pages
            const ensureSpace = (needed: number) => {
                if (y + needed > PAGE_H - 14) {
                    pdf.addPage();
                    pdf.setFillColor(...BRAND_BLUE);
                    pdf.rect(0, 0, PAGE_W, 2, "F");
                    y = 10;
                }
            };

            // ── HEADER ─────────────────────────────────────────────────────────
            pdf.setFillColor(...BRAND_BLUE);
            pdf.rect(0, 0, PAGE_W, 2, "F");

            pdf.setFillColor(...HEADER_BG);
            pdf.rect(0, 2, PAGE_W, 32, "F");

            // Logo mark
            filledRect(MARGIN, 8, 10, 10, 2, BRAND_BLUE);
            pdf.setTextColor(...WHITE);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8);
            pdf.text("F", MARGIN + 3.5, 14.8);

            // Brand name
            pdf.setTextColor(...BRAND_BLUE);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(13);
            pdf.text("Formify", MARGIN + 13, 14.2);

            // Tagline
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.setTextColor(...LABEL_COL);
            pdf.text("Voice-powered form filling", MARGIN + 13, 18.5);

            // Form title (right-aligned)
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            pdf.setTextColor(...VALUE_COL);
            pdf.text(clampText(formTitle, 90, 11), PAGE_W - MARGIN, 13, { align: "right" });

            // Date
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(...LABEL_COL);
            const dateStr = new Date().toLocaleDateString("en-AU", {
                day: "numeric", month: "long", year: "numeric",
            });
            pdf.text(dateStr, PAGE_W - MARGIN, 19, { align: "right" });

            // Header divider
            pdf.setDrawColor(...BORDER_COL);
            pdf.setLineWidth(0.3);
            pdf.line(0, 34, PAGE_W, 34);

            y = 40;

            // ── BLOCKS ─────────────────────────────────────────────────────────
            for (const [blockName, fields] of Object.entries(blocks)) {
                const fieldRows = Math.ceil(fields.length / 2);
                const bodyH = fieldRows * 16 + 6;
                const blockTotal = 10 + bodyH;

                ensureSpace(blockTotal + 4);

                // Outer border
                pdf.setDrawColor(...BORDER_COL);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(MARGIN, y, CONTENT_W, blockTotal, 3, 3, "S");

                // Block header band
                filledRect(MARGIN, y, CONTENT_W, 10, 3, BLOCK_HDR_BG);
                pdf.setDrawColor(...BORDER_COL);
                pdf.line(MARGIN, y + 10, MARGIN + CONTENT_W, y + 10);

                // Block title
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(8);
                pdf.setTextColor(...BRAND_BLUE);
                pdf.text(blockName.toUpperCase(), MARGIN + 5, y + 6.5);

                // Fields — two per row
                let fieldY = y + 14;

                const drawField = (field: string, fx: number) => {
                    const rawValue = attributes[field] ?? "";
                    const label = formatFieldLabel(field);
                    const BOX_H = 7.5;

                    // Label
                    pdf.setFont("helvetica", "normal");
                    pdf.setFontSize(7);
                    pdf.setTextColor(...LABEL_COL);
                    pdf.text(label, fx, fieldY);

                    // Input box
                    const boxY = fieldY + 1.5;
                    filledRect(fx, boxY, COL_W, BOX_H, 1.5, WHITE, BORDER_COL);

                    // Value — vertically centred inside box
                    pdf.setFont("helvetica", "normal");
                    pdf.setFontSize(8.5);
                    if (rawValue) {
                        pdf.setTextColor(...VALUE_COL);
                        pdf.text(clampText(rawValue, COL_W - 6, 8.5), fx + 3, boxY + BOX_H / 2 + 1.5);
                    } else {
                        pdf.setTextColor(...EMPTY_COL);
                        pdf.text("—", fx + 3, boxY + BOX_H / 2 + 1.5);
                    }
                };

                for (let i = 0; i < fields.length; i += 2) {
                    drawField(fields[i]!, MARGIN + 2);
                    if (fields[i + 1]) drawField(fields[i + 1]!, MARGIN + 2 + COL_W + 6);
                    fieldY += 16;
                }

                y += blockTotal + 5;
            }

            // ── FOOTER on every page ────────────────────────────────────────────
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const totalPages: number = (pdf as any).internal.getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
                pdf.setPage(p);
                pdf.setDrawColor(...BORDER_COL);
                pdf.setLineWidth(0.2);
                pdf.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(7);
                pdf.setTextColor(...LABEL_COL);
                pdf.text("Generated by Formify · formify-webapp.vercel.app", MARGIN, PAGE_H - 6);
                pdf.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
            }

            // ── Save ───────────────────────────────────────────────────────────
            pdf.save(`${formTitle.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
        } catch (error) {
            console.error("PDF generation error:", error);
            alert("Failed to generate PDF. Please try again.");
        }
    };

    // ── Email Export ──────────────────────────────────────────────────────────

    const handleSendEmail = async () => {
        setIsSendingEmail(true);
        setEmailStatus(null);

        const recipientEmail = emailOption === "self" ? user.email : customEmail;

        if (!recipientEmail) {
            setEmailStatus({ type: "error", message: "No email address available" });
            setIsSendingEmail(false);
            return;
        }

        try {
            // Send structured data only. The server renders the email HTML and
            // escapes every value, so no client-rendered/raw HTML is sent or trusted.
            const emailBlocks = Object.entries(blocks).map(([blockName, fields]) => ({
                name: blockName,
                fields: fields.map((field) => ({
                    label: formatFieldLabel(field),
                    value: attributes[field] ?? "",
                })),
            }));

            const response = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipientEmail,
                    formTitle,
                    blocks: emailBlocks,
                }),
            });

            const result = (await response.json()) as { error?: unknown };

            if (!response.ok) {
                const errorMsg = typeof result.error === 'string' ? result.error : 'Failed to send email';
                throw new Error(errorMsg);
            }

            setEmailStatus({ type: "success", message: `Email sent successfully to ${recipientEmail}` });
            setTimeout(() => {
                setShowEmailModal(false);
                setEmailStatus(null);
                setCustomEmail("");
            }, 2000);
        } catch (error) {
            console.error('Email send error:', error);
            const errorMessage = error instanceof Error ? error.message ?? 'Failed to send email' : 'Failed to send email';
            setEmailStatus({
                type: "error",
                message: errorMessage
            });
        } finally {
            setIsSendingEmail(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="flex min-h-0 flex-1 bg-[#FBFBFB] dark:bg-slate-950 dark:text-slate-100">
            <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex">
                <TemplateSelector
                    templates={templateSummaries as TemplateSummary[]}
                    selectedTemplateId={templateId}
                    loading={templatesLoading}
                    disabled={templateSwitchDisabled}
                    onSelect={requestTemplateSwitch}
                />
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
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Choose Template</p>
                            <button
                                type="button"
                                onClick={closeTemplateDrawer}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 active:scale-95 active:opacity-80 dark:text-slate-400 dark:hover:bg-slate-900"
                                aria-label="Close template drawer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <TemplateSelector
                            templates={templateSummaries as TemplateSummary[]}
                            selectedTemplateId={templateId}
                            loading={templatesLoading}
                            disabled={templateSwitchDisabled}
                            onSelect={requestTemplateSwitch}
                        />
                    </div>
                </div>
            )}

            <section className="min-w-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={openTemplateDrawer}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[border-color,color,transform,opacity] active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:hidden"
                        >
                            <FileText className="h-4 w-4" />
                            Choose Template
                        </button>
                        <div className="ml-auto flex items-center gap-3">
                            {isRecording && (
                                <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                    Recording
                                </span>
                            )}
                            {isFinalizing && (
                                <span className="flex items-center gap-1.5 text-xs text-[#868C94] dark:text-slate-400">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Finalizing…
                                </span>
                            )}
                            {hasValidTemplate && (
                                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${isConnected
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : (wsStatus === "connecting" || wsStatus === "reconnecting")
                                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                        : "bg-red-50 text-red-600 border-red-200"
                                    }`}>
                                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                    {wsStatus === "connecting" ? "Connecting…" : wsStatus === "reconnecting" ? "Reconnecting…" : isConnected ? "Connected" : "Disconnected"}
                                </div>
                            )}
                        </div>
                    </div>

                {/* Template loading state — only shown when waiting for a preloaded template */}
                {templateId && !templateReady && (
                    <div className="mb-6 flex items-center gap-2.5 bg-[#e8eef9] border border-[#2149A1]/20 text-[#2149A1] text-sm rounded-lg px-4 py-3 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        Loading template…
                    </div>
                )}

                {!templateLoading && !hasValidTemplate ? (
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
                                Choose Template
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
                            onClick={() => { setWsError(null); setMicError(null); connectWS(); }}
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
                    {!isRecording ? (
                        <button
                            onClick={startRecording}
                            disabled={!canRecord || getSessionToken.isPending}
                            className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-[background-color,color,transform,opacity] duration-150 hover:scale-[1.02] active:scale-[0.98] active:opacity-90"
                        >
                            {getSessionToken.isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                                : <><Mic className="w-4 h-4" />{isPaused ? "Resume Recording" : "Start Recording"}</>
                            }
                        </button>
                    ) : (
                        <button
                            onClick={pauseRecording}
                            className="flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-medium px-5 py-2.5 rounded-lg transition-[background-color,border-color,color,transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900"
                        >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            Pause
                        </button>
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

                    {/* Email Export — only show when paused */}
                    {isPaused && (
                        <button
                            onClick={() => setShowEmailModal(true)}
                            className="flex items-center gap-2 border border-slate-300 hover:border-[#2149A1] hover:text-[#2149A1] text-slate-600 text-sm font-medium px-4 py-2.5 rounded-lg transition-[border-color,color,transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-300"
                        >
                            <Mail className="w-3.5 h-3.5" />
                            Email Form
                        </button>
                    )}

                    {/* Reset — only show once something has happened */}
                    {(isPaused || isRecording) && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 text-sm text-[#868C94] hover:text-slate-700 transition-opacity active:opacity-80 ml-auto dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reset form
                        </button>
                    )}
                </div>

                {/* ── Form blocks ── */}
                <div ref={formContainerRef} className="space-y-5">
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
                            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                {fields.map((field) => {
                                    const isLocked = lockedFields.has(field);
                                    const value = attributes[field] ?? "";
                                    const isFilled = Boolean(value);

                                    return (
                                        <div key={field}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-medium text-[#868C94] dark:text-slate-400">
                                                    {formatFieldLabel(field)}
                                                </label>
                                                {isLocked && (
                                                    <button
                                                        onClick={() => unlockField(field)}
                                                        title="Locked — click to allow AI to fill again"
                                                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition-opacity active:opacity-80 dark:text-amber-300 dark:hover:text-amber-200"
                                                    >
                                                        <Lock className="w-3 h-3" />
                                                    </button>
                                                )}
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
                                                        ? "border-amber-300 bg-amber-50/50 text-slate-900 focus:ring-2 focus:ring-amber-200 dark:border-amber-500/50 dark:bg-amber-950/30 dark:text-amber-100 dark:focus:ring-amber-400/20"
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
                                    onClick={() => { setTemplateOpen(false); blocksReadyRef.current = false; setBlocksReady(false); }}
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
                    Not saved — refreshing this page will clear the form.
                </p>
                    </>
                ) : null}
                </div>
            </section>

            {showSwitchConfirm && pendingTemplateId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-slate-950/60">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Switch templates?</h3>
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
                                onClick={() => {
                                    setShowSwitchConfirm(false);
                                    setPendingTemplateId(null);
                                }}
                                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-[background-color,transform,opacity] hover:bg-slate-50 active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Email Modal ── */}
            {showEmailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 dark:bg-slate-900 dark:shadow-slate-950/60">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Email Form</h3>
                            <button
                                onClick={() => {
                                    setShowEmailModal(false);
                                    setEmailStatus(null);
                                    setCustomEmail("");
                                }}
                                className="text-slate-400 hover:text-slate-600 transition-opacity active:opacity-80 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {emailStatus && (
                            <div className={`mb-4 p-3 rounded-lg text-sm ${emailStatus.type === "success"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "bg-red-50 text-red-700 border border-red-200 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                                }`}>
                                {emailStatus.message}
                            </div>
                        )}

                        {/* Testing Notice */}
                        <div className="mb-4 p-3 rounded-lg text-xs bg-blue-50 text-blue-700 border border-blue-200 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                            <p className="font-medium mb-1">📧 Testing Mode</p>
                            <p>Without domain verification, use <code className="bg-blue-100 px-1 py-0.5 rounded font-mono dark:bg-blue-500/20">biswas.simk@gmail.com</code> to test emails.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="emailOption"
                                        checked={emailOption === "self"}
                                        onChange={() => setEmailOption("self")}
                                        className="w-4 h-4 text-[#2149A1]"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-200">
                                        Send to my email ({user.email ?? "No email"})
                                    </span>
                                </label>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input
                                        type="radio"
                                        name="emailOption"
                                        checked={emailOption === "custom"}
                                        onChange={() => setEmailOption("custom")}
                                        className="w-4 h-4 text-[#2149A1]"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-200">
                                        Send to custom email
                                    </span>
                                </label>
                                {emailOption === "custom" && (
                                    <input
                                        type="email"
                                        value={customEmail}
                                        onChange={(e) => setCustomEmail(e.target.value)}
                                        placeholder="recipient@example.com"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2149A1]/20 focus:border-[#2149A1] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowEmailModal(false);
                                    setEmailStatus(null);
                                    setCustomEmail("");
                                }}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors active:scale-[0.98] active:opacity-80 text-sm font-medium dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={isSendingEmail || (emailOption === "custom" && !customEmail)}
                                className="flex-1 px-4 py-2 bg-[#2149A1] text-white rounded-lg hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98] active:opacity-90 text-sm font-medium flex items-center justify-center gap-2"
                            >
                                {isSendingEmail ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4" />
                                        Send Email
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
