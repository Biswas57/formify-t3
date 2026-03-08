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
                //
                // style-src 'unsafe-inline': required by the Stripe Pricing Table web
                // component. It injects inline styles and uses @import inside
                // constructable stylesheets (shadow DOM). There is no nonce/hash path
                // for constructable sheets — 'unsafe-inline' is the only fix Stripe
                // documents. Without it the pricing table renders blank and the browser
                // logs "Applying inline style violates CSP directive".
                //
                // frame-src *.stripe.com: the pricing table embeds payment iframes from
                // js.stripe.com and hooks.stripe.com. Without this the iframe is blocked
                // at the network level before any JS runs, producing the SecurityError.
                //
                // connect-src api.stripe.com: the pricing table web component fetches
                // plan pricing data directly from the Stripe API on the client.
                source: "/(.*)",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            // unsafe-inline + unsafe-eval needed by Next.js itself and Stripe pricing table
                            "script-src 'self' https://js.stripe.com https://va.vercel-scripts.com https://vercel.live 'unsafe-inline' 'unsafe-eval'",
                            // unsafe-inline needed by Stripe pricing table shadow DOM / constructable stylesheets
                            "style-src 'self' https://js.stripe.com https://fonts.googleapis.com 'unsafe-inline'",
                            "frame-src 'self' https://js.stripe.com https://*.stripe.com https://vercel.live",
                            // wss://* covers the NEXT_PUBLIC_WS_URL transcription WebSocket server.
                            // vitals.vercel-insights.com + va.vercel-scripts.com are Vercel Analytics/Speed Insights.
                            "connect-src 'self' https://api.stripe.com https://*.stripe.com wss: ws: https://vitals.vercel-insights.com",
                            "img-src 'self' data: https://*.stripe.com https://*.googleusercontent.com",
                            // fonts.gstatic.com: Geist font loaded via next/font/google
                            "font-src 'self' https://fonts.gstatic.com",
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