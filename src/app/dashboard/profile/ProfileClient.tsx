"use client";

import { useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { LogOut, User, Mail, ShieldCheck, Pencil, Lock, Trash2, Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import BillingCard from "@/app/_components/BillingCard";

interface Props {
    user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
        accounts: { provider: string }[];
    };
}

// ─── Inline API helpers ───────────────────────────────────────────────────────

async function apiPost(url: string, body: Record<string, string>) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusMsg({ type, msg }: { type: "success" | "error"; msg: string }) {
    return (
        <div className={`flex items-center gap-2 text-xs mt-2 ${type === "success" ? "text-emerald-600" : "text-red-600"}`}>
            {type === "success" ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            {msg}
        </div>
    );
}

function PasswordField({
    label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label className="block text-xs font-medium text-[#868C94] mb-1">{label}</label>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 pr-9 focus:outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 transition-all"
                />
                <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#868C94] hover:text-slate-600"
                >
                    {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
            </div>
        </div>
    );
}

// ─── Section: Change Name ─────────────────────────────────────────────────────

function ChangeNameSection({ currentName }: { currentName: string | null }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(currentName ?? "");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        setStatus(null);
        try {
            await apiPost("/api/account/update-name", { name: name.trim() });
            setStatus({ type: "success", msg: "Name updated. Refresh to see changes." });
            setOpen(false);
        } catch (e) {
            setStatus({ type: "error", msg: e instanceof Error ? e.message : "Failed to update name" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-start gap-4 px-5 md:px-6 py-4">
            <User className="w-4 h-4 text-[#868C94] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-xs text-[#868C94] mb-0.5">Full name</p>
                {open ? (
                    <div className="mt-1 space-y-2">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 transition-all"
                            placeholder="Your full name"
                        />
                        {status && <StatusMsg type={status.type} msg={status.msg} />}
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={loading || !name.trim()}
                                className="flex items-center gap-1.5 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                            >
                                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                                Save
                            </button>
                            <button
                                onClick={() => { setOpen(false); setStatus(null); setName(currentName ?? ""); }}
                                className="text-xs text-[#868C94] hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-800">{currentName ?? "—"}</p>
                        <button
                            onClick={() => setOpen(true)}
                            className="ml-3 text-[#868C94] hover:text-[#2149A1] transition-colors"
                            title="Edit name"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Section: Change Password ─────────────────────────────────────────────────

function ChangePasswordSection({ hasPassword }: { hasPassword: boolean }) {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

    const handleSave = async () => {
        if (next.length < 8) {
            setStatus({ type: "error", msg: "New password must be at least 8 characters." });
            return;
        }
        if (next !== confirm) {
            setStatus({ type: "error", msg: "Passwords do not match." });
            return;
        }
        setLoading(true);
        setStatus(null);
        try {
            await apiPost("/api/account/change-password", {
                currentPassword: current,
                newPassword: next,
            });
            setStatus({ type: "success", msg: "Password changed successfully." });
            setCurrent(""); setNext(""); setConfirm("");
            setTimeout(() => setOpen(false), 1500);
        } catch (e) {
            setStatus({ type: "error", msg: e instanceof Error ? e.message : "Failed to change password" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-start gap-4 px-5 md:px-6 py-4">
            <Lock className="w-4 h-4 text-[#868C94] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-xs text-[#868C94] mb-0.5">Password</p>
                {open ? (
                    <div className="mt-1 space-y-2">
                        {hasPassword && (
                            <PasswordField label="Current password" value={current} onChange={setCurrent} />
                        )}
                        <PasswordField label="New password" value={next} onChange={setNext} placeholder="Min 8 characters" />
                        <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} />
                        {status && <StatusMsg type={status.type} msg={status.msg} />}
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex items-center gap-1.5 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                            >
                                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                                {hasPassword ? "Change password" : "Set password"}
                            </button>
                            <button
                                onClick={() => { setOpen(false); setStatus(null); setCurrent(""); setNext(""); setConfirm(""); }}
                                className="text-xs text-[#868C94] hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-800">{hasPassword ? "••••••••" : "Not set"}</p>
                        <button
                            onClick={() => setOpen(true)}
                            className="ml-3 text-[#868C94] hover:text-[#2149A1] transition-colors"
                            title={hasPassword ? "Change password" : "Set password"}
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Section: Delete Account ──────────────────────────────────────────────────

function DeleteAccountSection() {
    const [open, setOpen] = useState(false);
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

    const handleDelete = async () => {
        if (confirm !== "DELETE") return;
        setLoading(true);
        setStatus(null);
        try {
            await apiPost("/api/account/delete", {});
            await signOut({ callbackUrl: "/" });
        } catch (e) {
            setStatus({ type: "error", msg: e instanceof Error ? e.message : "Failed to delete account" });
            setLoading(false);
        }
    };

    return (
        <div className="px-5 md:px-6 py-4">
            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-2.5 text-sm text-red-600 hover:text-red-700 transition-colors min-h-[44px]"
                >
                    <Trash2 className="w-4 h-4" />
                    Delete account
                </button>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-red-600">Delete your account</p>
                    <p className="text-xs text-slate-600">
                        This permanently deletes your account, all templates, and cancels any active subscription.
                        This action <strong>cannot be undone</strong>.
                    </p>
                    <div>
                        <label className="block text-xs font-medium text-[#868C94] mb-1">
                            Type <span className="font-mono font-bold text-slate-700">DELETE</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all"
                            placeholder="DELETE"
                        />
                    </div>
                    {status && <StatusMsg type={status.type} msg={status.msg} />}
                    <div className="flex gap-2">
                        <button
                            onClick={handleDelete}
                            disabled={confirm !== "DELETE" || loading}
                            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                        >
                            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                            Delete permanently
                        </button>
                        <button
                            onClick={() => { setOpen(false); setConfirm(""); setStatus(null); }}
                            className="text-xs text-[#868C94] hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileClient({ user }: Props) {
    const providers = user.accounts.map((a) => a.provider);
    const hasGoogle = providers.includes("google");
    const hasPassword = !!user.accounts.find((a) => a.provider === "credentials") || providers.length === 0;

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
                    <p className="text-sm text-[#868C94] mt-1">Your account details and subscription</p>
                </div>

                {/* Avatar + name card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 mb-5 flex items-center gap-4 md:gap-5">
                    {user.image ? (
                        <Image
                            src={user.image}
                            alt={user.name ?? "User"}
                            width={64}
                            height={64}
                            className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover flex-shrink-0"
                        />
                    ) : (
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#2149A1] flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                            {initials}
                        </div>
                    )}
                    <div>
                        <p className="text-lg font-semibold text-slate-900">{user.name ?? "User"}</p>
                        <p className="text-sm text-[#868C94]">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {hasGoogle && (
                                <span className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                                    <ShieldCheck className="w-3 h-3" />
                                    Google
                                </span>
                            )}
                            {(hasPassword || providers.length === 0) && (
                                <span className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                                    <ShieldCheck className="w-3 h-3" />
                                    Email
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Subscription */}
                <div className="mb-5">
                    <p className="text-xs font-semibold text-[#868C94] uppercase tracking-widest mb-3 px-1">
                        Subscription
                    </p>
                    <BillingCard userId={user.id} />
                </div>

                {/* Account details */}
                <div className="mb-5">
                    <p className="text-xs font-semibold text-[#868C94] uppercase tracking-widest mb-3 px-1">
                        Account details
                    </p>
                    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                        <ChangeNameSection currentName={user.name} />
                        <div className="flex items-center gap-4 px-5 md:px-6 py-4">
                            <Mail className="w-4 h-4 text-[#868C94] flex-shrink-0" />
                            <div>
                                <p className="text-xs text-[#868C94] mb-0.5">Email</p>
                                <p className="text-sm text-slate-800">{user.email}</p>
                            </div>
                        </div>
                        {/* Show password section for credentials users OR Google-only users who want to add a password */}
                        <ChangePasswordSection hasPassword={hasPassword} />
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
                    <DeleteAccountSection />
                </div>
            </div>
        </div>
    );
}
