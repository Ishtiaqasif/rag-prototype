import { NextRequest } from "next/server";
import crypto from "crypto";

export function getSessionId(req: NextRequest): string {
    // Try to get from header first
    const headerSessionId = req.headers.get("x-session-id");
    if (headerSessionId) {
        return headerSessionId;
    }

    // Fallback: generate from IP (not ideal for production but works for demo)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const hash = crypto.createHash("sha256").update(ip).digest("hex");
    return `ip-${hash.substring(0, 16)}`;
}
