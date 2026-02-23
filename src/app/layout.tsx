import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

import { TRPCReactProvider } from "@/trpc/react";


export const metadata: Metadata = {
  title: "Formify",
  description: "Voice-powered form filling",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
