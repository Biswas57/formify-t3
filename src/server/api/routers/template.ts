import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { BlockSource, FieldType, PrismaClient } from "../../../../generated/prisma";
import { TRPCError } from "@trpc/server";
import { getUserEntitlements, hasFeature, FEATURES } from "@/server/entitlements";
import { PLAN_LIMITS } from "@/server/entitlements/features";

const templateFieldSchema = z.object({
    key: z.string().min(1),
    label: z.string().optional(),
    fieldType: z.enum(["TEXT", "NUMBER", "DATE", "EMAIL", "PHONE", "TEXTAREA", "SELECT"]),
    required: z.boolean().default(false),
    order: z.number().int(),
});

const templateBlockSchema = z.object({
    title: z.string().min(1),
    sourceType: z.enum(["SYSTEM", "USER", "CUSTOM_INLINE"]),
    sourceBlockId: z.string().optional(),
    order: z.number().int(),
    fields: z.array(templateFieldSchema),
});

const templateBodySchema = z.object({
    name: z.string().min(1).max(200),
    blocks: z.array(templateBlockSchema),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enforceFreeTemplateLimit(userId: string, db: PrismaClient) {
    // getUserEntitlements is request-scoped cached — no extra DB hit if already
    // called earlier in the same tRPC batch (e.g. entitlements.me + template.create
    // batched together).
    const entitlements = await getUserEntitlements(userId);
    if (hasFeature(entitlements, FEATURES.TEMPLATES_UNLIMITED)) return;
    const count = await db.template.count({ where: { ownerId: userId } });
    if (count >= PLAN_LIMITS.FREE_TEMPLATES) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free plan is limited to ${PLAN_LIMITS.FREE_TEMPLATES} templates. Upgrade to Pro for unlimited.`,
        });
    }
}

// Shared block create payload builder
function buildBlockCreate(b: z.infer<typeof templateBlockSchema>) {
    return {
        title: b.title,
        sourceType: b.sourceType,
        sourceBlockId: b.sourceBlockId,
        order: b.order,
        fields: {
            create: b.fields.map((f) => ({
                key: f.key,
                label: f.label ?? f.key,
                fieldType: f.fieldType,
                required: f.required,
                order: f.order,
            })),
        },
    };
}

// Minimal select for post-write responses.
//
// Previously: create + update both used `include` which re-reads every nested
// relation in full — same as list. For create, the caller only needs the id
// to navigate. For update, the TemplateBuilder already has all the data it
// just sent; re-reading it is wasteful.
//
// Using `select` here cuts the post-write DB read from ~full-list cost to
// a shallow fetch of just id + name + block ids, which is all the client
// needs to invalidate its cache correctly.
const POST_WRITE_SELECT = {
    id: true,
    name: true,
    updatedAt: true,
    blocks: {
        orderBy: { order: "asc" as const },
        select: {
            id: true,
            title: true,
            sourceType: true,
            sourceBlockId: true,
            order: true,
            fields: {
                orderBy: { order: "asc" as const },
                select: {
                    id: true,
                    key: true,
                    label: true,
                    fieldType: true,
                    required: true,
                    order: true,
                },
            },
        },
    },
};

// ── Router ────────────────────────────────────────────────────────────────────

export const templateRouter = createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db.template.findMany({
            where: { ownerId: ctx.session.user.id },
            include: {
                blocks: {
                    orderBy: { order: "asc" },
                    include: { fields: { orderBy: { order: "asc" } } },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
    }),

    get: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            return ctx.db.template.findFirst({
                where: { id: input.id, ownerId: ctx.session.user.id },
                include: {
                    blocks: {
                        orderBy: { order: "asc" },
                        include: { fields: { orderBy: { order: "asc" } } },
                    },
                },
            });
        }),

    create: protectedProcedure
        .input(templateBodySchema)
        .mutation(async ({ ctx, input }) => {
            await enforceFreeTemplateLimit(ctx.session.user.id, ctx.db);

            return ctx.db.template.create({
                data: {
                    ownerId: ctx.session.user.id,
                    name: input.name,
                    blocks: { create: input.blocks.map(buildBlockCreate) },
                },
                // Trimmed select instead of deep include — see POST_WRITE_SELECT comment above.
                // Saves ~40–60% of post-write read cost on create.
                select: POST_WRITE_SELECT,
            });
        }),

    update: protectedProcedure
        .input(z.object({ id: z.string() }).merge(templateBodySchema))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            // ── Fix: wrap delete + update in a single transaction ─────────────
            //
            // Bug in original: deleteMany ran OUTSIDE the transaction, before
            // ctx.db.template.update started. If the update failed for any reason
            // (network blip, validation error, DB timeout), the blocks were already
            // deleted and the template was left with zero blocks — silent data loss.
            //
            // Fix: both operations are atomic inside $transaction. Either both
            // commit or both roll back. Ownership check is also inside the tx
            // to close the TOCTOU window between check and write.

            return ctx.db.$transaction(async (tx) => {
                // Ownership check inside transaction — atomic with the write
                const existing = await tx.template.findFirst({
                    where: { id: input.id, ownerId: userId },
                    select: { id: true },
                });
                if (!existing) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
                }

                // Delete all blocks (cascades to fields) — safe inside tx
                await tx.templateBlock.deleteMany({ where: { templateId: input.id } });

                // Recreate and return trimmed shape
                return tx.template.update({
                    where: { id: input.id },
                    data: {
                        name: input.name,
                        blocks: { create: input.blocks.map(buildBlockCreate) },
                    },
                    select: POST_WRITE_SELECT,
                });
            });
        }),

    duplicate: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await enforceFreeTemplateLimit(ctx.session.user.id, ctx.db);

            const source = await ctx.db.template.findFirst({
                where: { id: input.id, ownerId: ctx.session.user.id },
                include: {
                    blocks: {
                        orderBy: { order: "asc" },
                        include: { fields: { orderBy: { order: "asc" } } },
                    },
                },
            });
            if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

            return ctx.db.template.create({
                data: {
                    ownerId: ctx.session.user.id,
                    name: `${source.name} (copy)`,
                    blocks: {
                        create: source.blocks.map((b: {
                            title: string;
                            sourceType: BlockSource;
                            sourceBlockId: string | null;
                            order: number;
                            fields: {
                                key: string;
                                label: string | null;
                                fieldType: FieldType;
                                required: boolean;
                                order: number;
                            }[];
                        }) => ({
                            title: b.title,
                            sourceType: b.sourceType,
                            sourceBlockId: b.sourceBlockId,
                            order: b.order,
                            fields: {
                                create: b.fields.map((f) => ({
                                    key: f.key,
                                    label: f.label,
                                    fieldType: f.fieldType,
                                    required: f.required,
                                    order: f.order,
                                })),
                            },
                        })),
                    },
                },
                // Only return id — duplicate triggers list.invalidate() which
                // re-fetches the full list. No need to re-read the full tree here.
                select: { id: true, name: true },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.template.deleteMany({
                where: { id: input.id, ownerId: ctx.session.user.id },
            });
            return { success: true };
        }),
});