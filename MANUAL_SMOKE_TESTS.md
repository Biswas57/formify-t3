# Manual Smoke Tests

Use this checklist after the free-app cleanup to verify normal product flows. Do not use real sensitive client/patient data.

## Status

- Scope: final free-app verification after T-138.
- Automated validation: completed on 2026-05-27.
- Manual browser testing: not yet run.
- Test accounts:
  - New account: pending.
  - Existing free account: pending.
  - Old/existing pro account: pending if such an account exists.

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
- [ ] New spoken content merges into existing edited notes.
- [ ] Final notes after a second stop preserve previous edits and include new content.
- [ ] Reset/new session clears notes intentionally.
- [ ] First start does not send old notes.
- [ ] Notes content is not logged during continuation.

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
- `CustomBlock` model remains for T-107 review.
- `npm run lint` and `npm run build` pass with the pre-existing unused eslint-disable warning in `src/server/auth/config.ts`.
