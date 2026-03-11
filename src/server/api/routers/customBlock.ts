import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { requireFeature, FEATURES } from "@/server/entitlements";

const fieldDefSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    fieldType: z.enum(["TEXT", "NUMBER", "DATE", "EMAIL", "PHONE", "TEXTAREA", "SELECT"]),
    required: z.boolean().default(false),
});

export const customBlockRouter = createTRPCRouter({
    /**
     * List all custom blocks owned by the current user.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
        const blocks = await ctx.db.customBlock.findMany({
            where: { ownerId: ctx.session.user.id },
            orderBy: { createdAt: "desc" },
        });

        return blocks.map((block) => ({
            ...block,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            fields: JSON.parse(block.fieldsJson),
        }));
    }),

    /**
     * Create a new custom block (PRO-only).
     */
    create: protectedProcedure
        .input(
            z.object({
                title: z.string().min(1).max(200),
                description: z.string().optional(),
                fields: z.array(fieldDefSchema).min(1),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Enforce PRO feature requirement
            await requireFeature(ctx.session.user.id, ctx.entitlementsCache, FEATURES.CUSTOM_BLOCKS_CREATE);

            const block = await ctx.db.customBlock.create({
                data: {
                    ownerId: ctx.session.user.id,
                    title: input.title,
                    description: input.description,
                    fieldsJson: JSON.stringify(input.fields),
                },
            });

            return {
                ...block,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                fields: JSON.parse(block.fieldsJson),
            };
        }),

    /**
     * Delete a custom block (PRO-only).
     */
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Enforce PRO feature requirement
            await requireFeature(ctx.session.user.id, ctx.entitlementsCache, FEATURES.CUSTOM_BLOCKS_DELETE);

            // Verify ownership
            const block = await ctx.db.customBlock.findFirst({
                where: { id: input.id, ownerId: ctx.session.user.id },
            });

            if (!block) {
                throw new Error("Custom block not found");
            }

            await ctx.db.customBlock.delete({ where: { id: input.id } });

            return { success: true };
        }),
});
