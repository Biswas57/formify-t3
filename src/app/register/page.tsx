"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface PasswordStrength {
    score: number;        // 0-4
    label: string;
    color: string;
}

function checkPasswordStrength(pw: string): PasswordStrength {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    const map: PasswordStrength[] = [
        { score: 0, label: "Too short", color: "bg-red-400" },
        { score: 1, label: "Weak", color: "bg-red-400" },
        { score: 2, label: "Fair", color: "bg-yellow-400" },
        { score: 3, label: "Good", color: "bg-[#2149A1]" },
        { score: 4, label: "Strong", color: "bg-emerald-500" },
    ];
    return map[score] ?? map[0]!;
}

export default function RegisterPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const strength = checkPasswordStrength(password);
    const passwordsMatch = password && confirmPassword && password === confirmPassword;

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = (await res.json()) as { error?: string };

            if (!res.ok) {
                setError(data.error ?? "Something went wrong. Please try again.");
                setIsLoading(false);
                return;
            }

            // Auto sign-in after successful registration
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                // Registration succeeded but auto-login failed — send to login
                router.push("/login?registered=true");
            } else {
                setSuccess(true);
                setTimeout(() => router.push("/dashboard"), 1200);
            }
        } catch {
            setError("Network error. Please check your connection and try again.");
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        await signIn("google", { callbackUrl: "/dashboard" });
    };

    if (success) {
        return (
            <div className="min-h-screen bg-[#FBFBFB] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-[#e8eef9] rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-[#2149A1]" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Account created!</h2>
                    <p className="text-[#868C94]">Redirecting you to your dashboard…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FBFBFB] flex">
            {/* ── Left branding panel ── */}
            <div className="hidden lg:flex lg:w-1/2 bg-[#2149A1] flex-col justify-between p-12 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/5"></div>
                    <div className="absolute bottom-[-40px] left-[-40px] w-96 h-96 rounded-full bg-white/5"></div>

                    {/* Steps illustration */}
                    <div className="absolute top-1/2 right-8 -translate-y-1/2 space-y-4">
                        {[
                            { n: "1", label: "Create account" },
                            { n: "2", label: "Set up template" },
                            { n: "3", label: "Start recording" },
                        ].map(({ n, label }) => (
                            <div key={n} className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-3 backdrop-blur-sm border border-white/20">
                                <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {n}
                                </div>
                                <span className="text-blue-100 text-sm font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10">
                    <Link href="/">
                        <span className="text-3xl font-extrabold tracking-tight text-white italic">
                            Formify
                        </span>
                    </Link>
                </div>

                <div className="relative z-10">
                    <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                        Your first form is
                        <span className="block text-blue-200">3 steps away.</span>
                    </h2>
                    <p className="text-blue-200 text-lg leading-relaxed max-w-md">
                        Join thousands of professionals who have eliminated manual data entry
                        and improved client relationships with Formify.
                    </p>
                </div>

                <div className="relative z-10 flex gap-6">
                    {["14-day free trial", "No credit card", "Cancel anytime"].map((badge) => (
                        <div key={badge} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-300 flex-shrink-0" />
                            <span className="text-blue-200 text-sm font-medium">{badge}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Right form panel ── */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
                <div className="w-full max-w-md py-8">
                    {/* Mobile logo */}
                    <div className="lg:hidden mb-8 text-center">
                        <Link href="/">
                            <span className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#2149A1] to-[#4a72d4] text-transparent bg-clip-text italic">
                                Formify
                            </span>
                        </Link>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
                        <p className="text-[#868C94]">
                            Already have an account?{" "}
                            <Link href="/login" className="text-[#2149A1] font-medium hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Google */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading || isLoading}
                        className="w-full flex items-center justify-center gap-3 border border-slate-300 hover:border-[#2149A1] bg-white hover:bg-[#e8eef9]/30 text-slate-700 font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mb-6"
                    >
                        {isGoogleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-[#FBFBFB] text-[#848494]">or register with email</span>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleRegister} className="space-y-5">
                        {/* Full name */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Full name
                            </label>
                            <input
                                id="name"
                                type="text"
                                autoComplete="name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Jane Smith"
                                className="w-full border border-slate-300 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 rounded-lg px-4 py-3 text-slate-900 placeholder-[#848494] outline-none transition-all duration-200 bg-white"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full border border-slate-300 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 rounded-lg px-4 py-3 text-slate-900 placeholder-[#848494] outline-none transition-all duration-200 bg-white"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    className="w-full border border-slate-300 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 rounded-lg px-4 py-3 pr-12 text-slate-900 placeholder-[#848494] outline-none transition-all duration-200 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#848494] hover:text-[#2149A1] transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {/* Strength meter */}
                            {password && (
                                <div className="mt-2">
                                    <div className="flex gap-1 mb-1">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : "bg-slate-200"}`}
                                            ></div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-[#848494]">{strength.label}</p>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Confirm password
                            </label>
                            <div className="relative">
                                <input
                                    id="confirm"
                                    type={showConfirm ? "text" : "password"}
                                    autoComplete="new-password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter your password"
                                    className={`w-full border rounded-lg px-4 py-3 pr-12 text-slate-900 placeholder-[#848494] outline-none transition-all duration-200 bg-white focus:ring-2 ${confirmPassword && !passwordsMatch
                                            ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                                            : passwordsMatch
                                                ? "border-emerald-400 focus:border-emerald-400 focus:ring-emerald-200"
                                                : "border-slate-300 focus:border-[#2149A1] focus:ring-[#2149A1]/20"
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#848494] hover:text-[#2149A1] transition-colors"
                                >
                                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                {passwordsMatch && (
                                    <CheckCircle2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || isGoogleLoading}
                            className="w-full bg-[#2149A1] hover:bg-[#1a3a87] text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mt-2"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isLoading ? "Creating account…" : "Create Account"}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-[#848494]">
                        By creating an account, you agree to our{" "}
                        <Link href="/terms" className="text-[#2149A1] hover:underline">Terms of Service</Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-[#2149A1] hover:underline">Privacy Policy</Link>.
                    </p>
                </div>
            </div>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}