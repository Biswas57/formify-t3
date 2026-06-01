# Decisions

Architectural and product decisions that should stay stable across tickets. Ticket history and implementation notes live in `TASKS.md`; agent workflow lives in `AI_AGENT_CONTEXT.md`.

## Architecture

### D-001 Two-service split

Formify is split into this Next.js web app and a sibling `ws-transcription` service. The web app owns auth, UI, templates, export, and WS token minting. The transcription server owns audio, Whisper, and GPT extraction. Do not change the WebSocket message contract in one repo without coordinating the other.

### D-002 Web app mints short-lived WS tokens

The browser never authenticates to the transcription server directly. Signed-in users call `transcription.getSessionToken`; the web server returns a short-lived JWT signed with `WS_TOKEN_SECRET` (shared with `ws-transcription`). The client sends that token in the WS `start` payload.

### D-003 Usage is analytics-only

`TranscriptionUsage` counts sessions at token mint time as best-effort analytics. Write/read failures must **not** block token minting or recording. Do not reintroduce plan-based or daily-limit gates on `getSessionToken` or core features.

### D-004 Forms WebSocket payload: keys only, no `corrected_audio`

On `start`, forms mode sends `{ action, mode: "forms", blocks, token }` where `blocks` maps block names to **field keys only** — never field values. The current frontend expects inbound `{ type, attributes }` updates; it does not consume `corrected_audio`. Adding corrected text requires coordinated changes in both repos.

### D-005 Notes AI transforms use HTTP on `ws-transcription`

Summarise, reorganise, and similar notes post-processing are **not** live WS protocol features. `ws-transcription` exposes authenticated HTTP transform endpoints; `formify-web` calls them from protected tRPC mutations. These transforms must not persist notes to the DB, stream audio, or change the browser WS recording contract.

### D-018 Do not stream audio before Notes session is ready

In Notes mode, client audio chunks must only be sent after the socket is open and the server confirms session readiness via `{ type: "started" }`. Readiness must reset on start, close/reconnect, and explicit reset/new-session transitions so stale state cannot leak audio into a new or unauthenticated WS session.

### D-019 Notes WebSocket exists only during recording/finalising

The Notes client does not pre-connect or keep an idle socket. It opens a WebSocket on demand when recording starts and closes it intentionally once the session ends (`notes_final`, reset, or unmount). Intentional closes must not surface an interruption banner, and the client must never auto-reconnect while idle/paused — only an explicit start/resume opens a new socket (resume continues with current `notesMarkdown`). This keeps backend idle/1006 socket churn from accumulating. Unexpected closes _during_ recording/finalising remain real failures (see D-018 readiness handling).

### D-020 Forms recording lifecycle is session-guarded

Forms mode must not leave browser microphone capture alive after backend/session failure. Local media capture stops on unexpected WS close, token/session errors, fatal session-level errors, reset, and unmount. Reset intentionally abandons the active session, invalidates the frontend session generation, and must ignore late `attributes_update` / `final_attributes` from the abandoned session.

Forms audio chunks must only be sent when the socket is open, the server has sent `{ type: "started" }`, the active session generation still matches, the UI is recording, and the blob has data. Forms and Notes both acquire microphone access before sending backend `start`; denying mic permission must not leave a started backend session open.

## Product model

### D-006 Formify is a genuinely free app

Core features (forms recording, notes recording, form templates, note templates, custom blocks, PDF/email export) are available to all signed-in users. Access is **auth-based**, not plan-based. Normal UI must not show Free/Pro tiers, pricing tables, upgrade modals, plan badges, billing cards, or paid-feature copy. Backend gates were removed before paywall UI cleanup so users do not hit `FORBIDDEN` behind a “free” surface.

### D-007 Billing schema removed; migrations retained

Stripe runtime code, billing APIs/UI, entitlement helpers, and active billing models (`Plan`, `UserPlan`, subscription fields) were removed via a dedicated migration after runtime references were gone. There are no paid subscribers to migrate. **Do not delete old migration files casually** — they are historical record only.

### D-008 Fair-use limits are not paywalls

Any future session/cost protection must be framed as reliability fair-use for the free app, not Free/Pro tiers, Stripe-backed monetisation, or feature gates.

### D-009 Donations are optional support only

Donation UI (if added) must not reintroduce subscriptions, pricing tables, upgrade prompts, or app-owned billing routes.

### D-021 Authenticated navigation target

The authenticated app navigation target is: `My Templates | Forms | Notes | New Template`.

`My Templates` is the authenticated home/dashboard for saved form templates. It should let users use/fill, edit, delete, and create form templates, and navigate to Forms or Notes. `Forms` is a first-class form filling workspace. `Notes` remains the existing notes recording/generation workspace. `New Template` creates a form template.

Canonical authenticated routes are `/templates`, `/forms`, `/templates/new`, and `/templates/[id]`. Legacy `/dashboard`, `/dashboard/formbank`, `/dashboard/create`, `/dashboard/templates/[id]`, and `/transcription` routes may remain as compatibility redirects until a later stale-route cleanup.

`/forms` must be accessible directly. With no `templateId`, it should show:

```txt
No form template selected.

Select a template to start filling a form, or create a new template first.

[Choose Template]
[+ New Template]
```

Do not auto-select the most recent template, because recording into the wrong structured form is worse than one extra click. “Use Template” / “Fill Form” from My Templates should route to `/forms?templateId=<templateId>`.

Desktop Forms should use a persistent saved-template sidebar. Mobile Forms should use a Choose Template overlay drawer similar to Notes. Template switching is allowed when idle/reset/completed, disabled while recording/finalising, and should warn before switching if the current form has filled/generated unsaved values. Stale session results must not apply after template switch/reset.

New Template remains standalone. Save should save only, stay on the page, and show saved/success state with `Use in Forms` and `Back to My Templates`. `Use in Forms` always routes to `/forms?templateId=<newTemplateId>`. Any `returnTo` support should stay simple and only affect back navigation, defaulting to My Templates.

### D-022 Form templates and note templates stay separate

Do not merge form templates and note templates. Form templates are structured field/block definitions for Forms mode. Note templates are Notes-only style + sections config and stay in the Notes sidebar/drawer.

## Domain behaviour

### D-010 Notes markdown is canonical

Notes post-processing and resume operate on the current visible `notesMarkdown` (including user edits and applied transforms). Preview-only transforms do not affect the next recording. Only explicit Apply/Replace actions update canonical notes. Resume sends canonical markdown as `currentNotesMarkdown` with `continuation: true`.

### D-011 Locked form fields are user-owned

In forms mode, fields the user manually edits are tracked as locked. AI `attributes_update` / `final_attributes` must not overwrite locked keys. Locked keys are omitted from subsequent WS `start` block lists so the server is not asked to refill user-corrected fields.

### D-012 Templates and custom blocks use `BlockDefinition`

The template builder and block library use `blockRouter` and `BlockDefinition` (`createCustom`, `listLibrary`, `deleteCustom`) with `TemplateBlock` / `BlockSource`. The legacy `CustomBlock` model and `customBlockRouter` are removed; do not reintroduce a parallel custom-block store.

## Security and privacy

### D-013 No PII or secrets in logs

Server and client operational logs must never include transcripts, notes markdown, form values, email HTML/body, reset tokens/URLs, passwords, session/auth tokens, or recipient addresses. Log safe metadata only (counts, lengths, statuses, timings, generic reason codes, `error.name` where `error.message` may echo PII). Auth flows must not enumerate accounts (e.g. forgot-password always returns success).

### D-014 Email HTML is server-rendered from structured data

`/api/email` accepts `{ to, formTitle, blocks }` validated with zod and size caps. The server renders the email and HTML-escapes every dynamic value. Do not accept client-rendered `formHTML` or embed untrusted HTML.

## UI infrastructure

### D-015 Dark mode is local and class-based

Theme preference (system / light / dark) is stored in `localStorage`, applied via a class on `document.documentElement`, with a small layout bootstrap script to avoid flash. No DB persistence required for v1.

### D-016 System font stack (no build-time font fetch)

Typography uses a local system font stack in `globals.css` / Tailwind — not `next/font/google` — so production builds do not fetch fonts over the network.

### D-017 Notes max session warning model (reliability guard)

For Notes mode, frontend warns against a 120-minute maximum session length as a reliability safeguard (not monetisation). Warning UX is local wall-clock timing from recording start for the active backend recording window, not MediaRecorder chunk cadence. Resume/start creates a new backend recording window, so warning timing resets per window. If the backend finalises at the cap, UI should show the session was finalised, advise starting a new session, and confirm notes are preserved.

### D-023 PDF exports use a shared light document style

Future PDF work should use a consistent light-themed document style for Notes and Forms regardless of app theme: header, document title, metadata row, content body, section headings, footer, and page numbers.

Notes PDF source is the current visible/canonical `notesMarkdown`, including manual edits and future applied summaries/reorganisations. Notes PDFs should improve title/session heading, export date/time, note style label where available, markdown formatting, heading hierarchy, spacing, wrapped text, bullet indentation, page breaks, footer/page numbers, and light Formify branding.

Forms PDF source is the current filled form state. Forms PDFs should improve template title, export date/time, clear section/block layout, field labels and filled values, consistent empty-value handling, spacing, page breaks, footer/page numbers, and light Formify branding.

Do not add paid export branding, Pro watermarks, export paywalls, custom PDF themes, user-uploaded logos, or database persistence as part of this PDF design pass.
