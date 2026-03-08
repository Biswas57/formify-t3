import { NextResponse } from "next/server";
import { stripe } from "@/server/billing/stripe";
import { env } from "@/env";

// Cache this route for 1 hour — revalidated automatically by Next.js
export const revalidate = 3600;

export async function GET() {
    const price = await stripe.prices.retrieve(env.STRIPE_PRO_PRICE_ID);
    const amount = price.unit_amount ? price.unit_amount / 100 : null;
    const formatted = amount
        ? `$${Number.isInteger(amount) ? amount.toString() : amount.toFixed(2)}`
        : "$9.99";
    return NextResponse.json({ price: formatted });
}
