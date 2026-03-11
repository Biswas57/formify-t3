import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import LandingPageClient from "./_landing/LandingPageClient";

export default async function HomePage() {
  const session = await auth();

  // Logged-in users go straight to dashboard — no need to see the marketing page.
  if (session?.user) {
    redirect("/dashboard");
  }

  return <LandingPageClient />;
}