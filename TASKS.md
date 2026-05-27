# Tasks

## Completed

| ID | Status | Notes |
| --- | --- | --- |
| T-101 Validate WS_TOKEN_SECRET in env config | Completed | `WS_TOKEN_SECRET` is validated in `src/env.js` and documented in README/context. |
| T-102 Remove unsafe/stale recording WebSocket console logs | Completed | Noisy client-side recording/WebSocket logs were removed from forms and notes clients; useful error handling remains. |
| T-103 Confirm frontend does not expect corrected_audio | Completed | Current frontend form handling uses `{ type, attributes }`; `corrected_audio` is not referenced in source. |
| T-104 Clean stale README | Completed | README now describes the current Next.js web app, separate WS server, modes, env vars, and commands. |
| T-105 Audit/remove T3 starter leftovers | Completed | `postRouter` and `LatestPost` starter component were removed; no `api.post` references remain. |
| T-106 Review email export HTML trust boundary | Completed | Added a security TODO at `/api/email` where client-rendered `formHTML` is accepted. |
| T-112 Verify web app ↔ transcription server WebSocket contract | Completed | Verified forms/notes token modes, start payloads, stop payloads, binary WebM/Opus audio sending, handled inbound messages, no `corrected_audio` dependency, PII-safe recording logs, and useful missing/invalid token feedback. No mismatches found. |
| T-113 Protect manually corrected form fields | Completed | Manual lock/unlock styling and all-fields-locked blocking passed; mic-dependent overwrite/semantic checks remain deferred. |
| T-116 Notes PDF export | Completed | PDF export could not be smoke-tested without generated notes; follow-up T-120 tracks remaining PDF formatting polish. |
| T-114 Note templates: DB model + tRPC router | Completed | Create/list/delete and 10-template limit passed through the sidebar API path; ownership boundary remains deferred. |
| T-115 Note templates: sidebar UI in NotesClient | Completed | Desktop sidebar and mobile drawer save/select/delete flows passed; active-recording template actions remain deferred. |
| T-118 Fix notes template sidebar overflow/clutter | Completed | Removed duplicate notes sub-header text, added desktop sidebar show/hide control, and constrained template rows so long titles/sections truncate without widening the sidebar. |
| T-119 Polish notes template sidebar truncation and toggle placement | Completed | Moved desktop hide toggle into the sidebar header, kept a lightweight collapsed reopen control, and made row actions hover/focus revealed so titles/sections use more width by default. |
| T-132 Fix note template inline rename commit | Completed | Rename now commits directly on Enter and on blur, skips unchanged/blank titles without submitting, preserves typed value on failure, and refetches the template list after success. |
| T-129 Design notes AI transform integration | Completed | Decision recorded in D-012: use authenticated HTTP transform endpoints in `ws-transcription`, called by protected `formify-web` tRPC mutations. |
| T-117 Manual smoke test T-113/T-114/T-115/T-116 | Completed | Feasible smoke tests passed for form-field locking, all-fields-locked blocking, note template create/list/delete/limit, desktop sidebar, and mobile drawer. Rename issue tracked as T-132; PDF export, mic-dependent recording checks, ownership boundary, and active-recording template actions remain deferred/blocked. |
| T-124 Stripe/payment/paywall audit | Completed | Audit found hard backend gates in WS token minting, template create/duplicate, custom block CRUD, note-template creation, optional NotesGate, and paywall UI/env/Stripe risks. T-122 should proceed as a phased free-app implementation. |
| T-122 Make Formify a free app | Completed | Core features are auth-based and no longer blocked by usage, plan, template, notes, or custom-block gates. Paywall/pricing/upgrade UI and product copy were removed; docs/context now describe the free-app model. |
| T-137 Later Stripe/schema cleanup | Completed | Removed remaining Stripe UI/routes/helper/dependency/env/entitlement residue and active billing schema through a dedicated migration. `MANUAL_SMOKE_TESTS.md` tracks deferred browser checks; historical migrations remain. |

## Active

_None._

## Backlog

| ID | Status | Notes |
| --- | --- | --- |
| T-107 Review legacy CustomBlock model | Backlog | Old `customBlockRouter` source was removed; decide whether existing `CustomBlock` data/model should be migrated or removed. |
| T-108 Remove legacy usage.recordSession | Backlog | Usage is counted during WS token mint; remove mutation after confirming no old clients call it. |
| T-109 Harden email HTML handling | Backlog | Escape or sanitize `formHTML` before accepting untrusted/richer HTML sources. |
| T-110 Review server-side logging for PII | Backlog | tRPC/password-reset/email operational logs remain; audit before production hardening. |
| T-111 Avoid Google Fonts build network dependency | Backlog | `next/font` can fail in restricted networks; consider self-hosted/local font strategy. |
| T-120 Review and polish PDF export formatting | Backlog | P1, medium risk, PDF/export. Inspect and improve form + notes PDF branding, title/date/style, pagination, wrapped text, blank lines, footers, and page numbers. |
| T-121 Add editable generated notes | Backlog | P2, medium risk, UI/state. Allow generated notes editing without form-field-style locking; needs UX decision on persistence/export behavior. |
| T-123 Support table-style form fields | Backlog | P3, high risk, likely UI/API/DB/export. Needs product/design spec before implementation. |
| T-125 Add notes Markdown download alongside PDF | Backlog | P2, low risk, notes export UI. Notes should be downloadable as both PDF and `.md`; applies to notes only, not form exports. |
| T-126 Notes local autosave and recovery | Backlog | P3, medium risk, frontend-only. Autosave visible generated notes locally with restore/discard UX; no audio, DB history, or WS changes. Lower priority for now. |
| T-127 Summarise current generated notes | Backlog | P1, medium-high risk, depends on T-130. `formify-web` adds a protected tRPC mutation and UI button that send current `notesMarkdown` only; no audio, DB save, or live WS protocol change. |
| T-128 Reorganise current notes into new sections | Backlog | P1/P2, high risk, depends on T-130. `formify-web` adds a protected tRPC mutation and UI flow that send current `notesMarkdown` plus target sections; no audio, DB save, or live WS protocol change. |
| T-130 Add HTTP notes transform endpoints to ws-transcription | Backlog | P0, medium-high risk, `ws-transcription`. Add server-to-server authenticated summarise/reorganise endpoints that reuse existing GPT helper style, validate input length, return Markdown, and do not log notes content. |
| T-131 Polish TranscriptionClient field locking UI | Backlog | P2, low risk, UI-only. Make locked/edited field state neater after T-113 behavior is smoke-tested. Formerly tracked as T-119 before the notes-sidebar follow-up reused that ID. |
