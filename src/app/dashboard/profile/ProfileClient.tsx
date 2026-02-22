"use client";

import { signOut } from "next-auth/react";
import { LogOut, User, Mail, Calendar, FileText, ShieldCheck } from "lucide-react";

interface Props {
    user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
        createdAt: Date;
        accounts: { provider: string }[];
        _count: { templates: number };
    };
}

export default function ProfileClient({ user }: Props) {
    const providers = user.accounts.map((a) => a.provider);
    const hasCredentials = !providers.length || providers.includes("credentials");
    const hasGoogle = providers.includes("google");

    const formatDate = (d: Date) =>
        new Date(d).toLocaleDateString("en-AU", {
            day: "numeric", month: "long", year: "numeric",
        });

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
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
                    <p className="text-sm text-[#868C94] mt-1">Your account details</p>
                </div>

                {/* Avatar + name card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 mb-5 flex items-center gap-4 md:gap-5">
                    {user.image ? (
                        <img
                            src={user.image}
                            alt={user.name ?? "User"}
                            className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover flex-shrink-0"
                        />
                    ) : (
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#2149A1] flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                            {initials}
                        </div>
                    )}
                    <div>
                        <p className="text-lg font-semibold text-slate-900">
                            {user.name ?? "User"}
                        </p>
                        <p className="text-sm text-[#868C94]">{user.email}</p>
                        {(hasGoogle || hasCredentials) && (
                            <div className="flex items-center gap-2 mt-2">
                                {hasGoogle && (
                                    <span className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                                        <ShieldCheck className="w-3 h-3" />
                                        Google
                                    </span>
                                )}
                                {hasCredentials && !hasGoogle && (
                                    <span className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                                        <ShieldCheck className="w-3 h-3" />
                                        Email
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-5">
                    <div className="flex items-center gap-4 px-5 md:px-6 py-4">
                        <User className="w-4 h-4 text-[#868C94] flex-shrink-0" />
                        <div>
                            <p className="text-xs text-[#868C94] mb-0.5">Full name</p>
                            <p className="text-sm text-slate-800">{user.name ?? "—"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-5 md:px-6 py-4">
                        <Mail className="w-4 h-4 text-[#868C94] flex-shrink-0" />
                        <div>
                            <p className="text-xs text-[#868C94] mb-0.5">Email</p>
                            <p className="text-sm text-slate-800">{user.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-5 md:px-6 py-4">
                        <Calendar className="w-4 h-4 text-[#868C94] flex-shrink-0" />
                        <div>
                            <p className="text-xs text-[#868C94] mb-0.5">Member since</p>
                            <p className="text-sm text-slate-800">{formatDate(user.createdAt)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-5 md:px-6 py-4">
                        <FileText className="w-4 h-4 text-[#868C94] flex-shrink-0" />
                        <div>
                            <p className="text-xs text-[#868C94] mb-0.5">Templates created</p>
                            <p className="text-sm text-slate-800">{user._count.templates}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                    <div className="px-5 md:px-6 py-4">
                        <p className="text-xs font-semibold text-[#868C94] uppercase tracking-widest mb-3">
                            Account
                        </p>
                        <button
                            onClick={() => void signOut({ callbackUrl: "/" })}
                            className="flex items-center gap-2.5 text-sm text-slate-700 hover:text-red-600 transition-colors group min-h-[44px]"
                        >
                            <LogOut className="w-4 h-4 group-hover:text-red-500 transition-colors" />
                            Sign out
                        </button>
                    </div>
                </div>

                <p className="text-xs text-slate-400 text-center mt-8">
                    Account management features (password change, delete account) coming soon.
                </p>
            </div>
        </div>
    );
}