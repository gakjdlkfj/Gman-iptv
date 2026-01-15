import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { id } from "../util/id.js";
import { sha256Hex } from "../util/crypto.js";

export async function userDataRoutes(app: FastifyInstance) {
  // Favorites
  app.get("/favorites", async () => {
    return app.db.prepare("SELECT * FROM favorites ORDER BY created_at DESC").all();
  });

  app.post("/favorites/toggle", async (req) => {
    const b = z.object({
      kind: z.enum(["LIVE","MOVIE","SERIES","EPISODE"]),
      refId: z.string().min(1)
    }).parse(req.body);

    const existing = app.db.prepare("SELECT id FROM favorites WHERE kind = ? AND ref_id = ?").get(b.kind, b.refId) as any;
    if (existing) {
      app.db.prepare("DELETE FROM favorites WHERE id = ?").run(existing.id);
      return { ok: true, favorited: false };
    }
    app.db.prepare("INSERT INTO favorites (id, kind, ref_id, created_at) VALUES (?, ?, ?, ?)").run(id("fav"), b.kind, b.refId, Date.now());
    return { ok: true, favorited: true };
  });

  // History / continue watching
  app.get("/history", async () => {
    return app.db.prepare("SELECT * FROM history ORDER BY updated_at DESC LIMIT 200").all();
  });

  app.post("/history/upsert", async (req) => {
    const b = z.object({
      kind: z.enum(["LIVE","MOVIE","SERIES","EPISODE"]),
      refId: z.string().min(1),
      positionSeconds: z.number().min(0).default(0)
    }).parse(req.body);

    const existing = app.db.prepare("SELECT id FROM history WHERE kind = ? AND ref_id = ?").get(b.kind, b.refId) as any;
    if (existing) {
      app.db.prepare("UPDATE history SET position_seconds = ?, updated_at = ? WHERE id = ?").run(b.positionSeconds, Date.now(), existing.id);
      return { ok: true };
    }
    app.db.prepare("INSERT INTO history (id, kind, ref_id, position_seconds, updated_at) VALUES (?, ?, ?, ?, ?)").run(id("his"), b.kind, b.refId, b.positionSeconds, Date.now());
    return { ok: true };
  });

  // Profiles + parental controls (simple scaffold)
  app.get("/profiles", async () => {
    return app.db.prepare("SELECT id, name, type, created_at FROM profiles ORDER BY created_at ASC").all();
  });

  app.post("/profiles", async (req) => {
    const b = z.object({
      name: z.string().min(1),
      type: z.enum(["KIDS","ADULT"]),
      pin: z.string().min(4).max(16).optional()
    }).parse(req.body);

    const pid = id("prof");
    app.db.prepare("INSERT INTO profiles (id, name, type, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
      pid, b.name, b.type, b.pin ? sha256Hex(b.pin) : null, Date.now()
    );
    return { ok: true, id: pid };
  });

  app.post("/profiles/:id/locks", async (req) => {
    const profileId = (req.params as any).id as string;
    const b = z.object({
      kind: z.enum(["LIVE","MOVIE","SERIES"]),
      value: z.string().min(1)
    }).parse(req.body);

    app.db.prepare("INSERT INTO profile_locks (id, profile_id, kind, value) VALUES (?, ?, ?, ?)").run(id("lock"), profileId, b.kind, b.value);
    return { ok: true };
  });

  app.get("/profiles/:id/locks", async (req) => {
    const profileId = (req.params as any).id as string;
    return app.db.prepare("SELECT * FROM profile_locks WHERE profile_id = ?").all(profileId);
  });
}
