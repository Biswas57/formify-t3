"use client";

import { Crown, Shield } from "lucide-react";

interface PlanBadgeProps {
    tier: "free" | "pro";
    status?: string | null;
    size?: "sm" | "md" | "lg";
    showIcon?: boolean;
}

export default function PlanBadge({ tier, status, size = "md", showIcon = true }: PlanBadgeProps) {
    const isPro = tier === "pro";

    const sizeClasses = {
        sm: "text-xs px-2 py-0.5 gap-1",
        md: "text-sm px-3 py-1 gap-1.5",
        lg: "text-base px-4 py-1.5 gap-2",
    };

    const iconSizes = {
        sm: "w-3 h-3",
        md: "w-3.5 h-3.5",
        lg: "w-4 h-4",
    };

    const statusColors: Record<string, string> = {
        ACTIVE: "bg-green-50 text-green-700 border-green-200",
        TRIALING: "bg-blue-50 text-blue-700 border-blue-200",
        PAST_DUE: "bg-amber-50 text-amber-700 border-amber-200",
        CANCELED: "bg-gray-50 text-gray-600 border-gray-200",
        INCOMPLETE: "bg-orange-50 text-orange-700 border-orange-200",
        INCOMPLETE_EXPIRED: "bg-red-50 text-red-700 border-red-200",
        UNPAID: "bg-red-50 text-red-700 border-red-200",
    };

    const planColor = isPro
        ? "bg-gradient-to-r from-[#2149A1] to-[#1a3a87] text-white border-[#2149A1]"
        : "bg-slate-100 text-slate-700 border-slate-300";

    const Icon = isPro ? Crown : Shield;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span
                className={`inline-flex items-center font-semibold rounded-full border ${planColor} ${sizeClasses[size]}`}
            >
                {showIcon && <Icon className={iconSizes[size]} />}
                {tier === "free" ? "Free" : "Pro"}
            </span>
            {status && status !== "ACTIVE" && (
                <span
                    className={`inline-flex items-center text-xs font-medium rounded-full border px-2 py-0.5 ${statusColors[status] ?? "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                >
                    {status.replace(/_/g, " ")}
                </span>
            )}
        </div>
    );
}
