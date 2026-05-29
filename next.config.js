/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
    images: {
        remotePatterns: [
            {
                // Google OAuth profile pictures (lh3.googleusercontent.com)
                protocol: "https",
                hostname: "**.googleusercontent.com",
            },
        ],
    },

    async headers() {
        return [
            {
                // Apply to all routes.
                source: "/(.*)",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            // unsafe-inline + unsafe-eval needed by Next.js itself.
                            "script-src 'self' https://va.vercel-scripts.com https://vercel.live 'unsafe-inline' 'unsafe-eval'",
                            "style-src 'self' 'unsafe-inline'",
                            "frame-src 'self' https://vercel.live",
                            // wss://* covers the NEXT_PUBLIC_WS_URL transcription WebSocket server.
                            // vitals.vercel-insights.com + va.vercel-scripts.com are Vercel Analytics/Speed Insights.
                            "connect-src 'self' wss: ws: https://vitals.vercel-insights.com",
                            "img-src 'self' data: https://*.googleusercontent.com",
                            // Fonts are a local system font stack (T-111); no external font fetches.
                            "font-src 'self'",
                            "object-src 'none'",
                            "base-uri 'self'",
                            // Remove 'self'-only form-action so Google OAuth redirects aren't blocked
                            "form-action 'self' https://accounts.google.com",
                        ].join("; "),
                    },
                ],
            },
        ];
    },
};

export default config;
