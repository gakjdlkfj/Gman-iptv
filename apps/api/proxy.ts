import type Database from "better-sqlite3";
import crypto from "node:crypto";
import { id } from "../util/id.js";
import { isAllowlistedHost, isBlockedHost, absolutize } from "../util/url.js";

function hmacSecret(): Buffer {
  const s = process.env.JWT_SECRET || "dev_secret";
  return crypto.createHash("sha256").update(s, "utf8").digest();
}

export function createPlaybackSession(db: Database, input: {
  kind: "LIVE"|"MOVIE"|"EPISODE";
  url: string;
  headers: Record<string,string>;
}) {
  const ttl = parseInt(process.env.PLAY_TTL_SECONDS || "3600", 10) * 1000;
  const now = Date.now();
  const sessionId = id("play");
  db.prepare(`
    INSERT INTO playback_sessions (id, kind, url, headers_json, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, input.kind, input.url, JSON.stringify(input.headers), now, now + ttl);
  return { id: sessionId, expiresAt: now + ttl };
}

export function getPlaybackSession(db: Database, sessionId: string) {
  const row = db.prepare("SELECT * FROM playback_sessions WHERE id = ?").get(sessionId) as any;
  if (!row) return null;
  if (row.expires_at < Date.now()) return null;
  return {
    id: row.id as string,
    kind: row.kind as string,
    url: row.url as string,
    headers: JSON.parse(row.headers_json) as Record<string,string>,
    createdAt: row.created_at as number,
    expiresAt: row.expires_at as number
  };
}

export function signUrl(upstreamUrl: string): string {
  const payload = Buffer.from(upstreamUrl, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", hmacSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySignedUrl(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", hmacSecret()).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function checkUpstreamAllowed(rawUrl: string) {
  const u = new URL(rawUrl);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http/https upstream URLs are allowed");
  if (isBlockedHost(u.hostname)) throw new Error("Blocked upstream host");
  if (!isAllowlistedHost(u.hostname)) throw new Error("Upstream host not in allowlist");
}

export function rewriteHlsManifest(manifestText: string, manifestUrl: string, playId: string) {
  // Rewrites every non-comment line into: /proxy/hls/{playId}/u/{signedToken}
  // Handles both master and media playlists.
  const lines = manifestText.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      out.push(line);
      continue;
    }
    const abs = absolutize(manifestUrl, trimmed);
    const signed = signUrl(abs);
    out.push(`/proxy/hls/${playId}/u/${signed}`);
  }
  return out.join("\n");
}
