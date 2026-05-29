# AI Agent Context

## Repo Purpose

This repo is the Formify web app. It handles auth, dashboards, templates, note templates, form-filling UI, notes UI, usage analytics, PDF/email export, and WebSocket token minting. Speech transcription and AI extraction run in a separate Formify `ws-transcription` server.

Formify is now free-app-first. Do not add Free/Pro distinctions, paywall gates, upgrade prompts, plan badges, pricing UI, or paid-feature copy unless the user explicitly asks.

## Connection To Transcription Server

- The browser connects to `NEXT_PUBLIC_WS_URL`.
- The web server mints short-lived WS JWTs in `src/server/ws-token.ts`.
- Tokens are signed with `WS_TOKEN_SECRET`, which must match the transcription server.
- Token minting happens through `transcription.getSessionToken` and remains auth-based.
- Do not touch the sibling `ws-transcription` repo unless explicitly asked.

## Main Files

- `src/env.js`: env validation.
- `src/server/api/root.ts`: mounted tRPC routers.
- `src/server/api/routers/transcription.ts`: WS token minting and best-effort usage analytics.
- `src/server/api/routers/template.ts`: form template CRUD.
- `src/server/api/routers/noteTemplate.ts`: note template CRUD.
- `src/server/api/routers/block.ts`: active block library and custom block API.
- `src/server/api/routers/usage.ts`: non-blocking usage state via `getToday`.
- `src/app/transcription/TranscriptionClient.tsx`: forms-mode recording and WebSocket UI.
- `src/app/dashboard/notes/NotesClient.tsx`: notes-mode recording and WebSocket UI.
- `src/app/dashboard/notes/NoteTemplateSidebar.tsx`: saved note template UI.
- `src/app/dashboard/TemplateBuilder.tsx`: template builder.
- `src/app/dashboard/formbank/TemplateList.tsx`: Form Bank list.
- `src/app/api/email/route.ts`: email export endpoint.
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
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WS_URL`

Optional or feature-specific:

- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SKIP_ENV_VALIDATION=1`

## Free-App Model

Core features are available to signed-in users:

- forms recording
- notes recording
- form templates
- note templates
- custom blocks
- PDF and email export

Do not block these features based on plan, usage, subscription, Stripe config, or old entitlement flags. Usage tracking is analytics-only and must not block recording.

Billing runtime code, Stripe env vars, and active billing schema have been removed. Historical migration files remain and should not be deleted casually.

## WebSocket Contract

Token request:

```ts
api.transcription.getSessionToken.mutate({ mode: "forms" | "notes" })
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

- Full manual smoke testing for the free-app migration is still deferred.
- Email export trusts Formify-generated `formHTML`; sanitize/escape before accepting richer or untrusted HTML.
- Historical billing migrations remain; do not delete old migrations casually.
- Some server-side logs remain for operational events; review for PII before hardening.
- Build can fail in network-restricted environments due Google Fonts.
