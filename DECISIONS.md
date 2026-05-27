# Decisions

## D-001 Separate Web App And Transcription Server

Formify keeps the Next.js web app separate from the WebSocket transcription server. This repo owns auth, templates, UI, and WS token minting. The sibling service owns audio transcription and AI extraction.

## D-002 Web App Mints Short-Lived WS Tokens

The frontend does not authenticate directly with the transcription server. It calls `transcription.getSessionToken`, which verifies the signed-in user and returns a short-lived JWT signed with `WS_TOKEN_SECRET`. Recording access is no longer blocked by free/pro usage limits.

## D-003 Usage Is Analytics-Only At Token Mint

Recording usage is counted as best-effort analytics when a WS token is minted. Usage write/read failures must not block token minting or recording. `usage.recordSession` remains only as legacy API surface.

## D-004 Current Form WS Payload Does Not Use corrected_audio

The current frontend expects form updates as `{ type, attributes }`. It does not require `corrected_audio`. Reintroducing corrected text in the WS protocol requires coordination with the transcription server and frontend consumers.

## D-005 Active Custom Blocks Use BlockDefinition

The active template builder uses `blockRouter` and `BlockDefinition`. The old `customBlockRouter` source has been removed; the `CustomBlock` model remains legacy and should not be wired back in without a product and migration decision.

## D-006 T3 Starter Post Surface Removed

The starter `postRouter` and `LatestPost` component were unused and removed to keep the active API surface focused on Formify.

## D-007 Email Export Trust Boundary Documented

Email export currently accepts Formify-generated rendered HTML. The endpoint documents this as a trust boundary; future richer or untrusted HTML sources require escaping or sanitization before sending.

## D-008 Keep WebSocket Logs PII-Safe

Client recording/WebSocket paths should not log tokens, transcript text, notes markdown, form values, raw attributes, or unknown field names. User-facing error state should carry operational feedback instead.

## D-009 NoteTemplate Schema Uses Plain Strings For noteStyle And sections

`NoteTemplate.noteStyle` is stored as a plain `String` (not a Prisma enum). The four valid values (`general`, `clinical`, `meeting`, `study`) are validated at the tRPC boundary with a Zod enum. This avoids a DB enum migration every time a new style is added.

`NoteTemplate.sections` is stored as a raw comma-separated `String`, matching the `sectionsRaw` state in `NotesClient.tsx`. No join table is used. This keeps the schema minimal and the client-side data format unchanged.

## D-010 Note Templates Initially Used A 10 Template Cap

`FREE_NOTE_TEMPLATES: 10` was added to `PLAN_LIMITS` in the initial note-template implementation. This cap is superseded by D-017 as Formify moves to the free-app model.

## D-011 Note Templates Use Sidebar/Drawer Placement

Notes templates are shown as a persistent left sidebar on desktop and a slide-in drawer from the sub-header on mobile. This keeps the main notes form unchanged, follows the dashboard mobile drawer pattern, and avoids new layout dependencies.

## D-012 Notes AI Transforms Use ws-transcription HTTP Endpoints

Notes Summarise/Reorganise are post-processing AI transforms, not live audio streaming. `ws-transcription` should own authenticated HTTP transform endpoints because it already owns OpenAI/Whisper/GPT provider and prompt logic. `formify-web` should call those endpoints from protected tRPC mutations and remain the UI/auth/orchestration layer.

These tickets should not save generated notes to the database, send audio, or change the live browser WebSocket transcription protocol.

## D-013 Formify Moves To A Free-App Model

Formify should make core features available to all signed-in users: forms recording, notes recording, form templates, note templates, and custom blocks. Free/pro plan state should no longer block normal product usage.

## D-014 Backend Access Unlock Comes Before Paywall UI Cleanup

Backend gates must be removed or bypassed before hiding upgrade UI. Otherwise users may see a free app but still hit `FORBIDDEN` errors from token minting, template creation, or custom block APIs.

## D-015 Formify Is No Longer Presented As A Billable Product

Normal product flows should not show Free/Pro distinctions, pricing gates, billing cards, plan badges, upgrade prompts, subscription-management UI, or paid-feature copy. Stripe runtime code, billing APIs, billing UI, Stripe env vars, and the active billing schema have been removed.

## D-016 Billing Schema Cleanup Used A Dedicated Migration

`Plan`, `UserPlan`, `SubscriptionStatus`, Stripe IDs, plan seed/fix scripts, and entitlement helper residue were removed through one dedicated Prisma migration after runtime references were removed. Old migration files are retained and should not be deleted casually.

## D-017 TranscriptionUsage Stays As Analytics

`TranscriptionUsage` remains for non-blocking recording analytics. Usage writes/read failures must not block token minting or recording.

## D-018 No Subscriber Migration Path Is Required

There are no existing paid subscribers, so Formify does not need a visible billing portal or subscriber migration UX during Stripe cleanup.
