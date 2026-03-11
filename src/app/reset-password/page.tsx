// src/app/reset-password/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Mic, AlertCircle, ArrowLeft } from "lucide-react";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata: Metadata = {
    title: "Reset Password — Formify",
};

export default async function ResetPasswordPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const token = typeof params.token === "string" ? params.token.trim() : null;

    // No token in URL — show a clear error state rather than a broken form
    if (!token) {
        return (
            <div className="min-h-screen bg-[#FBFBFB] flex">
                {/* Left panel */}
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
                                <span className="text-3xl font-extrabold tracking-tight text-white">
                                    Formify
                                </span>
                            </div>
                        </Link>
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                            Reset your
                            <span className="block text-blue-200">password.</span>
                        </h2>
                    </div>
                    <div className="relative z-10" />
                </div>

                {/* Right panel — error state */}
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

                        <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-red-700 mb-1">
                                    Invalid or expired link
                                </p>
                                <p className="text-sm text-red-600">
                                    This password reset link is missing or has expired. Reset links
                                    are valid for 1 hour. Please request a new one.
                                </p>
                            </div>
                        </div>

                        <Link
                            href="/forgot-password"
                            className="inline-flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] text-white text-sm font-medium px-5 py-3 rounded-lg transition-all duration-200 hover:scale-[1.01] mb-4"
                        >
                            Request a new reset link
                        </Link>

                        <p className="text-sm text-[#868C94] mt-4">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 hover:text-slate-700 transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back to sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <ResetPasswordClient token={token} />;
}