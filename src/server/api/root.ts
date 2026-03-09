import { postRouter } from "@/server/api/routers/post";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { blockRouter } from "@/server/api/routers/block";
import { templateRouter } from "@/server/api/routers/template";
import { billingRouter } from "@/server/api/routers/billing";
import { entitlementsRouter } from "@/server/api/routers/entitlements";
import { usageRouter } from "@/server/api/routers/usage";
import { transcriptionRouter } from "./routers/transcription";


/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

export const appRouter = createTRPCRouter({
  post: postRouter,
  template: templateRouter,
  block: blockRouter,
  billing: billingRouter,
  entitlements: entitlementsRouter,
  usage: usageRouter,
  transcription: transcriptionRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);