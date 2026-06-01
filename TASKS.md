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
| T-125 Add notes Markdown download alongside PDF | Completed | Notes actions now keep Copy separate and use one Download menu for PDF or client-side Markdown export with a safe `.md` filename. |
| T-121 Add editable generated notes | Completed | Final notes can be edited after `notes_final`; Done commits to visible notes, Cancel discards, and Copy/PDF/Markdown use the current visible notes. |
| T-139 Notes sidebar and wide-desktop layout polish | Completed | Removed sidebar saved-count pill, added a desktop collapsed rail with smooth width transition, and widened the desktop notes workspace. |
| T-140 Mobile notes/template polish | Completed | Mobile builder saved state now turns green, mobile Notes Templates drawer slides/fades, and notes card header/actions use consistent responsive rows. |
| T-142 Preserve notes across multi-segment recording sessions | Completed | Notes resume now sends current visible notes as optional continuation context so the backend can continue from edited/current notes; reset remains an explicit clean slate. |
| T-141a Design theme architecture and profile toggle | Completed | Inspected current styling/profile setup and chose localStorage-backed System/Light/Dark preference on `document.documentElement`; T-141b/T-141c split plumbing from styling. |
| T-141b Add theme provider and profile appearance toggle | Completed | Added local System/Light/Dark appearance preference, root `.dark` class bootstrap/provider, Tailwind v4 dark variant, and Profile Appearance controls. |
| T-141c Apply first-pass dark styling to core app surfaces | Completed | Added usable slate/navy dark styling and dark-mode contrast fixes for dashboard shell, profile, form bank, notes/sidebar, template builder, and transcription surfaces; detailed polish remains deferred. |
| T-141 Begin dark mode groundwork | Completed | First-pass dark mode groundwork is complete: local appearance preference, profile toggle, root dark class, and core surface styling are in place. |
| T-145 Improve button feedback and clickable affordances | Completed | Added global clickable/disabled cursor defaults plus focused pressed feedback on high-impact mobile and app action controls. |
| T-114 Note templates: DB model + tRPC router | Completed | Create/list/delete and 10-template limit passed through the sidebar API path; ownership boundary remains deferred. |
| T-115 Note templates: sidebar UI in NotesClient | Completed | Desktop sidebar and mobile drawer save/select/delete flows passed; active-recording template actions remain deferred. |
| T-118 Fix notes template sidebar overflow/clutter | Completed | Removed duplicate notes sub-header text, added desktop sidebar show/hide control, and constrained template rows so long titles/sections truncate without widening the sidebar. |
| T-119 Polish notes template sidebar truncation and toggle placement | Completed | Moved desktop hide toggle into the sidebar header, kept a lightweight collapsed reopen control, and made row actions hover/focus revealed so titles/sections use more width by default. |
| T-132 Fix note template inline rename commit | Completed | Rename now commits directly on Enter and on blur, skips unchanged/blank titles without submitting, preserves typed value on failure, and refetches the template list after success. |
| T-013b Add Notes session limit warning UX | Completed | Added frontend wall-clock session-length warnings (10m + 2m + reached) for the Notes 120-minute reliability cap, including calm non-modal callout copy and reached/finalised guidance to start a new session while preserving notes. |
| T-129 Design notes AI transform integration | Completed | Decision recorded in D-005: use authenticated HTTP transform endpoints in `ws-transcription`, called by protected `formify-web` tRPC mutations. |
| T-117 Manual smoke test T-113/T-114/T-115/T-116 | Completed | Feasible smoke tests passed for form-field locking, all-fields-locked blocking, note template create/list/delete/limit, desktop sidebar, and mobile drawer. Rename issue tracked as T-132; PDF export, mic-dependent recording checks, ownership boundary, and active-recording template actions remain deferred/blocked. |
| T-124 Stripe/payment/paywall audit | Completed | Audit found hard backend gates in WS token minting, template create/duplicate, custom block CRUD, note-template creation, optional NotesGate, and paywall UI/env/Stripe risks. T-122 should proceed as a phased free-app implementation. |
| T-122 Make Formify a free app | Completed | Core features are auth-based and no longer blocked by usage, plan, template, notes, or custom-block gates. Paywall/pricing/upgrade UI and product copy were removed; docs/context now describe the free-app model. |
| T-137 Later Stripe/schema cleanup | Completed | Removed remaining Stripe UI/routes/helper/dependency/env/entitlement residue and active billing schema through a dedicated migration. `MANUAL_SMOKE_TESTS.md` tracks deferred browser checks; historical migrations remain. |
| T-108 Remove legacy usage.recordSession | Completed | Audit confirmed no frontend/test/API caller used `usage.recordSession`; removed the legacy mutation while keeping the active `usage.getToday` analytics read. WS token minting and recording behaviour unchanged. |
| T-107 Review legacy CustomBlock model | Completed | Audit proved the `CustomBlock` model was unused (see D-012): active custom blocks use `BlockDefinition` via `block.createCustom`/`listLibrary`/`deleteCustom`. Removed the model, the `User.customBlocks` relation, and dropped the table via `20260529000000_remove_custom_block`. Template Builder/custom-block behaviour unchanged. |
| T-109 Harden email HTML handling | Completed | `/api/email` no longer accepts client-rendered `formHTML`; the client sends structured `blocks` and the server zod-validates shape/size and renders the email while HTML-escaping every dynamic value (D-014). `<script>`, inline `on*=` handlers, and `javascript:` URLs in form values are escaped to inert text. Auth intact; no raw HTML/PII logged; no new dependency. |
| T-110 Review server-side logging for PII | Completed | Audited server/API logs (D-013). Removed reset-URL/token + recipient-email logs in forgot-password, redacted raw `Error` objects to safe reason codes in forgot-password/register, and dropped the Resend `error.message` (recipient echo) to log only `error.name`. Safe metadata logs (timings, messageId, error.message-only) retained; no behaviour or response changes. |
| T-111 Avoid Google Fonts build network dependency | Completed | `next/font/google` (Geist) was present and fetched fonts at build time. Removed the import and `--font-geist-sans` plumbing from `layout.tsx`, `globals.css`, and `tailwind.config.ts`, replacing it with a professional system font stack (D-016). Tightened CSP `font-src`/`style-src` (no Google Fonts hosts). Build no longer fetches fonts; layout and dark mode preserved. |
| T-WEB-CRIT-001 Stop Forms recorder/mic on WS close and session errors | Completed | Forms now stops local media capture, clears session readiness, and moves to a recoverable paused/error state when the WS closes unexpectedly or the backend returns session/auth errors. |
| T-WEB-CRIT-002 Stop/reset Forms backend sessions safely | Completed | Forms reset invalidates the active frontend session generation, stops local capture, sends stop for active sessions, intentionally closes/reconnects the WS, and ignores late messages from abandoned sessions. |
| T-WEB-CRIT-003 Avoid backend sessions when mic acquisition fails | Completed | Forms and Notes now acquire/create local media before sending WS start; start failures stop local tracks and terminate/close started sessions where needed. |
| T-WEB-CRIT-004 Gate Forms audio on server started | Completed | Forms now sets WS session readiness only after `started` and sends binary audio only while recording, ready, open, and on the current session generation. |
| T-WEB-HIGH-005 Add recording start/stop in-flight guards | Completed | Forms and Notes now use synchronous start/stop refs so rapid clicks do not create duplicate recorders, sockets, or conflicting stop flows. |

## Active

_None._

## Backlog

| ID | Status | Notes |
| --- | --- | --- |
| T-120 Review and polish PDF export formatting | Backlog | P1, medium risk, PDF/export. Inspect and improve form + notes PDF branding, title/date/style, pagination, wrapped text, blank lines, footers, and page numbers. |
| T-123 Support table-style form fields | Backlog | P3, high risk, likely UI/API/DB/export. Needs product/design spec before implementation. |
| T-126 Notes local autosave and recovery | Backlog | P3, medium risk, frontend-only. Autosave current visible notes/session config locally with expiry and restore/discard UX; no audio, raw transcript, DB history, or WS changes. |
| T-127 Summarise current generated notes | Backlog | P1, medium-high risk, depends on backend transform endpoint availability. Use current visible `notesMarkdown`, show preview first, and only replace notes on explicit user action. |
| T-128 Reorganise current notes into new sections | Backlog | P1/P2, high risk, depends on backend transform endpoint availability. Use current visible `notesMarkdown`, one-section-per-line input, preview first, and apply only on explicit user action. |
| T-130 Coordinate notes transform HTTP endpoints | Backlog | Backend coordination ticket for `ws-transcription` transform endpoints before T-127/T-128 implementation. Preserve the live WS recording contract; transforms use authenticated HTTP and operate on canonical `notesMarkdown`. |
| T-131 Polish TranscriptionClient field locking UI | Backlog | P2, low risk, UI-only. Make locked/edited field state neater after T-113 behavior is smoke-tested. Formerly tracked as T-119 before the notes-sidebar follow-up reused that ID. |
| T-144 Add Donate button and donation page | Backlog | P2, low-medium risk. Add optional support/donate entry point without paywalls, Pro tiers, pricing tables, subscription logic, or feature gates. |
| T-WEB-HIGH-006 Add fair-use/abuse controls | Backlog | High operational risk, frontend/API coordination. Add non-monetised fair-use/cost-safety controls for token minting and email export: server-side rate limits, daily/session counters, safe metadata logging, and clear reliability wording only. Do not add Pro/upgrade/pricing/paywall language. |
| T-146 Header/navigation restructure | Backlog | Next feature phase. Authenticated header target: My Templates, Forms, Notes, New Template. Preserve Notes as a separate workspace and do not merge form templates with note templates. |
| T-147 My Templates as authenticated home | Backlog | Make saved form templates the authenticated home/dashboard. Users can use/fill, edit, delete, create templates, and navigate to Forms or Notes. |
| T-148 First-class `/forms` route with empty state | Backlog | `/forms` should work directly. With no `templateId`, show an empty state and do not auto-select the most recent template because recording into the wrong form is worse than one extra click. |
| T-149 Forms template sidebar/drawer | Backlog | Add saved form-template selection to Forms: persistent desktop sidebar and mobile overlay drawer. Switching is allowed only idle/reset/completed, disabled while recording/finalising, and must guard stale session results. |
| T-150 My Templates Use Template to Forms | Backlog | “Use Template” / “Fill Form” from My Templates should route to `/forms?templateId=<templateId>`. |
| T-151 Form filling UI cleanup | Backlog | Cleanup/polish current Forms filling workspace after direct `/forms` routing and template selection are stable. Preserve locked-field ownership and recording lifecycle safeguards. |
| T-152 PDF design improvements for Notes and Forms | Backlog | Canonical PDF ticket. Improve light-themed exported PDFs with consistent header/title/metadata/body/section/footer/page-number treatment. Notes source is current visible/canonical `notesMarkdown` including manual edits and future applied transforms. Forms source is current filled form state. No paid export branding, Pro watermark, export paywall, custom themes, or DB persistence. Suggested split: T-152a audit, T-152b shared PDF utilities, T-152c Notes PDF, T-152d Forms PDF, T-152e manual export QA. |

## Recommended Implementation Order

1. T-146 Header/navigation restructure.
2. T-147 My Templates as authenticated home.
3. T-148 First-class `/forms` route with empty state.
4. T-150 My Templates “Use template” -> `/forms?templateId=<id>`.
5. T-149 Forms template sidebar/drawer.
6. T-151 Form filling UI cleanup.
7. T-152 PDF design improvements for Notes and Forms.
8. Later: T-130, T-127, T-128, and T-126 with backend/privacy coordination as needed.
