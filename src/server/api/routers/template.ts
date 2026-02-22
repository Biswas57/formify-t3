import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { BlockSource, FieldType } from "../../../../generated/prisma";

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
            return ctx.db.template.create({
                data: {
                    ownerId: ctx.session.user.id,
                    name: input.name,
                    blocks: {
                        create: input.blocks.map((b) => ({
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
                        })),
                    },
                },
                include: {
                    blocks: {
                        orderBy: { order: "asc" },
                        include: { fields: { orderBy: { order: "asc" } } },
                    },
                },
            });
        }),

    update: protectedProcedure
        .input(z.object({ id: z.string() }).merge(templateBodySchema))
        .mutation(async ({ ctx, input }) => {
            // Verify ownership
            const existing = await ctx.db.template.findFirst({
                where: { id: input.id, ownerId: ctx.session.user.id },
            });
            if (!existing) throw new Error("Template not found");

            // Delete all blocks (cascades to fields) then recreate — simplest atomic approach
            await ctx.db.templateBlock.deleteMany({ where: { templateId: input.id } });

            return ctx.db.template.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    blocks: {
                        create: input.blocks.map((b) => ({
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
                        })),
                    },
                },
                include: {
                    blocks: {
                        orderBy: { order: "asc" },
                        include: { fields: { orderBy: { order: "asc" } } },
                    },
                },
            });
        }),

    duplicate: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const source = await ctx.db.template.findFirst({
                where: { id: input.id, ownerId: ctx.session.user.id },
                include: {
                    blocks: {
                        orderBy: { order: "asc" },
                        include: { fields: { orderBy: { order: "asc" } } },
                    },
                },
            });
            if (!source) throw new Error("Template not found");

            return ctx.db.template.create({
                data: {
                    ownerId: ctx.session.user.id,
                    name: `${source.name} (copy)`,
                    blocks: {
                        create: source.blocks.map((b: { title: string; sourceType: BlockSource; sourceBlockId: string | null; order: number; fields: { key: string; label: string | null; fieldType: FieldType; required: boolean; order: number }[] }) => ({
                            title: b.title,
                            sourceType: b.sourceType,
                            sourceBlockId: b.sourceBlockId,
                            order: b.order,
                            fields: {
                                create: b.fields.map((f: { key: string; label: string | null; fieldType: FieldType; required: boolean; order: number }) => ({
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