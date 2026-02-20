import NextAuth from "next-auth";
import { authConfig } from "./config";
import { cache } from "react";

const { handlers, auth: uncachedAuth, signIn, signOut } = NextAuth(authConfig);

/**
 * Cached version of `auth()` so React Server Components don't make
 * redundant DB/JWT calls within a single request.
 */
const auth = cache(uncachedAuth);

export { handlers, auth, signIn, signOut };