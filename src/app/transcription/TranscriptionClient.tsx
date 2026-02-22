"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import Link from "next/link";
import {
    Mic, Square, Wifi, WifiOff, RotateCcw, ChevronDown,
    Pencil, Check, AlertCircle, RefreshCw, Loader2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

interface ServerMessage {
    corrected_audio?: string;
    attributes?: Record<string, string>;
    error?: string;
    action?: string;
    template_size?: number;
}

type WSStatus = "disconnected" | "connecting" | "connected" | "error";
type RecordStatus = "idle" | "recording" | "finalizing" | "paused";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
            .map((f) => f.trim())
            .filter(Boolean);
        if (blockName && fields.length > 0) result[blockName] = fields;
    }
    return result;
}

function getWSUrl(): string {
    return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:5551";
}

const SUPPORTED_MIME =
    typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

const DEFAULT_TEMPLATE = `ID: name, date of birth, email, phone
Medical: chief complaint, medications, allergies
Social: occupation, address`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TranscriptionClient({ user }: { user: User }) {
    // Connection
    const wsRef = useRef<WebSocket | null>(null);
    const [wsStatus, setWsStatus] = useState<WSStatus>("disconnected");
    const [wsError, setWsError] = useState<string | null>(null);

    // Recording
    const recorderRef = useRef<MediaRecorder | null>(null);
    const [recordStatus, setRecordStatus] = useState<RecordStatus>("idle");
    const [micError, setMicError] = useState<string | null>(null);
    const blocksReadyRef = useRef(false);
    const [blocksReady, setBlocksReady] = useState(false);

    // Template
    const [templateRaw, setTemplateRaw] = useState(DEFAULT_TEMPLATE);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [formTitle, setFormTitle] = useState("New Form");

    // Form data
    const [attributes, setAttributes] = useState<Record<string, string>>({});
    const [editedValues, setEditedValues] = useState<Record<string, string>>({});
    const [isEditing, setIsEditing] = useState(false);

    // Derived
    const blocks = parseBlocks(templateRaw);
    const allFields = Object.values(blocks).flat();
    const isConnected = wsStatus === "connected";
    const isRecording = recordStatus === "recording";
    const isFinalizing = recordStatus === "finalizing";
    const isPaused = recordStatus === "paused";
    const canRecord = isConnected && blocksReady && !isFinalizing;
    const errorMessage = wsError ?? micError;

    // ── Template preload from query param ────────────────────────────────────────
    const searchParams = useSearchParams();
    const templateId = searchParams.get("templateId");

    const { data: preloadedTemplate } = api.template.get.useQuery(
        { id: templateId! },
        { enabled: !!templateId }
    );

    useEffect(() => {
        if (!preloadedTemplate) return;
        setFormTitle(preloadedTemplate.name);
        const raw = preloadedTemplate.blocks
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
            .map((b: { title: string; fields: { key: string; order: number }[] }) => `${b.title}: ${b.fields.sort((a: { order: number }, b: { order: number }) => a.order - b.order).map((f: { key: string }) => f.key).join(", ")}`)
            .join("\n");
        setTemplateRaw(raw);
    }, [preloadedTemplate]);

    // ── Sync attributes → editedValues when not editing ──────────────────────

    useEffect(() => {
        if (!isEditing) setEditedValues(attributes);
    }, [attributes, isEditing]);

    // ── Re-initialise fields when template changes ────────────────────────────

    useEffect(() => {
        const empty: Record<string, string> = {};
        allFields.forEach((f) => { empty[f] = ""; });
        setAttributes(empty);
        setEditedValues(empty);
        setIsEditing(false);
        blocksReadyRef.current = false;
        setBlocksReady(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateRaw]);

    // ── WebSocket ─────────────────────────────────────────────────────────────

    const connectWS = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        setWsStatus("connecting");
        setWsError(null);

        const ws = new WebSocket(getWSUrl());
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
            setWsStatus("connected");
            console.log("[Formify] WebSocket connected");
        };

        ws.onclose = () => {
            setWsStatus("disconnected");
            blocksReadyRef.current = false;
            setBlocksReady(false);
            console.log("[Formify] WebSocket disconnected");
        };

        ws.onerror = () => {
            setWsStatus("error");
            setWsError("Could not connect to the transcription server. Make sure it is running and try again.");
        };

        ws.onmessage = (ev: MessageEvent) => {
            try {
                const msg = JSON.parse(ev.data as string) as ServerMessage;

                if (msg.error) {
                    console.warn("[Formify] Server error:", msg.error);
                    return;
                }

                if (msg.action === "started") {
                    blocksReadyRef.current = true;
                    setBlocksReady(true);
                    console.log(`[Formify] Blocks accepted — ${msg.template_size ?? "?"} fields`);
                    return;
                }

                // Transcript: console only, never on page
                if (msg.corrected_audio !== undefined) {
                    console.log("[Formify] Transcript update:", msg.corrected_audio);
                }

                if (msg.attributes !== undefined) {
                    setAttributes((prev) => ({ ...prev, ...msg.attributes }));
                    // Final message after pause → leave finalizing
                    setRecordStatus((s) => (s === "finalizing" ? "paused" : s));
                }
            } catch {
                console.warn("[Formify] Non-JSON WS message");
            }
        };
    }, []);

    useEffect(() => {
        connectWS();
        return () => { wsRef.current?.close(); };
    }, [connectWS]);

    // ── Auto-send blocks once connected ──────────────────────────────────────

    const sendBlocks = useCallback(() => {
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) return;
        const parsed = parseBlocks(templateRaw);
        if (Object.keys(parsed).length === 0) return;
        ws.send(JSON.stringify({ action: "start", blocks: parsed }));
        console.log("[Formify] Blocks sent:", Object.keys(parsed).join(", "));
    }, [templateRaw]);

    useEffect(() => {
        if (wsStatus === "connected" && !blocksReadyRef.current) sendBlocks();
    }, [wsStatus, sendBlocks]);

    // ── Recording ─────────────────────────────────────────────────────────────

    const startRecording = useCallback(async () => {
        setMicError(null);
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN || !blocksReadyRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: SUPPORTED_MIME });
            recorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                    void e.data.arrayBuffer().then((buf) => ws.send(buf));
                }
            };

            recorder.onstart = () => {
                setRecordStatus("recording");
                setIsEditing(false);
            };

            recorder.onstop = () => stream.getTracks().forEach((t) => t.stop());

            recorder.start(250);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setMicError(
                msg.toLowerCase().includes("permission")
                    ? "Microphone permission was denied. Please allow microphone access in your browser and retry."
                    : `Could not start recording: ${msg}`
            );
        }
    }, []);

    const pauseRecording = useCallback(() => {
        recorderRef.current?.stop();
        setRecordStatus("finalizing");
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "stop" }));
            console.log("[Formify] Paused — awaiting final extraction");
        }
    }, []);

    // ── Edit / Save ───────────────────────────────────────────────────────────

    const handleSave = () => {
        setAttributes(editedValues);
        setIsEditing(false);
    };

    // ── Reset ─────────────────────────────────────────────────────────────────

    const handleReset = () => {
        recorderRef.current?.stop();
        setRecordStatus("idle");
        setIsEditing(false);
        setMicError(null);
        setWsError(null);
        const empty: Record<string, string> = {};
        allFields.forEach((f) => { empty[f] = ""; });
        setAttributes(empty);
        setEditedValues(empty);
        blocksReadyRef.current = false;
        setBlocksReady(false);
        sendBlocks();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#FBFBFB]">

            {/* ── Header ── */}
            <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3.5 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="flex items-center gap-2.5 animate-fade-in">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                                <Mic className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-3xl font-extrabold tracking-tight text-black">
                                Formify
                            </span>
                        </div>
                    </Link>

                    <div className="flex items-center gap-3">
                        {/* Subtle recording indicator */}
                        {isRecording && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                Recording
                            </span>
                        )}
                        {isFinalizing && (
                            <span className="flex items-center gap-1.5 text-xs text-[#868C94]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Finalizing…
                            </span>
                        )}

                        {/* WS pill */}
                        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${isConnected
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : wsStatus === "connecting"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-red-50 text-red-600 border-red-200"
                            }`}>
                            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                            {wsStatus === "connecting" ? "Connecting…" : isConnected ? "Connected" : "Disconnected"}
                        </div>

                        {/* User */}
                        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                            <div className="w-7 h-7 rounded-full bg-[#2149A1] flex items-center justify-center text-xs font-bold text-white">
                                {user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <span className="text-sm text-[#868C94] hidden sm:block">
                                {user.name ?? user.email}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <div className="container mx-auto px-4 py-8 max-w-3xl">

                {/* Error banner */}
                {errorMessage && (
                    <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="flex-1">{errorMessage}</p>
                        <button
                            onClick={() => { setWsError(null); setMicError(null); connectWS(); }}
                            className="flex items-center gap-1 font-medium text-xs text-red-600 hover:text-red-800 whitespace-nowrap transition-colors"
                        >
                            <RotateCcw className="w-3 h-3" /> Retry
                        </button>
                    </div>
                )}

                {/* Finalizing banner */}
                {isFinalizing && (
                    <div className="mb-6 flex items-center gap-2.5 bg-[#e8eef9] border border-[#2149A1]/20 text-[#2149A1] text-sm rounded-lg px-4 py-3">
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
                        className="text-2xl font-bold text-slate-900 bg-transparent border-none outline-none w-full placeholder-slate-300"
                        placeholder="Form title"
                    />
                    <p className="text-sm text-[#868C94] mt-1">
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
                            disabled={!canRecord}
                            className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                        >
                            <Mic className="w-4 h-4" />
                            {isPaused ? "Resume Recording" : "Start Recording"}
                        </button>
                    ) : (
                        <button
                            onClick={pauseRecording}
                            className="flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200"
                        >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            Pause
                        </button>
                    )}

                    {/* Edit / Save — only visible after at least one pause */}
                    {isPaused && (
                        !isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 border border-slate-300 hover:border-[#2149A1] hover:text-[#2149A1] text-slate-600 text-sm font-medium px-4 py-2.5 rounded-lg transition-all duration-200"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all duration-200"
                            >
                                <Check className="w-3.5 h-3.5" />
                                Save
                            </button>
                        )
                    )}

                    {/* Reset — only show once something has happened */}
                    {(isPaused || isRecording) && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 text-sm text-[#868C94] hover:text-slate-700 transition-colors ml-auto"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reset form
                        </button>
                    )}
                </div>

                {/* ── Form blocks ── */}
                <div className="space-y-5">
                    {Object.entries(blocks).map(([blockName, fields]) => (
                        <div key={blockName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Block header */}
                            <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/60">
                                <h3 className="text-sm font-semibold text-slate-600">{blockName}</h3>
                            </div>

                            {/* Fields grid */}
                            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                {fields.map((field) => {
                                    const value = isEditing
                                        ? (editedValues[field] ?? "")
                                        : (attributes[field] ?? "");
                                    const isFilled = Boolean(attributes[field]);

                                    return (
                                        <div key={field}>
                                            <label className="block text-xs font-medium text-[#868C94] mb-1.5 capitalize">
                                                {field}
                                            </label>
                                            <input
                                                type="text"
                                                value={value}
                                                readOnly={!isEditing}
                                                onChange={(e) =>
                                                    isEditing &&
                                                    setEditedValues((prev) => ({ ...prev, [field]: e.target.value }))
                                                }
                                                placeholder={isRecording ? "Listening…" : "—"}
                                                className={`w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-all duration-200
                          ${isEditing
                                                        ? "border-[#2149A1] bg-white text-slate-900 focus:ring-2 focus:ring-[#2149A1]/20 cursor-text"
                                                        : isFilled
                                                            ? "border-slate-200 bg-white text-slate-900 cursor-default select-text"
                                                            : "border-slate-200 bg-slate-50 text-slate-400 cursor-default"
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
                <div className="mt-8 rounded-xl border border-slate-200 overflow-hidden">
                    <button
                        onClick={() => setTemplateOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 text-sm text-[#868C94] hover:text-slate-700 transition-colors"
                    >
                        <span className="font-medium">Advanced — Template Editor</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${templateOpen ? "rotate-180" : ""}`} />
                    </button>

                    {templateOpen && (
                        <div className="px-5 pb-5 pt-2 bg-white border-t border-slate-100">
                            <p className="text-xs text-[#868C94] mb-3">
                                Format: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">BlockName: field1, field2</code>
                            </p>
                            <textarea
                                value={templateRaw}
                                onChange={(e) => setTemplateRaw(e.target.value)}
                                rows={6}
                                disabled={isRecording}
                                placeholder={DEFAULT_TEMPLATE}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-700 resize-none focus:outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 disabled:opacity-50 transition-all"
                            />
                            <div className="flex items-center justify-between mt-3">
                                <p className="text-xs text-[#868C94]">
                                    Changes reset the form fields.
                                </p>
                                <button
                                    onClick={() => { setTemplateOpen(false); sendBlocks(); }}
                                    disabled={!isConnected || isRecording}
                                    className="text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Apply template →
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <p className="text-xs text-slate-400 text-center mt-8 pb-4">
                    Not saved — refreshing this page will clear the form.
                </p>
            </div>
        </div>
    );
}