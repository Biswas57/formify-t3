import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { blockRouter } from "@/server/api/routers/block";
import { templateRouter } from "@/server/api/routers/template";
import { usageRouter } from "@/server/api/routers/usage";
import { transcriptionRouter } from "./routers/transcription";
import { noteTemplateRouter } from "./routers/noteTemplate";


/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

export const appRouter = createTRPCRouter({
  template: templateRouter,
  block: blockRouter,
  usage: usageRouter,
  transcription: transcriptionRouter,
  noteTemplate: noteTemplateRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.template.list();
 *       ^? Template[]
 */
export const createCaller = createCallerFactory(appRouter);
