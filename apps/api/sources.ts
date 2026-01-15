import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { addM3USource, addXtreamSource, listSources, refreshSource, validateSource } from "../services/ingest.js";
import { decryptString } from "../util/crypto.js";

const HeadersSchema = z.record(z.string()).default({});

export async function sourcesRoutes(app: FastifyInstance) {
  app.get("/sources", async () => {
    const sources = listSources(app.db);
    return sources.map(s => ({
      id: s.id,
      kind: s.kind,
      name: s.name,
      refreshIntervalMinutes: s.refresh_interval_minutes,
      timeoutMs: s.timeout_ms,
      lastRefreshAt: s.last_refresh_at,
      lastError: s.last_error
    }));
  });

  app.post("/sources/validate", async (req, reply) => {
    const schema = z.object({
      kind: z.enum(["M3U", "XTREAM"]),
      config: z.any(),
      headers: HeadersSchema,
      timeoutMs: z.number().int().min(1000).max(120000).default(15000)
    });
    const body = schema.parse(req.body);

    try {
      if (body.kind === "XTREAM") {
        // config is { baseUrl, username, password }
        const cfg = z.object({
          baseUrl: z.string().url(),
          username: z.string().min(1),
          password: z.string().min(1)
        }).parse(body.config);
        const counts = await validateSource({ kind: "XTREAM", config: cfg, headers: body.headers, timeoutMs: body.timeoutMs });
        return { ok: true, sourceKind: "XTREAM", counts };
      } else {
        const cfg = z.object({
          m3uUrl: z.string().url()
        }).parse(body.config);
        const counts = await validateSource({ kind: "M3U", config: cfg, headers: body.headers, timeoutMs: body.timeoutMs });
        return { ok: true, sourceKind: "M3U", counts };
      }
    } catch (e: any) {
      reply.code(400);
      return { ok: false, sourceKind: body.kind, message: String(e?.message ?? e) };
    }
  });

  app.post("/sources", async (req, reply) => {
    const schema = z.object({
      kind: z.enum(["M3U", "XTREAM"]),
      name: z.string().min(1),
      headers: HeadersSchema,
      refreshIntervalMinutes: z.number().int().min(5).max(10080).default(360),
      timeoutMs: z.number().int().min(1000).max(120000).default(15000),

      // M3U
      m3uUrl: z.string().url().optional(),
      epgUrl: z.string().url().optional(),

      // Xtream
      baseUrl: z.string().url().optional(),
      username: z.string().optional(),
      password: z.string().optional()
    });
    const b = schema.parse(req.body);

    let sourceId: string;
    if (b.kind === "M3U") {
      if (!b.m3uUrl) return reply.code(400).send({ ok: false, message: "m3uUrl required" });
      sourceId = addM3USource(app.db, {
        name: b.name,
        m3uUrl: b.m3uUrl,
        epgUrl: b.epgUrl,
        headers: b.headers,
        refreshIntervalMinutes: b.refreshIntervalMinutes,
        timeoutMs: b.timeoutMs
      });
    } else {
      if (!b.baseUrl || !b.username || !b.password) return reply.code(400).send({ ok: false, message: "baseUrl/username/password required" });
      sourceId = addXtreamSource(app.db, {
        name: b.name,
        baseUrl: b.baseUrl,
        username: b.username,
        password: b.password,
        headers: b.headers,
        refreshIntervalMinutes: b.refreshIntervalMinutes,
        timeoutMs: b.timeoutMs
      });
    }

    // Kick off refresh immediately (async)
    refreshSource(app.db, sourceId).catch(() => {});
    return { ok: true, id: sourceId };
  });

  app.post("/sources/:id/refresh", async (req, reply) => {
    const sourceId = (req.params as any).id as string;
    try {
      await refreshSource(app.db, sourceId);
      return { ok: true };
    } catch (e: any) {
      reply.code(400);
      return { ok: false, message: String(e?.message ?? e) };
    }
  });

  // Debug endpoint: get decrypted config (disable in production!)
  app.get("/sources/:id/_debug", async (req, reply) => {
    const sourceId = (req.params as any).id as string;
    const row = app.db.prepare("SELECT * FROM sources WHERE id = ?").get(sourceId) as any;
    if (!row) return reply.code(404).send({ ok: false });
    const cfg = JSON.parse(row.config_json);
    if (row.kind === "XTREAM") {
      cfg.password = "[encrypted]";
      cfg.passwordEncPresent = true;
    }
    return { ok: true, kind: row.kind, name: row.name, cfg, headers: JSON.parse(row.headers_json) };
  });
}
