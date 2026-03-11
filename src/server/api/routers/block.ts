import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { SYSTEM_BLOCKS } from "@/server/blocks-library";
import { requireFeature, FEATURES } from "@/server/entitlements";

export const blockRouter = createTRPCRouter({
    listLibrary: protectedProcedure.query(async ({ ctx }) => {
        const userBlocks = await ctx.db.blockDefinition.findMany({
            where: { ownerId: ctx.session.user.id },
            include: { fields: { orderBy: { order: "asc" } } },
            orderBy: { createdAt: "desc" },
        });

        return {
            systemBlocks: SYSTEM_BLOCKS,
            userBlocks: userBlocks.map((b: {
                id: string; name: string;
                fields: { key: string; label: string | null; fieldType: string; required: boolean; order: number }[]
            }) => ({
                id: b.id,
                name: b.name,
                sourceType: "USER" as const,
                fields: b.fields.map((f: {
                    key: string; label: string | null; fieldType: string; required: boolean; order: number
                }) => ({
                    key: f.key,
                    label: f.label ?? f.key,
                    fieldType: f.fieldType,
                    required: f.required,
                    order: f.order,
                })),
            })),
        };
    }),

    /** Create a custom block — PRO ONLY. */
    createCustom: protectedProcedure
        .input(z.object({
            name: z.string().min(1).max(100),
            fields: z.array(z.object({
                key: z.string().min(1).max(100),
                label: z.string().max(100).optional(),
                fieldType: z.enum(["TEXT", "NUMBER", "DATE", "EMAIL", "PHONE", "TEXTAREA", "SELECT"]),
                required: z.boolean().default(false),
            })).min(1),
        }))
        .mutation(async ({ ctx, input }) => {
            // ── PRO GATE ─────────────────────────────────────────────────────
            await requireFeature(ctx.session.user.id, ctx.entitlementsCache, FEATURES.CUSTOM_BLOCKS_CREATE);

            return ctx.db.blockDefinition.create({
                data: {
                    ownerId: ctx.session.user.id,
                    name: input.name,
                    fields: {
                        create: input.fields.map((f, i) => ({
                            key: f.key,
                            label: f.label ?? f.key,
                            fieldType: f.fieldType,
                            required: f.required,
                            order: i,
                        })),
                    },
                },
                include: { fields: { orderBy: { order: "asc" } } },
            });
        }),

    /** Delete a custom block — PRO ONLY. */
    deleteCustom: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // ── PRO GATE ─────────────────────────────────────────────────────
            await requireFeature(ctx.session.user.id, ctx.entitlementsCache, FEATURES.CUSTOM_BLOCKS_DELETE);

            await ctx.db.blockDefinition.deleteMany({
                where: { id: input.id, ownerId: ctx.session.user.id },
            });
            return { success: true };
        }),
});