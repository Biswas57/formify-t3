"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { env } from "@/env";
import { api } from "@/trpc/react";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** The logged-in user's ID — passed from the server component so UpgradeModal
     *  doesn't need useSession() and avoids a redundant /api/auth/session call. */
    userId?: string;
}

export default function UpgradeModal({ isOpen, onClose, userId }: UpgradeModalProps) {
    // Fix: render the Stripe pricing table only after mount.
    // <stripe-pricing-table> is a custom element registered by the Stripe script
    // at runtime. SSR outputs an empty unknown element; the client hydrates it
    // as a full web component — React #418 hydration mismatch. Guarding with
    // `mounted` ensures the element only ever renders on the client.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // userId is passed as a prop from the parent (server-component-derived).
    // This avoids calling useSession() here, which would trigger a redundant
    // /api/auth/session fetch every time the modal is rendered.

    // Fallback: direct Checkout if pricing table ID is missing/broken.
    const [isRedirecting, setIsRedirecting] = useState(false);
    const checkout = api.billing.createCheckoutSession.useMutation({
        onSuccess: ({ url }) => { window.location.href = url; },
        onError: (err) => { alert(err.message); setIsRedirecting(false); },
    });

    const pricingTableId = env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID;
    const publishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    // If no valid pricing table ID or user identity is available, fall back to
    // direct checkout so the server can attach metadata.userId reliably.
    const usePricingTable =
        !!pricingTableId &&
        pricingTableId.startsWith("prctbl_") &&
        !!userId;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-4xl rounded-xl bg-white shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                        <h2 className="font-semibold text-slate-900">Upgrade to Pro</h2>
                        <p className="text-sm text-[#868C94] mt-0.5">Unlock custom blocks, unlimited templates and transcriptions</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6">
                    {!mounted ? (
                        // Skeleton while JS loads — prevents layout shift
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    ) : usePricingTable ? (
                        // Stripe Pricing Table — client-only render.
                        // client-reference-id is the Formify user ID — Stripe passes it
                        // back in checkout.session.completed as session.client_reference_id,
                        // which the webhook uses to identify the user when
                        // session.metadata.userId is absent (pricing table flow).
                        /* @ts-expect-error - Stripe Pricing Table is a custom element loaded via script */
                        <stripe-pricing-table
                            pricing-table-id={pricingTableId}
                            publishable-key={publishableKey}
                            client-reference-id={userId}
                        />
                    ) : (
                        // Fallback when pricing table isn't configured: direct checkout
                        <div className="flex flex-col items-center gap-6 py-8">
                            <div className="text-center">
                                <p className="text-xl font-bold text-slate-900 mb-1">Pro Plan — $29/month</p>
                                <ul className="text-sm text-[#868C94] space-y-1 mt-3">
                                    <li>✓ Unlimited transcriptions</li>
                                    <li>✓ Unlimited templates</li>
                                    <li>✓ Create custom blocks</li>
                                    <li>✓ Priority support</li>
                                </ul>
                            </div>
                            <button
                                onClick={() => { setIsRedirecting(true); checkout.mutate(); }}
                                disabled={isRedirecting || checkout.isPending}
                                className="flex items-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition-all"
                            >
                                {(isRedirecting || checkout.isPending) && (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                                Continue to checkout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
