import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import DashboardSidebar from "./DashboardSidebar";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    return (
        <div className="min-h-screen bg-[#FBFBFB] flex">
            <DashboardSidebar user={session.user} />
            <main className="flex-1 min-w-0 flex flex-col">{children}</main>
        </div>
    );
}