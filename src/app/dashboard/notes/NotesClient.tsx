"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Mic, Square, Wifi, WifiOff, RotateCcw, Loader2,
    NotebookPen, Copy, Check, Download, AlertCircle,
    BookMarked, PanelLeftOpen, ChevronDown,
} from "lucide-react";
import { env } from "@/env";
import { api } from "@/trpc/react";
import NoteTemplateSidebar from "./NoteTemplateSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

interface ServerMessage {
    type?: string;
    error?: string;
    code?: string;
    message?: string;
    notesMarkdown?: string;
    // legacy compat
    action?: string;
    notes_markdown?: string;
}

type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
type RecordStatus = "idle" | "recording" | "finalizing" | "paused";
type NoteStyle = "general" | "clinical" | "meeting" | "study";
type SessionLimitWarningLevel = "none" | "warning" | "final-warning" | "reached";

const MAX_NOTES_SESSION_MS = 120 * 60_000;
const NOTES_SESSION_WARNING_MS = 10 * 60_000;
const NOTES_SESSION_FINAL_WARNING_MS = 2 * 60_000;

type NotesStartPayload = {
    action: "start";
    mode: "notes";
    noteStyle: NoteStyle;
    sections: string[];
    token: string;
    continuation?: boolean;
    currentNotesMarkdown?: string;
};

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

function buildMarkdownFilename(title: string): string {
    const base = title.trim().replace(/\.md$/i, "") || "formify-notes";
    const safe = base
        .replace(/[^a-zA-Z0-9 ._-]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^\.+/, "")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();

    return `${safe || "formify-notes"}.md`;
}

function getSessionWarningLevel(remainingMs: number): SessionLimitWarningLevel {
    if (remainingMs <= 0) return "reached";
    if (remainingMs <= NOTES_SESSION_FINAL_WARNING_MS) return "final-warning";
    if (remainingMs <= NOTES_SESSION_WARNING_MS) return "warning";
    return "none";
}

// ─── Simple markdown renderer ────────────────────────────────────────────────
// No external dependency — renders headings, bullets, bold, paragraphs.

function renderMarkdown(md: string): React.ReactNode[] {
    return md.split("\n").map((line, i) => {
        // H1
        if (line.startsWith("# ")) {
            return (
                <h1 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-2 first:mt-0 dark:text-slate-100">
                    {renderInline(line.slice(2))}
                </h1>
            );
        }
        // H2
        if (line.startsWith("## ")) {
            return (
                <h2 key={i} className="text-base font-semibold text-[#2149A1] mt-5 mb-1.5 first:mt-0 flex items-center gap-2 dark:text-blue-300">
                    <span className="w-1 h-4 bg-[#2149A1] rounded-full flex-shrink-0 dark:bg-blue-400" />
                    {renderInline(line.slice(3))}
                </h2>
            );
        }
        // H3
        if (line.startsWith("### ")) {
            return (
                <h3 key={i} className="text-sm font-semibold text-slate-700 mt-3 mb-1 first:mt-0 dark:text-slate-200">
                    {renderInline(line.slice(4))}
                </h3>
            );
        }
        // Bullet
        if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
                <div key={i} className="flex items-start gap-2.5 my-1">
                    <span className="w-1.5 h-1.5 bg-[#2149A1] rounded-full flex-shrink-0 mt-2 dark:bg-blue-400" />
                    <span className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">{renderInline(line.slice(2))}</span>
                </div>
            );
        }
        // Numbered list
        const numberedMatch = /^(\d+)\.\s/.exec(line);
        if (numberedMatch) {
            return (
                <div key={i} className="flex items-start gap-2.5 my-1">
                    <span className="text-xs font-semibold text-[#2149A1] flex-shrink-0 mt-0.5 w-4 text-right dark:text-blue-300">{numberedMatch[1]}.</span>
                    <span className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">{renderInline(line.slice(numberedMatch[0].length))}</span>
                </div>
            );
        }
        // Bold label pattern: "**Label:** value"
        // Handled inside renderInline
        // Empty line
        if (line.trim() === "") return <div key={i} className="h-2" />;
        // Horizontal rule
        if (line.trim() === "---" || line.trim() === "***") {
            return <hr key={i} className="border-slate-200 my-3 dark:border-slate-800" />;
        }
        // Normal paragraph
        return (
            <p key={i} className="text-sm text-slate-700 leading-relaxed my-0.5 dark:text-slate-300">
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
                    return <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
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
    const streamRef = useRef<MediaStream | null>(null);
    const [recordStatus, setRecordStatus] = useState<RecordStatus>("idle");
    const [micError, setMicError] = useState<string | null>(null);
    const wsSessionReadyRef = useRef(false);
    const [, setSessionReady] = useState(false);
    const recordingSessionStartedAtRef = useRef<number | null>(null);
    const manualStopRequestedRef = useRef(false);
    const [sessionLimitWarningLevel, setSessionLimitWarningLevel] = useState<SessionLimitWarningLevel>("none");
    const [sessionLimitRemainingMs, setSessionLimitRemainingMs] = useState<number | null>(null);

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
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [draftNotesMarkdown, setDraftNotesMarkdown] = useState("");
    const [hasManualEdits, setHasManualEdits] = useState(false);
    const [notesEditMessage, setNotesEditMessage] = useState<string | null>(null);

    // UI
    const [copied, setCopied] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarDrawerVisible, setSidebarDrawerVisible] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const notesEndRef = useRef<HTMLDivElement>(null);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const sidebarCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isEditingNotesRef = useRef(false);
    const hasManualEditsRef = useRef(false);

    const isConnected = wsStatus === "connected";
    const isRecording = recordStatus === "recording";
    const isFinalizing = recordStatus === "finalizing";
    const isPaused = recordStatus === "paused";
    // Sockets open on demand at record time (T-018), so starting does not
    // require an existing connection; only block while finalising or connecting.
    const canRecord = !isFinalizing && wsStatus !== "connecting";
    // The connection pill is only meaningful while a session is being
    // established or is active; hide it when idle/paused with no socket.
    const showConnectionPill = isRecording || isFinalizing || wsStatus === "connecting" || wsStatus === "error";
    const canSelectTemplate = recordStatus === "idle";
    const errorMessage = wsError ?? micError;
    const sessionLimitRemainingMinutes =
        sessionLimitRemainingMs === null ? null : Math.max(0, Math.ceil(sessionLimitRemainingMs / 60_000));
    const showSessionLimitWarning = sessionLimitWarningLevel !== "none";
    const sessionLimitWarningCopy = (() => {
        if (sessionLimitWarningLevel === "warning") {
            const minutesLabel = sessionLimitRemainingMinutes === 1 ? "1 minute" : `${sessionLimitRemainingMinutes ?? 0} minutes`;
            return `For reliability, this Notes session has a maximum session length of 120 minutes. About ${minutesLabel} remaining in this recording window.`;
        }
        if (sessionLimitWarningLevel === "final-warning") {
            const minutesLabel = sessionLimitRemainingMinutes === 1 ? "1 minute" : `${sessionLimitRemainingMinutes ?? 0} minutes`;
            return `Approaching maximum session length for reliability — about ${minutesLabel} remaining.`;
        }
        if (sessionLimitWarningLevel === "reached") {
            return "This Notes session reached the maximum session length for reliability and was finalised. Start a new session to continue. Your notes so far are preserved.";
        }
        return "";
    })();
    const sessionLimitWarningClasses: Record<SessionLimitWarningLevel, string> = {
        none: "",
        warning:
            "border-yellow-200 bg-yellow-50 text-yellow-800 " +
            "dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200",
        "final-warning":
            "border-orange-300 bg-orange-50 text-orange-800 " +
            "dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200",
        reached:
            "border-red-300 bg-red-50 text-red-800 " +
            "dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
    };

    const visibleNotesMarkdown = isEditingNotes ? draftNotesMarkdown : notesMarkdown;
    const hasNotes = notesMarkdown.trim().length > 0;
    const hasVisibleNotes = visibleNotesMarkdown.trim().length > 0;
    const canEditNotes = hasNotes && isFinal && !isRecording && !isFinalizing;

    useEffect(() => {
        if (recordStatus !== "recording" && recordStatus !== "finalizing") return;
        if (recordingSessionStartedAtRef.current === null) return;

        const tick = () => {
            const startedAt = recordingSessionStartedAtRef.current;
            if (startedAt === null) return;
            const elapsedMs = Date.now() - startedAt;
            const remainingMs = Math.max(0, MAX_NOTES_SESSION_MS - elapsedMs);
            setSessionLimitRemainingMs(remainingMs);
            setSessionLimitWarningLevel(getSessionWarningLevel(remainingMs));
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [recordStatus]);

    // Auto-scroll notes panel as content grows
    useEffect(() => {
        if (isRecording && notesEndRef.current) {
            notesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [notesMarkdown, isRecording]);

    useEffect(() => {
        if (!downloadOpen) return;

        const handleClick = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setDownloadOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setDownloadOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [downloadOpen]);

    useEffect(() => {
        if (!hasVisibleNotes) {
            setDownloadOpen(false);
        }
    }, [hasVisibleNotes]);

    useEffect(() => {
        return () => {
            if (sidebarCloseTimerRef.current) {
                clearTimeout(sidebarCloseTimerRef.current);
            }
        };
    }, []);

    const openMobileSidebar = () => {
        if (sidebarCloseTimerRef.current) {
            clearTimeout(sidebarCloseTimerRef.current);
            sidebarCloseTimerRef.current = null;
        }

        setSidebarOpen(true);
        setSidebarDrawerVisible(false);
        requestAnimationFrame(() => setSidebarDrawerVisible(true));
    };

    const closeMobileSidebar = () => {
        setSidebarDrawerVisible(false);

        if (sidebarCloseTimerRef.current) {
            clearTimeout(sidebarCloseTimerRef.current);
        }

        sidebarCloseTimerRef.current = setTimeout(() => {
            setSidebarOpen(false);
            sidebarCloseTimerRef.current = null;
        }, 200);
    };

    const setNotesEditing = (editing: boolean) => {
        isEditingNotesRef.current = editing;
        setIsEditingNotes(editing);
    };

    const setNotesManualEdits = (edited: boolean) => {
        hasManualEditsRef.current = edited;
        setHasManualEdits(edited);
    };

    const clearNotesEditState = () => {
        setNotesEditing(false);
        setDraftNotesMarkdown("");
        setNotesEditMessage(null);
    };

    const handleStartNotesEdit = () => {
        if (!canEditNotes) return;
        setDraftNotesMarkdown(notesMarkdown);
        setNotesEditMessage(null);
        setNotesEditing(true);
    };

    const handleDoneNotesEdit = () => {
        setNotesMarkdown(draftNotesMarkdown);
        setNotesManualEdits(true);
        setNotesEditing(false);
        setNotesEditMessage(null);
    };

    const handleCancelNotesEdit = () => {
        clearNotesEditState();
    };

    // Sync default sections when style changes (only if user hasn't typed custom sections)
    const userEditedSections = useRef(false);
    const handleStyleChange = (style: NoteStyle) => {
        setNoteStyle(style);
        if (!userEditedSections.current) {
            setSectionsRaw(DEFAULT_SECTIONS[style]);
        }
    };

    const handleTemplateSelect = (title: string, style: NoteStyle, sections: string) => {
        setSessionTitle(title);
        setNoteStyle(style);
        setSectionsRaw(sections);
        userEditedSections.current = sections.trim().length > 0;
    };

    // ── WebSocket ─────────────────────────────────────────────────────────────

    // Sockets exist only during active recording/finalising (T-018). Track
    // intentional closes (notes_final, reset, unmount) so they neither surface
    // as interruptions nor trigger any reconnect.
    const recordStatusRef = useRef<RecordStatus>("idle");
    const intentionalCloseRef = useRef(false);
    const sessionGenerationRef = useRef(0);
    const activeSessionGenerationRef = useRef<number | null>(null);
    const startInFlightRef = useRef(false);
    const stopInFlightRef = useRef(false);

    const markSessionInactive = useCallback(() => {
        wsSessionReadyRef.current = false;
        setSessionReady(false);
        activeSessionGenerationRef.current = null;
        wsTokenRef.current = null;
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

    // Opens a WebSocket on demand and resolves once it is OPEN. There is no
    // idle/pre-connected socket and no auto-reconnect — the connection only
    // lives for the duration of a recording/finalising session.
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
                // Do NOT send start here — startRecording sends it after token mint.
            };

            ws.onmessage = (event) => {
            if (wsRef.current !== ws) return;

            try {
                const msg = JSON.parse(event.data as string) as ServerMessage;
                const serverError =
                    msg.error ?? (msg.type === "error" ? msg.code ?? msg.message ?? "server-error" : null);

                if (serverError) {
                    console.warn("[Notes] Server error:", serverError);
                    markSessionInactive();
                    stopLocalRecorder();
                    if (recordStatusRef.current !== "idle") {
                        setRecordStatus("paused");
                        recordStatusRef.current = "paused";
                    }
                    if (serverError === "invalid-token" || serverError === "missing-token") {
                        setMicError("Session expired. Please try starting again.");
                    } else {
                        setMicError(msg.message ?? "The notes session ended unexpectedly. Please try again.");
                    }
                    setWsStatus("error");
                    startInFlightRef.current = false;
                    stopInFlightRef.current = false;
                    intentionalCloseRef.current = true;
                    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                        ws.close(1000, "server-error");
                    }
                    return;
                }

                if (msg.type === "started") {
                    if (activeSessionGenerationRef.current !== null) {
                        wsSessionReadyRef.current = true;
                        setSessionReady(true);
                    }
                    return;
                }

                if (msg.type === "notes_update") {
                    if (activeSessionGenerationRef.current === null) return;

                    const md = msg.notesMarkdown ?? "";
                    if (md) {
                        if (isEditingNotesRef.current || hasManualEditsRef.current) {
                            setNotesEditMessage("A late AI update arrived, but your edits were kept.");
                            return;
                        }
                        setNotesMarkdown(md);
                    }
                    return;
                }

                if (msg.type === "notes_final") {
                    if (activeSessionGenerationRef.current === null) return;

                    const md = msg.notesMarkdown ?? "";
                    if (md) {
                        if (isEditingNotesRef.current || hasManualEditsRef.current) {
                            setNotesEditMessage("A late final update arrived, but your edits were kept.");
                        } else {
                            setNotesMarkdown(md);
                        }
                    }

                    const startedAt = recordingSessionStartedAtRef.current;
                    const capReachedByTime =
                        startedAt !== null && (Date.now() - startedAt) >= MAX_NOTES_SESSION_MS;
                    const capFinalized = capReachedByTime && !manualStopRequestedRef.current;

                    if (capFinalized) {
                        stopLocalRecorder();
                        setSessionLimitWarningLevel("reached");
                        setSessionLimitRemainingMs(0);
                    } else {
                        setSessionLimitWarningLevel("none");
                        setSessionLimitRemainingMs(null);
                    }

                    setIsFinal(true);
                    setRecordStatus("paused");
                    recordStatusRef.current = "paused";
                    manualStopRequestedRef.current = false;
                    recordingSessionStartedAtRef.current = null;
                    stopInFlightRef.current = false;

                    // Session is finished — close the socket intentionally so no
                    // idle connection lingers or churns after finalisation.
                    intentionalCloseRef.current = true;
                    markSessionInactive();
                    ws.close(1000, "notes-final");
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

            ws.onclose = () => {
                clearTimeout(connectionTimeout);
                markSessionInactive();
                startInFlightRef.current = false;
                stopInFlightRef.current = false;

                const wasIntentional = intentionalCloseRef.current;
                intentionalCloseRef.current = false;
                if (wsRef.current === ws) wsRef.current = null;

                // Never opened — reject the pending connect so startRecording can surface it.
                if (!settled) {
                    settled = true;
                    setWsStatus("disconnected");
                    reject(new Error("connection-failed"));
                    return;
                }

                // Intentional close (notes_final, reset, unmount, connect timeout):
                // go quiet, no banner, no reconnect.
                if (wasIntentional) {
                    setWsStatus("disconnected");
                    return;
                }

                // A disconnect during recording/finalizing is a real failure — stop
                // local audio capture and let the user recover without losing notes.
                const currentStatus = recordStatusRef.current;
                if (currentStatus === "recording" || currentStatus === "finalizing") {
                    stopLocalRecorder();
                    setRecordStatus("paused");
                    recordStatusRef.current = "paused";
                    setWsError("The recording connection was interrupted. Your notes so far are preserved. Start a new recording segment to continue.");
                    setWsStatus("error");
                    return;
                }

                // Otherwise idle/paused — sockets only live during recording, so
                // do not reconnect.
                setWsStatus("disconnected");
            };
        });
    }, [markSessionInactive]);

    // Close the active socket intentionally (reset / unmount). Sockets are only
    // meant to exist during recording, so this never reconnects.
    const closeWsIntentionally = useCallback(() => {
        intentionalCloseRef.current = true;
        markSessionInactive();
        const ws = wsRef.current;
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            ws.close(1000, "client-intentional");
        }
    }, [markSessionInactive]);

    // No socket on mount — it is opened on demand when recording starts.
    // On unmount, close any active socket intentionally.
    useEffect(() => {
        return () => {
            intentionalCloseRef.current = true;
            markSessionInactive();
            startInFlightRef.current = false;
            stopInFlightRef.current = false;
            stopLocalRecorder();
            wsRef.current?.close(1000, "client-unmount");
        };
    }, [markSessionInactive]);

    // ── Recording ─────────────────────────────────────────────────────────────

    const stopLocalRecorder = () => {
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
    };

    const startRecording = async () => {
        if (startInFlightRef.current || recordStatusRef.current === "recording" || recordStatusRef.current === "finalizing") {
            return;
        }

        if (isEditingNotesRef.current) {
            setMicError("Finish editing before starting a new recording.");
            return;
        }

        startInFlightRef.current = true;
        setMicError(null);
        manualStopRequestedRef.current = false;
        recordingSessionStartedAtRef.current = null;
        setSessionLimitWarningLevel("none");
        setSessionLimitRemainingMs(null);

        let stream: MediaStream | null = null;
        let recorder: MediaRecorder | null = null;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            recorder = new MediaRecorder(stream, { mimeType: SUPPORTED_MIME });
        } catch (err) {
            stream?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            const msg = err instanceof Error ? err.message : "Microphone access denied";
            setMicError(
                msg.toLowerCase().includes("permission")
                    ? "Microphone permission was denied. Please allow microphone access and retry."
                    : `Could not start recording: ${msg}`
            );
            startInFlightRef.current = false;
            return;
        }

        // ── Mint session token (auth + usage enforcement happens server-side) ──
        let token: string;
        try {
            const result = await getSessionToken.mutateAsync({ mode: "notes" });
            token = result.token;
            wsTokenRef.current = token;
            void utils.usage.getToday.invalidate();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to start session";
            stopLocalRecorder();
            setMicError(msg);
            startInFlightRef.current = false;
            return;
        }

        // ── Open a fresh WebSocket on demand (sockets only live during recording) ──
        let ws: WebSocket;
        try {
            ws = await connectWS();
        } catch {
            stopLocalRecorder();
            setWsError("Could not connect to the transcription service. Please try again.");
            setWsStatus("error");
            startInFlightRef.current = false;
            return;
        }

        // ── Send start with locked-in config + token ───────────────────────
        // Config is captured NOW — what the user sees is what gets sent.
        const sessionGeneration = sessionGenerationRef.current + 1;
        sessionGenerationRef.current = sessionGeneration;
        activeSessionGenerationRef.current = sessionGeneration;
        wsSessionReadyRef.current = false;
        setSessionReady(false);

        const sections = sectionsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const continuationNotesMarkdown = visibleNotesMarkdown;
        const shouldContinueNotesSession =
            recordStatusRef.current !== "idle" && continuationNotesMarkdown.trim().length > 0;

        const startPayload: NotesStartPayload = {
            action: "start",
            mode: "notes",
            noteStyle,
            sections,
            token,
        };

        if (shouldContinueNotesSession) {
            startPayload.continuation = true;
            startPayload.currentNotesMarkdown = continuationNotesMarkdown;
        }

        ws.send(JSON.stringify(startPayload));

        if (!stream || !recorder) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "stop" }));
            }
            intentionalCloseRef.current = true;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close(1000, "start-aborted");
            }
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
                    ws.send(e.data);
                }
            };

            activeRecorder.onstop = () => activeStream.getTracks().forEach((track) => track.stop());

            await waitForSessionStarted(sessionGeneration);

            activeRecorder.start(2000); // 2s chunks — chunk delivery can jitter, so session-limit timing uses wall clock start time.
            recordingSessionStartedAtRef.current = Date.now();
            setSessionLimitRemainingMs(MAX_NOTES_SESSION_MS);
            clearNotesEditState();
            setNotesManualEdits(false);
            setIsFinal(false);
            setRecordStatus("recording");
            recordStatusRef.current = "recording";
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Microphone access denied";
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
                    ? "The notes session did not start in time. Please try again."
                    : `Could not start recording: ${msg}`
            );
        } finally {
            startInFlightRef.current = false;
        }
    };

    const stopRecording = () => {
        if (stopInFlightRef.current || recordStatusRef.current !== "recording") return;

        stopInFlightRef.current = true;
        manualStopRequestedRef.current = true;
        wsSessionReadyRef.current = false;
        setSessionReady(false);
        setRecordStatus("finalizing");
        recordStatusRef.current = "finalizing";
        setIsFinal(false);
        stopLocalRecorder();

        if (wsRef.current?.readyState === WebSocket.OPEN && activeSessionGenerationRef.current !== null) {
            wsRef.current.send(JSON.stringify({ action: "stop" }));
        } else {
            markSessionInactive();
            stopInFlightRef.current = false;
            setRecordStatus("paused");
            recordStatusRef.current = "paused";
            setWsError("The recording connection was unavailable. Your notes so far are preserved. Start a new recording segment to continue.");
            setWsStatus("error");
        }
    };

    const handleReset = () => {
        sessionGenerationRef.current += 1;
        startInFlightRef.current = false;
        stopInFlightRef.current = false;
        stopLocalRecorder();
        // Close any active socket intentionally and do not reconnect — a new
        // socket opens only when the user starts recording again.
        closeWsIntentionally();
        setRecordStatus("idle");
        recordStatusRef.current = "idle";
        setNotesMarkdown("");
        setIsFinal(false);
        clearNotesEditState();
        setNotesManualEdits(false);
        setMicError(null);
        setWsError(null);
        setWsStatus("disconnected");
        manualStopRequestedRef.current = false;
        recordingSessionStartedAtRef.current = null;
        setSessionLimitWarningLevel("none");
        setSessionLimitRemainingMs(null);
    };

    // ── PDF Export ────────────────────────────────────────────────────────────
    // Client-side only — note content never leaves the browser.
    // Uses the same jsPDF approach as the forms PDF export.

    const handleSavePDF = async () => {
        const notesForExport = visibleNotesMarkdown;
        if (!notesForExport.trim()) return;
        setIsGeneratingPDF(true);
        try {
            const { default: jsPDF } = await import("jspdf");

            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

            // ── Constants ──────────────────────────────────────────────────────
            const PAGE_W = 210;
            const PAGE_H = 297;
            const MARGIN = 14;
            const CONTENT_W = PAGE_W - MARGIN * 2;

            const BRAND_BLUE: [number, number, number] = [33, 73, 161];
            const HEADER_BG: [number, number, number] = [245, 247, 252];
            const BORDER_COL: [number, number, number] = [220, 224, 232];
            const LABEL_COL: [number, number, number] = [134, 140, 148];
            const VALUE_COL: [number, number, number] = [15, 23, 42];
            const H2_COL: [number, number, number] = [33, 73, 161];
            const H3_COL: [number, number, number] = [51, 65, 85];
            const BODY_COL: [number, number, number] = [71, 85, 105];
            const WHITE: [number, number, number] = [255, 255, 255];

            // Strip ** markers — used when a line is too long for inline bold rendering
            const stripBold = (text: string) => text.replace(/\*\*([^*]+)\*\*/g, "$1");

            // Print a line with inline bold/normal segments at a fixed y.
            // Only call this when the full stripped text is known to fit on one line.
            const printMixedLine = (text: string, x: number, y: number, size: number) => {
                const parts = text.split(/(\*\*[^*]+\*\*)/g);
                let cx = x;
                pdf.setFontSize(size);
                for (const part of parts) {
                    const bold = part.startsWith("**") && part.endsWith("**");
                    const content = bold ? part.slice(2, -2) : part;
                    pdf.setFont("helvetica", bold ? "bold" : "normal");
                    pdf.text(content, cx, y);
                    cx += pdf.getTextWidth(content);
                }
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

            const drawPlainLines = (lines: string[], x: number, lineHeight: number) => {
                for (const textLine of lines) {
                    ensureSpace(lineHeight);
                    pdf.text(textLine, x, y);
                    y += lineHeight;
                }
            };

            const splitLines = (text: string, width: number): string[] => {
                const lines: unknown = pdf.splitTextToSize(text, width);
                return Array.isArray(lines) ? lines.map(String) : [String(lines)];
            };

            // ── HEADER ────────────────────────────────────────────────────────
            pdf.setFillColor(...BRAND_BLUE);
            pdf.rect(0, 0, PAGE_W, 2, "F");

            pdf.setFillColor(...HEADER_BG);
            pdf.rect(0, 2, PAGE_W, 32, "F");

            // Logo mark
            pdf.setFillColor(...BRAND_BLUE);
            pdf.setDrawColor(...BRAND_BLUE);
            pdf.roundedRect(MARGIN, 8, 10, 10, 2, 2, "F");
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
            pdf.text("Voice notes", MARGIN + 13, 18.5);

            // Session title (right-aligned, clamped to 90mm)
            const docTitle = sessionTitle.trim() || "Voice Notes";
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            pdf.setTextColor(...VALUE_COL);
            let titleText = docTitle;
            while (titleText.length > 1 && pdf.getTextWidth(titleText) > 90) {
                titleText = titleText.slice(0, -1);
            }
            if (titleText !== docTitle) titleText += "…";
            pdf.text(titleText, PAGE_W - MARGIN, 13, { align: "right" });

            // Date
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(...LABEL_COL);
            const dateStr = new Date().toLocaleDateString("en-AU", {
                day: "numeric", month: "long", year: "numeric",
            });
            pdf.text(dateStr, PAGE_W - MARGIN, 19, { align: "right" });

            // Note style label
            pdf.setFontSize(7);
            pdf.text(NOTE_STYLE_LABELS[noteStyle].toUpperCase(), PAGE_W - MARGIN, 24.5, { align: "right" });

            // Header divider
            pdf.setDrawColor(...BORDER_COL);
            pdf.setLineWidth(0.3);
            pdf.line(0, 34, PAGE_W, 34);

            y = 42;

            // ── CONTENT ───────────────────────────────────────────────────────
            for (const line of notesForExport.split("\n")) {

                // H1 — large bold with left accent bar
                if (line.startsWith("# ")) {
                    const text = stripBold(line.slice(2));
                    const wrapped = splitLines(text, CONTENT_W - 6);
                    pdf.setFont("helvetica", "bold");
                    pdf.setFontSize(13);
                    pdf.setTextColor(...VALUE_COL);
                    for (const textLine of wrapped) {
                        ensureSpace(10);
                        pdf.setFillColor(...BRAND_BLUE);
                        pdf.rect(MARGIN, y - 4.5, 2.5, 7, "F");
                        pdf.text(textLine, MARGIN + 5.5, y);
                        y += 6;
                    }
                    y += 4;
                    continue;
                }

                // H2 — medium bold, brand blue, underline
                if (line.startsWith("## ")) {
                    const text = stripBold(line.slice(3));
                    const wrapped = splitLines(text, CONTENT_W);
                    ensureSpace(7);
                    y += 2;
                    pdf.setFont("helvetica", "bold");
                    pdf.setFontSize(10);
                    pdf.setTextColor(...H2_COL);
                    drawPlainLines(wrapped, MARGIN, 5);
                    y += 2;
                    ensureSpace(3);
                    pdf.setDrawColor(...BORDER_COL);
                    pdf.setLineWidth(0.2);
                    pdf.line(MARGIN, y, MARGIN + CONTENT_W, y);
                    y += 3;
                    continue;
                }

                // H3 — small bold, slate
                if (line.startsWith("### ")) {
                    const text = stripBold(line.slice(4));
                    const wrapped = splitLines(text, CONTENT_W);
                    ensureSpace(5.5);
                    y += 1;
                    pdf.setFont("helvetica", "bold");
                    pdf.setFontSize(9);
                    pdf.setTextColor(...H3_COL);
                    drawPlainLines(wrapped, MARGIN, 4.5);
                    y += 2;
                    continue;
                }

                // Bullet — blue dot + text with inline bold support
                if (line.startsWith("- ") || line.startsWith("* ")) {
                    const text = line.slice(2);
                    const stripped = stripBold(text);
                    const hasBold = text.includes("**");
                    pdf.setFontSize(8.5);
                    const wrapped = splitLines(stripped, CONTENT_W - 6);
                    pdf.setTextColor(...BODY_COL);
                    if (hasBold && wrapped.length === 1) {
                        ensureSpace(4.5);
                        pdf.setFillColor(...BRAND_BLUE);
                        pdf.circle(MARGIN + 1.5, y - 1, 0.75, "F");
                        printMixedLine(text, MARGIN + 4.5, y, 8.5);
                        y += 4.5;
                    } else {
                        pdf.setFont("helvetica", "normal");
                        wrapped.forEach((textLine: string, idx: number) => {
                            ensureSpace(4.5);
                            if (idx === 0) {
                                pdf.setFillColor(...BRAND_BLUE);
                                pdf.circle(MARGIN + 1.5, y - 1, 0.75, "F");
                            }
                            pdf.text(textLine, MARGIN + 4.5, y);
                            y += 4.5;
                        });
                    }
                    y += 0.5;
                    continue;
                }

                // Numbered list
                const numMatch = /^(\d+)\.\s/.exec(line);
                if (numMatch) {
                    const text = line.slice(numMatch[0].length);
                    const stripped = stripBold(text);
                    const hasBold = text.includes("**");
                    pdf.setFontSize(8.5);
                    const wrapped = splitLines(stripped, CONTENT_W - 8);
                    pdf.setFont("helvetica", "bold");
                    pdf.setFontSize(8.5);
                    if (hasBold && wrapped.length === 1) {
                        ensureSpace(4.5);
                        pdf.setTextColor(...BRAND_BLUE);
                        pdf.text(`${numMatch[1]}.`, MARGIN, y);
                        pdf.setTextColor(...BODY_COL);
                        printMixedLine(text, MARGIN + 7, y, 8.5);
                        y += 4.5;
                    } else {
                        wrapped.forEach((textLine: string, idx: number) => {
                            ensureSpace(4.5);
                            if (idx === 0) {
                                pdf.setFont("helvetica", "bold");
                                pdf.setTextColor(...BRAND_BLUE);
                                pdf.text(`${numMatch[1]}.`, MARGIN, y);
                            }
                            pdf.setFont("helvetica", "normal");
                            pdf.setTextColor(...BODY_COL);
                            pdf.text(textLine, MARGIN + 7, y);
                            y += 4.5;
                        });
                    }
                    y += 0.5;
                    continue;
                }

                // Horizontal rule
                if (line.trim() === "---" || line.trim() === "***") {
                    ensureSpace(6);
                    y += 2;
                    pdf.setDrawColor(...BORDER_COL);
                    pdf.setLineWidth(0.2);
                    pdf.line(MARGIN, y, MARGIN + CONTENT_W, y);
                    y += 4;
                    continue;
                }

                // Empty line
                if (line.trim() === "") {
                    ensureSpace(3);
                    y += 3;
                    continue;
                }

                // Normal paragraph — inline bold for single-line, stripped for wrapped
                const stripped = stripBold(line);
                const hasBold = line.includes("**");
                pdf.setFontSize(8.5);
                const wrapped = splitLines(stripped, CONTENT_W);
                pdf.setTextColor(...BODY_COL);
                if (hasBold && wrapped.length === 1) {
                    ensureSpace(4.5);
                    printMixedLine(line, MARGIN, y, 8.5);
                    y += 4.5;
                } else {
                    pdf.setFont("helvetica", "normal");
                    drawPlainLines(wrapped, MARGIN, 4.5);
                }
                y += 1;
            }

            // ── FOOTER ────────────────────────────────────────────────────────
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

            // ── Save ──────────────────────────────────────────────────────────
            const slug = (sessionTitle.trim() || "notes").replace(/[^a-z0-9]/gi, "_");
            pdf.save(`${slug}_${new Date().toISOString().split("T")[0]}.pdf`);

        } catch (error) {
            console.error("PDF generation error:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // ── Markdown Export ───────────────────────────────────────────────────────
    // Client-side only — note content never leaves the browser.

    const handleDownloadMarkdown = () => {
        if (!visibleNotesMarkdown.trim()) return;

        const contents = visibleNotesMarkdown.endsWith("\n") ? visibleNotesMarkdown : `${visibleNotesMarkdown}\n`;
        const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = buildMarkdownFilename(sessionTitle);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    // ── Copy ─────────────────────────────────────────────────────────────────

    const handleCopy = async () => {
        if (!visibleNotesMarkdown.trim()) return;
        await navigator.clipboard.writeText(visibleNotesMarkdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col min-h-0 flex-1 dark:text-slate-100">

            {sidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <button
                        type="button"
                        aria-label="Close templates"
                        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 dark:bg-black/50 ${sidebarDrawerVisible ? "opacity-100" : "opacity-0"}`}
                        onClick={closeMobileSidebar}
                    />
                    <div className={`relative h-full w-72 shadow-xl transition-transform duration-200 ease-out dark:shadow-slate-950/50 ${sidebarDrawerVisible ? "translate-x-0" : "-translate-x-full"}`}>
                        <NoteTemplateSidebar
                            currentTitle={sessionTitle}
                            currentNoteStyle={noteStyle}
                            currentSectionsRaw={sectionsRaw}
                            canSelect={canSelectTemplate}
                            onSelect={handleTemplateSelect}
                            onClose={closeMobileSidebar}
                        />
                    </div>
                </div>
            )}

            {/* ── Main layout ── */}
            <div className="flex min-h-0 flex-1">
                <aside className={`hidden flex-none overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200 ease-out md:flex dark:border-slate-800 dark:bg-slate-950 ${isSidebarCollapsed ? "w-12" : "w-72"}`}>
                    {isSidebarCollapsed ? (
                        <div className="flex h-full w-12 justify-center pt-3">
                            <button
                                type="button"
                                onClick={() => setIsSidebarCollapsed(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-[#2149A1] dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-blue-300"
                                aria-label="Show templates sidebar"
                                title="Show templates sidebar"
                            >
                                <PanelLeftOpen className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <NoteTemplateSidebar
                            currentTitle={sessionTitle}
                            currentNoteStyle={noteStyle}
                            currentSectionsRaw={sectionsRaw}
                            canSelect={canSelectTemplate}
                            onSelect={handleTemplateSelect}
                            onToggleSidebar={() => setIsSidebarCollapsed(true)}
                        />
                    )}
                </aside>

                <main className="min-w-0 flex-1 overflow-auto dark:bg-slate-950">
                    <div className="container mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 xl:max-w-6xl">

                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <button
                                    type="button"
                                    onClick={openMobileSidebar}
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors active:scale-[0.98] active:opacity-80 hover:bg-slate-50 md:hidden dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                                >
                                    <BookMarked className="h-3.5 w-3.5" />
                                    Templates
                                </button>
                            </div>

                            {/* WS status pill — only shown while connecting/active/error */}
                            {showConnectionPill && (
                                <div className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${isConnected
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : (wsStatus === "connecting" || wsStatus === "reconnecting")
                                        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                                        : "border-red-200 bg-red-50 text-red-600"
                                    }`}>
                                    {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                    {wsStatus === "connecting" ? "Connecting…" : wsStatus === "reconnecting" ? "Reconnecting…" : isConnected ? "Connected" : "Disconnected"}
                                </div>
                            )}
                        </div>

                {/* Error banner */}
                {errorMessage && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="flex-1">{errorMessage}</p>
                        <button
                            onClick={() => { setWsError(null); setMicError(null); setWsStatus("disconnected"); }}
                            className="flex items-center gap-1 font-medium text-xs text-red-600 hover:text-red-800 whitespace-nowrap transition-opacity active:opacity-80 dark:text-red-300 dark:hover:text-red-200"
                        >
                            <RotateCcw className="w-3 h-3" /> Dismiss
                        </button>
                    </div>
                )}

                {/* Finalizing banner */}
                {isFinalizing && (
                    <div className="flex items-center gap-2.5 bg-[#e8eef9] border border-[#2149A1]/20 text-[#2149A1] text-sm rounded-lg px-4 py-3 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        Generating final notes — this may take a moment…
                    </div>
                )}

                {/* Session length warning */}
                {showSessionLimitWarning && (
                    <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${sessionLimitWarningClasses[sessionLimitWarningLevel]}`}>
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>{sessionLimitWarningCopy}</p>
                    </div>
                )}

                {/* ── Config card (only when idle) ── */}
                {recordStatus === "idle" && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900/80">
                        {/* Session title */}
                        <div>
                            <label className="block text-xs font-medium text-[#868C94] mb-1.5 dark:text-slate-400">Session title <span className="font-normal">(optional)</span></label>
                            <input
                                type="text"
                                value={sessionTitle}
                                onChange={(e) => setSessionTitle(e.target.value)}
                                placeholder="e.g. Patient intake — John Smith"
                                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#2149A1]/20 focus:border-[#2149A1] placeholder-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                            />
                        </div>

                        {/* Note style */}
                        <div>
                            <label className="block text-xs font-medium text-[#868C94] mb-2 dark:text-slate-400">Note style</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {(Object.keys(NOTE_STYLE_LABELS) as NoteStyle[]).map((style) => (
                                    <button
                                        key={style}
                                        onClick={() => handleStyleChange(style)}
                                        className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-colors active:scale-[0.98] active:opacity-90 ${noteStyle === style
                                            ? "border-[#2149A1] bg-[#e8eef9] text-[#2149A1] dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-200"
                                            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
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
                            <label className="block text-xs font-medium text-[#868C94] mb-1.5 dark:text-slate-400">
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
                                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#2149A1]/20 focus:border-[#2149A1] placeholder-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                            />
                        </div>
                    </div>
                )}

                {/* Session title display when active */}
                {recordStatus !== "idle" && sessionTitle && (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{sessionTitle}</h1>
                        <p className="text-sm text-[#868C94] mt-1 dark:text-slate-400">
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
                            className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-[background-color,color,transform,opacity] duration-150 hover:scale-[1.02] active:scale-[0.98] active:opacity-90"
                        >
                            {getSessionToken.isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                                : <><Mic className="w-4 h-4" />{isPaused ? "Resume" : "Start Recording"}</>
                            }
                        </button>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors duration-150 active:scale-[0.98] active:opacity-90"
                        >
                            <Square className="w-4 h-4 fill-white" />
                            Stop
                        </button>
                    )}

                    {(isPaused || hasNotes) && !isRecording && !isFinalizing && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors active:scale-[0.98] active:opacity-80 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
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
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 dark:border-slate-800 dark:bg-slate-900/80">
                        {/* Panel header */}
                        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start">
                                <div className="flex min-w-0 items-center gap-2">
                                    <NotebookPen className="w-4 h-4 flex-shrink-0 text-[#2149A1] dark:text-blue-300" />
                                    <span className="truncate text-sm font-semibold text-slate-600 dark:text-slate-200">
                                        {isFinal ? "Final Notes" : "Live Notes"}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-1.5 sm:justify-start">
                                    {!isFinal && isRecording && (
                                        <span className="flex items-center gap-1 text-xs text-[#868C94] dark:text-slate-400">
                                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                            Updating
                                        </span>
                                    )}
                                    {isFinal && (
                                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium dark:border-emerald-700/60 dark:bg-emerald-500/15 dark:text-emerald-300">
                                            Complete
                                        </span>
                                    )}
                                    {isEditingNotes && (
                                        <span className="text-xs bg-[#e8eef9] text-[#2149A1] border border-[#2149A1]/20 px-2 py-0.5 rounded-full font-medium dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-200">
                                            Editing
                                        </span>
                                    )}
                                    {hasManualEdits && !isEditingNotes && (
                                        <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            Edited
                                        </span>
                                    )}
                                </div>
                            </div>

                            {hasNotes && (
                                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                                    {canEditNotes && (
                                        isEditingNotes ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={handleDoneNotesEdit}
                                                    className="flex items-center gap-1.5 rounded-lg bg-[#2149A1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors active:scale-[0.98] active:opacity-90 hover:bg-[#1a3a87]"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    Done
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelNotesEdit}
                                                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors active:scale-[0.98] active:opacity-80 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleStartNotesEdit}
                                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors active:scale-[0.98] active:opacity-80 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                            >
                                                <NotebookPen className="h-3.5 w-3.5" />
                                                Edit
                                            </button>
                                        )
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        disabled={!hasVisibleNotes}
                                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors active:scale-[0.98] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    >
                                        {copied
                                            ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</>
                                            : <><Copy className="w-3.5 h-3.5" /> Copy</>
                                        }
                                    </button>
                                    <div className="relative" ref={downloadMenuRef}>
                                        <button
                                            type="button"
                                            onClick={() => setDownloadOpen((value) => !value)}
                                            disabled={!hasVisibleNotes}
                                            aria-haspopup="menu"
                                            aria-expanded={downloadOpen}
                                            className="flex items-center gap-1.5 text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] px-2.5 py-1.5 rounded-lg hover:bg-[#e8eef9] transition-colors active:scale-[0.98] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-500/15 dark:hover:text-blue-200"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Download
                                            <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${downloadOpen ? "rotate-180" : ""}`} />
                                        </button>

                                        {downloadOpen && (
                                            <div
                                                role="menu"
                                                className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
                                            >
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        if (isGeneratingPDF) return;
                                                        setDownloadOpen(false);
                                                        void handleSavePDF();
                                                    }}
                                                    disabled={isGeneratingPDF}
                                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                >
                                                    {isGeneratingPDF ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2149A1] dark:text-blue-300" />
                                                    ) : (
                                                        <Download className="w-3.5 h-3.5 text-[#2149A1] dark:text-blue-300" />
                                                    )}
                                                    {isGeneratingPDF ? "Generating PDF…" : "Download PDF"}
                                                </button>
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setDownloadOpen(false);
                                                        handleDownloadMarkdown();
                                                    }}
                                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors active:bg-slate-100 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                >
                                                    <Download className="w-3.5 h-3.5 text-[#2149A1] dark:text-blue-300" />
                                                    Download Markdown (.md)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {notesEditMessage && (
                            <div className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                                {notesEditMessage}
                            </div>
                        )}

                        {/* Notes content */}
                        <div className="px-6 py-5">
                            {isEditingNotes ? (
                                <textarea
                                    value={draftNotesMarkdown}
                                    onChange={(event) => setDraftNotesMarkdown(event.target.value)}
                                    aria-label="Edit final notes markdown"
                                    className="min-h-[360px] w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                                    spellCheck
                                />
                            ) : hasNotes ? (
                                <div className="min-h-[200px]">
                                    {renderMarkdown(visibleNotesMarkdown)}
                                    <div ref={notesEndRef} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                                    <NotebookPen className="w-10 h-10 text-slate-200 mb-3 dark:text-slate-400" />
                                    <p className="text-sm text-slate-400 dark:text-slate-400">
                                        Notes will appear here as you speak…
                                    </p>
                                    <p className="text-xs text-slate-300 mt-1 dark:text-slate-400">
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
                        <div className="w-16 h-16 bg-[#e8eef9] rounded-2xl flex items-center justify-center mb-4 dark:bg-blue-500/15">
                            <NotebookPen className="w-8 h-8 text-[#2149A1] dark:text-blue-300" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 mb-2 dark:text-slate-100">Ready to take notes</h2>
                        <p className="text-sm text-[#868C94] max-w-sm dark:text-slate-300">
                            Configure your session above, then press <strong className="font-semibold text-slate-700 dark:text-slate-100">Start Recording</strong>. Notes will be generated live from your speech.
                        </p>
                    </div>
                )}
                    </div>
                </main>
            </div>
        </div>
    );
}
