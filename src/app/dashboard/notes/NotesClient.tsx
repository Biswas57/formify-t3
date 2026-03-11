"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Mic, Square, Wifi, WifiOff, RotateCcw, Loader2,
    NotebookPen, Copy, Check, Download, AlertCircle,
} from "lucide-react";
import { env } from "@/env";
import { api } from "@/trpc/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

interface ServerMessage {
    type?: string;
    error?: string;
    notesMarkdown?: string;
    // legacy compat
    action?: string;
    notes_markdown?: string;
}

type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
type RecordStatus = "idle" | "recording" | "finalizing" | "paused";
type NoteStyle = "general" | "clinical" | "meeting" | "study";

const NOTE_STYLE_LABELS: Record<NoteStyle, string> = {
    general: "General",
    clinical: "Clinical",
    meeting: "Meeting",
    study: "Study",
};

const NOTE_STYLE_DESCRIPTIONS: Record<NoteStyle, string> = {
    general: "Flexible structured notes",
    clinical: "Patient-focused SOAP-style notes",
    meeting: "Decisions, actions, and attendees",
    study: "Key concepts and summaries",
};

const DEFAULT_SECTIONS: Record<NoteStyle, string> = {
    general: "",
    clinical: "Presenting Complaint, History, Assessment, Plan",
    meeting: "Attendees, Agenda, Decisions, Action Items",
    study: "Summary, Key Concepts, Questions",
};

const SUPPORTED_MIME =
    typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

function getWSUrl(): string {
    return env.NEXT_PUBLIC_WS_URL;
}

// ─── Simple markdown renderer ────────────────────────────────────────────────
// No external dependency — renders headings, bullets, bold, paragraphs.

function renderMarkdown(md: string): React.ReactNode[] {
    return md.split("\n").map((line, i) => {
        // H1
        if (line.startsWith("# ")) {
            return (
                <h1 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-2 first:mt-0">
                    {renderInline(line.slice(2))}
                </h1>
            );
        }
        // H2
        if (line.startsWith("## ")) {
            return (
                <h2 key={i} className="text-base font-semibold text-[#2149A1] mt-5 mb-1.5 first:mt-0 flex items-center gap-2">
                    <span className="w-1 h-4 bg-[#2149A1] rounded-full flex-shrink-0" />
                    {renderInline(line.slice(3))}
                </h2>
            );
        }
        // H3
        if (line.startsWith("### ")) {
            return (
                <h3 key={i} className="text-sm font-semibold text-slate-700 mt-3 mb-1 first:mt-0">
                    {renderInline(line.slice(4))}
                </h3>
            );
        }
        // Bullet
        if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
                <div key={i} className="flex items-start gap-2.5 my-1">
                    <span className="w-1.5 h-1.5 bg-[#2149A1] rounded-full flex-shrink-0 mt-2" />
                    <span className="text-sm text-slate-700 leading-relaxed">{renderInline(line.slice(2))}</span>
                </div>
            );
        }
        // Numbered list
        const numberedMatch = /^(\d+)\.\s/.exec(line);
        if (numberedMatch) {
            return (
                <div key={i} className="flex items-start gap-2.5 my-1">
                    <span className="text-xs font-semibold text-[#2149A1] flex-shrink-0 mt-0.5 w-4 text-right">{numberedMatch[1]}.</span>
                    <span className="text-sm text-slate-700 leading-relaxed">{renderInline(line.slice(numberedMatch[0].length))}</span>
                </div>
            );
        }
        // Bold label pattern: "**Label:** value"
        // Handled inside renderInline
        // Empty line
        if (line.trim() === "") return <div key={i} className="h-2" />;
        // Horizontal rule
        if (line.trim() === "---" || line.trim() === "***") {
            return <hr key={i} className="border-slate-200 my-3" />;
        }
        // Normal paragraph
        return (
            <p key={i} className="text-sm text-slate-700 leading-relaxed my-0.5">
                {renderInline(line)}
            </p>
        );
    });
}

function renderInline(text: string): React.ReactNode {
    // Split on **bold** patterns
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length === 1) return text;
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotesClient({ user: _user }: { user: User }) {
    // Connection
    const wsRef = useRef<WebSocket | null>(null);
    const [wsStatus, setWsStatus] = useState<WSStatus>("disconnected");
    const [wsError, setWsError] = useState<string | null>(null);

    // Recording
    const recorderRef = useRef<MediaRecorder | null>(null);
    const [recordStatus, setRecordStatus] = useState<RecordStatus>("idle");
    const [micError, setMicError] = useState<string | null>(null);
    const sessionReadyRef = useRef(false);
    const [, setSessionReady] = useState(false);

    // Token
    const getSessionToken = api.transcription.getSessionToken.useMutation();
    const wsTokenRef = useRef<string | null>(null);
    const utils = api.useUtils();

    // Notes config
    const [noteStyle, setNoteStyle] = useState<NoteStyle>("general");
    const [sectionsRaw, setSectionsRaw] = useState(DEFAULT_SECTIONS.general);
    const [sessionTitle, setSessionTitle] = useState("");

    // Notes output
    const [notesMarkdown, setNotesMarkdown] = useState("");
    const [isFinal, setIsFinal] = useState(false);

    // UI
    const [copied, setCopied] = useState(false);
    const notesEndRef = useRef<HTMLDivElement>(null);

    const isConnected = wsStatus === "connected";
    const isRecording = recordStatus === "recording";
    const isFinalizing = recordStatus === "finalizing";
    const isPaused = recordStatus === "paused";
    const canRecord = isConnected && !isFinalizing;
    const errorMessage = wsError ?? micError;

    const hasNotes = notesMarkdown.trim().length > 0;

    // Auto-scroll notes panel as content grows
    useEffect(() => {
        if (isRecording && notesEndRef.current) {
            notesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [notesMarkdown, isRecording]);

    // Sync default sections when style changes (only if user hasn't typed custom sections)
    const userEditedSections = useRef(false);
    const handleStyleChange = (style: NoteStyle) => {
        setNoteStyle(style);
        if (!userEditedSections.current) {
            setSectionsRaw(DEFAULT_SECTIONS[style]);
        }
    };

    // ── WebSocket ─────────────────────────────────────────────────────────────

    // Auto-reconnect state
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordStatusRef = useRef<RecordStatus>("idle");
    const MAX_RECONNECT_ATTEMPTS = 4;

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
        }

        const ws = new WebSocket(getWSUrl());
        wsRef.current = ws;

        // 8s connection timeout — gives enough time for slow cold-starts
        const connectionTimeout = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) ws.close();
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
            // Do NOT send start here — deferred to startRecording after token mint.
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string) as ServerMessage;

                if (msg.error) {
                    console.warn("[Notes] Server error:", msg.error);
                    if (msg.error === "invalid-token" || msg.error === "missing-token") {
                        setMicError("Session expired. Please try starting again.");
                    }
                    return;
                }

                if (msg.type === "started") {
                    sessionReadyRef.current = true;
                    setSessionReady(true);
                    return;
                }

                if (msg.type === "notes_update") {
                    const md = msg.notesMarkdown ?? "";
                    if (md) setNotesMarkdown(md);
                    return;
                }

                if (msg.type === "notes_final") {
                    const md = msg.notesMarkdown ?? "";
                    if (md) setNotesMarkdown(md);
                    setIsFinal(true);
                    setRecordStatus("paused");
                    recordStatusRef.current = "paused";
                    return;
                }
            } catch {
                console.warn("[Notes] Non-JSON WS message");
            }
        };

        ws.onerror = () => {
            // onerror always fires before onclose — don't set error state here.
            // onclose handles all state transitions so we only act once.
        };

        ws.onclose = (event) => {
            clearTimeout(connectionTimeout);
            sessionReadyRef.current = false;
            setSessionReady(false);

            const currentStatus = recordStatusRef.current;

            // A disconnect during active recording is a real failure — surface it.
            if (currentStatus === "recording") {
                setWsError("Connection lost during recording. Please stop and try again.");
                setWsStatus("error");
                return;
            }

            // 1001 = idle going-away (server-side idle timeout), 1000 = clean close.
            // Both are expected for pre-connected idle sockets — attempt quiet reconnect.
            const attempt = ++reconnectAttemptsRef.current;
            if (attempt <= MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
                console.log(`[Notes] WS closed (code ${event.code}) — reconnect attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
                reconnectTimerRef.current = setTimeout(() => connectWS(true), delay);
            } else {
                // Exhausted retries — show a manual retry option
                setWsStatus("error");
                setWsError("Connection lost. Click Retry to reconnect.");
            }
        };
    }, []);

    useEffect(() => {
        connectWS();
        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        };
    }, [connectWS]);

    // ── Recording ─────────────────────────────────────────────────────────────

    const startRecording = async () => {
        setMicError(null);
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) return;

        // ── Mint session token (auth + usage enforcement happens server-side) ──
        let token: string;
        try {
            const result = await getSessionToken.mutateAsync({ mode: "notes" });
            token = result.token;
            wsTokenRef.current = token;
            void utils.usage.getToday.invalidate();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to start session";
            setMicError(msg);
            return;
        }

        // ── Send start with locked-in config + token ───────────────────────
        // Config is captured NOW — what the user sees is what gets sent.
        sessionReadyRef.current = false;
        setSessionReady(false);

        const sections = sectionsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        ws.send(JSON.stringify({
            action: "start",
            mode: "notes",
            noteStyle,
            sections,
            token,
        }));

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: SUPPORTED_MIME });
            recorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(e.data);
                }
            };

            recorder.start(2000); // 2s chunks — combined with MIN_CHUNK_NUM=6, first GPT pass fires after ~12s
            setRecordStatus("recording");
            recordStatusRef.current = "recording";
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Microphone access denied";
            setMicError(
                msg.toLowerCase().includes("permission")
                    ? "Microphone permission was denied. Please allow microphone access and retry."
                    : `Could not start recording: ${msg}`
            );
        }
    };

    const stopRecording = () => {
        const recorder = recorderRef.current;
        if (!recorder) return;

        recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        setRecordStatus("finalizing");
        recordStatusRef.current = "finalizing";
        setIsFinal(false);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: "stop" }));
        }
    };

    const handleReset = () => {
        if (recorderRef.current) {
            recorderRef.current.stop();
            recorderRef.current.stream.getTracks().forEach((t) => t.stop());
            recorderRef.current = null;
        }
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        reconnectAttemptsRef.current = 0;
        setRecordStatus("idle");
        recordStatusRef.current = "idle";
        setNotesMarkdown("");
        setIsFinal(false);
        setMicError(null);
        setWsError(null);
        sessionReadyRef.current = false;
        setSessionReady(false);

        wsRef.current?.close();
        setTimeout(() => connectWS(), 100);
    };

    // ── Copy / Download ───────────────────────────────────────────────────────

    const handleCopy = async () => {
        await navigator.clipboard.writeText(notesMarkdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const title = sessionTitle.trim() || "notes";
        const filename = `${title.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.md`;
        const blob = new Blob([notesMarkdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col min-h-0 flex-1">

            {/* ── Sub-header ── */}
            <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                    <NotebookPen className="w-4 h-4 text-[#2149A1]" />
                    <span className="text-sm font-semibold text-slate-900">Voice Notes</span>
                    <span className="text-xs text-[#868C94]">—</span>
                    <span className="text-xs text-[#868C94]">Audio is transcribed and converted to structured notes</span>
                </div>

                {/* WS status pill */}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 transition-colors ${isConnected
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : (wsStatus === "connecting" || wsStatus === "reconnecting")
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                        : "bg-red-50 text-red-600 border-red-200"
                    }`}>
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {wsStatus === "connecting" ? "Connecting…" : wsStatus === "reconnecting" ? "Reconnecting…" : isConnected ? "Connected" : "Disconnected"}
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 container mx-auto px-4 py-6 max-w-3xl flex flex-col gap-5">

                {/* Error banner */}
                {errorMessage && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="flex-1">{errorMessage}</p>
                        <button
                            onClick={() => { setWsError(null); setMicError(null); connectWS(); }}
                            className="flex items-center gap-1 font-medium text-xs text-red-600 hover:text-red-800 whitespace-nowrap"
                        >
                            <RotateCcw className="w-3 h-3" /> Retry
                        </button>
                    </div>
                )}

                {/* Finalizing banner */}
                {isFinalizing && (
                    <div className="flex items-center gap-2.5 bg-[#e8eef9] border border-[#2149A1]/20 text-[#2149A1] text-sm rounded-lg px-4 py-3">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        Generating final notes — this may take a moment…
                    </div>
                )}

                {/* ── Config card (only when idle) ── */}
                {recordStatus === "idle" && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                        {/* Session title */}
                        <div>
                            <label className="block text-xs font-medium text-[#868C94] mb-1.5">Session title <span className="font-normal">(optional)</span></label>
                            <input
                                type="text"
                                value={sessionTitle}
                                onChange={(e) => setSessionTitle(e.target.value)}
                                placeholder="e.g. Patient intake — John Smith"
                                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#2149A1]/20 focus:border-[#2149A1] placeholder-slate-400"
                            />
                        </div>

                        {/* Note style */}
                        <div>
                            <label className="block text-xs font-medium text-[#868C94] mb-2">Note style</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {(Object.keys(NOTE_STYLE_LABELS) as NoteStyle[]).map((style) => (
                                    <button
                                        key={style}
                                        onClick={() => handleStyleChange(style)}
                                        className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all ${noteStyle === style
                                            ? "border-[#2149A1] bg-[#e8eef9] text-[#2149A1]"
                                            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                            }`}
                                    >
                                        <span className="text-xs font-semibold">{NOTE_STYLE_LABELS[style]}</span>
                                        <span className="text-xs opacity-70 mt-0.5 leading-tight">{NOTE_STYLE_DESCRIPTIONS[style]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sections */}
                        <div>
                            <label className="block text-xs font-medium text-[#868C94] mb-1.5">
                                Sections <span className="font-normal">(comma-separated, optional)</span>
                            </label>
                            <input
                                type="text"
                                value={sectionsRaw}
                                onChange={(e) => {
                                    userEditedSections.current = true;
                                    setSectionsRaw(e.target.value);
                                }}
                                placeholder="e.g. Summary, Key Points, Action Items"
                                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#2149A1]/20 focus:border-[#2149A1] placeholder-slate-400"
                            />
                        </div>
                    </div>
                )}

                {/* Session title display when active */}
                {recordStatus !== "idle" && sessionTitle && (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{sessionTitle}</h1>
                        <p className="text-sm text-[#868C94] mt-1">
                            {isRecording
                                ? "Recording — notes are updating live."
                                : isFinalizing
                                    ? "Generating final notes…"
                                    : isFinal
                                        ? "Session complete — your notes are ready."
                                        : "Paused."}
                        </p>
                    </div>
                )}

                {/* ── Controls ── */}
                <div className="flex flex-wrap items-center gap-3">
                    {!isRecording ? (
                        <button
                            onClick={startRecording}
                            disabled={!canRecord || getSessionToken.isPending}
                            className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                        >
                            {getSessionToken.isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                                : <><Mic className="w-4 h-4" />{isPaused ? "Resume" : "Start Recording"}</>
                            }
                        </button>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200"
                        >
                            <Square className="w-4 h-4 fill-white" />
                            Stop
                        </button>
                    )}

                    {(isPaused || hasNotes) && !isRecording && !isFinalizing && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            New session
                        </button>
                    )}

                    {isRecording && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-500 ml-1">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            Recording
                        </span>
                    )}
                </div>

                {/* ── Notes panel ── */}
                {(hasNotes || isRecording) && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1">
                        {/* Panel header */}
                        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <NotebookPen className="w-4 h-4 text-[#2149A1]" />
                                <span className="text-sm font-semibold text-slate-600">
                                    {isFinal ? "Final Notes" : "Live Notes"}
                                </span>
                                {!isFinal && isRecording && (
                                    <span className="flex items-center gap-1 text-xs text-[#868C94]">
                                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                        Updating
                                    </span>
                                )}
                                {isFinal && (
                                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                                        Complete
                                    </span>
                                )}
                            </div>

                            {hasNotes && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                    >
                                        {copied
                                            ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</>
                                            : <><Copy className="w-3.5 h-3.5" /> Copy</>
                                        }
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="flex items-center gap-1.5 text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] px-2.5 py-1.5 rounded-lg hover:bg-[#e8eef9] transition-colors"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Download .md
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Notes content */}
                        <div className="px-6 py-5">
                            {hasNotes ? (
                                <div className="min-h-[200px]">
                                    {renderMarkdown(notesMarkdown)}
                                    <div ref={notesEndRef} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                                    <NotebookPen className="w-10 h-10 text-slate-200 mb-3" />
                                    <p className="text-sm text-slate-400">
                                        Notes will appear here as you speak…
                                    </p>
                                    <p className="text-xs text-slate-300 mt-1">
                                        First update arrives after ~15 seconds of audio
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty state (idle, no notes yet) */}
                {!hasNotes && !isRecording && recordStatus === "idle" && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-[#e8eef9] rounded-2xl flex items-center justify-center mb-4">
                            <NotebookPen className="w-8 h-8 text-[#2149A1]" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 mb-2">Ready to take notes</h2>
                        <p className="text-sm text-[#868C94] max-w-sm">
                            Configure your session above, then press <strong>Start Recording</strong>. Notes will be generated live from your speech.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}