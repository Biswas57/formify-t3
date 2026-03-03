"use client";

import { X } from "lucide-react";
import { env } from "@/env";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-4xl rounded-xl bg-white shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                        <h2 className="font-semibold text-slate-900">Upgrade to Pro</h2>
                        <p className="text-sm text-[#868C94] mt-0.5">Unlock custom blocks and more</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Stripe Pricing Table */}
                <div className="px-6 py-6">
                    {/* @ts-expect-error - Stripe Pricing Table is a custom element loaded via script */}
                    <stripe-pricing-table
                        pricing-table-id={env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID}
                        publishable-key={env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
                    />
                </div>
            </div>
        </div>
    );
}
