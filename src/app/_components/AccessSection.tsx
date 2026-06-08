"use client";

import Link from "next/link";
import { Blocks, CheckCircle, FileText, NotebookPen } from "lucide-react";

const INCLUDED_FEATURES = [
    {
        icon: FileText,
        title: "Voice-filled forms",
        description: "Create templates and capture structured form data from natural conversation.",
    },
    {
        icon: NotebookPen,
        title: "Structured notes",
        description: "Turn recorded sessions into organised notes that are ready to copy or export.",
    },
    {
        icon: Blocks,
        title: "Custom workflows",
        description: "Build reusable blocks and templates around the information your work needs.",
    },
];

export default function AccessSection() {
    return (
        <section id="access" className="scroll-mt-[73px] py-16 sm:py-20 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12 animate-fade-up">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#2149A1]/20 bg-[#e8eef9] px-3 py-1 text-xs font-medium text-[#2149A1] mb-4">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Free to use
                    </span>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        The Complete Formify Workflow Is Included
                    </h2>
                    <p className="text-lg text-[#868C94] max-w-2xl mx-auto">
                        Create forms, capture notes, build templates, and export documents from one focused workspace.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {INCLUDED_FEATURES.map(({ icon: Icon, title, description }, idx) => (
                        <div
                            key={title}
                            className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-up"
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            <div className="w-11 h-11 rounded-xl bg-[#e8eef9] text-[#2149A1] flex items-center justify-center mb-5">
                                <Icon className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                            <p className="text-sm leading-relaxed text-[#868C94]">{description}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-10 flex justify-center">
                    <Link href="/register">
                        <button className="bg-[#2149A1] hover:bg-[#1a3a87] text-white font-medium px-6 py-3 rounded-lg transition-all duration-300 hover:scale-105">
                            Get Started
                        </button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
