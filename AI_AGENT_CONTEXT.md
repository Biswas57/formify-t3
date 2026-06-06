# AI Agent Context

## Repo Purpose

This repo is the Formify web app. It handles auth, dashboards, templates, note templates, form-filling UI, notes UI, usage analytics, PDF/Markdown export, and WebSocket token minting. Speech transcription and AI extraction run in a separate Formify `ws-transcription` server.

Formify is now free-app-first. Do not add Free/Pro distinctions, paywall gates, upgrade prompts, plan badges, pricing UI, or paid-feature copy unless the user explicitly asks.

## Connection To Transcription Server

- The browser connects to `NEXT_PUBLIC_WS_URL`.
- The web server mints short-lived WS JWTs in `src/server/ws-token.ts`.
- Tokens are signed with `WS_TOKEN_SECRET`, which must match the transcription server.
- Token minting happens through `transcription.getSessionToken` and remains auth-based.
- Notes Summarise/Reorganise calls protected `transcription.summariseNotes` / `transcription.reorganiseNotes` tRPC mutations; the web server then calls `ws-transcription` HTTP endpoints with `NOTES_TRANSFORM_SECRET`.
- Do not touch the sibling `ws-transcription` repo unless explicitly asked.

## Main Files

- `src/env.js`: env validation.
- `src/server/api/root.ts`: mounted tRPC routers.
- `src/server/api/routers/transcription.ts`: WS token minting and best-effort usage analytics.
- `src/server/api/routers/template.ts`: form template CRUD.
- `src/server/api/routers/noteTemplate.ts`: note template CRUD.
- `src/server/api/routers/block.ts`: active block library and custom block API.
- `src/server/api/routers/usage.ts`: non-blocking usage state via `getToday`.
- `src/app/forms/page.tsx`: canonical Forms route.
- `src/app/forms/FormsClient.tsx`: forms-mode recording, WebSocket UI, template sidebar, local draft restore, field locking, and form PDF export.
- `src/app/dashboard/notes/NotesClient.tsx`: notes-mode recording and WebSocket UI.
- `src/app/dashboard/notes/NoteTemplateSidebar.tsx`: saved note template UI.
- `src/app/templates/TemplateBuilder.tsx`: form template builder. New templates save in place, create only once before switching to update semantics, and expose `Use in Forms` only after a persisted template id exists.
- `src/app/templates/TemplateList.tsx`: My Templates list.
- `src/lib/pdf`: shared client-side PDF export utilities for Forms and Notes.
- `src/app/api/auth/forgot-password/route.ts`: password reset email flow; may use Resend if configured.
- `prisma/schema.prisma`: database schema.

Legacy notes:

- The old `customBlockRouter` source and the legacy `CustomBlock` model have both been removed (T-107). Active custom blocks use `BlockDefinition` via `blockRouter`.
- T3 starter `postRouter` and `LatestPost` have been removed from current source.
- Paywall-era UI components such as `NotesGate`, `UpgradeModal`, `PlanBadge`, and `BillingCard` have been removed and should not be reintroduced into normal flows.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run db:migrate
npm run db:seed
```

Build notes:

- `npm run build` runs `prisma generate` first.
- Prisma generation can change generated files with local absolute paths; avoid committing generated churn unless intentional.
- Fonts use a local system font stack (no `next/font/google`), so the build does not fetch fonts over the network (T-111).

## Env Vars

Required for normal app usage:

- `AUTH_SECRET` in production
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `DATABASE_URL`
- `NODE_ENV`
- `WS_TOKEN_SECRET`
- `NOTES_TRANSFORM_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WS_URL`

Optional or feature-specific:

- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `NOTES_TRANSFORM_URL` when the notes transform HTTP origin cannot be derived from `NEXT_PUBLIC_WS_URL`
- `RESEND_API_KEY` for password reset email delivery
- `EMAIL_FROM` for the password reset sender address
- `SKIP_ENV_VALIDATION=1`

## Free-App Model

Core features are available to signed-in users:

- forms recording
- notes recording
- form templates
- note templates
- custom blocks
- PDF/Markdown export

Do not block these features based on plan, usage, subscription, Stripe config, or old entitlement flags. Usage tracking is analytics-only and must not block recording.

Billing runtime code, Stripe env vars, and active billing schema have been removed. Historical migration files remain and should not be deleted casually.

## WebSocket Contract

Token request:

```ts
api.transcription.getSessionToken.mutate({ mode: "forms" | "notes" });
```

Forms start:

```json
{
  "action": "start",
  "mode": "forms",
  "blocks": { "Block": ["field_key"] },
  "token": "<jwt>"
}
```

Notes start:

```json
{
  "action": "start",
  "mode": "notes",
  "noteStyle": "general",
  "sections": [],
  "token": "<jwt>"
}
```

Audio chunks are sent as binary WebM/Opus frames. Stop is:

```json
{ "action": "stop" }
```

Expected inbound messages from transcription server:

- Forms: `started`, `attributes_update`, `final_attributes`.
- Notes: `started`, `notes_update`, `notes_final`.
- Errors: token errors such as `missing-token` and `invalid-token`.

Current frontend form messages expect `{ type, attributes }`; `corrected_audio` is not used.

## WebSocket Lifecycle Invariants

- Local microphone capture must stop when a recording session fails, resets, closes unexpectedly, or unmounts.
- Start flows should acquire microphone access before sending backend `start` so denied mic permission does not leave a started backend session open.
- Audio chunks should only be sent after the backend confirms `{ type: "started" }` for the active session.
- Reset/new-session flows should invalidate abandoned sessions so late backend messages cannot repopulate stale UI state.
- Notes resume treats visible `notesMarkdown` as canonical and sends it as `currentNotesMarkdown` with `continuation: true`.

## Safe-Change Rules

- Work only on the requested ticket from `TASKS.md`.
- Keep diffs minimal and scoped.
- Do not change the WebSocket contract without coordinating both repos.
- Do not reintroduce billing/paywall/product-plan behavior unless explicitly requested.
- Do not edit Prisma schema/migrations unless required.
- Do not add dependencies without approval.
- Preserve existing UI design and mobile behavior.
- Keep TypeScript strict.
- Do not log tokens, transcripts, notes, form values, raw attributes, or other PII.
- Avoid generated Prisma churn.
- Treat existing worktree changes as user-owned unless clearly produced by your current task.

## Known Risks

- Historical billing migrations remain; do not delete old migrations casually.
- Fair-use session/cost limits are not implemented yet (see D-008 in `DECISIONS.md`).
- PDF exports embed the repo-owned `public/favicon.svg` mark when available and render the "Formify" wordmark as text. A separate exportable wordmark asset still does not exist.
