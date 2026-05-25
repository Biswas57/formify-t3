/**
 * src/server/api/routers/noteTemplate.ts
 *
 * CRUD for reusable note session configurations.
 *
 * Stores: title, noteStyle, sections (comma-separated raw string).
 * Does NOT store generated notes or transcripts.
 *
 * Limits: max FREE_NOTE_TEMPLATES per user (all plans share the same cap for now;
 * adjust when a Pro-unlimited note-templates feature is added).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { PLAN_LIMITS } from "@/server/entitlements/features";

// Valid noteStyle values — mirrors the NoteStyle union in NotesClient.tsx.
// Stored as a plain string in the DB; validated here at the API boundary.
const NOTE_STYLE_VALUES = ["general", "clinical", "meeting", "study"] as const;

const noteStyleSchema = z.enum(NOTE_STYLE_VALUES);

// Sections is stored as a comma-separated raw string, matching sectionsRaw in
// NotesClient. No join table needed for this simple format.
const sectionsSchema = z
    .string()
    .max(500, "Sections string too long")
    .default("");

export const noteTemplateRouter = createTRPCRouter({

    // ── list ──────────────────────────────────────────────────────────────────
    // Returns all note templates owned by the current user, newest first.

    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db.noteTemplate.findMany({
            where: { ownerId: ctx.session.user.id },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                title: true,
                noteStyle: true,
                sections: true,
                updatedAt: true,
            },
        });
    }),

    // ── create ────────────────────────────────────────────────────────────────
    // Creates a new note template. Enforces the per-user limit before insert.

    create: protectedProcedure
        .input(
            z.object({
                title: z.string().min(1).max(200),
                noteStyle: noteStyleSchema,
                sections: sectionsSchema,
            })
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            const count = await ctx.db.noteTemplate.count({
                where: { ownerId: userId },
            });

            if (count >= PLAN_LIMITS.FREE_NOTE_TEMPLATES) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: `You have reached the limit of ${PLAN_LIMITS.FREE_NOTE_TEMPLATES} note templates. Delete one to create another.`,
                });
            }

            return ctx.db.noteTemplate.create({
                data: {
                    ownerId: userId,
                    title: input.title,
                    noteStyle: input.noteStyle,
                    sections: input.sections,
                },
                select: {
                    id: true,
                    title: true,
                    noteStyle: true,
                    sections: true,
                    updatedAt: true,
                },
            });
        }),

    // ── rename ────────────────────────────────────────────────────────────────
    // Title-only rename procedure from the task contract.

    rename: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                title: z.string().min(1).max(200),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const result = await ctx.db.noteTemplate.updateMany({
                where: { id: input.id, ownerId: ctx.session.user.id },
                data: { title: input.title },
            });

            if (result.count === 0) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Note template not found.",
                });
            }

            return { success: true };
        }),

    // ── update ────────────────────────────────────────────────────────────────
    // Updates title, noteStyle, and sections for an owned template.

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                title: z.string().min(1).max(200),
                noteStyle: noteStyleSchema,
                sections: sectionsSchema,
            })
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            // Ownership check — findFirst with ownerId prevents leaking other
            // users' template IDs through timing or error messages.
            const existing = await ctx.db.noteTemplate.findFirst({
                where: { id: input.id, ownerId: userId },
                select: { id: true },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Note template not found.",
                });
            }

            return ctx.db.noteTemplate.update({
                where: { id: input.id },
                data: {
                    title: input.title,
                    noteStyle: input.noteStyle,
                    sections: input.sections,
                },
                select: {
                    id: true,
                    title: true,
                    noteStyle: true,
                    sections: true,
                    updatedAt: true,
                },
            });
        }),

    // ── delete ────────────────────────────────────────────────────────────────
    // Deletes an owned template. Uses deleteMany with ownerId so no row is
    // deleted if the caller doesn't own it (silent no-op rather than 404,
    // matching the template.delete pattern in template.ts).

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.noteTemplate.deleteMany({
                where: { id: input.id, ownerId: ctx.session.user.id },
            });
            return { success: true };
        }),
});
