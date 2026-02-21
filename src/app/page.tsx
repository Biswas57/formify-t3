"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mic,
  Zap,
  Users,
  Shield,
  Clock,
  MessageSquare,
  ArrowRight,
  CheckCircle,
  Menu,
  X,
  Bell,
} from "lucide-react";

export default function HomePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFB]">
      {/* ── Header ── */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50 animate-slide-down">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 animate-fade-in">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-black">
              Formify
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 animate-fade-in-delay">
            {["about", "features", "industries"].map((section) => (
              <button
                key={section}
                onClick={() => scrollToSection(section)}
                className="text-[#868C94] hover:text-[#2149A1] capitalize transition-colors duration-300 cursor-pointer text-sm font-medium"
              >
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </button>
            ))}
            <Link href="/login">
              <button className="border border-slate-300 hover:border-[#2149A1] hover:text-[#2149A1] text-slate-700 text-sm font-medium px-4 py-1.5 rounded-md transition-all duration-300">
                Sign In
              </button>
            </Link>
            <Link href="/register">
              <button className="bg-[#2149A1] hover:bg-[#1a3a87] text-white text-sm font-medium px-4 py-1.5 rounded-md hover:scale-105 transition-all duration-300">
                Get Started
              </button>
            </Link>
          </nav>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-[#868C94] hover:text-[#2149A1] transition-colors duration-300"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4 space-y-4">
              {["about", "features", "industries"].map((section) => (
                <button
                  key={section}
                  onClick={() => scrollToSection(section)}
                  className="block w-full text-left text-[#868C94] hover:text-[#2149A1] capitalize transition-colors duration-300 py-2 text-sm font-medium"
                >
                  {section.charAt(0).toUpperCase() + section.slice(1)}
                </button>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <button className="w-full border border-slate-300 hover:border-[#2149A1] hover:text-[#2149A1] text-slate-700 font-medium py-2 rounded-md transition-all duration-300">
                    Sign In
                  </button>
                </Link>
                <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                  <button className="w-full bg-[#2149A1] hover:bg-[#1a3a87] text-white font-medium py-2 rounded-md transition-all duration-300">
                    Get Started
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="py-16 sm:py-20 md:py-32 overflow-hidden relative">
        {/* Background decorative forms */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="container mx-auto px-4 h-full relative">
            {/* Form 1 */}
            <div className="hidden sm:block absolute top-20 left-10 w-32 sm:w-40 md:w-48 h-48 sm:h-56 md:h-64 bg-white rounded-lg shadow-lg transform rotate-[-8deg] hover:scale-110 hover:rotate-[-6deg] transition-all duration-500 opacity-20 hover:opacity-30 pointer-events-auto">
              <div className="p-4 h-full">
                <div className="h-3 bg-[#e8eef9] rounded mb-3"></div>
                <div className="space-y-2">
                  <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-200 rounded w-full"></div>
                  <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                </div>
                <div className="mt-4 space-y-3">
                  {[false, false, true].map((active, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${active ? "bg-[#2149A1]" : "border border-slate-300"}`}></div>
                      <div className={`h-2 rounded ${active ? "bg-blue-200 w-24" : "bg-slate-200 w-20"}`}></div>
                    </div>
                  ))}
                  <div className="mt-6 space-y-2">
                    <div className="h-2 bg-slate-200 rounded w-full"></div>
                    <div className="h-2 bg-slate-200 rounded w-2/3"></div>
                    <div className="h-2 bg-slate-200 rounded w-4/5"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form 2 */}
            <div className="hidden sm:block absolute top-32 right-4 sm:right-8 md:right-16 w-36 sm:w-44 md:w-52 h-56 sm:h-64 md:h-72 bg-white rounded-lg shadow-lg transform rotate-[12deg] hover:scale-110 hover:rotate-[10deg] transition-all duration-500 opacity-15 hover:opacity-25 pointer-events-auto">
              <div className="p-4 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-4 h-4 bg-[#2149A1] rounded"></div>
                  <div className="h-3 bg-slate-300 rounded w-20"></div>
                </div>
                <div className="space-y-3">
                  {[
                    { labelW: "w-16", valueW: "w-full", valueBg: "bg-[#e8eef9]" },
                    { labelW: "w-20", valueW: "w-3/4", valueBg: "bg-slate-100" },
                    { labelW: "w-24", valueW: "w-1/2", valueBg: "bg-slate-100" },
                  ].map((row, i) => (
                    <div key={i} className="border-b border-slate-200 pb-1">
                      <div className={`h-2 bg-slate-200 rounded ${row.labelW} mb-1`}></div>
                      <div className={`h-3 ${row.valueBg} rounded ${row.valueW}`}></div>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-8 bg-slate-100 rounded border"></div>
                    <div className="h-8 bg-[#e8eef9] rounded border border-[#2149A1]/20"></div>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  {["w-full", "w-4/5", "w-3/4", "w-full", "w-2/3"].map((w, i) => (
                    <div key={i} className={`h-1 bg-slate-200 rounded ${w}`}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form 3 */}
            <div className="hidden sm:block absolute bottom-20 left-4 sm:left-12 md:left-20 w-32 sm:w-38 md:w-44 h-48 sm:h-54 md:h-60 bg-white rounded-lg shadow-lg transform rotate-[6deg] hover:scale-110 hover:rotate-[4deg] transition-all duration-500 opacity-20 hover:opacity-30 pointer-events-auto">
              <div className="p-4 h-full">
                <div className="border-b-2 border-[#2149A1] pb-2 mb-4">
                  <div className="h-2 bg-[#2149A1] rounded w-1/2"></div>
                </div>
                <div className="space-y-4">
                  {[
                    { dotColor: "bg-slate-400", lineColor: "bg-slate-100", lineW: "w-full" },
                    { dotColor: "bg-slate-400", lineColor: "bg-[#e8eef9]", lineW: "w-3/4" },
                    { dotColor: "bg-[#2149A1]", lineColor: "bg-slate-100", lineW: "w-4/5" },
                  ].map((row, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-1 mb-2">
                        <div className={`w-2 h-2 ${row.dotColor} rounded-full`}></div>
                        <div className="h-2 bg-slate-200 rounded w-16"></div>
                      </div>
                      <div className={`ml-3 h-2 ${row.lineColor} rounded ${row.lineW}`}></div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-2 bg-slate-50 rounded border-2 border-dashed border-slate-300">
                  <div className="text-center">
                    <div className="w-6 h-6 bg-slate-300 rounded mx-auto mb-1"></div>
                    <div className="h-1 bg-slate-300 rounded w-16 mx-auto"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-4 text-center relative z-10">
          <span className="inline-block mb-4 bg-[#e8eef9] text-[#2149A1] border border-[#2149A1]/20 text-xs sm:text-sm font-medium px-3 py-1 rounded-full animate-bounce-in">
            Voice-Powered Form Filling
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight animate-fade-up">
            Transform Speech into
            <span className="text-[#2149A1] block animate-fade-up-delay">
              Structured Data
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-[#868C94] mb-8 max-w-3xl mx-auto leading-relaxed animate-fade-up-delay-2 px-4">
            Formify streamlines form-filling by converting speech to text in real time. Eliminate
            manual data entry and connect more deeply with your clients through focused, genuine conversations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-up-delay-3 px-4">
            <Link href="/register" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto bg-[#2149A1] hover:bg-[#1a3a87] text-white text-base sm:text-lg px-6 sm:px-8 py-3 rounded-lg hover:scale-105 transition-all duration-300 group flex items-center justify-center gap-2 font-medium">
                Get Started
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
            </Link>
            <button className="w-full sm:w-auto border border-slate-300 hover:border-[#2149A1] text-slate-700 hover:text-[#2149A1] text-base sm:text-lg px-6 sm:px-8 py-3 rounded-lg hover:scale-105 transition-all duration-300 font-medium">
              Watch Demo
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-[#868C94] animate-fade-up-delay-4 px-4">
            {["No credit card required", "Real-time processing", "HIPAA compliant"].map((item) => (
              <div key={item} className="flex items-center gap-2 hover:text-[#2149A1] transition-colors duration-300">
                <CheckCircle className="w-4 h-4 text-[#2149A1] flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Signature */}
          <div className="absolute bottom-8 right-8 sm:bottom-12 sm:right-12 pointer-events-none z-20">
            <span
              className="text-[#2149A1]/30 font-bold italic text-2xl sm:text-3xl overflow-hidden whitespace-nowrap inline-block animate-write-signature"
              style={{ fontFamily: "cursive" }}
            >
              Formify
            </span>
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="animate-slide-right order-2 lg:order-1">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Eliminate Manual Data Entry Forever
              </h2>
              <p className="text-base sm:text-lg text-[#868C94] mb-6 leading-relaxed">
                Formify transforms tedious, manual form-filling and helps professionals connect
                more deeply with their clients through focused and genuine conversations that truly
                capture every detail.
              </p>
              <div className="space-y-4">
                {[
                  {
                    title: "Real-Time Audio Analysis",
                    desc: "Advanced algorithms process speech patterns and context in real-time",
                    delay: "animate-fade-in-up",
                  },
                  {
                    title: "Structured Data Mapping",
                    desc: "Intelligent field mapping ensures information goes exactly where it belongs",
                    delay: "animate-fade-in-up-delay",
                  },
                  {
                    title: "Effortless Client Interactions",
                    desc: "Focus on your clients while technology handles the paperwork",
                    delay: "animate-fade-in-up-delay-2",
                  },
                ].map(({ title, desc, delay }) => (
                  <div key={title} className={`flex items-start gap-3 ${delay} group`}>
                    <CheckCircle className="w-6 h-6 text-[#2149A1] mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-[#2149A1] transition-colors duration-300">
                        {title}
                      </h3>
                      <p className="text-[#868C94]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Demo Form Card */}
            <div className="bg-gradient-to-br from-[#e8eef9] to-slate-50 rounded-2xl p-4 sm:p-6 lg:p-12 animate-slide-left order-1 lg:order-2">
              <div className="bg-white rounded-xl p-3 sm:p-6 shadow-lg hover:shadow-xl transition-shadow duration-500">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#2149A1] rounded-full flex items-center justify-center">
                      <Mic className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
                    </div>
                    <div className="w-12 sm:w-16 h-1.5 sm:h-2 bg-[#e8eef9] rounded-full">
                      <div className="h-1.5 sm:h-2 bg-[#2149A1] rounded-full w-3/4 animate-pulse-wave"></div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-4 mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">Form Title</h3>
                    <h4 className="text-[#2149A1] font-medium">John&apos;s Form</h4>
                  </div>
                  {[
                    { label: "Name", value: "John Smith", anim: "animate-typing-1", cursor: "animate-cursor-1" },
                    { label: "Email", value: "john.smith@company.com", anim: "animate-typing-2", cursor: "animate-cursor-2" },
                    { label: "Phone Number", value: "(555) 123-4567", anim: "animate-typing-3", cursor: "animate-cursor-3" },
                    { label: "Address", value: "123 Main Street, New York, NY", anim: "animate-typing-4", cursor: "animate-cursor-4" },
                  ].map(({ label, value, anim, cursor }) => (
                    <div key={label} className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{label}</label>
                      <div className="border border-slate-200 rounded p-3 h-10 flex items-center bg-slate-50 relative overflow-hidden">
                        <span className={`text-sm text-slate-700 ${anim} overflow-hidden whitespace-nowrap`}>{value}</span>
                        <div className={`w-0.5 h-4 bg-[#2149A1] ${cursor} absolute`} style={{ left: "12px" }}></div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-4 mt-6 border-t border-slate-200">
                    <button className="flex-1 bg-[#2149A1] hover:bg-[#1a3a87] text-white text-sm font-medium py-2 px-4 rounded transition-colors duration-200">
                      Save as PDF
                    </button>
                    <button className="flex-1 border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-medium py-2 px-4 rounded transition-colors duration-200">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-16 sm:py-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16 animate-fade-up">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Powerful Features for Modern Professionals
            </h2>
            <p className="text-lg sm:text-xl text-[#868C94] max-w-2xl mx-auto px-4">
              Advanced technology that transforms how you capture and structure client information
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              { icon: Mic, color: "bg-emerald-100", iconColor: "text-emerald-600", title: "Real-Time Speech Recognition", desc: "Advanced voice processing converts natural speech to structured text instantly", delay: "animate-slide-up" },
              { icon: Zap, color: "bg-orange-100", iconColor: "text-orange-600", title: "WebSocket Integration", desc: "Lightning-fast real-time connections ensure seamless data flow and instant updates", delay: "animate-slide-up-delay" },
              { icon: MessageSquare, color: "bg-purple-100", iconColor: "text-purple-600", title: "Natural Dialogue Mapping", desc: "Intelligent algorithms map conversational speech into structured form fields automatically", delay: "animate-slide-up-delay-2" },
              { icon: Users, color: "bg-cyan-100", iconColor: "text-cyan-600", title: "Client-Focused Interactions", desc: "Maintain eye contact and genuine connections while forms fill themselves", delay: "animate-slide-up-delay-3" },
              { icon: Shield, color: "bg-red-100", iconColor: "text-red-600", title: "Enterprise Security", desc: "HIPAA compliant with end-to-end encryption for sensitive professional data", delay: "animate-slide-up-delay-4" },
              { icon: Clock, color: "bg-green-100", iconColor: "text-green-600", title: "Custom Form Builder", desc: "Create tailored forms for any industry with drag-and-drop simplicity", delay: "animate-slide-up-delay-5" },
            ].map(({ icon: Icon, color, iconColor, title, desc, delay }) => (
              <div key={title} className={`bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-500 hover:-translate-y-2 ${delay} group`}>
                <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-[#2149A1] transition-colors duration-300 mb-2">{title}</h3>
                <p className="text-[#868C94] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Industries ── */}
      <section id="industries" className="py-16 sm:py-20 bg-[#FBFBFB]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16 animate-fade-up">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Trusted by Professionals Across Industries
            </h2>
            <p className="text-lg sm:text-xl text-[#868C94] max-w-2xl mx-auto px-4">
              From healthcare to finance, Formify adapts to your industry&apos;s unique needs
            </p>
          </div>

          {/* Stacked paper cards */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-[320px] sm:max-w-[480px] md:max-w-[600px] h-64 sm:h-80 md:h-96 group">
              {[
                { label: "Legal", icon: Bell, color: "orange", rotate: "-15deg", left: "0px", z: 10 },
                { label: "Education", icon: MessageSquare, color: "purple", rotate: "-5deg", left: "140px", z: 20 },
                { label: "Finance", icon: Users, color: "green", rotate: "5deg", left: "280px", z: 30 },
                { label: "Healthcare", icon: Shield, color: "cyan", rotate: "15deg", left: "420px", z: 40 },
              ].map(({ label, icon: Icon, color, rotate, left, z }) => {
                const colorMap: Record<string, { bg: string; text: string; accent: string }> = {
                  orange: { bg: "bg-orange-100", text: "text-orange-600", accent: "bg-orange-200" },
                  purple: { bg: "bg-purple-100", text: "text-purple-600", accent: "bg-purple-200" },
                  green: { bg: "bg-green-100", text: "text-green-600", accent: "bg-green-200" },
                  cyan: { bg: "bg-cyan-100", text: "text-cyan-600", accent: "bg-cyan-200" },
                };
                const c = colorMap[color]!;
                return (
                  <div
                    key={label}
                    className="absolute top-10 w-64 h-80 bg-white rounded-lg shadow-xl border border-slate-200 cursor-pointer transition-all duration-500 ease-out hover:-translate-y-4"
                    style={{ transform: `rotate(${rotate})`, left, zIndex: z }}
                  >
                    <div className="p-6 h-full">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-8 h-8 ${c.bg} rounded-full flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${c.text}`} />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">{label}</h3>
                      </div>
                      <p className="text-slate-600 text-sm mb-6">
                        {label === "Legal" && "Client intake, case documentation, and consultation records with security"}
                        {label === "Education" && "Student assessments, parent conferences, and administrative documentation"}
                        {label === "Finance" && "Client onboarding, risk assessments, and financial planning documentation"}
                        {label === "Healthcare" && "Patient intake, medical histories, and consultation notes with HIPAA compliance"}
                      </p>
                      <div className="space-y-3">
                        <div className="h-2 bg-slate-200 rounded w-full"></div>
                        <div className={`h-2 ${c.accent} rounded w-3/4`}></div>
                        <div className="h-2 bg-slate-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 text-center animate-fade-up">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Ready to Transform Your Form-Filling Process?
          </h2>
          <p className="text-lg sm:text-xl text-[#868C94] mb-8 max-w-2xl mx-auto px-4">
            Join thousands of professionals who have eliminated manual data entry and improved
            client relationships with Formify.
          </p>
          <div className="max-w-md mx-auto mb-8 animate-slide-up px-4">
            <Link href="/register" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto bg-[#2149A1] hover:bg-[#1a3a87] hover:scale-105 text-white font-medium px-8 py-3 rounded-lg transition-all duration-300">
                Get Started
              </button>
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-8 text-sm text-[#868C94] px-4">
            {["✓ 14-day free trial", "✓ No setup fees", "✓ Cancel anytime", "✓ 24/7 support"].map((item) => (
              <span key={item} className="hover:text-[#2149A1] transition-colors duration-300">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-white py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-[#4a72d4] to-[#2149A1] text-transparent bg-clip-text italic block mb-4">
                Formify
              </span>
              <p className="text-slate-400">Voice-powered form filling for modern professionals.</p>
            </div>
            {[
              { title: "Product", links: ["Features", "Pricing", "Security", "Integrations"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Support", links: ["Help Center", "Documentation", "API Reference", "Status"] },
            ].map(({ title, links }) => (
              <div key={title}>
                <h3 className="font-semibold mb-4">{title}</h3>
                <ul className="space-y-2 text-slate-400">
                  {links.map((link) => (
                    <li key={link}>
                      <a href="#" className="hover:text-[#4a72d4] transition-colors duration-300">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 mt-6 sm:mt-8 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-400 text-sm">© 2025 Formify. All rights reserved.</p>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-sm text-slate-400 mt-4 md:mt-0">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                <a key={item} href="#" className="hover:text-[#4a72d4] transition-colors duration-300 text-center sm:text-left">{item}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}