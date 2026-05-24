# Formify Web App

Formify is a Next.js/T3-style web application for turning live conversations into structured forms and notes. The web app owns authentication, templates, billing, entitlements, and the user interface. Real-time audio transcription is handled by a separate WebSocket transcription server.

## What It Does

- Create reusable form templates from system blocks and Pro custom blocks.
- Start a voice session from a template and stream microphone audio to the transcription server.
- Fill form fields in real time from WebSocket `attributes_update` and `final_attributes` messages.
- Capture voice notes in Notes mode, with live markdown updates and a final polished note.
- Export completed forms locally as PDF or email the rendered form.
- Gate template, custom block, and transcription limits through plan entitlements.

## Architecture

- **Next.js app router**: pages and layouts live in `src/app`.
- **tRPC API**: routers live in `src/server/api/routers` and are mounted in `src/server/api/root.ts`.
- **Auth**: NextAuth configuration lives in `src/server/auth`.
- **Database**: Prisma models and migrations live in `prisma`; generated client output is in `generated/prisma`.
- **Billing**: Stripe checkout, portal, and webhook handling live in `src/server/billing` and `src/app/api/stripe`.
- **Entitlements**: plan feature checks live in `src/server/entitlements`.
- **Transcription server bridge**: the web app mints short-lived WS JWTs in `src/server/ws-token.ts` and sends them to `NEXT_PUBLIC_WS_URL`.

## Recording Flow

Forms mode:

1. The user opens `/transcription`, optionally with `?templateId=...`.
2. The client calls `transcription.getSessionToken` with `mode: "forms"`.
3. The server enforces auth and free-tier usage, then mints a short-lived JWT signed with `WS_TOKEN_SECRET`.
4. The browser sends `{ action: "start", mode: "forms", blocks, token }` over WebSocket.
5. Audio chunks stream as binary WebM/Opus frames.
6. The transcription server returns `started`, `attributes_update`, and `final_attributes` messages.

Notes mode follows the same token/audio flow with `mode: "notes"` and expects `notes_update` / `notes_final` messages.

## Billing And Entitlements

Free users are limited by values in `src/server/entitlements/features.ts`, including daily transcription usage and template count. Pro users receive feature flags such as unlimited templates/transcription and custom block creation. Stripe webhooks update `UserPlan` records, and request-scoped entitlement caching avoids repeated plan reads within a single request.

## Environment Variables

Required at a high level:

- `DATABASE_URL`
- `AUTH_SECRET` in production
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `WS_TOKEN_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID`
- `NEXT_PUBLIC_WS_URL`

Optional or feature-specific:

- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NOTES_IS_PRO_ONLY=true` to make Notes mode Pro-only
- `SKIP_ENV_VALIDATION=1` for build environments that intentionally skip env checks

`WS_TOKEN_SECRET` must match the secret configured on the separate transcription WebSocket server.

## Local Development

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npm run postinstall
```

Run database migrations:

```bash
npm run db:migrate
```

Seed plan data if needed:

```bash
npm run db:seed
```

Start the web app:

```bash
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run build
```

The web app expects the transcription WebSocket server to be running at `NEXT_PUBLIC_WS_URL`.
