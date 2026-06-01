# Manual Smoke Tests

Use this checklist after the free-app cleanup to verify normal product flows. Do not use real sensitive client/patient data.

## Status

- Scope: free-app verification plus critical Forms/Notes recording lifecycle stabilisation QA.
- Automated validation: critical lifecycle pass completed on 2026-06-01 with `git diff --check`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Manual browser testing: deferred; this checklist is not a blocker for the next feature implementation phase.
- Known validation notes: `npm run lint` and `npm run build` pass with the pre-existing unused eslint-disable warning in `src/server/auth/config.ts:27`; `npm run build` also reports the existing Prisma config deprecation notice.
- Test accounts:
  - New account: pending.
  - Existing free account: pending.
  - Old paid-era account: pending if such an account exists.

## Auth

- [ ] New user can register.
- [ ] Existing user can log in.
- [ ] User can log out.
- [ ] Logged-out user is redirected away from protected dashboard pages.
- [ ] Existing account sessions still load after billing schema cleanup.

## Core Free Features

- [ ] Forms recording can mint a WS token and start normally.
- [ ] Notes recording can mint a WS token and start normally.
- [ ] Usage analytics do not block recording.
- [ ] Form templates can be created beyond the previous paid/free cap.
- [ ] Form templates can be duplicated beyond the previous paid/free cap.
- [ ] Note templates can be created beyond the previous paid/free cap.
- [ ] Custom block creation opens without upgrade UI.
- [ ] Custom block can be created and appears in the block library.
- [ ] Notes page is accessible to signed-in users.
- [ ] Template builder is accessible to signed-in users.

## WebSocket Recording Lifecycle

- [ ] Forms: denying microphone permission does not leave a lingering started WS/backend session.
- [ ] Forms: unexpected WS close during `recording` stops local mic capture and preserves current form values.
- [ ] Forms: unexpected WS close during `finalizing` stops local mic capture and preserves current form values.
- [ ] Forms: Reset during/after recording stops local capture, stops/closes/abandons the active session, and leaves the UI idle.
- [ ] Forms: late `attributes_update` or `final_attributes` from an abandoned/reset session do not refill fields.
- [ ] Forms: binary audio is not sent before the WS session receives `started`.
- [ ] Forms: rapid Start clicks do not create duplicate recorders or sessions.
- [ ] Forms: rapid Stop clicks do not send conflicting duplicate stop flows.
- [ ] Forms: missing/invalid WS token shows a recoverable recording error and does not leave recording active.
- [ ] Notes recording does not stream binary audio before the WS session receives `started`.
- [ ] Missing/invalid WS token shows a recoverable recording error and does not leave recording active.
- [ ] Notes: denying microphone permission does not leave a lingering started WS/backend session.
- [ ] Unexpected WS close during Notes `recording` stops local mic capture and keeps current notes visible.
- [ ] Unexpected WS close during Notes `finalizing` stops local mic capture and keeps current notes visible.
- [ ] After an unexpected Notes WS close, Dismiss clears the banner and the user can start recording again (a fresh socket opens on Start).
- [ ] No Notes WebSocket opens on page mount/idle — a socket only opens when recording starts.
- [ ] After `notes_final`, the Notes WebSocket closes intentionally with no interruption banner.
- [ ] After finalisation, waiting several minutes opens no new idle socket (no 1006 churn / reconnect loop).
- [ ] Resume after finalisation opens a fresh socket and sends continuation notes normally.
- [ ] Notes: rapid Start clicks do not create duplicate recorders or sessions.
- [ ] Notes: rapid Stop clicks do not send conflicting duplicate stop flows.

## Exports

- [ ] Forms PDF export works.
- [ ] Notes Download menu opens.
- [ ] Notes PDF export works from the Download menu.
- [ ] Notes Markdown export creates a `.md` file.
- [ ] Markdown file content matches the current visible notes.
- [ ] Markdown filename uses the session title or safe fallback.
- [ ] Notes Copy action still works.
- [ ] Notes export controls remain usable on mobile.

## Notes Editing

- [ ] Edit button appears only after final notes are displayed.
- [ ] Edit button does not appear during recording/live draft/finalising states.
- [ ] Done commits textarea edits to the visible notes.
- [ ] Cancel discards draft edits and restores the previous final notes.
- [ ] PDF export uses edited notes after Done.
- [ ] Markdown export uses edited notes after Done.
- [ ] Copy uses the current visible draft while editing.
- [ ] Starting a new session clears edit state.
- [ ] Late AI messages do not silently overwrite draft edits.

## Notes Continuity

- [ ] Stop/finalise/edit/Done/resume preserves manual edits.
- [ ] Resume sends `continuation: true`.
- [ ] Resume sends canonical `currentNotesMarkdown` from the current visible notes.
- [ ] New spoken content merges into existing edited notes.
- [ ] Final notes after a second stop preserve previous edits and include new content.
- [ ] Reset/new session clears notes intentionally.
- [ ] First start does not send old notes.
- [ ] Notes content is not logged during continuation.

## Notes Session Length Guard

- [ ] During a long Notes recording, a non-modal reliability warning appears before the 120-minute maximum session length.
- [ ] A stronger final-warning appears in the final minutes before the maximum session length.
- [ ] Warning copy uses reliability/max-session wording (no plan, pricing, or upgrade language).
- [ ] If the backend finalises at the maximum session length, the UI shows that the session was finalised and advises starting a new session.
- [ ] After cap finalisation, current notes remain visible and editable/exportable as expected.
- [ ] Starting/resuming recording begins a fresh per-recording timer window and warning state.
- [ ] New session/reset clears the session-length warning state.

## Notes Layout

- [ ] Notes template sidebar header no longer shows a saved-count pill.
- [ ] Desktop sidebar collapses and expands smoothly.
- [ ] Collapsed desktop rail shows the sidebar reopen icon near the top.
- [ ] Reopen icon is not floating inside the main notes content.
- [ ] Wide desktop notes workspace uses more horizontal space cleanly.
- [ ] Mobile Templates drawer still opens and closes.
- [ ] Note template save/select/rename/delete still behave the same.

## Mobile Polish

- [ ] Mobile template builder bottom save button turns green after save.
- [ ] Mobile Notes Templates drawer slides in and out smoothly.
- [ ] Mobile drawer backdrop and close button still close the drawer.
- [ ] Mobile drawer remains readable in dark mode.
- [ ] Notes card header/action layout is consistent for Live Notes / Updating.
- [ ] Notes card header/action layout is consistent for Final Notes / Complete.
- [ ] Notes card header/action layout is consistent while Editing.
- [ ] Notes card header/action layout is consistent after Edited.
- [ ] Edit, Done, Cancel, Copy, and Download still work on mobile.
- [ ] Desktop notes sidebar/rail remains unchanged.
- [ ] Desktop template save behaviour remains unchanged.

## Clickable Feedback

- [ ] Mobile Start/Stop/Resume buttons show immediate pressed feedback.
- [ ] Mobile Templates button and drawer controls show immediate pressed feedback.
- [ ] Mobile Save button shows pressed, saving, and saved states correctly.
- [ ] Mobile Edit, Done, Cancel, Copy, and Download controls feel responsive.
- [ ] Desktop clickable cards, buttons, links, and menu items show pointer/hover affordance.
- [ ] Desktop disabled buttons do not show pointer cursor.
- [ ] Dark mode hover/active states remain readable.
- [ ] Landing page Sign In / Get Started / Watch Demo / nav / mobile menu controls show immediate pressed feedback.
- [ ] Login, register, forgot-password, and reset-password submit/Google/password-toggle buttons show immediate pressed feedback.
- [ ] Auth submit buttons keep their loading labels and disabled state without pressed feedback while disabled.
- [ ] No action behaviour changed.

## Email HTML Hardening

- [ ] Sending a normal form email still works and renders acceptably.
- [ ] A form value containing `<script>alert(1)</script>` is escaped to inert text (no script runs, visible as literal text).
- [ ] A form value containing `onclick=` / `javascript:` is escaped to inert text, not an active handler/link.
- [ ] Empty field values still render as a dash.
- [ ] An invalid/oversized payload returns a generic error and does not send.
- [ ] No raw email/form HTML, recipient, or field values appear in server logs.

## Account And Profile

- [ ] Profile page loads.
- [ ] Name update works.
- [ ] Password change works where applicable.
- [ ] Account deletion works.
- [ ] Deleted account cannot continue using an old authenticated session.

## Appearance

- [ ] Default appearance follows system preference.
- [ ] User can switch System/Light/Dark in profile.
- [ ] Appearance preference persists on refresh.
- [ ] System option responds to OS preference changes.
- [ ] Light mode still works.
- [ ] No obvious hydration flash or class mismatch on reload.
- [ ] Profile account actions still work after changing appearance.

## Dark Mode Core Surfaces

- [ ] Dashboard/header and mobile menu are readable in dark mode.
- [ ] Form Bank template list and menus are readable in dark mode.
- [ ] Notes page is readable in dark mode.
- [ ] Notes empty state, including "Ready to take notes", is readable in dark mode.
- [ ] Notes template sidebar, collapsed rail, and mobile drawer are readable in dark mode.
- [ ] Sidebar/template row titles and subtitles are readable in dark mode.
- [ ] Notes edit/copy/download controls remain readable in dark mode.
- [ ] Markdown headings, body text, bullets, and horizontal rules are readable in dark mode.
- [ ] Template builder canvas, library, modal, and mobile bottom bar are readable in dark mode.
- [ ] Transcription page fields, locked amber state, recording controls, and email modal are readable in dark mode.
- [ ] Profile page and account forms are readable in dark mode.
- [ ] Labels and helper/muted text are readable in dark mode.
- [ ] Placeholder text is visible but clearly secondary in dark mode.
- [ ] Buttons and disabled states remain readable in dark mode.
- [ ] Light mode remains visually intact after toggling back.
- [ ] Mobile layouts remain usable in dark mode.
- [ ] PDF/Markdown export behaviour is unchanged.
- [ ] Notes edit and continuation behaviour are unchanged.

## UI Residue

- [ ] Authenticated app shows no pricing/pro/upgrade/billing card.
- [ ] Landing page shows no pricing/pro section or upgrade CTA.
- [ ] No upgrade modal appears in normal flows.
- [ ] No plan badge appears in dashboard/profile flows.
- [ ] No paywall copy appears around notes, templates, recording, or custom blocks.

## Technical

- [x] `npx prisma validate`
- [x] `npm run db:seed`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`

## Notes

- Historical Prisma migrations still contain old billing/Stripe terms and are intentionally retained.
- `TranscriptionUsage` remains as non-blocking analytics.
- Legacy `CustomBlock` model removed (T-107); active custom blocks use `BlockDefinition`.
- `npm run lint` and `npm run build` pass with the pre-existing unused eslint-disable warning in `src/server/auth/config.ts`.
