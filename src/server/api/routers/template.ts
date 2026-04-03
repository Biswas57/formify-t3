import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { BlockSource, FieldType, PrismaClient } from "../../../../generated/prisma";
import { TRPCError } from "@trpc/server";
import { getUserEntitlements, hasFeature, FEATURES, type EntitlementsCache } from "@/server/entitlements";
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

async function enforceFreeTemplateLimit(
    userId: string,
    db: PrismaClient,
    cache: EntitlementsCache,
) {
    const entitlements = await getUserEntitlements(userId, cache);
    if (hasFeature(entitlements, FEATURES.TEMPLATES_UNLIMITED)) return;
    const count = await db.template.count({ where: { ownerId: userId } });
    if (count >= PLAN_LIMITS.FREE_TEMPLATES) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free plan is limited to ${PLAN_LIMITS.FREE_TEMPLATES} templates. Upgrade to Pro for unlimited.`,
        });
    }
}

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

// Minimal select returned after create/update — just enough for cache
// invalidation and navigation. The full nested tree is never re-read
// immediately after a write.
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

    // ── listSummary ───────────────────────────────────────────────────────────
    //
    // Lightweight query for the form bank listing page.
    //
    // The old `list` query fetched the full nested tree:
    //   templates → blocks (ordered) → fields (ordered) for every template.
    // For a user with 20 templates averaging 3 blocks × 8 fields each, that's
    // 20 + 60 + 480 = 560 rows fetched to render a list of template name cards.
    //
    // listSummary fetches only what the card UI actually renders:
    //   - id, name, updatedAt (displayed)
    //   - _count.blocks, sum of field counts via aggregation (badge)
    //
    // The field count requires a subquery but Prisma's _count on a nested
    // relation isn't directly available across two levels. We use a raw
    // aggregation via groupBy or a simple select with _count on blocks.
    // For the field total we fetch block._count.fields per template.
    //
    // This replaces the full include with a select that returns ~95% less data
    // for typical template libraries.

    listSummary: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id;

        const templates = await ctx.db.template.findMany({
            where: { ownerId: userId },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                name: true,
                updatedAt: true,
                blocks: {
                    orderBy: { order: "asc" },
                    select: {
                        // title needed: card renders up to 3 block title badges
                        title: true,
                        _count: { select: { fields: true } },
                    },
                },
            },
        });

        // Flatten into a stable client shape.
        // previewTitles: first 3 block titles for the badge row on the card.
        // blockCount / fieldCount: metadata line ("3 blocks · 12 fields").
        return templates.map((t) => ({
            id: t.id,
            name: t.name,
            updatedAt: t.updatedAt,
            blockCount: t.blocks.length,
            fieldCount: t.blocks.reduce((sum, b) => sum + b._count.fields, 0),
            previewTitles: t.blocks.slice(0, 3).map((b) => b.title),
        }));
    }),

    // ── list ─────────────────────────────────────────────────────────────────
    //
    // Full nested tree. Still used by:
    //   - TemplateBuilder (needs full field definitions to populate the editor)
    //   - Any future page that needs to render all field data
    //
    // Do NOT use this on the form bank listing page. Use listSummary instead.

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
            await enforceFreeTemplateLimit(ctx.session.user.id, ctx.db, ctx.entitlementsCache);

            return ctx.db.template.create({
                data: {
                    ownerId: ctx.session.user.id,
                    name: input.name,
                    blocks: { create: input.blocks.map(buildBlockCreate) },
                },
                select: POST_WRITE_SELECT,
            });
        }),

    update: protectedProcedure
        .input(z.object({ id: z.string() }).merge(templateBodySchema))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            const existing = await ctx.db.template.findFirst({
                where: { id: input.id, ownerId: userId },
                select: { id: true },
            });
            if (!existing) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
            }

            const [, updatedTemplate] = await ctx.db.$transaction([
                ctx.db.templateBlock.deleteMany({ where: { templateId: input.id } }),
                ctx.db.template.update({
                    where: { id: input.id },
                    data: {
                        name: input.name,
                        blocks: { create: input.blocks.map(buildBlockCreate) },
                    },
                    select: POST_WRITE_SELECT,
                }),
            ]);

            return updatedTemplate;
        }),

    duplicate: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await enforceFreeTemplateLimit(ctx.session.user.id, ctx.db, ctx.entitlementsCache);

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