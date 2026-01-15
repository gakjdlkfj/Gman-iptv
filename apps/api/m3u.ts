export interface M3uEntry {
  name: string;
  url: string;
  groupTitle?: string | null;
  tvgId?: string | null;
  tvgName?: string | null;
  tvgLogo?: string | null;
}

const attrRegex = /([\w\-]+)="([^"]*)"/g;

export function parseM3U(text: string): M3uEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const out: M3uEntry[] = [];
  let pendingName: string | null = null;
  let pendingAttrs: Record<string, string> = {};

  for (const line of lines) {
    if (line.startsWith("#EXTINF", true as any)) {
      // EXTINF:-1 tvg-id="x" tvg-logo="y" group-title="News",Channel
      const comma = line.indexOf(",");
      pendingName = comma >= 0 ? line.slice(comma + 1).trim() : "";
      pendingAttrs = {};
      for (const m of line.matchAll(attrRegex)) {
        pendingAttrs[m[1]] = m[2];
      }
    } else if (!line.startsWith("#")) {
      const name = pendingName ?? line;
      out.push({
        name,
        url: line,
        groupTitle: pendingAttrs["group-title"] ?? null,
        tvgId: pendingAttrs["tvg-id"] ?? null,
        tvgName: pendingAttrs["tvg-name"] ?? null,
        tvgLogo: pendingAttrs["tvg-logo"] ?? null
      });
      pendingName = null;
      pendingAttrs = {};
    }
  }
  return out;
}
