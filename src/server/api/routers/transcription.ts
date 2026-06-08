/**
 * src/server/api/routers/transcription.ts
 *
 * Mints short-lived WS session tokens.
 * This is the server-side gate for authentication (must be signed in).
 * Usage is recorded here as best-effort analytics, but it no longer blocks
 * recording now that Formify is moving to the free-app model.
 *
 * The WS server validates the token but does NOT touch the DB directly —
 * it trusts the token was minted by this authenticated web app.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { env } from "@/env";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { countWords, logPerf, safeJsonChars } from "@/server/api/perf-log";
import { mintWSToken } from "@/server/ws-token";

const NOTE_STYLE_VALUES = ["general", "clinical", "meeting", "study"] as const;
const NOTES_TRANSFORM_MIN_CHARS = 500;
const NOTES_TRANSFORM_MIN_WORDS = 80;
const NOTES_TRANSFORM_MAX_SECTIONS = 12;
const NOTES_TRANSFORM_TIMEOUT_MS = 60_000;

type NotesTransformKind = "summarise" | "reorganise";

type NotesTransformBridgeMetadata = {
    kind: NotesTransformKind;
    notesChars: number;
    notesWords: number;
    targetSectionCount: number;
};

type NotesTransformBridgeResult = {
    payload: unknown;
    durationMs: number;
    httpStatus: number;
};

const notesTransformBaseSchema = z.object({
    notesMarkdown: z.string(),
    noteStyle: z.enum(NOTE_STYLE_VALUES),
});

const backendErrorSchema = z.object({
    error: z.object({
        code: z.string().optional(),
        message: z.string().optional(),
    }),
});

const summariseResponseSchema = z.object({
    summaryMarkdown: z.string(),
});

const reorganiseResponseSchema = z.object({
    reorganisedMarkdown: z.string(),
});

function todayUTC(): string {
    return new Date().toISOString().split("T")[0]!;
}

function validateNotesTransformInput(notesMarkdown: string, kind: NotesTransformKind) {
    const trimmed = notesMarkdown.trim();
    if (
        trimmed.length < NOTES_TRANSFORM_MIN_CHARS ||
        countWords(trimmed) < NOTES_TRANSFORM_MIN_WORDS
    ) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: kind === "summarise"
                ? "These notes are too short to summarise yet."
                : "These notes are too short to reorganise yet.",
        });
    }
}

function getNotesTransformBridgeMetadata(
    kind: NotesTransformKind,
    notesMarkdown: string,
    targetSectionCount = 0
): NotesTransformBridgeMetadata {
    const trimmed = notesMarkdown.trim();
    return {
        kind,
        notesChars: trimmed.length,
        notesWords: countWords(trimmed),
        targetSectionCount,
    };
}

function logNotesTransformBridge(
    metadata: NotesTransformBridgeMetadata,
    event: {
        category: string;
        durationMs: number;
        httpStatus?: number;
        outputChars?: number;
        resultJsonChars?: number;
        backendCode?: string;
        errorName?: string;
    }
): void {
    logPerf("notes-transform-bridge", {
        type: metadata.kind,
        category: event.category,
        durationMs: event.durationMs,
        httpStatus: event.httpStatus,
        notesChars: metadata.notesChars,
        notesWords: metadata.notesWords,
        targetSectionCount: metadata.targetSectionCount,
        outputChars: event.outputChars,
        resultJsonChars: event.resultJsonChars,
        backendCode: event.backendCode,
        errorName: event.errorName,
    });
}

function getNotesTransformBaseUrl(): string | null {
    if (env.NOTES_TRANSFORM_URL) {
        return env.NOTES_TRANSFORM_URL.replace(/\/+$/, "");
    }

    try {
        const url = new URL(env.NEXT_PUBLIC_WS_URL);
        if (url.protocol === "ws:") {
            url.protocol = "http:";
            return url.origin;
        }
        if (url.protocol === "wss:") {
            url.protocol = "https:";
            return url.origin;
        }
    } catch {
        return null;
    }

    return null;
}

function mapBackendTransformError(kind: NotesTransformKind, code?: string, status?: number): string {
    if (code === "notes-too-short-to-summarise") {
        return "These notes are too short to summarise yet.";
    }
    if (code === "notes-too-short-to-reorganise") {
        return "These notes are too short to reorganise yet.";
    }
    if (code === "too-many-sections" || code === "sections-too-many") {
        return "Use up to 12 sections.";
    }
    if (status && [502, 503, 504].includes(status)) {
        return "The notes transform service is unavailable. Your notes were not changed.";
    }
    if (kind === "summarise" && code?.includes("too-short")) {
        return "These notes are too short to summarise yet.";
    }
    if (kind === "reorganise" && code?.includes("too-short")) {
        return "These notes are too short to reorganise yet.";
    }
    return "The transform failed. Your notes were not changed.";
}

async function callNotesTransform(
    kind: NotesTransformKind,
    body: Record<string, unknown>,
    metadata: NotesTransformBridgeMetadata
): Promise<NotesTransformBridgeResult> {
    const startedAt = Date.now();
    const baseUrl = getNotesTransformBaseUrl();
    if (!baseUrl || !env.NOTES_TRANSFORM_SECRET) {
        logNotesTransformBridge(metadata, {
            category: "unavailable",
            durationMs: Date.now() - startedAt,
        });
        throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "The notes transform service is unavailable. Your notes were not changed.",
        });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOTES_TRANSFORM_TIMEOUT_MS);
    const endpoint = kind === "summarise"
        ? "/notes/transform/summarise"
        : "/notes/transform/reorganise";

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.NOTES_TRANSFORM_SECRET}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        let payload: unknown = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok) {
            const parsed = backendErrorSchema.safeParse(payload);
            const errorCode = parsed.success ? parsed.data.error.code : undefined;
            logNotesTransformBridge(metadata, {
                category: parsed.success ? "backend-error-envelope" : "non-2xx",
                durationMs: Date.now() - startedAt,
                httpStatus: response.status,
                backendCode: errorCode ?? "unknown",
            });
            throw new TRPCError({
                code: response.status === 503 ? "SERVICE_UNAVAILABLE" : "BAD_GATEWAY",
                message: mapBackendTransformError(kind, errorCode, response.status),
            });
        }

        return {
            payload,
            durationMs: Date.now() - startedAt,
            httpStatus: response.status,
        };
    } catch (error) {
        if (error instanceof TRPCError) throw error;

        const isAbort = error instanceof Error && error.name === "AbortError";
        const message = isAbort
            ? "The notes transform service is unavailable. Your notes were not changed."
            : "The transform failed. Your notes were not changed.";

        logNotesTransformBridge(metadata, {
            category: isAbort ? "timeout" : "fetch-failure",
            durationMs: Date.now() - startedAt,
            errorName: error instanceof Error ? error.name : "unknown",
        });

        throw new TRPCError({
            code: isAbort ? "TIMEOUT" : "BAD_GATEWAY",
            message,
        });
    } finally {
        clearTimeout(timeout);
    }
}

export const transcriptionRouter = createTRPCRouter({
    /**
     * Mint a short-lived WS session token.
     *
     * Enforces:
     *   - Authentication (protectedProcedure)
     *
     * Records usage as non-blocking analytics. Analytics failures must not
     * prevent a signed-in user from starting a recording session.
     *
     * Returns { token } — the client sends this in the WS start payload.
     */
    getSessionToken: protectedProcedure
        .input(z.object({
            mode: z.enum(["forms", "notes"]),
            recordingSessionId: z.string().uuid().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const recordingSessionId = input.mode === "notes"
                ? input.recordingSessionId ?? randomUUID()
                : undefined;

            try {
                const today = todayUTC();
                await ctx.db.transcriptionUsage.upsert({
                    where: { userId_date: { userId, date: today } },
                    create: { userId, date: today, count: 1 },
                    update: { count: { increment: 1 } },
                });
            } catch (error) {
                console.warn("[Transcription] Usage analytics write failed; token still minted.", {
                    mode: input.mode,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }

            const token = mintWSToken(userId, input.mode, recordingSessionId);
            return { token, recordingSessionId };
        }),

    summariseNotes: protectedProcedure
        .input(notesTransformBaseSchema)
        .mutation(async ({ input }) => {
            validateNotesTransformInput(input.notesMarkdown, "summarise");
            const metadata = getNotesTransformBridgeMetadata("summarise", input.notesMarkdown);

            const result = await callNotesTransform("summarise", {
                notesMarkdown: input.notesMarkdown,
                noteStyle: input.noteStyle,
            }, metadata);

            const parsed = summariseResponseSchema.safeParse(result.payload);
            if (!parsed.success || !parsed.data.summaryMarkdown.trim()) {
                logNotesTransformBridge(metadata, {
                    category: "incomplete-output",
                    durationMs: result.durationMs,
                    httpStatus: result.httpStatus,
                    resultJsonChars: safeJsonChars(result.payload),
                });
                throw new TRPCError({
                    code: "BAD_GATEWAY",
                    message: "The transform result looked incomplete. Your notes were not changed.",
                });
            }

            logNotesTransformBridge(metadata, {
                category: "success",
                durationMs: result.durationMs,
                httpStatus: result.httpStatus,
                outputChars: parsed.data.summaryMarkdown.length,
                resultJsonChars: safeJsonChars(result.payload),
            });

            return { summaryMarkdown: parsed.data.summaryMarkdown };
        }),

    reorganiseNotes: protectedProcedure
        .input(notesTransformBaseSchema.extend({
            targetSections: z.array(z.string().trim().min(1)).max(50),
        }))
        .mutation(async ({ input }) => {
            validateNotesTransformInput(input.notesMarkdown, "reorganise");

            const targetSections = Array.from(
                new Map(input.targetSections.map((section) => [section.toLocaleLowerCase(), section])).values()
            );

            if (targetSections.length > NOTES_TRANSFORM_MAX_SECTIONS) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Use up to 12 sections.",
                });
            }
            const metadata = getNotesTransformBridgeMetadata(
                "reorganise",
                input.notesMarkdown,
                targetSections.length
            );

            const result = await callNotesTransform("reorganise", {
                notesMarkdown: input.notesMarkdown,
                noteStyle: input.noteStyle,
                targetSections,
            }, metadata);

            const parsed = reorganiseResponseSchema.safeParse(result.payload);
            if (!parsed.success || !parsed.data.reorganisedMarkdown.trim()) {
                logNotesTransformBridge(metadata, {
                    category: "incomplete-output",
                    durationMs: result.durationMs,
                    httpStatus: result.httpStatus,
                    resultJsonChars: safeJsonChars(result.payload),
                });
                throw new TRPCError({
                    code: "BAD_GATEWAY",
                    message: "The transform result looked incomplete. Your notes were not changed.",
                });
            }

            logNotesTransformBridge(metadata, {
                category: "success",
                durationMs: result.durationMs,
                httpStatus: result.httpStatus,
                outputChars: parsed.data.reorganisedMarkdown.length,
                resultJsonChars: safeJsonChars(result.payload),
            });

            return { reorganisedMarkdown: parsed.data.reorganisedMarkdown };
        }),
});
