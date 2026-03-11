// src/app/dashboard/_components/NotesGate.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { NotebookPen, Sparkles, Mic, FileText, Zap } from "lucide-react";
import UpgradeModal from "@/app/dashboard/_components/UpgradeModal";

interface Props {
    user: { id?: string; name?: string | null; email?: string | null };
}

export default function NotesGate({ user }: Props) {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Sub-header */}
            <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center gap-2.5">
                <NotebookPen className="w-4 h-4 text-[#868C94]" />
                <span className="text-sm font-semibold text-slate-400">Voice Notes</span>
                <span className="text-xs bg-[#2149A1] text-white font-medium px-2 py-0.5 rounded-full">Pro</span>
            </div>

            {/* Gate content */}
            <div className="flex-1 flex items-center justify-center px-4 py-16">
                <div className="max-w-md w-full text-center">
                    {/* Icon */}
                    <div className="w-20 h-20 bg-gradient-to-br from-[#e8eef9] to-[#dce6f5] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <NotebookPen className="w-10 h-10 text-[#2149A1]" />
                    </div>

                    <div className="inline-flex items-center gap-1.5 bg-[#e8eef9] text-[#2149A1] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        Pro Feature
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 mb-3">
                        AI Voice Notes
                    </h1>
                    <p className="text-[#868C94] text-sm leading-relaxed mb-8">
                        Voice Notes converts your speech into structured, professional notes in real time — clinical SOAP notes, meeting summaries, study notes, and more.
                        Upgrade to Pro to unlock it.
                    </p>

                    {/* Feature list */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mb-8 text-left space-y-3">
                        {[
                            { icon: Mic, text: "Real-time transcription from your microphone" },
                            { icon: FileText, text: "Structured markdown notes — clinical, meeting, study, or general" },
                            { icon: Zap, text: "Live updates as you speak, final polish when done" },
                            { icon: NotebookPen, text: "Download as .md or copy to clipboard" },
                        ].map(({ icon: Icon, text }) => (
                            <div key={text} className="flex items-start gap-3">
                                <div className="w-7 h-7 bg-[#e8eef9] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Icon className="w-3.5 h-3.5 text-[#2149A1]" />
                                </div>
                                <p className="text-sm text-slate-700">{text}</p>
                            </div>
                        ))}
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => setModalOpen(true)}
                            className="flex items-center justify-center gap-2 bg-[#2149A1] hover:bg-[#1a3a87] text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                        >
                            <Sparkles className="w-4 h-4" />
                            Upgrade to Pro
                        </button>
                        <Link
                            href="/dashboard"
                            className="flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-medium px-6 py-3 rounded-xl transition-all duration-200 text-sm"
                        >
                            Back to dashboard
                        </Link>
                    </div>
                </div>
            </div>

            <UpgradeModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                userId={user.id}
            />
        </div>
    );
}