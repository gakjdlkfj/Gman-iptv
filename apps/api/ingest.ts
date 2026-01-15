import type Database from "better-sqlite3";
import { id } from "../util/id.js";
import { inferStreamType } from "../util/url.js";
import { parseM3U } from "../parsers/m3u.js";
import { XtreamClient, type XtreamConfig } from "../parsers/xtream.js";
import { fetchText } from "./http.js";
import { encryptString, decryptString } from "../util/crypto.js";

type SourceRow = {
  id: string;
  kind: "M3U" | "XTREAM";
  name: string;
  config_json: string;
  headers_json: string;
  refresh_interval_minutes: number;
  timeout_ms: number;
};

export function listSources(db: Database): SourceRow[] {
  return db.prepare("SELECT * FROM sources ORDER BY name ASC").all() as any;
}

export function getSource(db: Database, sourceId: string): SourceRow | null {
  return (db.prepare("SELECT * FROM sources WHERE id = ?").get(sourceId) as any) ?? null;
}

export function addM3USource(db: Database, input: {
  name: string;
  m3uUrl: string;
  epgUrl?: string;
  headers: Record<string,string>;
  refreshIntervalMinutes: number;
  timeoutMs: number;
}) {
  const sourceId = id("src");
  const config = { m3uUrl: input.m3uUrl, epgUrl: input.epgUrl ?? null };
  db.prepare(`
    INSERT INTO sources (id, kind, name, config_json, headers_json, refresh_interval_minutes, timeout_ms)
    VALUES (?, 'M3U', ?, ?, ?, ?, ?)
  `).run(sourceId, input.name, JSON.stringify(config), JSON.stringify(input.headers), input.refreshIntervalMinutes, input.timeoutMs);

  return sourceId;
}

export function addXtreamSource(db: Database, input: {
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  headers: Record<string,string>;
  refreshIntervalMinutes: number;
  timeoutMs: number;
}) {
  const sourceId = id("src");
  const config = {
    baseUrl: input.baseUrl,
    username: input.username,
    passwordEnc: encryptString(input.password)
  };
  db.prepare(`
    INSERT INTO sources (id, kind, name, config_json, headers_json, refresh_interval_minutes, timeout_ms)
    VALUES (?, 'XTREAM', ?, ?, ?, ?, ?)
  `).run(sourceId, input.name, JSON.stringify(config), JSON.stringify(input.headers), input.refreshIntervalMinutes, input.timeoutMs);

  return sourceId;
}

function clearSourceData(db: Database, sourceId: string) {
  db.prepare("DELETE FROM channels WHERE source_id = ?").run(sourceId);
  db.prepare("DELETE FROM vod WHERE source_id = ?").run(sourceId);
  db.prepare("DELETE FROM episodes WHERE source_id = ?").run(sourceId);
  db.prepare("DELETE FROM epg_programs WHERE source_id = ?").run(sourceId);
}

export async function refreshSource(db: Database, sourceId: string) {
  const src = getSource(db, sourceId);
  if (!src) throw new Error("Source not found");
  const headers = JSON.parse(src.headers_json) as Record<string,string>;
  const cfg = JSON.parse(src.config_json) as any;

  // Replace this with incremental updates for production.
  clearSourceData(db, sourceId);

  try {
    if (src.kind === "M3U") {
      const m3uText = await fetchText(cfg.m3uUrl, { headers, timeoutMs: src.timeout_ms });
      const entries = parseM3U(m3uText);

      const ins = db.prepare(`
        INSERT INTO channels (id, source_id, name, group_title, logo_url, tvg_id, epg_channel_id, stream_url, stream_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const e of entries) {
        const chId = id("ch");
        ins.run(
          chId,
          sourceId,
          e.name,
          e.groupTitle ?? null,
          e.tvgLogo ?? null,
          e.tvgId ?? null,
          null,
          e.url,
          inferStreamType(e.url)
        );
      }
    } else if (src.kind === "XTREAM") {
      const xtcfg: XtreamConfig = {
        baseUrl: cfg.baseUrl,
        username: cfg.username,
        password: decryptString(cfg.passwordEnc)
      };
      const xc = new XtreamClient(xtcfg, src.timeout_ms, headers);

      const liveStreams = await xc.getLiveStreams();
      const insCh = db.prepare(`
        INSERT INTO channels (id, source_id, name, group_title, logo_url, tvg_id, epg_channel_id, stream_url, stream_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of liveStreams) {
        const chId = id("ch");
        // Try HLS first; you can add fallback to .ts in playback recovery.
        const url = xc.buildLiveUrl(s.stream_id, "m3u8");
        insCh.run(
          chId,
          sourceId,
          s.name,
          s.category_id ?? null,
          s.stream_icon ?? null,
          null,
          s.epg_channel_id ?? null,
          url,
          inferStreamType(url)
        );
      }

      const vodStreams = await xc.getVodStreams();
      const insVod = db.prepare(`
        INSERT INTO vod (id, source_id, kind, title, category, poster_url, stream_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const v of vodStreams) {
        const vodId = id("vod");
        const ext = (v.container_extension || "mp4").toLowerCase();
        const url = xc.buildMovieUrl(v.stream_id, ext === "mkv" ? "mp4" : ext); // browsers: mkv often fails
        insVod.run(vodId, sourceId, "MOVIE", v.name, v.category_id ?? null, v.stream_icon ?? null, url);
      }

      const series = await xc.getSeries();
      for (const ser of series) {
        const seriesRowId = id("vod");
        insVod.run(seriesRowId, sourceId, "SERIES", ser.name, ser.category_id ?? null, ser.cover ?? null, null);

        // Episodes are fetched lazily by /series/:id endpoint to avoid huge ingest times.
        // You can optionally prefetch popular series in a background worker.
      }
    }

    db.prepare("UPDATE sources SET last_refresh_at = ?, last_error = NULL WHERE id = ?").run(Date.now(), sourceId);
  } catch (e: any) {
    db.prepare("UPDATE sources SET last_error = ? WHERE id = ?").run(String(e?.message ?? e), sourceId);
    throw e;
  }
}

export async function validateSource(input: { kind: "M3U"|"XTREAM"; config: any; headers: Record<string,string>; timeoutMs: number }) {
  if (input.kind === "M3U") {
    const text = await fetchText(input.config.m3uUrl, { headers: input.headers, timeoutMs: input.timeoutMs });
    const entries = parseM3U(text);
    return { live: entries.length, movies: 0, series: 0 };
  }
  const cfg: XtreamConfig = input.config;
  const xc = new XtreamClient(cfg, input.timeoutMs, input.headers);
  const [live, vod, series] = await Promise.all([
    xc.getLiveStreams().then(x => x.length),
    xc.getVodStreams().then(x => x.length),
    xc.getSeries().then(x => x.length)
  ]);
  return { live, movies: vod, series };
}
