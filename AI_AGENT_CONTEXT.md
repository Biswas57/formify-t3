# AI Agent Context

## Repo Purpose

This repo is the Formify web app. It handles auth, dashboards, templates, billing, entitlements, form-filling UI, notes UI, usage tracking, and PDF/email export. Speech transcription and AI extraction run in a separate Formify WebSocket transcription server.

## Connection To Transcription Server

- The browser connects to `NEXT_PUBLIC_WS_URL`.
- The web server mints short-lived WS JWTs in `src/server/ws-token.ts`.
- Tokens are signed with `WS_TOKEN_SECRET`, which must match the transcription server.
- Token minting happens through `transcription.getSessionToken` and is the auth/usage gate.
- Do not touch the sibling `ws-transcription` repo unless explicitly asked.

## Main Files

- `src/env.js`: env validation.
- `src/server/api/root.ts`: mounted tRPC routers.
- `src/server/api/routers/transcription.ts`: WS token minting and free-tier usage enforcement.
- `src/server/api/routers/template.ts`: template CRUD and free-template limits.
- `src/server/api/routers/block.ts`: active block library and custom block API.
- `src/server/api/routers/usage.ts`: usage display; `recordSession` is legacy.
- `src/server/entitlements/*`: plan features and entitlement checks.
- `src/server/billing/stripe.ts`: Stripe checkout and portal helpers.
- `src/app/api/stripe/webhook/route.ts`: subscription webhook handling.
- `src/app/transcription/TranscriptionClient.tsx`: forms-mode recording and WebSocket UI.
- `src/app/dashboard/notes/NotesClient.tsx`: notes-mode recording and WebSocket UI.
- `src/app/dashboard/TemplateBuilder.tsx`: template builder.
- `src/app/dashboard/formbank/TemplateList.tsx`: Form Bank list.
- `src/app/api/email/route.ts`: email export endpoint.
- `prisma/schema.prisma`: database schema.

Legacy notes:

- `src/server/api/routers/customBlock.ts` is unmounted legacy code for the old `CustomBlock` model.
- T3 starter `postRouter` and `LatestPost` have been removed from current source.

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
- `next/font` may need network access to fetch Google Fonts during production build.

## Env Vars

Validated in `src/env.js`:

- `AUTH_SECRET` required in production.
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `DATABASE_URL`
- `NODE_ENV`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `WS_TOKEN_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID`
- `NEXT_PUBLIC_WS_URL`

Optional or direct-use vars:

- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NOTES_IS_PRO_ONLY=true`
- `SKIP_ENV_VALIDATION=1`

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
- Do not change billing or entitlement behavior unless explicitly requested.
- Do not edit Prisma schema/migrations unless required.
- Do not add dependencies without approval.
- Preserve existing UI design and mobile behavior.
- Keep TypeScript strict.
- Do not log tokens, transcripts, notes, form values, raw attributes, or other PII.
- Avoid generated Prisma churn.
- Treat existing worktree changes as user-owned unless clearly produced by your current task.

## Known Risks

- Email export trusts Formify-generated `formHTML`; sanitize/escape before accepting richer or untrusted HTML.
- `customBlockRouter` and `CustomBlock` model appear legacy but need migration review before removal.
- `usage.recordSession` is legacy and should be removed only after older clients are ruled out.
- Some server-side logs remain for operational events; review for PII before hardening.
- Build can fail in network-restricted environments due Google Fonts.
