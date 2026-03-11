// src/app/forgot-password/page.tsx
"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { Mic, ArrowLeft, Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function ForgotPasswordForm() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = (await res.json()) as { error?: string };

            if (!res.ok) {
                setError(data.error ?? "Something went wrong. Please try again.");
            } else {
                // Always show success — don't leak whether the email exists
                setSubmitted(true);
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
                </div>
                <div className="relative z-10">
                    <Link href="/">
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                                <Mic className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-3xl font-extrabold tracking-tight text-white">Formify</span>
                        </div>
                    </Link>
                </div>
                <div className="relative z-10">
                    <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                        Reset your
                        <span className="block text-blue-200">password.</span>
                    </h2>
                    <p className="text-blue-200 text-lg leading-relaxed max-w-md">
                        Enter your email and we&apos;ll send you a link to get back into your account.
                    </p>
                </div>
                <div className="relative z-10" />
            </div>

            {/* ── Right panel ── */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden mb-8 text-center">
                        <Link href="/">
                            <div className="flex items-center gap-2.5 justify-center">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                                    <Mic className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-3xl font-extrabold tracking-tight text-black">Formify</span>
                            </div>
                        </Link>
                    </div>

                    <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[#868C94] hover:text-slate-700 mb-8 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to sign in
                    </Link>

                    {submitted ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
                            <p className="text-[#868C94] mb-6">
                                If an account exists for <strong className="text-slate-700">{email}</strong>, we&apos;ve sent a password reset link.
                            </p>
                            <p className="text-sm text-[#868C94]">
                                Didn&apos;t receive it?{" "}
                                <button
                                    onClick={() => setSubmitted(false)}
                                    className="text-[#2149A1] font-medium hover:underline"
                                >
                                    Try again
                                </button>
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8">
                                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Forgot password?</h1>
                                <p className="text-[#868C94]">
                                    No problem. Enter your email and we&apos;ll send you a reset link.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Email address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#868C94]" />
                                        <input
                                            id="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            className="w-full pl-10 pr-4 border border-slate-300 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 rounded-lg px-4 py-3 text-slate-900 placeholder-[#848494] outline-none transition-all duration-200 bg-white"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !email}
                                    className="w-full bg-[#2149A1] hover:bg-[#1a3a87] text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                                >
                                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isLoading ? "Sending…" : "Send reset link"}
                                </button>
                            </form>

                            <p className="mt-8 text-center text-sm text-[#868C94]">
                                Remember your password?{" "}
                                <Link href="/login" className="text-[#2149A1] font-medium hover:underline">
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

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#FBFBFB] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>}>
            <ForgotPasswordForm />
        </Suspense>
    );
}