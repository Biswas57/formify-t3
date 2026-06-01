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
| T-116 Notes PDF export | Completed | Notes PDF export was added; follow-up T-120 tracked remaining PDF formatting polish. |
| T-125 Add notes Markdown download alongside PDF | Completed | Notes actions now keep Copy separate and use one Download menu for PDF or client-side Markdown export with a safe `.md` filename. |
| T-121 Add editable generated notes | Completed | Final notes can be edited after `notes_final`; Done commits to visible notes, Cancel discards, and Copy/PDF/Markdown use the current visible notes. |
| T-139 Notes sidebar and wide-desktop layout polish | Completed | Removed sidebar saved-count pill, added a desktop collapsed rail with smooth width transition, and widened the desktop notes workspace. |
| T-140 Mobile notes/template polish | Completed | Mobile builder saved state now turns green, mobile Notes Templates drawer slides/fades, and notes card header/actions use consistent responsive rows. |
| T-142 Preserve notes across multi-segment recording sessions | Completed | Notes resume now sends current visible notes as optional continuation context so the backend can continue from edited/current notes; reset remains an explicit clean slate. |
| T-141 Begin dark mode groundwork | Completed | Added local System/Light/Dark appearance preference with root `.dark` bootstrap/provider, Tailwind v4 dark variant, Profile Appearance controls, and first-pass usable dark styling across the dashboard shell, profile, form bank, notes/sidebar, template builder, and transcription surfaces. |
| T-145 Improve button feedback and clickable affordances | Completed | Added global clickable/disabled cursor defaults plus focused pressed feedback on high-impact mobile and app action controls. |
| T-114 Note templates: DB model + tRPC router | Completed | Create/list/delete and 10-template limit passed through the sidebar API path; ownership boundary remains deferred. |
| T-115 Note templates: sidebar UI in NotesClient | Completed | Desktop sidebar and mobile drawer save/select/delete flows passed; active-recording template actions remain deferred. |
| T-118 Fix notes template sidebar overflow/clutter | Completed | Removed duplicate notes sub-header text, added desktop sidebar show/hide control, and constrained template rows so long titles/sections truncate without widening the sidebar. |
| T-119 Polish notes template sidebar truncation and toggle placement | Completed | Moved desktop hide toggle into the sidebar header, kept a lightweight collapsed reopen control, and made row actions hover/focus revealed so titles/sections use more width by default. |
| T-132 Fix note template inline rename commit | Completed | Rename now commits directly on Enter and on blur, skips unchanged/blank titles without submitting, preserves typed value on failure, and refetches the template list after success. |
| T-013b Add Notes session limit warning UX | Completed | Added frontend wall-clock session-length warnings (10m + 2m + reached) for the Notes 120-minute reliability cap, including calm non-modal callout copy and reached/finalised guidance to start a new session while preserving notes. |
| T-129 Design notes AI transform integration | Completed | Decision recorded in D-005: use authenticated HTTP transform endpoints in `ws-transcription`, called by protected `formify-web` tRPC mutations. |
| T-124 Stripe/payment/paywall audit | Completed | Audit found hard backend gates in WS token minting, template create/duplicate, custom block CRUD, note-template creation, optional NotesGate, and paywall UI/env/Stripe risks. T-122 should proceed as a phased free-app implementation. |
| T-122 Make Formify a free app | Completed | Core features are auth-based and no longer blocked by usage, plan, template, notes, or custom-block gates. Paywall/pricing/upgrade UI and product copy were removed; docs/context now describe the free-app model. |
| T-137 Later Stripe/schema cleanup | Completed | Removed remaining Stripe UI/routes/helper/dependency/env/entitlement residue and active billing schema through a dedicated migration. Historical migrations remain. |
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
| T-146 Header/navigation restructure | Completed | Added canonical `/templates`, `/forms`, `/templates/new`, and `/templates/[id]` routes, preserved old dashboard/transcription compatibility redirects, extracted shared authenticated navigation, updated header/logo/signed-in defaults to My Templates, and added safe New Template `returnTo` handling. |
| T-147 My Templates as authenticated home | Completed | `/templates` is the canonical saved form templates page; `/`, `/dashboard`, and `/dashboard/formbank` now send signed-in users there. |
| T-148 First-class Forms route with empty state | Completed | `/forms` works directly with no default template fallback: no-template and invalid-template states show selection guidance and cannot start recording, request mic access, mint a token, or send a WebSocket start until a valid saved template is selected. |
| T-149 Forms template sidebar/drawer | Completed | Forms has a persistent desktop saved-template sidebar, mobile Choose Template drawer, New Template shortcut, selected-template state, and switching guards that disable during recording/finalising and warn only when filled/generated/manual-edited content exists. |
| T-150 My Templates Use Template to Forms | Completed | Saved template primary CTA is now "Use Template" and routes to `/forms?templateId=<templateId>`. |
| T-151 Form filling UI cleanup | Completed | Forms uses the shared authenticated shell, hides the old advanced template editor from the Forms workflow without deleting it, and keeps form filling focused on selected saved templates. |
| T-120 Review and polish PDF export formatting | Completed | Superseded by T-152: Forms and Notes now share branded light-themed PDF utilities with improved headers, metadata, section/content styling, wrapping, filenames, and page numbers. |
| T-152 PDF design improvements for Notes and Forms | Completed | Shared `src/lib/pdf` exports now provide `exportFormPdf` and `exportNotesPdf` with dynamic jsPDF import, favicon mark branding, compact light-themed headers/metadata/footer/page numbers, compact printable Forms rows in template order, polished Notes markdown output from canonical visible notes, safe filenames, and no raw transcript/audio, paid branding, paywall, or persistence. |
| T-157 Simplify New Template save/use UX | Completed | `Use in Forms` now appears next to Save and in the mobile sticky action area, stays disabled until the template has a persisted id, routes to `/forms?templateId=<id>` after create/update, and replaces the old post-save navigation strip with a small saved confirmation. Create-once/update-after-create semantics are preserved. |
| T-158 Route performance and redirect optimisation | Completed | Legacy dashboard/transcription routes now redirect to canonical routes from `next.config.js` before the old app tree/layout renders; page-level compatibility redirects remain as fallback. Protected template pages auth-check before tRPC prefetches, `/dashboard/create` preserves safe `returnTo` values, login callback URLs canonicalise old dashboard/transcription destinations, and registration/template CTA wording now targets My Templates/Forms. Root `/` already redirects signed-in users directly to `/templates` while preserving the unauthenticated landing page. |

## Active

_None._

## Backlog

| ID | Status | Notes |
| --- | --- | --- |
| T-123 Support table-style form fields | Backlog | P3, high risk, likely UI/API/DB/export. Needs product/design spec before implementation. |
| T-126 Notes local autosave and recovery | Backlog | P3, medium risk, frontend-only. Autosave current visible notes/session config locally with expiry and restore/discard UX; no audio, raw transcript, DB history, or WS changes. |
| T-127 Summarise current generated notes | Backlog | P1, medium-high risk, depends on backend transform endpoint availability. Use current visible `notesMarkdown`, show preview first, and only replace notes on explicit user action. |
| T-128 Reorganise current notes into new sections | Backlog | P1/P2, high risk, depends on backend transform endpoint availability. Use current visible `notesMarkdown`, one-section-per-line input, preview first, and apply only on explicit user action. |
| T-130 Coordinate notes transform HTTP endpoints | Backlog | Backend coordination ticket for `ws-transcription` transform endpoints before T-127/T-128 implementation. Preserve the live WS recording contract; transforms use authenticated HTTP and operate on canonical `notesMarkdown`. |
| T-131 Polish TranscriptionClient field locking UI | Backlog | P2, low risk, UI-only. Make locked/edited field state neater after T-113 behavior has settled. Formerly tracked as T-119 before the notes-sidebar follow-up reused that ID. |
| T-144 Add Donate button and donation page | Backlog | P2, low-medium risk. Add optional support/donate entry point without paywalls, Pro tiers, pricing tables, subscription logic, or feature gates. |
| T-WEB-HIGH-006 Add fair-use/abuse controls | Backlog | High operational risk, frontend/API coordination. Add non-monetised fair-use/cost-safety controls for token minting and email export: server-side rate limits, daily/session counters, safe metadata logging, and clear reliability wording only. Do not add Pro/upgrade/pricing/paywall language. |
| T-FOLLOW Remove stale route/link residue after navigation stabilises | Backlog | Later cleanup after compatibility window: remove `/transcription` and old dashboard compatibility routes/links/references, remove old "transcription page" wording, and optionally rename `TranscriptionClient`/files to Forms terminology. |
| T-FOLLOW Landing/root route performance investigation | Backlog | Medium risk, performance. Root `/` preserves the public landing page and redirects signed-in users directly to `/templates`, but production Speed Insights should guide deeper landing/auth optimisation if `/` remains slow. Avoid changing the public landing experience without design review. |
| T-156 PDF rendering strategy and high-quality export redesign | Backlog | P1/P2, medium-high risk, export architecture. Evaluate the current jsPDF drawing approach, `@react-pdf/renderer`, HTML/CSS print templates, server-side HTML-to-PDF with Playwright/Puppeteer, and `pdfmake`; prototype one Forms PDF and one Notes PDF before replacing current implementation. Preserve Forms source as current filled form state, Notes source as current visible/canonical markdown, support a real Formify logo/wordmark strategy, keep exports maintainable, fit a mostly-empty 17-field Forms PDF on one page where practical, and do not add paywall/export-limit language. |
| T-153 Add exportable Formify wordmark asset for PDFs | Backlog | Low risk, design asset. Add a repo-owned SVG/PNG Formify wordmark suitable for embedding in generated PDFs. Current PDFs embed the repo-owned favicon mark and render the wordmark as text because no separate wordmark asset exists. |
| T-154 Advanced PDF markdown/table support | Backlog | Medium risk, export polish. Improve Notes PDF rendering for tables, richer code blocks, nested lists, and more complete inline emphasis if product usage requires it. Current v1 degrades advanced markdown safely. |

## Recommended Implementation Order

1. T-WEB-HIGH-006 fair-use/abuse controls before public scale.
2. T-156 PDF rendering strategy and high-quality export redesign.
3. T-153 exportable Formify wordmark asset for PDFs.
4. T-130 coordinate notes transform HTTP endpoints.
5. T-127 and T-128 notes transform UI after backend contracts exist.
6. T-126 notes local autosave and recovery.
7. T-FOLLOW stale route/link cleanup after compatibility redirects have had time to settle.
