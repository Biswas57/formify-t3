# Tasks

## Completed

Completed work is intentionally compacted into parent/range rows. Child ticket IDs are retained in the notes for traceability without turning this file back into a long changelog.

| ID | Status | Notes |
| --- | --- | --- |
| T-101–T-112 Web hygiene, security, and privacy baseline | Completed | Consolidates T-101, T-102, T-103, T-104, T-105, T-106, T-107, T-108, T-109, T-110, T-111, and T-112: env validation, stale log/starter cleanup, README refresh, WS contract verification, legacy model/mutation cleanup, former product email trust hardening context, PII-safe server logging, and removal of the Google Fonts build dependency. |
| T-WEB-CRIT-001–T-WEB-HIGH-005 Recording lifecycle guardrails | Completed | Consolidates T-WEB-CRIT-001 through T-WEB-CRIT-004 plus T-WEB-HIGH-005: Forms/Notes mic, token, socket, start/stop, readiness, session-generation, close, and rapid-click safeguards. |
| T-113/T-131 Forms field lock and overwrite protection | Completed | Consolidates T-113 and T-131: manual field protection, all-fields-locked blocking, neutral stable unlock UI, reserved row space, mobile/desktop affordances, and AI overwrite guard behaviour. |
| T-114–T-171 Template sidebar and workspace shell polish | Completed | Consolidates note template storage/sidebar work T-114, T-115, T-118, T-119, T-132, T-139, T-140 plus workspace/sidebar alignment T-169 and T-171. Covers Notes save/select/rename/delete, overflow/truncation, desktop collapsed rails, mobile drawers, Forms/Notes sidebar consistency, shared workspace action/header polish, and product email export removal. |
| T-116–T-152 Export suite | Completed | Consolidates T-116, T-120, T-125, and T-152: Notes PDF export, PDF formatting polish, Notes Markdown download, and shared branded Forms/Notes PDF utilities with safe filenames and current visible/canonical output as source. |
| T-013b/T-121–T-183 Notes authoring, recovery, and session UX | Completed | Consolidates T-013b, T-121, T-126, T-142, T-162, T-163, T-177, T-180, T-182, and T-183: editable final notes, local autosave/recovery, multi-segment resume context, 60-minute reliability warning UI, no forced auto-scroll, polished Actions/transform loading, stale transform handling, copy text/Markdown, and bounded undo/redo. |
| T-127–T-130 Notes AI transform foundation | Completed | Consolidates T-127, T-128, T-129, and T-130: Summarise/Reorganise product flows, preview-first Apply semantics, protected web tRPC bridge, `ws-transcription` transform endpoints, and transform URL/secret configuration. |
| T-122/T-124/T-137 Free-app and billing cleanup | Completed | Consolidates T-122, T-124, and T-137: paywall/Stripe audit, removal of feature gates and paid product copy, free-app model documentation, and later billing/schema/env/dependency cleanup. |
| T-141/T-145 Cross-app visual accessibility polish | Completed | Consolidates T-141 and T-145: dark mode groundwork, app-wide theme preference, usable dark styling across major surfaces, and improved clickable/disabled/pressed affordances. |
| T-146–T-158 Product routing and Forms workspace IA | Completed | Consolidates T-146 through T-151 plus T-157 and T-158: canonical `/templates`, `/forms`, and builder routes, compatibility redirects, authenticated home, first-class no-template Forms state, Forms template sidebar/drawer, Use Template routing, Forms UI cleanup, New Template save/use UX, and route redirect optimisation. |
| T-165–T-168 Forms reliability and state persistence | Completed | Consolidates T-165, T-166, T-167, and T-168: one-current Forms draft autosave/restore, no idle WS lifecycle, start-owned mic/token/socket flow, connection status parity, widened Forms workspace, and moving the legacy Forms client to `src/app/forms/FormsClient.tsx`. |
| T-172–T-179 Template Builder editing and performance | Completed | Consolidates T-172, T-173, T-174, and T-179: editable custom/info blocks, stable dirty-state save guard, duplicate-save protection, lean builder query, deferred custom block loading, and no-op save/load cost reductions while preserving current create/update semantics. |
| T-176/T-178/T-181 Performance and observability | Completed | Consolidates T-176, T-178, and T-181: all-routes performance audit, `/forms` selected-template first-paint optimisation, safe render memoisation, and content-safe web performance metadata for template, block, and Notes transform bridge paths. |

## Active

_None._

## Backlog

| ID | Status | Notes |
| --- | --- | --- |
| T-144 Add Donate button and donation page | Backlog | P2, low-medium risk. Add optional support/donate entry point without paywalls, Pro tiers, pricing tables, subscription logic, or feature gates. |
| T-184 Align Copy Markdown icon | Backlog | P4, Notes UI polish. Make Copy Markdown use the same visual icon language as Download Markdown across desktop and mobile actions. |
| T-185 Fix mobile transform preview actions | Backlog | P1, Notes mobile UX. Make Summarise/Reorganise preview Apply/Cancel actions consistently visible and tappable on mobile to prevent accidental dismissal. |
| T-186 Add frontend recovery UX for interrupted finalisation/transforms | Backlog | P1/P2, Notes reliability, cross-repo. After backend T-135, persist short-lived recovery descriptors and poll/reconnect for retained final/transform results with session/source guards and no stale auto-apply. |
| T-187 Plan Forms and Notes PDF/export polish | Backlog | P3, export polish. Audit current Forms/Notes PDF output and define the final professional export layer without blocking current Notes reliability work. Supersedes T-156. |
