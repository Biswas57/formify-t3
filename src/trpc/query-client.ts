import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client.
        // 5 minutes: entitlements, block library, templates don't change mid-session.
        staleTime: 5 * 60 * 1000,
        // Prevents surprise refetches every time the user alt-tabs back.
        // Data is already fresh from SSR prefetch — no need to re-hit the DB.
        refetchOnWindowFocus: false,
        // Don't retry on error by default — fail fast and let the UI show an error state.
        retry: 1,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });