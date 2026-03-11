// src/app/reset-password/ResetPasswordClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Mic,
    Eye,
    EyeOff,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Lock,
} from "lucide-react";

interface Props {
    token: string;
}

export default function ResetPasswordClient({ token }: Props) {
    const router = useRouter();

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Inline validation — only shown after the user has started typing in each field
    const [passwordTouched, setPasswordTouched] = useState(false);
    const [confirmTouched, setConfirmTouched] = useState(false);

    const passwordTooShort = password.length > 0 && password.length < 8;
    const passwordsMismatch =
        confirm.length > 0 && password !== confirm;

    const isFormValid =
        password.length >= 8 && password === confirm;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordTouched(true);
        setConfirmTouched(true);

        if (!isFormValid) return;

        setError(null);
        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            const data = (await res.json()) as { ok?: boolean; error?: string };

            if (!res.ok) {
                setError(data.error ?? "Something went wrong. Please try again.");
            } else {
                setSuccess(true);
                // Redirect to login after a short delay so user can read the success message
                setTimeout(() => router.push("/login"), 2000);
            }
        } catch {
            setError("Network error. Please check your connection and try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FBFBFB] flex">
            {/* ── Left panel ── */}
            <div className="hidden lg:flex lg:w-1/2 bg-[#2149A1] flex-col justify-between p-12 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/5" />
                    <div className="absolute bottom-[-40px] left-[-40px] w-96 h-96 rounded-full bg-white/5" />
                    <div className="absolute top-1/2 left-1/4 w-32 h-32 rounded-full bg-white/5" />

                    {/* Decorative lock illustration */}
                    <div className="absolute top-24 right-12 w-40 h-48 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 transform rotate-[6deg] flex items-center justify-center">
                        <Lock className="w-16 h-16 text-white/40" />
                    </div>
                </div>

                {/* Logo */}
                <div className="relative z-10">
                    <Link href="/">
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                                <Mic className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-3xl font-extrabold tracking-tight text-white">
                                Formify
                            </span>
                        </div>
                    </Link>
                </div>

                {/* Centre copy */}
                <div className="relative z-10">
                    <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                        Choose a new
                        <span className="block text-blue-200">password.</span>
                    </h2>
                    <p className="text-blue-200 text-lg leading-relaxed max-w-md">
                        Pick something strong and memorable. You&apos;ll use it to sign in to
                        your Formify account.
                    </p>
                </div>

                {/* Trust badges */}
                <div className="relative z-10 flex gap-6">
                    {["Secure reset", "Encrypted storage", "One-time link"].map((badge) => (
                        <div key={badge} className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                            <span className="text-blue-200 text-sm font-medium">{badge}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Right panel ── */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden mb-8">
                        <Link href="/">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                                    <Mic className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-3xl font-extrabold tracking-tight text-black">
                                    Formify
                                </span>
                            </div>
                        </Link>
                    </div>

                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 text-sm text-[#868C94] hover:text-slate-700 mb-8 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to sign in
                    </Link>

                    {/* ── Success state ── */}
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                Password updated!
                            </h1>
                            <p className="text-[#868C94] mb-2">
                                Your password has been changed successfully.
                            </p>
                            <p className="text-sm text-[#868C94] flex items-center justify-center gap-1.5">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Redirecting to sign in…
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ── Heading ── */}
                            <div className="mb-8">
                                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                                    Choose a new password
                                </h1>
                                <p className="text-[#868C94]">Must be at least 8 characters.</p>
                            </div>

                            {/* ── API error banner ── */}
                            {error && (
                                <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p>{error}</p>
                                        {error.toLowerCase().includes("expired") && (
                                            <Link
                                                href="/forgot-password"
                                                className="font-medium underline mt-1 inline-block"
                                            >
                                                Request a new link →
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Form ── */}
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* New password */}
                                <div>
                                    <label
                                        htmlFor="password"
                                        className="block text-sm font-medium text-slate-700 mb-1.5"
                                    >
                                        New password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onBlur={() => setPasswordTouched(true)}
                                            placeholder="At least 8 characters"
                                            className={`w-full border focus:ring-2 rounded-lg px-4 py-3 pr-12 text-slate-900 placeholder-[#848494] outline-none transition-all duration-200 bg-white ${passwordTouched && passwordTooShort
                                                ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                                                : "border-slate-300 focus:border-[#2149A1] focus:ring-[#2149A1]/20"
                                                }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#848494] hover:text-[#2149A1] transition-colors"
                                            aria-label={
                                                showPassword ? "Hide password" : "Show password"
                                            }
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    {passwordTouched && passwordTooShort && (
                                        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Password must be at least 8 characters.
                                        </p>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <div>
                                    <label
                                        htmlFor="confirm"
                                        className="block text-sm font-medium text-slate-700 mb-1.5"
                                    >
                                        Confirm new password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="confirm"
                                            type={showConfirm ? "text" : "password"}
                                            autoComplete="new-password"
                                            required
                                            value={confirm}
                                            onChange={(e) => setConfirm(e.target.value)}
                                            onBlur={() => setConfirmTouched(true)}
                                            placeholder="Re-enter your password"
                                            className={`w-full border focus:ring-2 rounded-lg px-4 py-3 pr-12 text-slate-900 placeholder-[#848494] outline-none transition-all duration-200 bg-white ${confirmTouched && passwordsMismatch
                                                ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                                                : "border-slate-300 focus:border-[#2149A1] focus:ring-[#2149A1]/20"
                                                }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm((v) => !v)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#848494] hover:text-[#2149A1] transition-colors"
                                            aria-label={
                                                showConfirm ? "Hide password" : "Show password"
                                            }
                                        >
                                            {showConfirm ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    {confirmTouched && passwordsMismatch && (
                                        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Passwords do not match.
                                        </p>
                                    )}
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-[#2149A1] hover:bg-[#1a3a87] text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                                >
                                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isLoading ? "Updating…" : "Update password"}
                                </button>
                            </form>

                            <p className="mt-8 text-center text-sm text-[#868C94]">
                                Remember your password?{" "}
                                <Link
                                    href="/login"
                                    className="text-[#2149A1] font-medium hover:underline"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}