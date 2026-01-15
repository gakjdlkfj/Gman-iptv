import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { inferStreamType } from "../util/url.js";
import { XtreamClient } from "../parsers/xtream.js";
import { decryptString } from "../util/crypto.js";
import { id } from "../util/id.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/live/groups", async () => {
    const rows = app.db.prepare(`
      SELECT COALESCE(group_title,'Other') AS groupTitle, COUNT(*) AS count
      FROM channels
      GROUP BY COALESCE(group_title,'Other')
      ORDER BY groupTitle ASC
    `).all() as any[];
    return rows;
  });

  app.get("/live/channels", async (req) => {
    const q = z.object({
      group: z.string().optional(),
      search: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(200),
      offset: z.coerce.number().int().min(0).default(0)
    }).parse((req as any).query);

    const where: string[] = [];
    const params: any[] = [];

    if (q.group) { where.push("COALESCE(group_title,'Other') = ?"); params.push(q.group); }
    if (q.search) { where.push("name LIKE ?"); params.push(`%${q.search}%`); }

    const sql = `
      SELECT * FROM channels
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;
    params.push(q.limit, q.offset);

    return app.db.prepare(sql).all(...params);
  });

  app.get("/vod/movies", async (req) => {
    const q = z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(200),
      offset: z.coerce.number().int().min(0).default(0)
    }).parse((req as any).query);

    const where = ["kind='MOVIE'"];
    const params: any[] = [];
    if (q.category) { where.push("category = ?"); params.push(q.category); }
    if (q.search) { where.push("title LIKE ?"); params.push(`%${q.search}%`); }

    const sql = `
      SELECT * FROM vod
      WHERE ${where.join(" AND ")}
      ORDER BY title ASC
      LIMIT ? OFFSET ?
    `;
    params.push(q.limit, q.offset);
    return app.db.prepare(sql).all(...params);
  });

  app.get("/vod/series", async (req) => {
    const q = z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(200),
      offset: z.coerce.number().int().min(0).default(0)
    }).parse((req as any).query);

    const where = ["kind='SERIES'"];
    const params: any[] = [];
    if (q.category) { where.push("category = ?"); params.push(q.category); }
    if (q.search) { where.push("title LIKE ?"); params.push(`%${q.search}%`); }

    const sql = `
      SELECT * FROM vod
      WHERE ${where.join(" AND ")}
      ORDER BY title ASC
      LIMIT ? OFFSET ?
    `;
    params.push(q.limit, q.offset);
    return app.db.prepare(sql).all(...params);
  });

  // Lazy: fetch series episodes from Xtream on demand (and cache in DB)
  app.get("/series/:seriesId", async (req, reply) => {
    const seriesId = (req.params as any).seriesId as string;
    const series = app.db.prepare("SELECT * FROM vod WHERE id = ? AND kind='SERIES'").get(seriesId) as any;
    if (!series) return reply.code(404).send({ ok: false, message: "Series not found" });

    // Episodes cached?
    const cached = app.db.prepare("SELECT * FROM episodes WHERE series_id = ? ORDER BY season_number, episode_number").all(seriesId) as any[];
    if (cached.length > 0) {
      return { ok: true, series, episodes: cached };
    }

    // Need to hit provider: we require that this series came from an XTREAM source.
    const src = app.db.prepare("SELECT * FROM sources WHERE id = ?").get(series.source_id) as any;
    if (!src || src.kind !== "XTREAM") return reply.code(400).send({ ok: false, message: "Series source is not XTREAM" });
    const cfg = JSON.parse(src.config_json);
    const headers = JSON.parse(src.headers_json);
    const xc = new XtreamClient(
      { baseUrl: cfg.baseUrl, username: cfg.username, password: decryptString(cfg.passwordEnc) },
      src.timeout_ms,
      headers
    );

    // We do not know provider's original series_id if we generated our own UUID.
    // This scaffold stores series as normalized rows; in production store provider_id too.
    // For now, we can't fetch series_info reliably without provider id.
    return reply.code(501).send({
      ok: false,
      message: "This scaffold needs a 'provider_series_id' column to fetch episodes. See README notes."
    });
  });

  app.get("/search", async (req) => {
    const q = z.object({ q: z.string().min(1).max(200) }).parse((req as any).query);
    const term = `%${q.q}%`;

    const channels = app.db.prepare(`
      SELECT id, name, group_title, logo_url, stream_type, stream_url
      FROM channels WHERE name LIKE ?
      ORDER BY name ASC LIMIT 50
    `).all(term);

    const vod = app.db.prepare(`
      SELECT id, kind, title, category, poster_url
      FROM vod WHERE title LIKE ?
      ORDER BY title ASC LIMIT 50
    `).all(term);

    return { channels, vod };
  });
}
