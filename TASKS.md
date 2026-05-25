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
| T-113 Protect manually corrected form fields | Completed | See summary below. |
| T-116 Notes PDF export | Completed | See summary below. |
| T-114 Note templates: DB model + tRPC router | Completed | See summary below. |
| T-115 Note templates: sidebar UI in NotesClient | Completed | See summary below. |

## Active

None.

### T-113 Summary

- **Repo:** `formify-web`
- **File:** `src/app/transcription/TranscriptionClient.tsx`
- **Risk:** Low
- **WS contract change:** None — field key filtering is client-side only; the server already handles any subset of blocks/fields.

**What was done:**
- Removed global `isEditing` / `editedValues` / `handleSave` / global Edit+Save buttons / "Edits are local only" disclaimer
- Added `lockedFields: Set<string>` state + `lockedFieldsRef` (ref mirror for WS closure)
- `handleFieldChange(field, value)`: updates `attributes` directly and locks the field on first keystroke
- `unlockField(field)`: removes field from `lockedFields` so AI can fill it again
- `attributes_update` and `final_attributes` handlers: skip any key in `lockedFieldsRef.current`
- `sendBlocks`: filters locked keys from each block's field array before sending; skips empty blocks; skips send entirely if all fields are locked. **Field values are never sent.**
- Locked fields render with amber border + small amber lock icon (click to unlock)
- `handleReset` and template-change effect both call `setLockedFields(new Set())`

**Validation:**
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. Lint/build still report the pre-existing unused eslint-disable warning in `src/server/auth/config.ts`.
- Browser smoke reached `/dashboard/notes` but redirected to `/login`; authenticated manual UI smoke still needed.

### T-116 Summary

- **Repo:** `formify-web`
- **File:** `src/app/dashboard/notes/NotesClient.tsx`
- **Risk:** Low
- **New dependency:** None — uses dynamic `import("jspdf")` already present in the project

**What was done:**
- Removed `handleDownload` (`.md` blob export)
- Added `isGeneratingPDF` boolean state for loading feedback on the button
- Added `handleSavePDF`: fully client-side, branded Formify header (matching forms PDF), walks `notesMarkdown` line-by-line handling H1/H2/H3, bullets, numbered lists, horizontal rules, paragraphs. Inline bold segments rendered via `printMixedLine` helper (single-line) with graceful fallback to stripped text for wrapped lines. Note content never sent to server, never logged.
- Replaced "Download .md" button with "Download PDF" (shows "Generating…" spinner while building)
- `handleCopy` retained unchanged

### T-114 Summary

- **Repo:** `formify-web`
- **Files:**
  - `prisma/schema.prisma` — new `NoteTemplate` model + `noteTemplates` relation on `User`
  - `src/server/entitlements/features.ts` — added `FREE_NOTE_TEMPLATES: 10` to `PLAN_LIMITS`
  - `src/server/api/routers/noteTemplate.ts` — new router (list, create, rename, update, delete)
  - `src/server/api/root.ts` — mounted `noteTemplate: noteTemplateRouter`
  - `DECISIONS.md` — D-009 (schema string choices), D-010 (10-template cap)
- **Risk:** Medium — involves Prisma schema change and migration
- **WS contract change:** None
- **New dependency:** None

**What was done:**
- Added `NoteTemplate` model: `id`, `ownerId`, `title`, `noteStyle` (String), `sections` (String), timestamps, `@@index([ownerId])`, `onDelete: Cascade` owner relation.
- `noteStyle` stored as plain String validated by Zod at the API boundary (not a DB enum). See D-009.
- `sections` stored as raw comma-separated String matching `sectionsRaw` in NotesClient. See D-009.
- Added `noteTemplates NoteTemplate[]` relation to `User`.
- Added `FREE_NOTE_TEMPLATES: 10` to `PLAN_LIMITS`. All users share cap initially. See D-010.
- `noteTemplateRouter`: `list` (owned, newest first), `create` (limit-enforced), `rename` (title-only, ownership-checked), `update` (full config, ownership-checked), `delete` (ownership-checked `deleteMany`).
- Mounted as `noteTemplate` in `appRouter`.

**Migration command:**
```
npx prisma migrate dev --name add_note_template
```

**Review validation:**
- Added the missing title-only `rename` procedure while keeping `update` for full config edits.
- Removed unrelated `UserPlan.status` default drift from the generated migration.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. Lint/build still report the pre-existing unused eslint-disable warning in `src/server/auth/config.ts`.

### T-115 Summary

- **Repo:** `formify-web`
- **Files:**
  - `src/app/dashboard/notes/NoteTemplateSidebar.tsx` — new reusable notes template sidebar/drawer content
  - `src/app/dashboard/notes/NotesClient.tsx` — desktop sidebar, mobile drawer toggle, template selection wiring
  - `DECISIONS.md` — D-011 sidebar/drawer placement
- **Risk:** Low — UI-only wiring against the T-114 tRPC router
- **WS contract change:** None
- **New dependency:** None

**What was done:**
- Added list, save-as, rename, inline-confirm delete, loading, empty, and limit-error UI for note templates.
- Desktop renders a persistent `w-64` left sidebar; mobile renders a drawer opened from the notes sub-header.
- Selecting a template loads `sessionTitle`, `noteStyle`, and `sectionsRaw` while idle.
- Create/rename trim titles and do not submit empty titles.
- Template actions are disabled for selection/save while recording is not idle.

**Validation:**
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. Lint/build still report the pre-existing unused eslint-disable warning in `src/server/auth/config.ts`.
- Manual smoke tests intentionally not run in this pass.

## Backlog

| ID | Status | Notes |
| --- | --- | --- |
| T-107 Review legacy customBlockRouter | Backlog | `customBlockRouter` is unmounted and uses old `CustomBlock`; decide whether to migrate data or remove model/API. |
| T-108 Remove legacy usage.recordSession | Backlog | Usage is counted during WS token mint; remove mutation after confirming no old clients call it. |
| T-109 Harden email HTML handling | Backlog | Escape or sanitize `formHTML` before accepting untrusted/richer HTML sources. |
| T-110 Review server-side logging for PII | Backlog | Stripe/tRPC/password-reset/email operational logs remain; audit before production hardening. |
| T-111 Avoid Google Fonts build network dependency | Backlog | `next/font` can fail in restricted networks; consider self-hosted/local font strategy. |
