import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { openDb } from "./db.js";
import { initSchema } from "./schema.js";
import { sourcesRoutes } from "./routes/sources.js";
import { catalogRoutes } from "./routes/catalog.js";
import { epgRoutes } from "./routes/epg.js";
import { userDataRoutes } from "./routes/userdata.js";
import { playbackRoutes } from "./routes/playback.js";
import { listSources, refreshSource } from "./services/ingest.js";
import { refreshEpg } from "./services/epg.js";

declare module "fastify" {
  interface FastifyInstance {
    db: any;
  }
}

const PORT = parseInt(process.env.PORT || "8787", 10);
const DB_PATH = process.env.DB_PATH || "./data/app.sqlite";

const app = Fastify({
  logger: {
    transport: { target: "pino-pretty" }
  }
});

await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || "dev_secret" });

app.db = openDb(DB_PATH);
initSchema(app.db);

// Routes (this scaffold doesn't enforce auth yet; add preHandler with JWT as needed)
await app.register(async (r) => {
  await sourcesRoutes(r);
  await catalogRoutes(r);
  await epgRoutes(r);
  await userDataRoutes(r);
  await playbackRoutes(r);
}, { prefix: "/api" });

// Health
app.get("/health", async () => ({ ok: true, now: Date.now() }));

// Simple refresh scheduler (replace with BullMQ in production)
function startSchedulers() {
  const tickMs = 60_000;
  setInterval(async () => {
    const sources = listSources(app.db);
    for (const s of sources) {
      const due = !s.last_refresh_at || (Date.now() - s.last_refresh_at) > (s.refresh_interval_minutes * 60_000);
      if (!due) continue;
      try {
        await refreshSource(app.db, s.id);
        // EPG refresh after catalog refresh (optional)
        await refreshEpg(app.db, s.id).catch(() => {});
        app.log.info({ sourceId: s.id }, "refreshed source + epg");
      } catch (e: any) {
        app.log.warn({ sourceId: s.id, err: String(e?.message ?? e) }, "refresh failed");
      }
    }
  }, tickMs);
}

startSchedulers();

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  app.log.info(`API listening on :${PORT}`);
}).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
