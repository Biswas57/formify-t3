import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { SYSTEM_BLOCKS } from "@/server/blocks-library";
import {
    countTemplateFields,
    logPerf,
    safeJsonChars,
} from "@/server/api/perf-log";

export const blockRouter = createTRPCRouter({
    listUserBlocks: protectedProcedure.query(async ({ ctx }) => {
        const userBlocks = await ctx.db.blockDefinition.findMany({
            where: { ownerId: ctx.session.user.id },
            include: { fields: { orderBy: { order: "asc" } } },
            orderBy: { createdAt: "desc" },
        });

        const result = userBlocks.map((b: {
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
        }));

        logPerf("block.listUserBlocks", {
            blockCount: result.length,
            fieldCount: countTemplateFields({ blocks: result }),
            resultJsonChars: safeJsonChars(result),
        });

        return result;
    }),

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

    /** Create a custom block. Auth is required; ownership is set to the caller. */
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
            const baseLog = {
                fieldCount: input.fields.length,
                payloadJsonChars: safeJsonChars(input),
            };

            try {
                const result = await ctx.db.blockDefinition.create({
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

                logPerf("block.createCustom", {
                    ...baseLog,
                    status: "success",
                    resultFieldCount: result.fields.length,
                    resultJsonChars: safeJsonChars(result),
                });

                return result;
            } catch (error) {
                logPerf("block.createCustom", {
                    ...baseLog,
                    status: "error",
                    errorName: error instanceof Error ? error.name : "unknown",
                });
                throw error;
            }
        }),

    /** Delete an owned custom block. */
    deleteCustom: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.blockDefinition.deleteMany({
                where: { id: input.id, ownerId: ctx.session.user.id },
            });
            return { success: true };
        }),
});
