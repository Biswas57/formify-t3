import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // 30s global staleTime: with SSR prefetching, data arrives fresh in the
        // HTML. Without a staleTime > 0, React Query immediately treats it as
        // stale and fires a redundant client-side refetch on every mount.
        staleTime: 30 * 1000,

        // Disable window-focus refetching globally.
        //
        // Problem: refetchOnWindowFocus defaults to true, which means every
        // mounted query (entitlements, usage, template list, etc.) refires
        // whenever the user alt-tabs back to the app. In the logs this shows up
        // as repeated auth/session + entitlements.me + template.list calls at
        // 728–2029ms each, often in bursts of 3–5.
        //
        // This is the primary cause of the repeated /api/auth/session hits:
        // tRPC procedures re-validate the session cookie on each request, so
        // every refetchOnWindowFocus burst produces a matching auth round-trip.
        //
        // Queries that genuinely need fresh data on focus (e.g. usage.getToday
        // on the transcription page) should opt back in explicitly:
        //   useQuery(key, { refetchOnWindowFocus: true })
        refetchOnWindowFocus: false,
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