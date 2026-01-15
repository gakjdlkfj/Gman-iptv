import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPlaybackSession, getPlaybackSession, verifySignedUrl, checkUpstreamAllowed, rewriteHlsManifest } from "../services/proxy.js";
import { fetchText } from "../services/http.js";

export async function playbackRoutes(app: FastifyInstance) {
  // Create a playback session for a channel/movie/episode
  app.post("/playback/session", async (req, reply) => {
    const b = z.object({
      kind: z.enum(["LIVE","MOVIE","EPISODE"]),
      url: z.string().url(),
      headers: z.record(z.string()).default({})
    }).parse(req.body);

    // SSRF checks at session creation time
    try {
      checkUpstreamAllowed(b.url);
    } catch (e: any) {
      return reply.code(400).send({ ok: false, message: String(e?.message ?? e) });
    }

    const s = createPlaybackSession(app.db, { kind: b.kind, url: b.url, headers: b.headers });
    return { ok: true, id: s.id, expiresAt: s.expiresAt };
  });

  // Proxy: HLS manifest rewrite
  app.get("/proxy/hls/:playId/manifest.m3u8", async (req, reply) => {
    const playId = (req.params as any).playId as string;
    const s = getPlaybackSession(app.db, playId);
    if (!s) return reply.code(404).send("Not found");

    try {
      checkUpstreamAllowed(s.url);
      const text = await fetchText(s.url, { headers: s.headers, timeoutMs: 15000 });
      const rewritten = rewriteHlsManifest(text, s.url, playId);
      reply.header("content-type", "application/vnd.apple.mpegurl");
      reply.header("cache-control", "no-store");
      return rewritten;
    } catch (e: any) {
      return reply.code(502).send(String(e?.message ?? e));
    }
  });

  // Proxy: any HLS URI (variants/segments/keys) signed
  app.get("/proxy/hls/:playId/u/:token", async (req, reply) => {
    const playId = (req.params as any).playId as string;
    const token = (req.params as any).token as string;

    const s = getPlaybackSession(app.db, playId);
    if (!s) return reply.code(404).send("Not found");

    const upstream = verifySignedUrl(token);
    if (!upstream) return reply.code(400).send("Bad token");

    try {
      checkUpstreamAllowed(upstream);
      const res = await fetch(upstream, { headers: s.headers });
      if (!res.ok) return reply.code(502).send(`Upstream HTTP ${res.status}`);

      // Copy content-type when possible
      const ct = res.headers.get("content-type");
      if (ct) reply.header("content-type", ct);
      reply.header("cache-control", "no-store");

      // Stream body
      return reply.send(res.body as any);
    } catch (e: any) {
      return reply.code(502).send(String(e?.message ?? e));
    }
  });

  // Proxy: file (MP4) - supports range if browser requests it.
  app.get("/proxy/file/:playId", async (req, reply) => {
    const playId = (req.params as any).playId as string;
    const s = getPlaybackSession(app.db, playId);
    if (!s) return reply.code(404).send("Not found");

    try {
      checkUpstreamAllowed(s.url);

      // Forward Range header for seeking
      const headers = { ...s.headers } as any;
      const range = (req.headers as any)["range"];
      if (range) headers["range"] = range;

      const res = await fetch(s.url, { headers });
      if (![200, 206].includes(res.status)) return reply.code(502).send(`Upstream HTTP ${res.status}`);

      // Passthrough headers relevant to ranges
      for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
        const v = res.headers.get(h);
        if (v) reply.header(h, v);
      }
      reply.status(res.status);
      reply.header("cache-control", "no-store");
      return reply.send(res.body as any);
    } catch (e: any) {
      return reply.code(502).send(String(e?.message ?? e));
    }
  });
}
