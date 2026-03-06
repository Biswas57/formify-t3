import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import DashboardHeader from "./DashboardHeader";
import { api, HydrateClient } from "@/trpc/server";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    // Prefetch entitlements server-side so DashboardHeader and TemplateBuilder
    // both read from the dehydrated cache — zero client-side waterfall for plan checks.
    void api.entitlements.me.prefetch();

    return (
        <HydrateClient>
            <div className="min-h-screen bg-[#FBFBFB] flex flex-col">
                <DashboardHeader user={session.user} />
                <main className="flex-1 min-w-0 flex flex-col">{children}</main>
            </div>
        </HydrateClient>
    );
}