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

## Active

| ID | Status | Notes |
| --- | --- | --- |
| T-113 Protect manually corrected form fields | Active | Implemented. See summary below. |

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

**Validation needed:**
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Backlog

| ID | Status | Notes |
| --- | --- | --- |
| T-107 Review legacy customBlockRouter | Backlog | `customBlockRouter` is unmounted and uses old `CustomBlock`; decide whether to migrate data or remove model/API. |
| T-108 Remove legacy usage.recordSession | Backlog | Usage is counted during WS token mint; remove mutation after confirming no old clients call it. |
| T-109 Harden email HTML handling | Backlog | Escape or sanitize `formHTML` before accepting untrusted/richer HTML sources. |
| T-110 Review server-side logging for PII | Backlog | Stripe/tRPC/password-reset/email operational logs remain; audit before production hardening. |
| T-111 Avoid Google Fonts build network dependency | Backlog | `next/font` can fail in restricted networks; consider self-hosted/local font strategy. |
| T-114 Note templates: DB model + tRPC router | Backlog | New `NoteTemplate` model (title, noteStyle, sections, ownerId). 10-template limit per user. Router: list, create, rename, delete. Needs migration. |
| T-115 Note templates: sidebar UI in NotesClient | Backlog | Depends on T-114. Left sidebar (desktop) / bottom drawer (mobile) showing saved note templates. Select loads style+sections into config card. |
| T-116 Notes PDF export | Backlog | Replace "Download .md" with PDF using existing jsPDF pattern from TranscriptionClient. Branded header. Include session title + date + notes content. |