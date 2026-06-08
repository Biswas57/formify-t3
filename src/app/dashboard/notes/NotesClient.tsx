"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Mic, Square, Wifi, WifiOff, RotateCcw, Loader2,
    NotebookPen, Copy, Check, Download, AlertCircle,
    BookMarked, PanelLeftOpen, ChevronDown, X,
    SlidersHorizontal, Sparkles, ListTree, Undo2,
    Pencil, FileText, FileDown,
} from "lucide-react";
import { env } from "@/env";
import { api } from "@/trpc/react";
import { exportNotesPdf } from "@/lib/pdf";
import NoteTemplateSidebar from "./NoteTemplateSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    id?: string | null;
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
type SessionLimitWarningLevel = "none" | "warning" | "final-warning" | "strong-warning" | "reached";
type RestoredRecordStatus = "idle" | "paused";

type NotesDraft = {
    version: 1;
    notesMarkdown: string;
    preFinalNotesMarkdown?: string;
    noteStyle: NoteStyle;
    sectionsRaw: string;
    sessionTitle: string;
    selectedNoteTemplateId?: string | null;
    selectedNoteTemplateTitle?: string | null;
    recordStatus: RestoredRecordStatus;
    isFinal: boolean;
    hasManualEdits: boolean;
    wasEditingNotes: boolean;
    updatedAt: string;
};

type PendingNotesConfigChange =
    | { type: "template"; id: string; title: string; noteStyle: NoteStyle; sectionsRaw: string }
    | { type: "style"; noteStyle: NoteStyle }
    | { type: "sections"; sectionsRaw: string };

type NotesTransformType = "summary" | "reorganise";

type NotesTransformPreview = {
    type: NotesTransformType;
    markdown: string;
};

type NotesUndoSnapshot = {
    markdown: string;
    preFinalNotesMarkdown: string | null;
    isFinal: boolean;
    hasManualEdits: boolean;
};

const MAX_NOTES_SESSION_MS = 60 * 60_000;
const NOTES_SESSION_WARNING_MS = 15 * 60_000;
const NOTES_SESSION_FINAL_WARNING_MS = 5 * 60_000;
const NOTES_SESSION_STRONG_WARNING_MS = 2 * 60_000;
const NOTES_DRAFT_STORAGE_PREFIX = "formify:notes:draft:v1";
const NOTES_DRAFT_SAVE_DEBOUNCE_MS = 300;
const NOTES_RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000] as const;
const NOTES_RECONNECT_TOTAL_WINDOW_MS = 20_000;
const NOTES_RECONNECT_OVERLOADED_GRACE_MS = 3000;
const NOTES_RECONNECT_MAX_BUFFERED_CHUNKS = 10;
const NOTES_RECONNECT_MAX_BUFFERED_BYTES = 4 * 1024 * 1024;
const NOTES_TRANSFORM_MIN_CHARS = 500;
const NOTES_TRANSFORM_MIN_WORDS = 80;
const NOTES_TRANSFORM_MAX_SECTIONS = 12;

const NON_RETRYABLE_NOTES_ERROR_CODES = new Set([
    "invalid-token",
    "missing-token",
    "mode-mismatch",
    "bad-start-payload",
    "unknown-mode",
    "bad-json",
]);

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

const NOTE_STYLE_VALUES = ["general", "clinical", "meeting", "study"] as const;

const SUPPORTED_MIME =
    typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

function getWSUrl(): string {
    return env.NEXT_PUBLIC_WS_URL;
}

function isNoteStyle(value: unknown): value is NoteStyle {
    return typeof value === "string" && NOTE_STYLE_VALUES.includes(value as NoteStyle);
}

function getNotesDraftStorageKey(user: User): string | null {
    const stableIdentifier = user.id ?? user.email;
    return stableIdentifier ? `${NOTES_DRAFT_STORAGE_PREFIX}:${stableIdentifier}` : null;
}

function parseNotesDraft(raw: string | null): NotesDraft | null {
    if (!raw) return null;

    try {
        const value = JSON.parse(raw) as Partial<NotesDraft>;
        if (value.version !== 1) return null;
        if (typeof value.notesMarkdown !== "string") return null;
        if (!isNoteStyle(value.noteStyle)) return null;

        return {
            version: 1,
            notesMarkdown: value.notesMarkdown,
            preFinalNotesMarkdown:
                typeof value.preFinalNotesMarkdown === "string" ? value.preFinalNotesMarkdown : undefined,
            noteStyle: value.noteStyle,
            sectionsRaw: typeof value.sectionsRaw === "string" ? value.sectionsRaw : DEFAULT_SECTIONS[value.noteStyle],
            sessionTitle: typeof value.sessionTitle === "string" ? value.sessionTitle : "",
            selectedNoteTemplateId:
                typeof value.selectedNoteTemplateId === "string" ? value.selectedNoteTemplateId : null,
            selectedNoteTemplateTitle:
                typeof value.selectedNoteTemplateTitle === "string" ? value.selectedNoteTemplateTitle : null,
            recordStatus: value.recordStatus === "paused" ? "paused" : "idle",
            isFinal: value.isFinal === true,
            hasManualEdits: value.hasManualEdits === true,
            wasEditingNotes: value.wasEditingNotes === true,
            updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
        };
    } catch {
        return null;
    }
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
    if (remainingMs <= NOTES_SESSION_STRONG_WARNING_MS) return "strong-warning";
    if (remainingMs <= NOTES_SESSION_FINAL_WARNING_MS) return "final-warning";
    if (remainingMs <= NOTES_SESSION_WARNING_MS) return "warning";
    return "none";
}

function isRetryableNotesServerError(code: string): boolean {
    return !NON_RETRYABLE_NOTES_ERROR_CODES.has(code);
}

function countMarkdownWords(markdown: string): number {
    return markdown.trim().split(/\s+/).filter(Boolean).length;
}

function hasEnoughNotesForTransform(markdown: string): boolean {
    const trimmed = markdown.trim();
    return trimmed.length >= NOTES_TRANSFORM_MIN_CHARS && countMarkdownWords(trimmed) >= NOTES_TRANSFORM_MIN_WORDS;
}

function parseTargetSections(value: string): string[] {
    const seen = new Set<string>();
    const sections: string[] = [];

    for (const section of value.split(",")) {
        const trimmed = section.trim();
        if (!trimmed) continue;
        const key = trimmed.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        sections.push(trimmed);
    }

    return sections;
}

function isPlaceholderMarkdownLine(value: string): boolean {
    return /^(no relevant notes captured\.?|none|n\/a)$/i.test(value.trim().replace(/^[-*]\s+/, ""));
}

function extractHeadingsAtLevel(markdown: string, level: number): string[] {
    const lines = markdown.split(/\r?\n/);
    const headings: string[] = [];
    const seen = new Set<string>();
    const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

    for (let index = 0; index < lines.length; index += 1) {
        const match = headingPattern.exec(lines[index] ?? "");
        const hashes = match?.[1];
        const rawTitle = match?.[2];
        if (!hashes || !rawTitle || hashes.length !== level) continue;

        const title = rawTitle.trim();
        if (!title || isPlaceholderMarkdownLine(title)) continue;

        let hasMeaningfulBody = false;
        for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
            const bodyLine = lines[bodyIndex] ?? "";
            const bodyHeading = headingPattern.exec(bodyLine);
            const bodyHeadingHashes = bodyHeading?.[1];
            if (bodyHeadingHashes && bodyHeadingHashes.length <= level) break;
            if (bodyLine.trim() && !isPlaceholderMarkdownLine(bodyLine)) {
                hasMeaningfulBody = true;
                break;
            }
        }

        if (!hasMeaningfulBody) continue;

        const key = title.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        headings.push(title);
    }

    return headings.slice(0, NOTES_TRANSFORM_MAX_SECTIONS);
}

function getReorganiseSectionPrefill(markdown: string): string {
    for (const level of [2, 1, 3]) {
        const headings = extractHeadingsAtLevel(markdown, level);
        if (headings.length > 0) return headings.join(", ");
    }

    return "";
}

function getSafeTransformErrorMessage(error: unknown, type: NotesTransformType): string {
    const fallback = "The transform failed. Your notes were not changed.";
    const message = error instanceof Error ? error.message : "";
    const safeMessages = new Set([
        "These notes are too short to summarise yet.",
        "These notes are too short to reorganise yet.",
        "Use up to 12 sections.",
        "The notes transform service is unavailable. Your notes were not changed.",
        "The transform failed. Your notes were not changed.",
        "The transform result looked incomplete. Your notes were not changed.",
        "Finish editing before using Actions.",
    ]);

    if (safeMessages.has(message)) return message;
    if (message.toLocaleLowerCase().includes("too short")) {
        return type === "summary"
            ? "These notes are too short to summarise yet."
            : "These notes are too short to reorganise yet.";
    }
    if (message.toLocaleLowerCase().includes("12 sections")) return "Use up to 12 sections.";
    if (message.toLocaleLowerCase().includes("unavailable")) {
        return "The notes transform service is unavailable. Your notes were not changed.";
    }

    return fallback;
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

export default function NotesClient({ user }: { user: User }) {
    const notesDraftStorageKey = getNotesDraftStorageKey(user);

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
    const logicalRecordingSessionIdRef = useRef<string | null>(null);
    const manualStopRequestedRef = useRef(false);
    const [sessionLimitWarningLevel, setSessionLimitWarningLevel] = useState<SessionLimitWarningLevel>("none");
    const [sessionLimitRemainingMs, setSessionLimitRemainingMs] = useState<number | null>(null);

    // Token
    const getSessionToken = api.transcription.getSessionToken.useMutation();
    const summariseNotes = api.transcription.summariseNotes.useMutation();
    const reorganiseNotes = api.transcription.reorganiseNotes.useMutation();
    const wsTokenRef = useRef<string | null>(null);
    const utils = api.useUtils();

    // Notes config
    const [noteStyle, setNoteStyle] = useState<NoteStyle>("general");
    const [sectionsRaw, setSectionsRaw] = useState(DEFAULT_SECTIONS.general);
    const [sessionTitle, setSessionTitle] = useState("");
    const [selectedNoteTemplateId, setSelectedNoteTemplateId] = useState<string | null>(null);
    const [selectedNoteTemplateTitle, setSelectedNoteTemplateTitle] = useState<string | null>(null);

    // Notes output
    const [notesMarkdown, setNotesMarkdown] = useState("");
    const [preFinalNotesMarkdown, setPreFinalNotesMarkdown] = useState<string | null>(null);
    const [isFinal, setIsFinal] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [draftNotesMarkdown, setDraftNotesMarkdown] = useState("");
    const [hasManualEdits, setHasManualEdits] = useState(false);
    const [notesEditMessage, setNotesEditMessage] = useState<string | null>(null);

    // UI
    const [copied, setCopied] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [transformError, setTransformError] = useState<string | null>(null);
    const [transformPreview, setTransformPreview] = useState<NotesTransformPreview | null>(null);
    const [reorganiseDialogOpen, setReorganiseDialogOpen] = useState(false);
    const [reorganiseSectionsRaw, setReorganiseSectionsRaw] = useState("");
    const [reorganiseAutoSections, setReorganiseAutoSections] = useState(false);
    const [undoSnapshot, setUndoSnapshot] = useState<NotesUndoSnapshot | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarDrawerVisible, setSidebarDrawerVisible] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [pendingNotesConfigChange, setPendingNotesConfigChange] = useState<PendingNotesConfigChange | null>(null);
    const [isStartingRecording, setIsStartingRecording] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const sidebarCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftHydratedRef = useRef(false);
    const suppressNextEmptyDraftSaveRef = useRef(false);
    const isEditingNotesRef = useRef(false);
    const hasManualEditsRef = useRef(false);
    const visibleNotesMarkdownRef = useRef("");
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectDeadlineRef = useRef<number | null>(null);
    const reconnectingRef = useRef(false);
    const reconnectAttemptInFlightRef = useRef(false);
    const reconnectTokenRef = useRef<string | null>(null);
    const reconnectAudioBufferRef = useRef<Blob[]>([]);
    const reconnectAudioBufferBytesRef = useRef(0);

    const isConnected = wsStatus === "connected";
    const isRecording = recordStatus === "recording";
    const isFinalizing = recordStatus === "finalizing";
    const isPaused = recordStatus === "paused";
    // Sockets open on demand at record time (T-018), so starting does not
    // require an existing connection; only block while finalising or connecting.
    const canRecord = !isStartingRecording && !isFinalizing && wsStatus !== "connecting" && wsStatus !== "reconnecting";
    // The connection pill is only meaningful while a session is being
    // established or is active; hide it when idle/paused with no socket.
    const showConnectionPill =
        isStartingRecording ||
        isRecording ||
        isFinalizing ||
        wsStatus === "connecting" ||
        wsStatus === "reconnecting" ||
        wsStatus === "error";
    const canSelectTemplate = !isStartingRecording && !isRecording && !isFinalizing;
    const errorMessage = wsError ?? micError;
    const sessionLimitRemainingMinutes =
        sessionLimitRemainingMs === null ? null : Math.max(0, Math.ceil(sessionLimitRemainingMs / 60_000));
    const showSessionLimitWarning = sessionLimitWarningLevel !== "none";
    const sessionLimitWarningCopy = (() => {
        if (sessionLimitWarningLevel === "warning") {
            const minutesLabel = sessionLimitRemainingMinutes === 1 ? "1 minute" : `${sessionLimitRemainingMinutes ?? 0} minutes`;
            return `For reliability, this recording will finalise at 60 minutes. You can resume afterwards. About ${minutesLabel} remaining.`;
        }
        if (sessionLimitWarningLevel === "final-warning") {
            const minutesLabel = sessionLimitRemainingMinutes === 1 ? "1 minute" : `${sessionLimitRemainingMinutes ?? 0} minutes`;
            return `This recording will finalise soon for reliability. Your notes are preserved, and you can resume afterwards. About ${minutesLabel} remaining.`;
        }
        if (sessionLimitWarningLevel === "strong-warning") {
            const minutesLabel = sessionLimitRemainingMinutes === 1 ? "1 minute" : `${sessionLimitRemainingMinutes ?? 0} minutes`;
            return `This recording is almost at the 60-minute reliability window and will finalise shortly. Your notes are preserved, and you can resume afterwards. About ${minutesLabel} remaining.`;
        }
        if (sessionLimitWarningLevel === "reached") {
            return "This recording is finalising for reliability at the 60-minute mark. Your notes are preserved, and you can resume afterwards.";
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
        "strong-warning":
            "border-orange-400 bg-orange-100 text-orange-900 " +
            "dark:border-orange-500/60 dark:bg-orange-500/20 dark:text-orange-100",
        reached:
            "border-red-300 bg-red-50 text-red-800 " +
            "dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
    };

    const visibleNotesMarkdown = isEditingNotes ? draftNotesMarkdown : notesMarkdown;
    const hasNotes = notesMarkdown.trim().length > 0;
    const hasVisibleNotes = visibleNotesMarkdown.trim().length > 0;
    const hasNotesContent = hasNotes || isFinal || hasManualEdits || isEditingNotes;
    const showFullSetupPanel = recordStatus === "idle" && !hasNotesContent && !isStartingRecording;
    const displayTitle = sessionTitle.trim() || `${NOTE_STYLE_LABELS[noteStyle]} Notes`;
    const statusText = isStartingRecording
        ? "Connecting — preparing notes session."
        : wsStatus === "reconnecting"
            ? "Reconnecting — preserving your recording."
            : isRecording
            ? "Recording — notes are updating live."
            : isFinalizing
                ? "Finalising — generating final notes."
                : isFinal
                    ? "Complete — final notes ready."
                    : "Paused — resume when ready.";
    const isConnectingStatus = isStartingRecording || wsStatus === "connecting" || wsStatus === "reconnecting";
    const connectionPillClasses = isConnectingStatus
        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
        : isConnected
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-600";
    const connectionPillLabel = isStartingRecording || wsStatus === "connecting"
        ? "Connecting…"
        : wsStatus === "reconnecting"
            ? "Reconnecting…"
            : isConnected
                ? "Connected"
                : "Disconnected";
    const isTransforming = summariseNotes.isPending || reorganiseNotes.isPending;
    const activeTransformLabel = summariseNotes.isPending
        ? "Generating summary preview…"
        : reorganiseNotes.isPending
            ? "Reorganising notes…"
            : null;
    const notesAreLongEnoughForTransform = hasEnoughNotesForTransform(visibleNotesMarkdown);
    const transformsBlockedByLifecycle =
        isStartingRecording ||
        isRecording ||
        isFinalizing ||
        wsStatus === "connecting" ||
        wsStatus === "reconnecting" ||
        getSessionToken.isPending;
    const transformDisabledReason = (() => {
        if (isEditingNotes) return "Finish editing before using Actions.";
        if (transformsBlockedByLifecycle) return "Actions are unavailable while recording is active.";
        if (isTransforming) return "A notes action is already running.";
        if (!hasVisibleNotes) return "Add notes before using Actions.";
        if (!notesAreLongEnoughForTransform) {
            return "These notes are too short to summarise yet. These notes are too short to reorganise yet.";
        }
        return null;
    })();
    const canRunTransform = transformDisabledReason === null;
    const canEditNotes = hasNotes && isFinal && !transformsBlockedByLifecycle && !isTransforming;
    const canUndoTransform =
        undoSnapshot !== null &&
        !isEditingNotes &&
        !transformsBlockedByLifecycle &&
        !isTransforming;

    useEffect(() => {
        visibleNotesMarkdownRef.current = visibleNotesMarkdown;
    }, [visibleNotesMarkdown]);

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
        if (!actionsOpen) return;

        const handleClick = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setActionsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setActionsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [actionsOpen]);

    useEffect(() => {
        if (!hasVisibleNotes) {
            setDownloadOpen(false);
            setActionsOpen(false);
        }
    }, [hasVisibleNotes]);

    useEffect(() => {
        return () => {
            if (sidebarCloseTimerRef.current) {
                clearTimeout(sidebarCloseTimerRef.current);
            }
            if (draftSaveTimerRef.current) {
                clearTimeout(draftSaveTimerRef.current);
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

    const clearNotesDraft = useCallback(() => {
        if (draftSaveTimerRef.current) {
            clearTimeout(draftSaveTimerRef.current);
            draftSaveTimerRef.current = null;
        }

        if (notesDraftStorageKey && typeof window !== "undefined") {
            window.localStorage.removeItem(notesDraftStorageKey);
        }

        suppressNextEmptyDraftSaveRef.current = true;
    }, [notesDraftStorageKey]);

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

    const captureUndoSnapshot = (): NotesUndoSnapshot => ({
        markdown: notesMarkdown,
        preFinalNotesMarkdown,
        isFinal,
        hasManualEdits,
    });

    const handleStartNotesEdit = () => {
        if (!canEditNotes) return;
        setActionsOpen(false);
        setDownloadOpen(false);
        setDraftNotesMarkdown(notesMarkdown);
        setNotesEditMessage(null);
        setNotesEditing(true);
    };

    const handleDoneNotesEdit = () => {
        if (draftNotesMarkdown !== notesMarkdown) {
            setUndoSnapshot(captureUndoSnapshot());
        }
        setNotesMarkdown(draftNotesMarkdown);
        if (draftNotesMarkdown !== notesMarkdown) {
            setNotesManualEdits(true);
        }
        setNotesEditing(false);
        setNotesEditMessage(null);
    };

    const handleCancelNotesEdit = () => {
        clearNotesEditState();
    };

    // Sync default sections when style changes (only if user hasn't typed custom sections)
    const userEditedSections = useRef(false);
    const applyNotesConfigChange = useCallback((change: PendingNotesConfigChange) => {
        if (change.type === "template") {
            setSessionTitle(change.title);
            setSelectedNoteTemplateId(change.id);
            setSelectedNoteTemplateTitle(change.title);
            setNoteStyle(change.noteStyle);
            setSectionsRaw(change.sectionsRaw);
            userEditedSections.current = change.sectionsRaw.trim().length > 0;
            return;
        }

        if (change.type === "style") {
            setSelectedNoteTemplateId(null);
            setSelectedNoteTemplateTitle(null);
            setNoteStyle(change.noteStyle);
            if (!userEditedSections.current) {
                setSectionsRaw(DEFAULT_SECTIONS[change.noteStyle]);
            }
            return;
        }

        setSelectedNoteTemplateId(null);
        setSelectedNoteTemplateTitle(null);
        setSectionsRaw(change.sectionsRaw);
        userEditedSections.current = true;
    }, []);

    const requestNotesConfigChange = (change: PendingNotesConfigChange): boolean => {
        if (isStartingRecording || isRecording || isFinalizing) return false;

        if (hasNotesContent) {
            setPendingNotesConfigChange(change);
            return false;
        }

        applyNotesConfigChange(change);
        return true;
    };

    const handleStyleChange = (style: NoteStyle) => {
        requestNotesConfigChange({ type: "style", noteStyle: style });
    };

    const handleTemplateSelect = (id: string, title: string, style: NoteStyle, sections: string) => {
        return requestNotesConfigChange({ type: "template", id, title, noteStyle: style, sectionsRaw: sections });
    };

    // ── WebSocket ─────────────────────────────────────────────────────────────

    // Sockets exist only during active recording/finalising (T-018). Track
    // intentional closes (notes_final, reset, unmount) so they neither surface
    // as interruptions nor trigger any reconnect.
    const recordStatusRef = useRef<RecordStatus>("idle");
    const intentionalCloseRef = useRef(false);
    const intentionalCloseSocketRef = useRef<WebSocket | null>(null);
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

    function markSocketCloseIntentional(socket: WebSocket | null = wsRef.current) {
        intentionalCloseRef.current = true;
        intentionalCloseSocketRef.current = socket;
    }

    function consumeIntentionalClose(socket: WebSocket): boolean {
        const wasIntentional =
            intentionalCloseRef.current &&
            (intentionalCloseSocketRef.current === null || intentionalCloseSocketRef.current === socket);

        if (intentionalCloseSocketRef.current === null || intentionalCloseSocketRef.current === socket) {
            intentionalCloseRef.current = false;
            intentionalCloseSocketRef.current = null;
        }

        return wasIntentional;
    }

    function clearReconnectTimers() {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (reconnectGraceTimerRef.current) {
            clearTimeout(reconnectGraceTimerRef.current);
            reconnectGraceTimerRef.current = null;
        }
    }

    function clearReconnectAudioBuffer() {
        reconnectAudioBufferRef.current = [];
        reconnectAudioBufferBytesRef.current = 0;
    }

    function resetReconnectState({ clearAudio = true }: { clearAudio?: boolean } = {}) {
        clearReconnectTimers();
        reconnectAttemptRef.current = 0;
        reconnectDeadlineRef.current = null;
        reconnectingRef.current = false;
        reconnectAttemptInFlightRef.current = false;
        reconnectTokenRef.current = null;
        if (clearAudio) clearReconnectAudioBuffer();
    }

    function clearLogicalRecordingSession() {
        logicalRecordingSessionIdRef.current = null;
    }

    function isReconnectStillActive() {
        return reconnectingRef.current && recordStatusRef.current === "recording" && !stopInFlightRef.current;
    }

    async function mintNotesToken({
        reuseLogicalSession,
        shouldAcceptResult,
    }: {
        reuseLogicalSession: boolean;
        shouldAcceptResult?: () => boolean;
    }): Promise<string> {
        const requestedRecordingSessionId = reuseLogicalSession
            ? logicalRecordingSessionIdRef.current ?? undefined
            : undefined;
        const result = await getSessionToken.mutateAsync({
            mode: "notes",
            recordingSessionId: requestedRecordingSessionId,
        });

        if (shouldAcceptResult && !shouldAcceptResult()) {
            throw new Error("token-mint-cancelled");
        }

        if (result.recordingSessionId) {
            logicalRecordingSessionIdRef.current = result.recordingSessionId;
        }

        wsTokenRef.current = result.token;
        void utils.usage.getToday.invalidate();
        return result.token;
    }

    function buildNotesStartPayload(token: string, forceContinuation: boolean): NotesStartPayload {
        const sections = sectionsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const continuationNotesMarkdown = visibleNotesMarkdownRef.current;
        const shouldContinueNotesSession =
            forceContinuation ||
            (recordStatusRef.current !== "idle" && continuationNotesMarkdown.trim().length > 0);

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

        return startPayload;
    }

    function moveToPausedAfterReconnectFailure(message: string) {
        resetReconnectState();
        clearLogicalRecordingSession();
        const ws = wsRef.current;
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            markSocketCloseIntentional(ws);
            ws.close(1000, "reconnect-failed");
        }
        if (wsRef.current === ws) {
            wsRef.current = null;
        }
        markSessionInactive();
        stopLocalRecorder();
        setIsStartingRecording(false);
        startInFlightRef.current = false;
        stopInFlightRef.current = false;
        if (recordStatusRef.current !== "idle") {
            setRecordStatus("paused");
            recordStatusRef.current = "paused";
        }
        setWsError(message);
        setWsStatus("error");
    }

    function bufferAudioChunk(chunk: Blob) {
        if (chunk.size <= 0 || recordStatusRef.current !== "recording") return;

        const nextChunkCount = reconnectAudioBufferRef.current.length + 1;
        const nextBytes = reconnectAudioBufferBytesRef.current + chunk.size;

        if (
            nextChunkCount > NOTES_RECONNECT_MAX_BUFFERED_CHUNKS ||
            nextBytes > NOTES_RECONNECT_MAX_BUFFERED_BYTES
        ) {
            moveToPausedAfterReconnectFailure(
                "The recording connection could not be recovered quickly enough. Your notes so far are preserved. Resume to continue."
            );
            return;
        }

        reconnectAudioBufferRef.current.push(chunk);
        reconnectAudioBufferBytesRef.current = nextBytes;
    }

    function flushBufferedAudio(sessionGeneration: number) {
        const ws = wsRef.current;
        if (
            ws?.readyState !== WebSocket.OPEN ||
            !wsSessionReadyRef.current ||
            activeSessionGenerationRef.current !== sessionGeneration ||
            recordStatusRef.current !== "recording"
        ) {
            return;
        }

        const buffered = reconnectAudioBufferRef.current;
        reconnectAudioBufferRef.current = [];
        reconnectAudioBufferBytesRef.current = 0;

        for (const chunk of buffered) {
            if (
                ws.readyState !== WebSocket.OPEN ||
                !wsSessionReadyRef.current ||
                activeSessionGenerationRef.current !== sessionGeneration ||
                recordStatusRef.current !== "recording"
            ) {
                bufferAudioChunk(chunk);
                return;
            }

            ws.send(chunk);
        }
    }

    function sendOrBufferAudioChunk(chunk: Blob) {
        if (chunk.size <= 0 || recordStatusRef.current !== "recording") return;

        const ws = wsRef.current;
        const canSend =
            !reconnectingRef.current &&
            ws?.readyState === WebSocket.OPEN &&
            wsSessionReadyRef.current &&
            activeSessionGenerationRef.current !== null;

        if (!canSend) {
            bufferAudioChunk(chunk);
            return;
        }

        try {
            ws.send(chunk);
        } catch {
            bufferAudioChunk(chunk);
            beginReconnect("audio-send-failed");
        }
    }

    async function getReconnectToken(): Promise<string> {
        if (reconnectTokenRef.current) return reconnectTokenRef.current;

        const token = await mintNotesToken({
            reuseLogicalSession: true,
            shouldAcceptResult: isReconnectStillActive,
        });
        if (!isReconnectStillActive()) {
            throw new Error("reconnect-cancelled");
        }
        reconnectTokenRef.current = token;
        return token;
    }

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

    function beginReconnect(reason: string, { graceMs = 0 }: { graceMs?: number } = {}): boolean {
        if (recordStatusRef.current !== "recording" || stopInFlightRef.current || startInFlightRef.current) {
            return false;
        }

        if (!reconnectingRef.current) {
            reconnectingRef.current = true;
            reconnectAttemptRef.current = 0;
            reconnectDeadlineRef.current = Date.now() + NOTES_RECONNECT_TOTAL_WINDOW_MS;
            reconnectTokenRef.current = null;
            clearReconnectAudioBuffer();
        }

        wsSessionReadyRef.current = false;
        setSessionReady(false);
        setIsStartingRecording(false);
        setWsError(null);
        setMicError(null);
        setWsStatus("reconnecting");
        console.warn(`[Notes] Recovering recording connection after ${reason}`);

        if (graceMs > 0) {
            if (!reconnectGraceTimerRef.current && !reconnectTimerRef.current && !reconnectAttemptInFlightRef.current) {
                reconnectGraceTimerRef.current = setTimeout(() => {
                    reconnectGraceTimerRef.current = null;
                    scheduleReconnectAttempt();
                }, graceMs);
            }
            return true;
        }

        if (reconnectGraceTimerRef.current) {
            clearTimeout(reconnectGraceTimerRef.current);
            reconnectGraceTimerRef.current = null;
        }

        if (!reconnectTimerRef.current && !reconnectAttemptInFlightRef.current) {
            scheduleReconnectAttempt();
        }

        return true;
    }

    function scheduleReconnectAttempt() {
        if (!reconnectingRef.current || recordStatusRef.current !== "recording" || stopInFlightRef.current) {
            return;
        }

        if (reconnectGraceTimerRef.current) {
            clearTimeout(reconnectGraceTimerRef.current);
            reconnectGraceTimerRef.current = null;
        }

        if (reconnectTimerRef.current || reconnectAttemptInFlightRef.current) return;

        const now = Date.now();
        const deadline = reconnectDeadlineRef.current ?? now + NOTES_RECONNECT_TOTAL_WINDOW_MS;
        reconnectDeadlineRef.current = deadline;

        const attemptIndex = reconnectAttemptRef.current;
        if (attemptIndex >= NOTES_RECONNECT_DELAYS_MS.length || now >= deadline) {
            moveToPausedAfterReconnectFailure(
                "The recording connection could not be recovered. Your notes so far are preserved. Resume to continue."
            );
            return;
        }

        reconnectAttemptRef.current = attemptIndex + 1;
        const retryDelayMs = NOTES_RECONNECT_DELAYS_MS[attemptIndex] ?? NOTES_RECONNECT_DELAYS_MS.at(-1)!;
        const delay = Math.min(retryDelayMs, Math.max(0, deadline - now));

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            void runReconnectAttempt();
        }, delay);
    }

    async function runReconnectAttempt() {
        if (!reconnectingRef.current || recordStatusRef.current !== "recording" || stopInFlightRef.current) {
            return;
        }

        reconnectAttemptInFlightRef.current = true;

        try {
            const deadline = reconnectDeadlineRef.current ?? Date.now() + NOTES_RECONNECT_TOTAL_WINDOW_MS;
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) {
                throw new Error("reconnect-window-expired");
            }

            const token = await getReconnectToken();
            if (!reconnectingRef.current || recordStatusRef.current !== "recording" || stopInFlightRef.current) {
                return;
            }

            const sessionGeneration = sessionGenerationRef.current + 1;
            sessionGenerationRef.current = sessionGeneration;
            activeSessionGenerationRef.current = sessionGeneration;
            wsSessionReadyRef.current = false;
            setSessionReady(false);

            const previousWs = wsRef.current;
            if (previousWs && previousWs.readyState !== WebSocket.CLOSED && previousWs.readyState !== WebSocket.CLOSING) {
                markSocketCloseIntentional(previousWs);
                previousWs.close(1000, "notes-reconnect");
            }
            if (wsRef.current === previousWs) {
                wsRef.current = null;
            }

            const ws = await connectWS(
                "reconnecting",
                sessionGeneration,
                Math.max(1000, Math.min(8000, remainingMs))
            );

            if (!reconnectingRef.current || recordStatusRef.current !== "recording" || stopInFlightRef.current) {
                markSocketCloseIntentional(ws);
                ws.close(1000, "reconnect-cancelled");
                return;
            }

            ws.send(JSON.stringify(buildNotesStartPayload(token, true)));
            await waitForSessionStarted(sessionGeneration);

            if (!reconnectingRef.current || recordStatusRef.current !== "recording" || stopInFlightRef.current) {
                markSocketCloseIntentional(ws);
                ws.close(1000, "reconnect-cancelled");
                return;
            }

            setWsStatus("connected");
            setWsError(null);
            setMicError(null);
            flushBufferedAudio(sessionGeneration);
            resetReconnectState({ clearAudio: false });
        } catch (error) {
            if (!reconnectingRef.current || recordStatusRef.current !== "recording" || stopInFlightRef.current) {
                return;
            }

            const failedWs = wsRef.current;
            if (failedWs && failedWs.readyState !== WebSocket.CLOSED && failedWs.readyState !== WebSocket.CLOSING) {
                markSocketCloseIntentional(failedWs);
                failedWs.close(1000, "reconnect-attempt-failed");
            }
            if (wsRef.current === failedWs) {
                wsRef.current = null;
            }
            markSessionInactive();
            reconnectAttemptInFlightRef.current = false;
            console.warn("[Notes] Reconnect attempt failed:", error);
            scheduleReconnectAttempt();
        } finally {
            reconnectAttemptInFlightRef.current = false;
        }
    }

    function handleTerminalServerError(serverError: string, message: string | undefined, ws: WebSocket) {
        resetReconnectState();
        clearLogicalRecordingSession();
        markSessionInactive();
        stopLocalRecorder();
        setIsStartingRecording(false);
        if (recordStatusRef.current !== "idle") {
            setRecordStatus("paused");
            recordStatusRef.current = "paused";
        }
        if (serverError === "invalid-token" || serverError === "missing-token") {
            setMicError("Session expired. Please try starting again.");
        } else {
            setMicError(message ?? "The notes session ended unexpectedly. Please try again.");
        }
        setWsStatus("error");
        startInFlightRef.current = false;
        stopInFlightRef.current = false;
        markSocketCloseIntentional(ws);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1000, "server-error");
        }
        if (wsRef.current === ws) {
            wsRef.current = null;
        }
    }

    // Opens a WebSocket on demand and resolves once it is OPEN. There is no
    // idle/pre-connected socket; reconnects are explicit and bounded.
    function connectWS(
        status: "connecting" | "reconnecting",
        sessionGeneration: number,
        timeoutMs = 8000
    ): Promise<WebSocket> {
        const existing = wsRef.current;
        if (existing?.readyState === WebSocket.OPEN && activeSessionGenerationRef.current === sessionGeneration) {
            return Promise.resolve(existing);
        }

        return new Promise<WebSocket>((resolve, reject) => {
            wsSessionReadyRef.current = false;
            setSessionReady(false);
            setWsStatus(status);
            setWsError(null);

            let settled = false;
            const ws = new WebSocket(getWSUrl());
            wsRef.current = ws;

            // Gives enough time for slow cold-starts while allowing bounded retries.
            const connectionTimeout = setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    markSocketCloseIntentional(ws);
                    ws.close();
                }
            }, timeoutMs);

            ws.onopen = () => {
                clearTimeout(connectionTimeout);
                setWsError(null);
                settled = true;
                resolve(ws);
                // Do NOT send start here — startRecording sends it after token mint.
            };

            ws.onmessage = (event) => {
            if (wsRef.current !== ws || activeSessionGenerationRef.current !== sessionGeneration) return;

            try {
                const msg = JSON.parse(event.data as string) as ServerMessage;
                const serverError =
                    msg.error ?? (msg.type === "error" ? msg.code ?? msg.message ?? "server-error" : null);

                if (serverError) {
                    console.warn("[Notes] Server error:", serverError);
                    if (recordStatusRef.current === "recording" && isRetryableNotesServerError(serverError)) {
                        beginReconnect(serverError, {
                            graceMs: serverError === "transcription-overloaded" ? NOTES_RECONNECT_OVERLOADED_GRACE_MS : 0,
                        });
                    } else {
                        handleTerminalServerError(serverError, msg.message, ws);
                    }
                    return;
                }

                if (msg.type === "started") {
                    wsSessionReadyRef.current = true;
                    setSessionReady(true);
                    setWsStatus("connected");
                    setWsError(null);
                    setMicError(null);
                    return;
                }

                if (msg.type === "notes_update") {
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
                    resetReconnectState();
                    const md = msg.notesMarkdown ?? "";
                    if (md) {
                        const previousVisibleNotes = visibleNotesMarkdownRef.current;
                        if (previousVisibleNotes.trim().length > 0) {
                            setPreFinalNotesMarkdown(previousVisibleNotes);
                        }
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
                    clearLogicalRecordingSession();
                    stopInFlightRef.current = false;

                    // Session is finished — close the socket intentionally so no
                    // idle connection lingers or churns after finalisation.
                    markSocketCloseIntentional(ws);
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
                const wasIntentional = consumeIntentionalClose(ws);
                const isCurrentSocket =
                    wsRef.current === ws && activeSessionGenerationRef.current === sessionGeneration;

                // Never opened — reject the pending connect so startRecording can surface it.
                if (!settled) {
                    settled = true;
                    if (isCurrentSocket) {
                        if (wsRef.current === ws) wsRef.current = null;
                        markSessionInactive();
                        setWsStatus(wasIntentional ? "disconnected" : status === "reconnecting" ? "reconnecting" : "disconnected");
                    }
                    reject(new Error("connection-failed"));
                    return;
                }

                if (!isCurrentSocket) return;

                markSessionInactive();
                startInFlightRef.current = false;
                stopInFlightRef.current = false;
                setIsStartingRecording(false);
                if (wsRef.current === ws) wsRef.current = null;

                // Intentional close (notes_final, reset, unmount, connect timeout):
                // go quiet, no banner, no reconnect.
                if (wasIntentional) {
                    setWsStatus("disconnected");
                    return;
                }

                // A disconnect during active recording gets a bounded retry window.
                // Finalising/stop paths do not retry because local recording has ended.
                const currentStatus = recordStatusRef.current;
                if (currentStatus === "recording") {
                    if (reconnectingRef.current) {
                        setWsStatus("reconnecting");
                        if (!reconnectTimerRef.current && !reconnectGraceTimerRef.current && !reconnectAttemptInFlightRef.current) {
                            scheduleReconnectAttempt();
                        }
                    } else {
                        beginReconnect("socket-close");
                    }
                    return;
                }

                if (currentStatus === "finalizing") {
                    setRecordStatus("paused");
                    recordStatusRef.current = "paused";
                    setWsError("The recording connection was interrupted during finalisation. Your notes so far are preserved. Resume to continue.");
                    setWsStatus("error");
                    return;
                }

                // Otherwise idle/paused — sockets only live during recording, so
                // do not reconnect.
                setWsStatus("disconnected");
            };
        });
    }

    // Close the active socket intentionally (reset / unmount). Sockets are only
    // meant to exist during recording, so this never reconnects.
    function closeWsIntentionally() {
        resetReconnectState();
        markSessionInactive();
        const ws = wsRef.current;
        markSocketCloseIntentional(ws);
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            ws.close(1000, "client-intentional");
        }
        if (wsRef.current === ws) {
            wsRef.current = null;
        }
    }

    useEffect(() => {
        if (!notesDraftStorageKey) {
            draftHydratedRef.current = true;
            return;
        }

        const draft = parseNotesDraft(window.localStorage.getItem(notesDraftStorageKey));
        if (!draft) {
            draftHydratedRef.current = true;
            return;
        }

        const restoredHasContent =
            draft.notesMarkdown.trim().length > 0 || draft.isFinal || draft.hasManualEdits || draft.wasEditingNotes;
        const restoredStatus: RestoredRecordStatus = restoredHasContent ? "paused" : "idle";

        setNotesMarkdown(draft.notesMarkdown);
        setPreFinalNotesMarkdown(draft.preFinalNotesMarkdown ?? null);
        setNoteStyle(draft.noteStyle);
        setSectionsRaw(draft.sectionsRaw);
        setSessionTitle(draft.sessionTitle);
        setSelectedNoteTemplateId(draft.selectedNoteTemplateId ?? null);
        setSelectedNoteTemplateTitle(draft.selectedNoteTemplateTitle ?? null);
        setIsFinal(draft.isFinal);
        setIsEditingNotes(false);
        isEditingNotesRef.current = false;
        setDraftNotesMarkdown("");
        setNotesEditMessage(null);
        setHasManualEdits(draft.hasManualEdits || draft.wasEditingNotes);
        hasManualEditsRef.current = draft.hasManualEdits || draft.wasEditingNotes;
        setRecordStatus(restoredStatus);
        recordStatusRef.current = restoredStatus;
        setIsStartingRecording(false);
        setWsStatus("disconnected");
        setWsError(null);
        setMicError(null);
        setSessionLimitWarningLevel("none");
        setSessionLimitRemainingMs(null);
        userEditedSections.current = draft.sectionsRaw.trim().length > 0;
        draftHydratedRef.current = true;
    }, [notesDraftStorageKey]);

    useEffect(() => {
        if (!draftHydratedRef.current || !notesDraftStorageKey) return;

        if (draftSaveTimerRef.current) {
            clearTimeout(draftSaveTimerRef.current);
            draftSaveTimerRef.current = null;
        }

        const shouldSaveDraft =
            visibleNotesMarkdown.trim().length > 0 || isFinal || hasManualEdits || isEditingNotes;

        if (!shouldSaveDraft) {
            if (suppressNextEmptyDraftSaveRef.current) {
                suppressNextEmptyDraftSaveRef.current = false;
            }
            return;
        }

        suppressNextEmptyDraftSaveRef.current = false;
        draftSaveTimerRef.current = setTimeout(() => {
            const draft: NotesDraft = {
                version: 1,
                notesMarkdown: visibleNotesMarkdown,
                preFinalNotesMarkdown: preFinalNotesMarkdown ?? undefined,
                noteStyle,
                sectionsRaw,
                sessionTitle,
                selectedNoteTemplateId,
                selectedNoteTemplateTitle,
                recordStatus: recordStatus === "idle" ? "idle" : "paused",
                isFinal,
                hasManualEdits,
                wasEditingNotes: isEditingNotes,
                updatedAt: new Date().toISOString(),
            };

            try {
                window.localStorage.setItem(notesDraftStorageKey, JSON.stringify(draft));
            } catch (error) {
                console.warn("[Notes] Could not save local notes draft:", error);
            }
        }, NOTES_DRAFT_SAVE_DEBOUNCE_MS);

        return () => {
            if (draftSaveTimerRef.current) {
                clearTimeout(draftSaveTimerRef.current);
                draftSaveTimerRef.current = null;
            }
        };
    }, [
        notesDraftStorageKey,
        visibleNotesMarkdown,
        preFinalNotesMarkdown,
        noteStyle,
        sectionsRaw,
        sessionTitle,
        selectedNoteTemplateId,
        selectedNoteTemplateTitle,
        recordStatus,
        isFinal,
        hasManualEdits,
        isEditingNotes,
    ]);

    // No socket on mount — it is opened on demand when recording starts.
    // On unmount, close any active socket intentionally.
    useEffect(() => {
        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (reconnectGraceTimerRef.current) {
                clearTimeout(reconnectGraceTimerRef.current);
                reconnectGraceTimerRef.current = null;
            }
            reconnectAttemptRef.current = 0;
            reconnectDeadlineRef.current = null;
            reconnectingRef.current = false;
            reconnectAttemptInFlightRef.current = false;
            reconnectTokenRef.current = null;
            logicalRecordingSessionIdRef.current = null;
            reconnectAudioBufferRef.current = [];
            reconnectAudioBufferBytesRef.current = 0;
            const ws = wsRef.current;
            markSocketCloseIntentional(ws);
            startInFlightRef.current = false;
            stopInFlightRef.current = false;
            stopLocalRecorder();
            markSessionInactive();
            ws?.close(1000, "client-unmount");
            if (wsRef.current === ws) {
                wsRef.current = null;
            }
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
        resetReconnectState();
        clearLogicalRecordingSession();
        cancelTransformFlow();
        setUndoSnapshot(null);
        setIsStartingRecording(true);
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
            setIsStartingRecording(false);
            return;
        }

        // ── Mint session token (auth + usage enforcement happens server-side) ──
        let token: string;
        try {
            token = await mintNotesToken({ reuseLogicalSession: false });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to start session";
            clearLogicalRecordingSession();
            stopLocalRecorder();
            setMicError(msg);
            startInFlightRef.current = false;
            setIsStartingRecording(false);
            return;
        }

        const sessionGeneration = sessionGenerationRef.current + 1;
        sessionGenerationRef.current = sessionGeneration;
        activeSessionGenerationRef.current = sessionGeneration;
        wsSessionReadyRef.current = false;
        setSessionReady(false);

        // ── Open a fresh WebSocket on demand (sockets only live during recording) ──
        let ws: WebSocket;
        try {
            ws = await connectWS("connecting", sessionGeneration);
        } catch {
            stopLocalRecorder();
            clearLogicalRecordingSession();
            markSessionInactive();
            setWsError("Could not connect to the transcription service. Please try again.");
            setWsStatus("error");
            startInFlightRef.current = false;
            setIsStartingRecording(false);
            return;
        }

        // ── Send start with locked-in config + token ───────────────────────
        // Config is captured NOW — what the user sees is what gets sent.
        const startPayload = buildNotesStartPayload(token, false);

        ws.send(JSON.stringify(startPayload));

        if (!stream || !recorder) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "stop" }));
            }
            markSocketCloseIntentional(ws);
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close(1000, "start-aborted");
            }
            markSessionInactive();
            stopLocalRecorder();
            clearLogicalRecordingSession();
            setMicError("Could not start recording. Please try again.");
            startInFlightRef.current = false;
            setIsStartingRecording(false);
            return;
        }

        const activeStream = stream;
        const activeRecorder = recorder;

        try {
            recorderRef.current = activeRecorder;

            activeRecorder.ondataavailable = (e) => {
                sendOrBufferAudioChunk(e.data);
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
            setIsStartingRecording(false);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Microphone access denied";
            if (activeSessionGenerationRef.current === sessionGeneration && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "stop" }));
            }
            markSocketCloseIntentional(ws);
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close(1000, "start-aborted");
            }
            markSessionInactive();
            stopLocalRecorder();
            clearLogicalRecordingSession();
            setMicError(
                msg === "session-start-timeout"
                    ? "The notes session did not start in time. Please try again."
                    : `Could not start recording: ${msg}`
            );
            setIsStartingRecording(false);
        } finally {
            startInFlightRef.current = false;
        }
    };

    const stopRecording = () => {
        if (stopInFlightRef.current || recordStatusRef.current !== "recording") return;

        stopInFlightRef.current = true;
        resetReconnectState();
        manualStopRequestedRef.current = true;
        wsSessionReadyRef.current = false;
        setSessionReady(false);
        setRecordStatus("finalizing");
        recordStatusRef.current = "finalizing";
        setIsStartingRecording(false);
        setIsFinal(false);
        stopLocalRecorder();

        if (wsRef.current?.readyState === WebSocket.OPEN && activeSessionGenerationRef.current !== null) {
            wsRef.current.send(JSON.stringify({ action: "stop" }));
        } else {
            markSessionInactive();
            clearLogicalRecordingSession();
            stopInFlightRef.current = false;
            setRecordStatus("paused");
            recordStatusRef.current = "paused";
            setWsError("The recording connection was unavailable. Your notes so far are preserved. Start a new recording segment to continue.");
            setWsStatus("error");
        }
    };

    const handleReset = () => {
        clearNotesDraft();
        sessionGenerationRef.current += 1;
        startInFlightRef.current = false;
        stopInFlightRef.current = false;
        cancelTransformFlow();
        setUndoSnapshot(null);
        stopLocalRecorder();
        clearLogicalRecordingSession();
        // Close any active socket intentionally and do not reconnect — a new
        // socket opens only when the user starts recording again.
        closeWsIntentionally();
        setRecordStatus("idle");
        recordStatusRef.current = "idle";
        setIsStartingRecording(false);
        setNotesMarkdown("");
        setPreFinalNotesMarkdown(null);
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

    const confirmNotesConfigChange = () => {
        if (!pendingNotesConfigChange) return;

        const change = pendingNotesConfigChange;
        handleReset();
        applyNotesConfigChange(change);
        setPendingNotesConfigChange(null);
        closeMobileSidebar();
    };

    const cancelNotesConfigChange = () => {
        setPendingNotesConfigChange(null);
    };

    // ── Notes transforms ─────────────────────────────────────────────────────

    const getTransformPreflightError = (type: NotesTransformType): string | null => {
        if (isEditingNotesRef.current) return "Finish editing before using Actions.";
        if (transformsBlockedByLifecycle || isTransforming) return "The transform failed. Your notes were not changed.";
        if (!visibleNotesMarkdownRef.current.trim()) {
            return type === "summary"
                ? "These notes are too short to summarise yet."
                : "These notes are too short to reorganise yet.";
        }
        if (!hasEnoughNotesForTransform(visibleNotesMarkdownRef.current)) {
            return type === "summary"
                ? "These notes are too short to summarise yet."
                : "These notes are too short to reorganise yet.";
        }

        return null;
    };

    const replaceCanonicalNotes = (markdown: string) => {
        setNotesMarkdown(markdown);
        visibleNotesMarkdownRef.current = markdown;
        setPreFinalNotesMarkdown(null);
        clearNotesEditState();
    };

    const openReorganiseDialog = () => {
        setActionsOpen(false);
        setTransformError(null);
        const preflightError = getTransformPreflightError("reorganise");
        if (preflightError) {
            setTransformError(preflightError);
            return;
        }

        setReorganiseSectionsRaw(getReorganiseSectionPrefill(visibleNotesMarkdownRef.current));
        setReorganiseAutoSections(false);
        setReorganiseDialogOpen(true);
    };

    const handleSummariseNotes = async () => {
        setActionsOpen(false);
        setTransformError(null);

        const preflightError = getTransformPreflightError("summary");
        if (preflightError) {
            setTransformError(preflightError);
            return;
        }

        try {
            const result = await summariseNotes.mutateAsync({
                notesMarkdown: visibleNotesMarkdownRef.current,
                noteStyle,
            });
            if (!result.summaryMarkdown.trim()) {
                setTransformError("The transform result looked incomplete. Your notes were not changed.");
                return;
            }
            setTransformPreview({ type: "summary", markdown: result.summaryMarkdown });
        } catch (error) {
            setTransformError(getSafeTransformErrorMessage(error, "summary"));
        }
    };

    const handleGenerateReorganisePreview = async () => {
        setTransformError(null);

        const preflightError = getTransformPreflightError("reorganise");
        if (preflightError) {
            setTransformError(preflightError);
            return;
        }

        const targetSections = reorganiseAutoSections ? [] : parseTargetSections(reorganiseSectionsRaw);
        if (!reorganiseAutoSections && targetSections.length > NOTES_TRANSFORM_MAX_SECTIONS) {
            setTransformError("Use up to 12 sections.");
            return;
        }

        try {
            const result = await reorganiseNotes.mutateAsync({
                notesMarkdown: visibleNotesMarkdownRef.current,
                noteStyle,
                targetSections,
            });
            if (!result.reorganisedMarkdown.trim()) {
                setTransformError("The transform result looked incomplete. Your notes were not changed.");
                return;
            }
            setTransformPreview({ type: "reorganise", markdown: result.reorganisedMarkdown });
            setReorganiseDialogOpen(false);
        } catch (error) {
            setTransformError(getSafeTransformErrorMessage(error, "reorganise"));
        }
    };

    const cancelTransformFlow = () => {
        setTransformPreview(null);
        setReorganiseDialogOpen(false);
        setTransformError(null);
    };

    const backToReorganiseSections = () => {
        setTransformPreview(null);
        setReorganiseDialogOpen(true);
        setTransformError(null);
    };

    const applyTransformPreview = () => {
        if (!transformPreview) return;

        setUndoSnapshot(captureUndoSnapshot());
        replaceCanonicalNotes(transformPreview.markdown);
        setTransformPreview(null);
        setReorganiseDialogOpen(false);
        setTransformError(null);
    };

    const handleUndoLastChange = () => {
        if (!undoSnapshot || !canUndoTransform) return;

        setActionsOpen(false);
        setNotesMarkdown(undoSnapshot.markdown);
        visibleNotesMarkdownRef.current = undoSnapshot.markdown;
        setPreFinalNotesMarkdown(undoSnapshot.preFinalNotesMarkdown);
        setIsFinal(undoSnapshot.isFinal);
        clearNotesEditState();
        setNotesManualEdits(undoSnapshot.hasManualEdits);
        setUndoSnapshot(null);
        setTransformPreview(null);
        setReorganiseDialogOpen(false);
        setTransformError(null);
    };

    // ── PDF Export ────────────────────────────────────────────────────────────
    // Client-side only — note content never leaves the browser.
    // Uses the same jsPDF approach as the forms PDF export.

    const handleSavePDF = async () => {
        const notesForExport = visibleNotesMarkdown;
        if (!notesForExport.trim()) return;
        setIsGeneratingPDF(true);
        try {
            await exportNotesPdf({
                markdown: notesForExport,
                title: sessionTitle,
                noteStyleLabel: NOTE_STYLE_LABELS[noteStyle],
                sections: sectionsRaw
                    .split(",")
                    .map((section) => section.trim())
                    .filter(Boolean),
            });
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
                        aria-label="Close notes templates"
                        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 dark:bg-black/50 ${sidebarDrawerVisible ? "opacity-100" : "opacity-0"}`}
                        onClick={closeMobileSidebar}
                    />
                    <div className={`absolute inset-y-0 left-0 flex w-80 max-w-[86vw] transform flex-col bg-white shadow-2xl transition-transform duration-200 ease-out dark:bg-slate-950 dark:shadow-slate-950/50 ${sidebarDrawerVisible ? "translate-x-0" : "-translate-x-full"}`}>
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
                        <div className="flex h-full w-full flex-col items-center py-3">
                            <button
                                type="button"
                                onClick={() => setIsSidebarCollapsed(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-[#2149A1] dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-blue-300"
                                aria-label="Show notes templates sidebar"
                                title="Show notes templates sidebar"
                            >
                                <PanelLeftOpen className="h-4 w-4" />
                            </button>
                            <div className="mt-3 h-px w-6 bg-slate-200 dark:bg-slate-800" />
                            <BookMarked className="mt-4 h-4 w-4 text-[#2149A1] dark:text-blue-300" />
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
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[border-color,color,transform,opacity] active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:hidden"
                                >
                                    <BookMarked className="h-4 w-4" />
                                    Notes Templates
                                </button>
                            </div>

                            {/* WS status pill — only shown while connecting/active/error */}
                            {showConnectionPill && (
                                <div className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${connectionPillClasses}`}>
                                    {isConnected && !isStartingRecording ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                    {connectionPillLabel}
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

                {/* ── Config card (only for a clean new session) ── */}
                {showFullSetupPanel && (
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
                                    requestNotesConfigChange({ type: "sections", sectionsRaw: e.target.value });
                                }}
                                placeholder="e.g. Summary, Key Points, Action Items"
                                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#2149A1]/20 focus:border-[#2149A1] placeholder-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                            />
                        </div>
                    </div>
                )}

                {/* Session title display once the user leaves the clean setup state */}
                {!showFullSetupPanel && (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{displayTitle}</h1>
                        <p className="mt-1 text-sm text-[#868C94] dark:text-slate-400">{statusText}</p>
                    </div>
                )}

                {/* ── Controls ── */}
                <div className="flex flex-wrap items-center gap-3">
                    {isRecording ? (
                        <button
                            onClick={stopRecording}
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
                            Finalising…
                        </button>
                    ) : (
                        <button
                            onClick={startRecording}
                            disabled={!canRecord || getSessionToken.isPending}
                            className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-[background-color,color,transform,opacity] duration-150 hover:scale-[1.02] active:scale-[0.98] active:opacity-90"
                        >
                            {isStartingRecording || getSessionToken.isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                                : <><Mic className="w-4 h-4" />{isPaused ? "Resume" : "Start Recording"}</>
                            }
                        </button>
                    )}

                    {(isPaused || hasNotes) && !isRecording && !isFinalizing && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors active:scale-[0.98] active:opacity-80 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset Notes
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
                            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-start">
                                <div className="flex min-w-0 items-center gap-2">
                                    <NotebookPen className="w-4 h-4 flex-shrink-0 text-[#2149A1] dark:text-blue-300" />
                                    <span className="truncate text-sm font-semibold text-slate-600 dark:text-slate-200">
                                        {isFinal ? "Final Notes" : "Live Notes"}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-start gap-1.5">
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
                                    {activeTransformLabel && (
                                        <span className="flex items-center gap-1 rounded-full border border-[#2149A1]/20 bg-[#e8eef9] px-2 py-0.5 text-xs font-medium text-[#2149A1] dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-200">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            {activeTransformLabel}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {hasNotes && (
                                <div className="w-full sm:w-auto" ref={actionsMenuRef}>
                                    <div className="flex w-full items-center justify-end sm:hidden">
                                        {isEditingNotes ? (
                                            <div className="flex items-center gap-2">
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
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDownloadOpen(false);
                                                    setActionsOpen((value) => !value);
                                                }}
                                                disabled={!hasVisibleNotes}
                                                aria-haspopup="dialog"
                                                aria-expanded={actionsOpen}
                                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-[background-color,border-color,color,transform,opacity] active:scale-[0.98] active:opacity-80 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                {isTransforming ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2149A1] dark:text-blue-300" />
                                                ) : (
                                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                                )}
                                                Actions
                                                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${actionsOpen ? "rotate-180" : ""}`} />
                                            </button>
                                        )}
                                    </div>

                                    {actionsOpen && !isEditingNotes && (
                                        <div className="fixed inset-0 z-[70] sm:hidden" role="dialog" aria-modal="true" aria-labelledby="notes-mobile-actions-title">
                                            <button
                                                type="button"
                                                aria-label="Close notes actions"
                                                className="absolute inset-0 bg-black/45 motion-safe:animate-fade-in motion-reduce:animate-none"
                                                onClick={() => setActionsOpen(false)}
                                            />
                                            <div className="absolute inset-x-0 bottom-0 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl motion-safe:animate-slide-up motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/70">
                                                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                                                    <div>
                                                        <h3 id="notes-mobile-actions-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                            Notes Actions
                                                        </h3>
                                                        {transformDisabledReason && (
                                                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                                {transformDisabledReason}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActionsOpen(false)}
                                                        className="rounded-lg p-2 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                                        aria-label="Close notes actions"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="space-y-1 px-3 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleSummariseNotes()}
                                                        disabled={!canRunTransform}
                                                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            {summariseNotes.isPending ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-[#2149A1] dark:text-blue-300" />
                                                            ) : (
                                                                <Sparkles className="h-4 w-4 text-[#2149A1] dark:text-blue-300" />
                                                            )}
                                                            Summarise
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={openReorganiseDialog}
                                                        disabled={!canRunTransform}
                                                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            {reorganiseNotes.isPending ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-[#2149A1] dark:text-blue-300" />
                                                            ) : (
                                                                <ListTree className="h-4 w-4 text-[#2149A1] dark:text-blue-300" />
                                                            )}
                                                            Reorganise
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleUndoLastChange}
                                                        disabled={!canUndoTransform}
                                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <Undo2 className="h-4 w-4 text-slate-400" />
                                                        Undo last change
                                                    </button>
                                                    <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActionsOpen(false);
                                                            handleStartNotesEdit();
                                                        }}
                                                        disabled={!canEditNotes}
                                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <Pencil className="h-4 w-4 text-slate-400" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActionsOpen(false);
                                                            void handleCopy();
                                                        }}
                                                        disabled={!hasVisibleNotes}
                                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        {copied ? (
                                                            <Check className="h-4 w-4 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="h-4 w-4 text-slate-400" />
                                                        )}
                                                        {copied ? "Copied" : "Copy"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (isGeneratingPDF) return;
                                                            setActionsOpen(false);
                                                            void handleSavePDF();
                                                        }}
                                                        disabled={!hasVisibleNotes || isGeneratingPDF}
                                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        {isGeneratingPDF ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-[#2149A1] dark:text-blue-300" />
                                                        ) : (
                                                            <FileText className="h-4 w-4 text-[#2149A1] dark:text-blue-300" />
                                                        )}
                                                        {isGeneratingPDF ? "Generating PDF…" : "Download PDF"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActionsOpen(false);
                                                            handleDownloadMarkdown();
                                                        }}
                                                        disabled={!hasVisibleNotes}
                                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <FileDown className="h-4 w-4 text-[#2149A1] dark:text-blue-300" />
                                                        Download Markdown
                                                    </button>
                                                </div>
                                                <div className="px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActionsOpen(false)}
                                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition-colors active:scale-[0.99] active:opacity-80 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="hidden w-full flex-wrap items-center gap-2 sm:flex sm:w-auto sm:justify-end">
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDownloadOpen(false);
                                                    setActionsOpen((value) => !value);
                                                }}
                                                disabled={!hasVisibleNotes}
                                                aria-haspopup="menu"
                                                aria-expanded={actionsOpen}
                                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors active:scale-[0.98] active:opacity-80 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                            >
                                                {isTransforming ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2149A1] dark:text-blue-300" />
                                                ) : (
                                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                                )}
                                                Actions
                                                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${actionsOpen ? "rotate-180" : ""}`} />
                                            </button>

                                            {actionsOpen && (
                                                <div
                                                    role="menu"
                                                    className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
                                                >
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => void handleSummariseNotes()}
                                                        disabled={!canRunTransform}
                                                        className="flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <span className="flex items-center gap-2.5">
                                                            {summariseNotes.isPending ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2149A1] dark:text-blue-300" />
                                                            ) : (
                                                                <Sparkles className="h-3.5 w-3.5 text-[#2149A1] dark:text-blue-300" />
                                                            )}
                                                            Summarise
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={openReorganiseDialog}
                                                        disabled={!canRunTransform}
                                                        className="flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <span className="flex items-center gap-2.5">
                                                            {reorganiseNotes.isPending ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2149A1] dark:text-blue-300" />
                                                            ) : (
                                                                <ListTree className="h-3.5 w-3.5 text-[#2149A1] dark:text-blue-300" />
                                                            )}
                                                            Reorganise
                                                        </span>
                                                    </button>
                                                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={handleUndoLastChange}
                                                        disabled={!canUndoTransform}
                                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <Undo2 className="h-3.5 w-3.5 text-slate-400" />
                                                        Undo last change
                                                    </button>
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={handleStartNotesEdit}
                                                        disabled={!canEditNotes}
                                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 text-slate-400" />
                                                        Edit
                                                    </button>
                                                    {transformDisabledReason && (
                                                        <div className="border-t border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-400 dark:border-slate-800 dark:text-slate-500">
                                                            {transformDisabledReason}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {isEditingNotes && (
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
                                                onClick={() => {
                                                    setActionsOpen(false);
                                                    setDownloadOpen((value) => !value);
                                                }}
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
                                                            <FileText className="w-3.5 h-3.5 text-[#2149A1] dark:text-blue-300" />
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
                                                        <FileDown className="w-3.5 h-3.5 text-[#2149A1] dark:text-blue-300" />
                                                        Download Markdown (.md)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {notesEditMessage && (
                            <div className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                                {notesEditMessage}
                            </div>
                        )}

                        {transformError && (
                            <div className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-5 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                <span>{transformError}</span>
                                <button
                                    type="button"
                                    onClick={() => setTransformError(null)}
                                    className="rounded-md px-1.5 py-1 text-red-500 transition-colors active:scale-95 active:opacity-80 hover:bg-red-100 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-900/40 dark:hover:text-red-100"
                                    aria-label="Dismiss notes action error"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}

                        {/* Notes content */}
                        <div className="px-4 py-4 sm:px-6 sm:py-5">
                            {isEditingNotes ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-inner dark:border-slate-800 dark:bg-slate-950/50">
                                    <div className="mb-2 flex items-center justify-between gap-3 px-1">
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            Edit your final notes. Done commits changes; Cancel leaves notes unchanged.
                                        </p>
                                    </div>
                                    <textarea
                                        value={draftNotesMarkdown}
                                        onChange={(event) => setDraftNotesMarkdown(event.target.value)}
                                        aria-label="Edit final notes markdown"
                                        className="min-h-[55vh] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-4 text-[15px] leading-7 text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 sm:min-h-[520px] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                                        spellCheck
                                    />
                                </div>
                            ) : hasNotes ? (
                                <div className="min-h-[200px]">
                                    {renderMarkdown(visibleNotesMarkdown)}
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
                {showFullSetupPanel && (
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

            {reorganiseDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <button
                        type="button"
                        aria-label="Cancel reorganise notes"
                        className="absolute inset-0 bg-black/50 motion-safe:animate-fade-in motion-reduce:animate-none"
                        onClick={cancelTransformFlow}
                    />
                    <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl motion-safe:animate-slide-up motion-reduce:animate-none sm:rounded-xl sm:motion-safe:animate-fade-up dark:bg-slate-900 dark:shadow-slate-950/60">
                        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={cancelTransformFlow}
                                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                aria-label="Cancel reorganise notes"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <h3 className="pr-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Reorganise notes</h3>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                Choose target sections for a preview, or let Formify organise the notes automatically.
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                            <label className="block text-xs font-medium text-[#868C94] dark:text-slate-400">
                                Sections <span className="font-normal">(comma-separated)</span>
                            </label>
                            <textarea
                                value={reorganiseSectionsRaw}
                                onChange={(event) => setReorganiseSectionsRaw(event.target.value)}
                                disabled={reorganiseAutoSections}
                                rows={5}
                                placeholder="Summary, Key Points, Actions"
                                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition-colors placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                            />

                            <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={reorganiseAutoSections}
                                    onChange={(event) => setReorganiseAutoSections(event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-[#2149A1] focus:ring-[#2149A1]/30 dark:border-slate-700 dark:bg-slate-950"
                                />
                                Auto sections
                            </label>

                            {transformError && (
                                <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                    {transformError}
                                </p>
                            )}
                        </div>

                        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row dark:border-slate-800 dark:bg-slate-900">
                            <button
                                type="button"
                                onClick={() => void handleGenerateReorganisePreview()}
                                disabled={reorganiseNotes.isPending}
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#2149A1] px-4 py-2 text-sm font-medium text-white transition-[background-color,transform,opacity] hover:bg-[#1a3a87] active:scale-[0.98] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {reorganiseNotes.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                Preview Reorganised Notes
                            </button>
                            <button
                                type="button"
                                onClick={cancelTransformFlow}
                                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-[background-color,transform,opacity] hover:bg-slate-50 active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {transformPreview && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <button
                        type="button"
                        aria-label="Cancel notes action preview"
                        className="absolute inset-0 bg-black/50 motion-safe:animate-fade-in motion-reduce:animate-none"
                        onClick={cancelTransformFlow}
                    />
                    <div className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl motion-safe:animate-slide-up motion-reduce:animate-none sm:max-h-[88vh] sm:rounded-xl sm:motion-safe:animate-fade-up dark:bg-slate-900 dark:shadow-slate-950/60">
                        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={cancelTransformFlow}
                                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition-colors active:scale-95 active:opacity-80 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                aria-label="Cancel notes action preview"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <h3 className="pr-8 text-lg font-semibold text-slate-900 dark:text-slate-100">
                                {transformPreview.type === "summary" ? "Summary Preview" : "Reorganised Notes Preview"}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Review before applying. Your current notes are unchanged.
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-6 sm:py-5 dark:bg-slate-950/40">
                            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                                {renderMarkdown(transformPreview.markdown)}
                            </div>
                        </div>

                        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row dark:border-slate-800 dark:bg-slate-900">
                            {transformPreview.type === "reorganise" && (
                                <button
                                    type="button"
                                    onClick={backToReorganiseSections}
                                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-[background-color,transform,opacity] hover:bg-slate-50 active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Back to sections
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={cancelTransformFlow}
                                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-[background-color,transform,opacity] hover:bg-slate-50 active:scale-[0.98] active:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={applyTransformPreview}
                                className="flex-1 rounded-lg bg-[#2149A1] px-4 py-2 text-sm font-medium text-white transition-[background-color,transform,opacity] hover:bg-[#1a3a87] active:scale-[0.98] active:opacity-90"
                            >
                                {transformPreview.type === "summary" ? "Apply Summary" : "Apply Reorganised Notes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingNotesConfigChange && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-slate-950/60">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Change notes template?</h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            Changing templates will clear your current notes for this session. This cannot be undone unless you have copied or downloaded them.
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={confirmNotesConfigChange}
                                className="flex-1 rounded-lg bg-[#2149A1] px-4 py-2 text-sm font-medium text-white transition-[background-color,transform,opacity] hover:bg-[#1a3a87] active:scale-[0.98] active:opacity-90"
                            >
                                Change Template
                            </button>
                            <button
                                type="button"
                                onClick={cancelNotesConfigChange}
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
