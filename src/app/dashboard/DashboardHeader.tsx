"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { FileText, Plus, LogOut, User, ChevronDown, Mic } from "lucide-react";

interface HeaderUser {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

const NAV = [
    { label: "My Templates", href: "/dashboard/formbank", icon: FileText },
    { label: "New Template", href: "/dashboard/create", icon: Plus },
];

export default function DashboardHeader({ user }: { user: HeaderUser }) {
    const pathname = usePathname();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isActive = (href: string) => {
        if (href === "/dashboard/formbank") {
            return (
                pathname.startsWith("/dashboard/formbank") ||
                pathname.startsWith("/dashboard/templates")
            );
        }
        return pathname === href || pathname.startsWith(href);
    };

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const initials =
        user.name
            ?.split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) ??
        user.email?.[0]?.toUpperCase() ??
        "?";

    return (
        <header className="h-20 bg-white border-b border-slate-200 flex items-center px-6 gap-8 sticky top-0 z-50">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
                <div className="flex items-center gap-2.5 animate-fade-in">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                        <Mic className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-3xl font-extrabold tracking-tight text-black">
                        Formify
                    </span>
                </div>
            </Link>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 flex-shrink-0" />

            {/* Nav links */}
            <nav className="flex items-center gap-1 flex-1">
                {NAV.map(({ label, href, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive(href)
                            ? "bg-[#e8eef9] text-[#2149A1]"
                            : "text-[#868C94] hover:bg-slate-100 hover:text-slate-800"
                            }`}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                    </Link>
                ))}
            </nav>

            {/* Profile dropdown */}
            <div className="relative flex-shrink-0" ref={dropdownRef}>
                <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors group"
                >
                    {user.image ? (
                        <img
                            src={user.image}
                            alt={user.name ?? "User"}
                            className="w-7 h-7 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-[#2149A1] flex items-center justify-center text-xs font-bold text-white">
                            {initials}
                        </div>
                    )}
                    <span className="text-sm text-slate-700 font-medium hidden sm:block">
                        {user.name ?? user.email}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[#868C94] transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                        {/* User info */}
                        <div className="px-3 py-2 border-b border-slate-100 mb-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                                {user.name ?? "User"}
                            </p>
                            <p className="text-xs text-[#868C94] truncate">{user.email}</p>
                        </div>

                        <Link
                            href="/dashboard/profile"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <User className="w-3.5 h-3.5 text-[#868C94]" />
                            Profile
                        </Link>

                        <div className="border-t border-slate-100 mt-1 pt-1">
                            <button
                                onClick={() => void signOut({ callbackUrl: "/" })}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Sign out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}