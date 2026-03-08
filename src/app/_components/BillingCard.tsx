"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Crown, Zap, AlertCircle, ExternalLink, Loader2, Calendar } from "lucide-react";
import UpgradeModal from "@/app/dashboard/_components/UpgradeModal";
import { hasFeature, FEATURES } from "@/server/entitlements/features";

export default function BillingCard() {
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const { data: entitlements, isLoading } = api.entitlements.me.useQuery(undefined, {
        staleTime: 60_000,
    });
    const { data: usage } = api.usage.getToday.useQuery(undefined, {
        staleTime: 30_000,
    });

    const createPortal = api.billing.createPortalSession.useMutation({
        onSuccess: ({ url }) => { window.location.href = url; },
        onError: (err) => { alert(err.message); setIsRedirecting(false); },
    });

    // isPro = user currently has active Pro features.
    // Using hasFeature() rather than planSlug === "pro" ensures that a canceled
    // subscription (planSlug still "pro", but features: []) is treated as Free.
    const isPro = entitlements ? hasFeature(entitlements, FEATURES.CUSTOM_BLOCKS_CREATE) : false;

    // True if the user has a subscription row at all (active or not).
    // Used to decide whether to show "Manage billing" vs "Upgrade to Pro".
    const hasSubscription = !!entitlements?.status;

    if (isLoading) {
        return (
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-center min-h-[80px]">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Header */}
                <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${isPro ? "bg-gradient-to-r from-blue-50 to-purple-50" : ""}`}>
                    <div className="flex items-center gap-2.5">
                        {isPro ? <Crown className="w-4 h-4 text-purple-600" /> : <Zap className="w-4 h-4 text-slate-400" />}
                        <div>
                            <p className="text-sm font-semibold text-slate-900">
                                {isPro ? "Pro Plan" : "Free Plan"}
                            </p>
                            {isPro && entitlements?.currentPeriodEnd && (
                                <p className="text-xs text-[#868C94] flex items-center gap-1 mt-0.5">
                                    <Calendar className="w-3 h-3" />
                                    {entitlements.status === "CANCELED" ? "Access until" : "Renews"}{" "}
                                    {new Date(entitlements.currentPeriodEnd).toLocaleDateString("en-AU", {
                                        day: "numeric", month: "long", year: "numeric",
                                    })}
                                </p>
                            )}
                        </div>
                    </div>

                    {isPro || hasSubscription ? (
                        <button
                            onClick={() => { setIsRedirecting(true); createPortal.mutate(); }}
                            disabled={isRedirecting || createPortal.isPending}
                            className="flex items-center gap-1.5 text-xs font-medium text-[#2149A1] hover:text-[#1a3a87] disabled:opacity-40 transition-colors"
                        >
                            {isRedirecting || createPortal.isPending
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <ExternalLink className="w-3 h-3" />}
                            Manage billing
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="flex items-center gap-1.5 text-xs font-medium bg-[#2149A1] text-white px-3 py-1.5 rounded-lg hover:bg-[#1a3a87] transition-colors"
                        >
                            <Crown className="w-3 h-3" />
                            Upgrade to Pro
                        </button>
                    )}
                </div>

                {/* Usage / features */}
                <div className="px-6 py-4 space-y-3">
                    {isPro ? (
                        <p className="text-xs text-[#868C94] flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-purple-500" />
                            Unlimited transcriptions, custom blocks, and templates
                        </p>
                    ) : (
                        <>
                            {/* Past subscriber who has canceled — show resubscribe prompt */}
                            {hasSubscription && !isPro && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    Your Pro subscription has ended. Resubscribe to restore access.
                                </p>
                            )}

                            {usage && (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-xs text-[#868C94]">Daily transcriptions</p>
                                        <p className="text-xs font-medium text-slate-700">
                                            {usage.count} / {usage.limit} used
                                        </p>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-300 ${usage.count >= (usage.limit ?? 3)
                                                    ? "bg-red-500"
                                                    : usage.count >= Math.ceil((usage.limit ?? 3) * 0.67)
                                                        ? "bg-amber-500"
                                                        : "bg-[#2149A1]"
                                                }`}
                                            style={{ width: `${Math.min(100, (usage.count / (usage.limit ?? 3)) * 100)}%` }}
                                        />
                                    </div>
                                    {!usage.canRecord && (
                                        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Daily limit reached — resets at midnight UTC.
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="text-xs text-[#868C94] space-y-0.5 pt-1 border-t border-slate-100">
                                <ul className="space-y-0.5 mb-1.5">
                                    <li>• {usage?.limit ?? 3} transcription sessions per day</li>
                                    <li>• Up to 10 saved templates</li>
                                    <li>• System blocks only</li>
                                </ul>
                                <button onClick={() => setShowUpgradeModal(true)} className="text-[#2149A1] font-medium hover:underline">
                                    Upgrade to Pro
                                </button>{" "}for unlimited everything + custom blocks.
                            </div>
                        </>
                    )}
                </div>
            </div>

            <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
        </>
    );
}