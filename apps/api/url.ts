import net from "node:net";

export function inferStreamType(url: string): "HLS" | "MP4" | "UNKNOWN" {
  const u = url.toLowerCase();
  if (u.includes(".m3u8")) return "HLS";
  if (u.includes(".mp4") || u.includes(".m4v")) return "MP4";
  return "UNKNOWN";
}

export function absolutize(base: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

export function isPrivateIp(ip: string): boolean {
  // IPv4 ranges
  const v = net.isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map((x) => parseInt(x, 10));
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }
  if (v === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7
    if (normalized.startswith?.("fe80")) return true; // link-local (non-standard helper)
    return false;
  }
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (net.isIP(host) && isPrivateIp(host)) return true;
  return false;
}

export function isAllowlistedHost(hostname: string): boolean {
  const allow = (process.env.PROXY_HOST_ALLOWLIST || "").split(",").map(s => s.trim()).filter(Boolean);
  if (allow.length === 0) return true; // dev default
  return allow.includes(hostname);
}
