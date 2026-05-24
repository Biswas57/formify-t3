# Decisions

## D-001 Separate Web App And Transcription Server

Formify keeps the Next.js web app separate from the WebSocket transcription server. This repo owns auth, templates, billing, entitlements, UI, and WS token minting. The sibling service owns audio transcription and AI extraction.

## D-002 Web App Mints Short-Lived WS Tokens

The frontend does not authenticate directly with the transcription server. It calls `transcription.getSessionToken`, which verifies the signed-in user, enforces free-tier usage, increments usage when appropriate, and returns a short-lived JWT signed with `WS_TOKEN_SECRET`.

## D-003 Usage Is Counted At Token Mint

Recording usage is counted before a WS token is returned. This avoids relying on the browser to report a completed session and prevents token-spam races. `usage.recordSession` remains only as legacy API surface.

## D-004 Current Form WS Payload Does Not Use corrected_audio

The current frontend expects form updates as `{ type, attributes }`. It does not require `corrected_audio`. Reintroducing corrected text in the WS protocol requires coordination with the transcription server and frontend consumers.

## D-005 Active Custom Blocks Use BlockDefinition

The active template builder uses `blockRouter` and `BlockDefinition`. The older `customBlockRouter` / `CustomBlock` path is unmounted legacy code and should not be wired back in without a product and migration decision.

## D-006 T3 Starter Post Surface Removed

The starter `postRouter` and `LatestPost` component were unused and removed to keep the active API surface focused on Formify.

## D-007 Email Export Trust Boundary Documented

Email export currently accepts Formify-generated rendered HTML. The endpoint documents this as a trust boundary; future richer or untrusted HTML sources require escaping or sanitization before sending.

## D-008 Keep WebSocket Logs PII-Safe

Client recording/WebSocket paths should not log tokens, transcript text, notes markdown, form values, raw attributes, or unknown field names. User-facing error state should carry operational feedback instead.
