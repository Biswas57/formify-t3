"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { FileText, Plus, LogOut, User, ChevronDown, Mic, Menu, X, NotebookPen } from "lucide-react";

interface HeaderUser {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

const NAV = [
    { label: "My Templates", href: "/templates", icon: FileText },
    { label: "Forms", href: "/forms", icon: Mic },
    { label: "Notes", href: "/dashboard/notes", icon: NotebookPen },
    { label: "New Template", href: "/templates/new", icon: Plus },
];

export default function DashboardHeader({ user }: { user: HeaderUser }) {
    const pathname = usePathname();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isActive = (href: string) => {
        if (href === "/templates") {
            return (
                pathname === "/templates" ||
                (pathname.startsWith("/templates/") && !pathname.startsWith("/templates/new")) ||
                pathname.startsWith("/dashboard/formbank") ||
                pathname.startsWith("/dashboard/templates")
            );
        }
        if (href === "/forms") {
            return pathname.startsWith("/forms") || pathname.startsWith("/transcription");
        }
        if (href === "/templates/new") {
            return pathname.startsWith("/templates/new") || pathname.startsWith("/dashboard/create");
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

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [mobileMenuOpen]);

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
        <>
            <header className="h-16 md:h-20 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 gap-4 md:gap-8 sticky top-0 z-40 dark:border-slate-800 dark:bg-slate-950/95">
                {/* Logo */}
                <Link href="/templates" className="flex items-center gap-2 flex-shrink-0 transition-opacity active:opacity-80">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                        <Mic className="w-4 h-4 md:w-6 md:h-6 text-white" />
                    </div>
                    <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-black dark:text-slate-100">
                        Formify
                    </span>
                </Link>

                {/* Divider - desktop only */}
                <div className="hidden md:block w-px h-5 bg-slate-200 flex-shrink-0 dark:bg-slate-800" />

                {/* Nav links - desktop only */}
                <nav className="hidden md:flex items-center gap-1 flex-1">
                    {NAV.map(({ label, href, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.98] active:opacity-90 ${isActive(href)
                                ? "bg-[#e8eef9] text-[#2149A1] dark:bg-blue-500/15 dark:text-blue-200"
                                : "text-[#868C94] hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </Link>
                    ))}
                </nav>

                {/* Spacer on mobile */}
                <div className="flex-1 md:hidden" />

                {/* Profile dropdown - desktop only */}
                <div className="hidden md:block relative flex-shrink-0" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen((v) => !v)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors active:scale-95 active:opacity-80 group dark:hover:bg-slate-900"
                    >
                        {user.image ? (
                            <Image
                                src={user.image}
                                alt={user.name ?? "User"}
                                width={28}
                                height={28}
                                className="w-7 h-7 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-[#2149A1] flex items-center justify-center text-xs font-bold text-white">
                                {initials}
                            </div>
                        )}
                        <span className="text-sm text-slate-700 font-medium hidden sm:block dark:text-slate-200">
                            {user.name ?? user.email}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#868C94] transition-transform duration-150 dark:text-slate-400 ${dropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
                            <div className="px-3 py-2 border-b border-slate-100 mb-1 dark:border-slate-800">
                                <p className="text-xs font-semibold text-slate-800 truncate dark:text-slate-100">
                                    {user.name ?? "User"}
                                </p>
                                <p className="text-xs text-[#868C94] truncate dark:text-slate-400">{user.email}</p>
                            </div>
                            <Link
                                href="/dashboard/profile"
                                onClick={() => setDropdownOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors active:opacity-80 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <User className="w-3.5 h-3.5 text-[#868C94] dark:text-slate-400" />
                                Profile
                            </Link>
                            <div className="border-t border-slate-100 mt-1 pt-1 dark:border-slate-800">
                                <button
                                    onClick={() => void signOut({ callbackUrl: "/" })}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors active:opacity-80 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Sign out
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Hamburger - mobile only */}
                <button
                    onClick={() => setMobileMenuOpen((v) => !v)}
                    className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-100 transition-colors active:scale-95 active:opacity-80 flex-shrink-0 dark:hover:bg-slate-900"
                    aria-label="Toggle menu"
                >
                    {mobileMenuOpen ? (
                        <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                    ) : (
                        <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                    )}
                </button>
            </header>

            {/* Mobile drawer overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-30 md:hidden cursor-pointer dark:bg-black/50"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Mobile drawer */}
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 bg-white z-30 md:hidden flex flex-col transform transition-transform duration-200 ease-in-out dark:bg-slate-950 ${mobileMenuOpen ? "translate-y-0" : "-translate-y-full"}`}
                aria-hidden={!mobileMenuOpen}
                style={{
                    visibility: mobileMenuOpen ? "visible" : "hidden",
                    transition: mobileMenuOpen
                        ? undefined
                        : "transform 200ms cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear 200ms",
                }}
            >
                {/* User info */}
                <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100 dark:border-slate-800">
                    {user.image ? (
                        <Image
                            src={user.image}
                            alt={user.name ?? "User"}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-[#2149A1] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                            {initials}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">
                                {user.name ?? "User"}
                            </p>
                        </div>
                        <p className="text-xs text-[#868C94] truncate dark:text-slate-400">{user.email}</p>
                    </div>
                </div>

                {/* Nav links */}
                <nav className="flex flex-col gap-1 px-3 py-4">
                    {NAV.map(({ label, href, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors duration-150 min-h-[52px] active:scale-[0.98] active:opacity-90 ${isActive(href)
                                ? "bg-[#e8eef9] text-[#2149A1] dark:bg-blue-500/15 dark:text-blue-200"
                                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                }`}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {label}
                        </Link>
                    ))}
                    <Link
                        href="/dashboard/profile"
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors duration-150 min-h-[52px] active:scale-[0.98] active:opacity-90 ${isActive("/dashboard/profile")
                            ? "bg-[#e8eef9] text-[#2149A1] dark:bg-blue-500/15 dark:text-blue-200"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                            }`}
                    >
                        <User className="w-5 h-5 flex-shrink-0" />
                        Profile
                    </Link>
                </nav>

                {/* Sign out at bottom */}
                <div className="mt-auto px-3 pb-8 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                        onClick={() => void signOut({ callbackUrl: "/" })}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 transition-colors active:scale-[0.98] active:opacity-90 min-h-[52px] dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" />
                        Sign out
                    </button>
                </div>
            </div>
        </>
    );
}
