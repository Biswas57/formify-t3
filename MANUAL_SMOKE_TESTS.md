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
- [ ] Notes PDF export works.
- [ ] Notes Markdown export works if/when T-125 is implemented.

## Account And Profile

- [ ] Profile page loads.
- [ ] Name update works.
- [ ] Password change works where applicable.
- [ ] Account deletion works.
- [ ] Deleted account cannot continue using an old authenticated session.

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
