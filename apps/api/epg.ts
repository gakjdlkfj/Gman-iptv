import type Database from "better-sqlite3";
import { id } from "../util/id.js";
import { fetchText } from "./http.js";
import { parseXmlTv } from "../parsers/xmltv.js";
import { getSource } from "./ingest.js";
import { decryptString } from "../util/crypto.js";
import { XtreamClient } from "../parsers/xtream.js";

export async function refreshEpg(db: Database, sourceId: string) {
  const src = getSource(db, sourceId);
  if (!src) throw new Error("Source not found");
  const headers = JSON.parse(src.headers_json) as Record<string,string>;
  const cfg = JSON.parse(src.config_json) as any;

  let epgUrl: string | null = null;
  if (src.kind === "M3U") {
    epgUrl = cfg.epgUrl ?? null;
  } else {
    epgUrl = null; // default to Xtream XMLTV
    const xc = new XtreamClient(
      { baseUrl: cfg.baseUrl, username: cfg.username, password: decryptString(cfg.passwordEnc) },
      src.timeout_ms,
      headers
    );
    epgUrl = xc.xmltvUrl();
  }

  if (!epgUrl) return { inserted: 0, message: "No EPG URL configured." };

  const xml = await fetchText(epgUrl, { headers, timeoutMs: src.timeout_ms });
  const programmes = parseXmlTv(xml);

  // Replace full EPG for the source; in production do incremental upsert by (channel_key,start,end,title)
  db.prepare("DELETE FROM epg_programs WHERE source_id = ?").run(sourceId);

  const ins = db.prepare(`
    INSERT INTO epg_programs (id, source_id, channel_key, title, start_utc_ms, end_utc_ms, desc)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of programmes) {
    ins.run(id("epg"), sourceId, p.channel, p.title, p.startUtcMs, p.endUtcMs, p.desc ?? null);
  }

  return { inserted: programmes.length, message: "EPG refreshed." };
}

export function queryEpg(db: Database, params: { channelKeys: string[]; fromUtcMs: number; toUtcMs: number }) {
  // inclusive overlap query
  const rows = db.prepare(`
    SELECT * FROM epg_programs
    WHERE channel_key IN (${params.channelKeys.map(() => "?").join(",")})
      AND end_utc_ms > ?
      AND start_utc_ms < ?
    ORDER BY channel_key ASC, start_utc_ms ASC
  `).all(...params.channelKeys, params.fromUtcMs, params.toUtcMs) as any[];

  return rows;
}
