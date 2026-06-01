# Formify Web App

Formify is a free Next.js/T3-style web application for turning live conversations into structured forms and notes. The web app owns authentication, dashboards, templates, note templates, UI, PDF/email export, and WebSocket token minting. Real-time audio transcription and AI extraction are handled by the separate Formify `ws-transcription` service.

## What It Does

- Create reusable form templates from system blocks and custom blocks.
- Start forms recording from a template and stream microphone audio to the transcription server.
- Fill form fields in real time from WebSocket `attributes_update` and `final_attributes` messages.
- Capture voice notes in Notes mode, with live markdown updates and final polished notes.
- Save note templates for title, note style, and sections.
- Export completed forms and notes locally as PDF; forms can also be emailed.

Recording, notes, form templates, note templates, and custom blocks are available to signed-in users without paid tiers.

## Architecture

- **Next.js app router**: pages and layouts live in `src/app`.
- **tRPC API**: routers live in `src/server/api/routers` and are mounted in `src/server/api/root.ts`.
- **Auth**: NextAuth configuration lives in `src/server/auth`.
- **Database**: Prisma models and migrations live in `prisma`; generated client output is in `generated/prisma`.
- **Free-app access model**: core feature access is auth-based, not plan-based.
- **Transcription server bridge**: the web app mints short-lived WS JWTs in `src/server/ws-token.ts` and sends them to `NEXT_PUBLIC_WS_URL`.

## Recording Flow

Forms mode:

1. The user opens `/transcription`, optionally with `?templateId=...`.
2. The client acquires microphone access before starting a backend session.
3. The client calls `transcription.getSessionToken` with `mode: "forms"`.
4. The server verifies the signed-in user and mints a short-lived JWT signed with `WS_TOKEN_SECRET`.
5. The browser sends `{ action: "start", mode: "forms", blocks, token }` over WebSocket.
6. Audio chunks stream as binary WebM/Opus frames only after the transcription server confirms `started`.
7. The transcription server returns `started`, `attributes_update`, and `final_attributes` messages.

Forms reset abandons the active session and ignores late attributes from the abandoned session. Unexpected recording connection loss should stop local microphone capture and leave the UI in a recoverable state.

Notes mode follows the same mic-first token/audio flow with `mode: "notes"` and expects `notes_update` / `notes_final` messages. Notes resume treats the current visible `notesMarkdown` as canonical and sends it as `currentNotesMarkdown` with `continuation: true`.

Additional manual browser/microphone checks, when needed, are tracked in `MANUAL_SMOKE_TESTS.md`.

## Free-App Model

Formify should present as a free app in normal product flows:

- No Free/Pro distinction in normal user-facing UI.
- No pricing table, upgrade prompt, billing card, plan badge, or subscription-management UI.
- No core feature should be blocked by plan state or daily usage limits.
- Billing runtime code, env vars, and active schema have been removed; historical migration files remain.

Do not reintroduce paywall logic or paid-tier copy unless explicitly requested.

## Environment Variables

Required at a high level:

- `DATABASE_URL`
- `AUTH_SECRET` in production
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `WS_TOKEN_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WS_URL`

Optional or feature-specific:

- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
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

Seed reference data if needed:

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
npm run lint
npm run build
```

The web app expects the transcription WebSocket server to be running at `NEXT_PUBLIC_WS_URL`.
