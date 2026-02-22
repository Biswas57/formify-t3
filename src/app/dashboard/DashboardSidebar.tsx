"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { FileText, User, Menu, X, LogOut } from "lucide-react";

interface SidebarUser {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

const NAV = [
    { label: "Form Bank", href: "/dashboard/formbank", icon: FileText },
    { label: "Profile", href: "/dashboard/profile", icon: User },
];

export default function DashboardSidebar({ user }: { user: SidebarUser }) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (href: string) =>
        href === "/dashboard/formbank"
            ? pathname.startsWith("/dashboard/formbank") || pathname.startsWith("/dashboard/templates")
            : pathname === href;

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-slate-200">
                <Link
                    href="/dashboard/formbank"
                    className="flex items-center gap-2.5"
                    onClick={() => setMobileOpen(false)}
                >
                    <img src="/favicon.svg" alt="Formify" className="w-8 h-8" />
                    <span className="text-xl font-bold text-gray-900">Formify</span>
                </Link>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {NAV.map(({ label, href, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive(href)
                            ? "bg-[#e8eef9] text-[#2149A1]"
                            : "text-[#868C94] hover:bg-slate-100 hover:text-slate-800"
                            }`}
                    >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                    </Link>
                ))}
            </nav>

            {/* User + sign out */}
            <div className="px-3 py-4 border-t border-slate-200">
                <div className="flex items-center gap-3 px-3 py-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-[#2149A1] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                            {user.name ?? "User"}
                        </p>
                        <p className="text-xs text-[#868C94] truncate">{user.email}</p>
                    </div>
                </div>
                <button
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#868C94] hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Sign out
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white h-screen sticky top-0">
                <SidebarContent />
            </aside>

            {/* Mobile top bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <Link href="/dashboard/formbank" className="flex items-center gap-2">
                    <img src="/favicon.svg" alt="Formify" className="w-7 h-7" />
                    <span className="font-bold text-gray-900">Formify</span>
                </Link>
                <button
                    onClick={() => setMobileOpen((v) => !v)}
                    className="p-2 text-[#868C94] hover:text-slate-800"
                >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-40">
                    <div
                        className="absolute inset-0 bg-black/20"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
                        <SidebarContent />
                    </aside>
                </div>
            )}
        </>
    );
}