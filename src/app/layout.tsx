import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "next-auth/react";

import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "./_components/ThemeProvider";
import { APPEARANCE_STORAGE_KEY } from "./_components/theme";


export const metadata: Metadata = {
  title: "Formify",
  description: "Voice-powered form filling",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const themeBootstrapScript = `
(function() {
  try {
    var preference = localStorage.getItem("${APPEARANCE_STORAGE_KEY}");
    if (preference !== "system" && preference !== "light" && preference !== "dark") {
      preference = "system";
    }
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolvedDark = preference === "dark" || (preference === "system" && systemDark);
    document.documentElement.classList.toggle("dark", resolvedDark);
    document.documentElement.style.colorScheme = resolvedDark ? "dark" : "light";
  } catch (_) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <SessionProvider>
          <ThemeProvider>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </ThemeProvider>
        </SessionProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
