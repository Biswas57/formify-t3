"use client";

import { Check, Crown, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const BASE_PLANS = [
    {
        name: "Free",
        slug: "free",
        price: "$0",
        period: "/forever",
        description: "Perfect for trying out Formify",
        icon: Zap,
        features: [
            "View templates",
            "Use basic template blocks",
            "Record transcription forms",
            "Up to 10 templates",
            "Basic support",
        ],
        highlighted: false,
    },
    {
        name: "Pro",
        slug: "pro",
        price: "$100.99", // fallback — overwritten with live Stripe price
        period: "/month",
        description: "For professionals who need more power",
        icon: Crown,
        features: [
            "Everything in Free",
            "Create custom blocks",
            "Unlimited templates",
            "Advanced transcription features",
            "Priority support",
            "API access",
        ],
        highlighted: true,
    },
];

export default function PricingSection() {
    const [proPrice, setProPrice] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/stripe/pro-price")
            .then((r) => r.json() as Promise<{ price: string }>)
            .then((data) => setProPrice(data.price))
            .catch(() => {
                /* keep fallback */
            });
    }, []);

    const plans = BASE_PLANS.map((p) =>
        p.slug === "pro" && proPrice ? { ...p, price: proPrice } : p,
    );
    return (
        <section id="pricing" className="py-16 sm:py-20 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12 animate-fade-up">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-lg text-[#868C94] max-w-2xl mx-auto">
                        Choose the plan that fits your needs. Upgrade or downgrade anytime.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                    {plans.map((plan, idx) => {
                        const Icon = plan.icon;
                        const isFreePlan = plan.slug === "free";
                        const buttonHref = isFreePlan ? "/register" : "/login";

                        return (
                            <div
                                key={plan.slug}
                                className={`relative rounded-2xl border-2 p-6 sm:p-8 transition-all duration-300 hover:shadow-xl ${plan.highlighted
                                    ? "border-[#2149A1] bg-gradient-to-br from-blue-50 to-white"
                                    : "border-slate-200 bg-white"
                                    } ${idx === 0 ? "animate-slide-in-left" : "animate-slide-in-right"}`}
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                {plan.highlighted && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#2149A1] text-white text-xs font-bold px-4 py-1 rounded-full">
                                        Most Popular
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${plan.highlighted
                                            ? "bg-gradient-to-r from-[#2149A1] to-[#1a3a87]"
                                            : "bg-slate-100"
                                            }`}
                                    >
                                        <Icon
                                            className={`w-6 h-6 ${plan.highlighted ? "text-white" : "text-slate-600"
                                                }`}
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                                        <p className="text-sm text-[#868C94]">{plan.description}</p>
                                    </div>
                                </div>

                                <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                                    <span className="text-[#868C94]">{plan.period}</span>
                                </div>

                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3">
                                            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link href={buttonHref}>
                                    <button
                                        className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 ${plan.highlighted
                                            ? "bg-[#2149A1] hover:bg-[#1a3a87] text-white hover:scale-105"
                                            : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                                            }`}
                                    >
                                        {isFreePlan ? "Get Started" : "Sign In to Upgrade"}
                                    </button>
                                </Link>
                            </div>
                        );
                    })}
                </div>

                <p className="text-center text-sm text-[#868C94] mt-8">
                    All plans include 14-day free trial • No credit card required • Cancel anytime
                </p>
            </div>
        </section>
    );
}

