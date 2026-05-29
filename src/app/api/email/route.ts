import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { auth } from "@/server/auth";

const resend = new Resend(process.env.RESEND_API_KEY);

// Defensive caps to bound request size and rendered output.
const MAX_TEXT_LEN = 5000;
const MAX_FIELDS_PER_BLOCK = 200;
const MAX_BLOCKS = 100;

// The client sends structured data only. The server renders the email HTML and
// escapes every dynamic value, so untrusted/raw HTML is never accepted or sent.
const emailSchema = z.object({
    to: z.string().email().max(MAX_TEXT_LEN),
    formTitle: z.string().min(1).max(MAX_TEXT_LEN),
    blocks: z
        .array(
            z.object({
                name: z.string().max(MAX_TEXT_LEN),
                fields: z
                    .array(
                        z.object({
                            label: z.string().max(MAX_TEXT_LEN),
                            value: z.string().max(MAX_TEXT_LEN),
                        }),
                    )
                    .max(MAX_FIELDS_PER_BLOCK),
            }),
        )
        .max(MAX_BLOCKS),
});

/** Escape user-supplied text so it can never inject HTML/attributes into the email. */
function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json()) as unknown;

        // Validate shape and size. Never log the parsed body — it contains PII.
        const parsed = emailSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid email request." }, { status: 400 });
        }

        const { to, formTitle, blocks } = parsed.data;

        // Server-render the form body from structured data, escaping every value.
        const blocksHtml = blocks
            .map(
                (block) => `
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #2149A1; font-size: 14px; font-weight: 600; margin-bottom: 10px;">${escapeHtml(block.name)}</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            ${block.fields
                                .map(
                                    (field) => `
                                <tr>
                                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #6b7280; width: 40%;">${escapeHtml(field.label)}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #111827;">${escapeHtml(field.value) || "&mdash;"}</td>
                                </tr>
                            `,
                                )
                                .join("")}
                        </table>
                    </div>
                `,
            )
            .join("");

        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? "Formify <onboarding@resend.dev>",
            to: [to],
            subject: `Formify: ${formTitle}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #111827;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f9fafb;
                        }
                        .container {
                            background-color: #ffffff;
                            border-radius: 8px;
                            padding: 30px;
                            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            border-bottom: 3px solid #2149A1;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }
                        h1 { color: #2149A1; font-size: 24px; margin: 0 0 10px 0; }
                        .subtitle { color: #6b7280; font-size: 14px; margin: 0; }
                        .content { margin-top: 20px; }
                        .footer {
                            margin-top: 40px;
                            padding-top: 20px;
                            border-top: 1px solid #e5e7eb;
                            text-align: center;
                            font-size: 12px;
                            color: #9ca3af;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${escapeHtml(formTitle)}</h1>
                            <p class="subtitle">Generated by Formify on ${new Date().toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}</p>
                        </div>
                        <div class="content">
                            ${blocksHtml}
                        </div>
                        <div class="footer">
                            <p>This form was sent from Formify</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        });

        if (error) {
            // Log only the Resend error name — never log error.message (it can echo
            // the recipient address), the rendered HTML, the title, or the recipient.
            console.error("[email] Resend send failed.", { name: error.name });

            let errorMessage = "Failed to send email";
            if (error.message?.includes("domain is not verified")) {
                errorMessage =
                    "Testing mode: Only emails to @resend.dev addresses work without domain verification. " +
                    "Use \'delivered@resend.dev\' for testing, or verify your domain at https://resend.com/domains";
            } else if (error.message?.includes("API key")) {
                errorMessage =
                    "Email service not configured. Please add RESEND_API_KEY to environment variables.";
            }

            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }

        // Log only the message ID — not the recipient or subject — to avoid PII in logs.
        console.log("[email] Sent, messageId:", data?.id);

        return NextResponse.json({ success: true, messageId: data?.id });
    } catch (error) {
        // Log only the error class/message, never the request body.
        const label = error instanceof Error ? error.message : "unknown";
        console.error("[email] Internal error:", label);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
