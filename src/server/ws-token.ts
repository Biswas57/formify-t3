/**
 * src/server/ws-token.ts
 *
 * Web-app side of the WS session token.
 * Mirrors ws-transcription/ws-token.ts — both must use the same WS_TOKEN_SECRET.
 *
 * Only mintWSToken is used here (server-side in the tRPC router).
 * verifyWSToken lives in ws-transcription/ws-token.ts.
 */

import jwt from "jsonwebtoken";

const SECRET = process.env.WS_TOKEN_SECRET;
const TTL_SECONDS = 120; // 2 minutes

export interface WSTokenPayload {
    userId: string;
    mode: "forms" | "notes";
}

export function mintWSToken(userId: string, mode: "forms" | "notes"): string {
    if (!SECRET) throw new Error("WS_TOKEN_SECRET is not set in environment");
    return jwt.sign({ userId, mode } satisfies WSTokenPayload, SECRET, {
        expiresIn: TTL_SECONDS,
    });
}
