// src/app/dashboard/notes/page.tsx
//
// Notes mode gate.
//
// NOTES_IS_PRO_ONLY controls whether notes is Pro-only or open to all users.
// Set NOTES_IS_PRO_ONLY=true in your .env to activate gating without a code deploy.
// Default: false (notes is available to all users while feature is in beta).

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getUserEntitlements, hasFeature, FEATURES } from "@/server/entitlements";
import { createTRPCContext } from "@/server/api/trpc";
import { headers } from "next/headers";
import NotesClient from "./NotesClient";
import NotesGate from "../_components/NotesGate";

// Feature flag: flip this to true (or set NOTES_IS_PRO_ONLY=true env) to gate notes
const NOTES_IS_PRO_ONLY = process.env.NOTES_IS_PRO_ONLY === "true";

export const metadata = { title: "Voice Notes — Formify" };

export default async function NotesPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    // Check entitlements for the gate
    if (NOTES_IS_PRO_ONLY) {
        const ctx = await createTRPCContext({ headers: await headers() });
        const entitlements = await getUserEntitlements(session.user.id, ctx.entitlementsCache);
        const hasAccess = hasFeature(entitlements, FEATURES.NOTES_ACCESS);

        if (!hasAccess) {
            // Show a polished upgrade gate instead of a raw error
            return <NotesGate user={session.user} />;
        }
    }

    return <NotesClient user={session.user} />;
}