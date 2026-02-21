"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
    const urlError = searchParams.get("error");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(
        urlError === "CredentialsSignin" ? "Invalid email or password." : null
    );

    const handleCredentialsSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        setIsLoading(false);

        if (result?.error) {
            setError("Invalid email or password. Please try again.");
        } else {
            router.push(callbackUrl);
            router.refresh();
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        await signIn("google", { callbackUrl });
    };

    return (
        <div className="min-h-screen bg-[#FBFBFB] flex">
            {/* ── Left panel — branding ── */}
            <div className="hidden lg:flex lg:w-1/2 bg-[#2149A1] flex-col justify-between p-12 relative overflow-hidden">
                {/* Background geometric shapes */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/5"></div>
                    <div className="absolute bottom-[-40px] left-[-40px] w-96 h-96 rounded-full bg-white/5"></div>
                    <div className="absolute top-1/2 left-1/4 w-32 h-32 rounded-full bg-white/5"></div>

                    {/* Decorative mini-form cards */}
                    <div className="absolute top-24 right-12 w-40 h-48 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 transform rotate-[6deg]">
                        <div className="p-4 space-y-3">
                            <div className="h-2 bg-white/40 rounded w-3/4"></div>
                            <div className="h-8 bg-white/20 rounded border border-white/30"></div>
                            <div className="h-2 bg-white/40 rounded w-1/2"></div>
                            <div className="h-8 bg-white/20 rounded border border-white/30"></div>
                            <div className="h-8 bg-white/40 rounded mt-4"></div>
                        </div>
                    </div>
                    <div className="absolute bottom-32 right-20 w-32 h-40 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 transform rotate-[-8deg]">
                        <div className="p-3 space-y-2">
                            <div className="h-2 bg-white/40 rounded w-full"></div>
                            <div className="h-2 bg-white/30 rounded w-2/3"></div>
                            <div className="h-2 bg-white/40 rounded w-4/5"></div>
                            <div className="h-2 bg-white/30 rounded w-1/2"></div>
                            <div className="h-2 bg-white/40 rounded w-3/4"></div>
                        </div>
                    </div>
                </div>

                {/* Logo */}
                <div className="relative z-10">
                    <Link href="/">
                        <span className="text-3xl font-extrabold tracking-tight text-white italic">
                            Formify
                        </span>
                    </Link>
                </div>

                {/* Centre copy */}
                <div className="relative z-10">
                    <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                        Turn conversations into
                        <span className="block text-blue-200">structured forms.</span>
                    </h2>
                    <p className="text-blue-200 text-lg leading-relaxed max-w-md">
                        Stop typing, start talking. Formify captures every detail so you can
                        stay focused on what matters — your clients.
                    </p>
                </div>

                {/* Trust badges */}
                <div className="relative z-10 flex gap-6">
                    {["HIPAA Compliant", "Real-Time AI", "Secure & Private"].map((badge) => (
                        <div key={badge} className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                            <span className="text-blue-200 text-sm font-medium">{badge}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Right panel — form ── */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden mb-8 text-center">
                        <Link href="/">
                            <span className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#2149A1] to-[#4a72d4] text-transparent bg-clip-text italic">
                                Formify
                            </span>
                        </Link>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Welcome back</h1>
                        <p className="text-[#868C94]">
                            Don&apos;t have an account?{" "}
                            <Link href="/register" className="text-[#2149A1] font-medium hover:underline">
                                Sign up free
                            </Link>
                        </p>
                    </div>

                    {/* Error banner */}
                    {error && (
                        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Google sign-in */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading || isLoading}
                        className="w-full flex items-center justify-center gap-3 border border-slate-300 hover:border-[#2149A1] bg-white hover:bg-[#e8eef9]/30 text-slate-700 font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mb-6"
                    >
                        {isGoogleLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <GoogleIcon />
                        )}
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-[#FBFBFB] text-[#848494]">or sign in with email</span>
                        </div>
                    </div>

                    {/* Credentials form */}
                    <form onSubmit={handleCredentialsSignIn} className="space-y-5">
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

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                                    Password
                                </label>
                                <Link href="/forgot-password" className="text-sm text-[#2149A1] hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full border border-slate-300 focus:border-[#2149A1] focus:ring-2 focus:ring-[#2149A1]/20 rounded-lg px-4 py-3 pr-12 text-slate-900 placeholder-[#848494] outline-none transition-all duration-200 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#848494] hover:text-[#2149A1] transition-colors"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || isGoogleLoading}
                            className="w-full bg-[#2149A1] hover:bg-[#1a3a87] text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isLoading ? "Signing in…" : "Sign In"}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-xs text-[#848494]">
                        By signing in, you agree to our{" "}
                        <Link href="/terms" className="text-[#2149A1] hover:underline">Terms of Service</Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-[#2149A1] hover:underline">Privacy Policy</Link>.
                    </p>
                </div>
            </div>
        </div>
    );
}

/** Inline Google "G" SVG so we have no external icon dependency */
function GoogleIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
        </svg>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#FBFBFB] flex items-center justify-center">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
