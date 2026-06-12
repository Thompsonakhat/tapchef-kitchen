import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cfg } from "./lib/config.js";
import { createApiRouter } from "./routes/api.js";
import { safeErr } from "./lib/utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappDist = path.resolve(__dirname, "../webapp/dist");

export async function startServer(_bot) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    req.setTimeout?.(cfg.AI_TIMEOUT_MS);
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, miniAppUrlSet: !!cfg.MINI_APP_URL });
  });

  app.use("/api", createApiRouter());
  app.use("/app/assets", express.static(path.join(webappDist, "assets"), { maxAge: "1h" }));
  app.use("/app", express.static(webappDist));

  const sendIndex = (_req, res) => {
    res.sendFile(path.join(webappDist, "index.html"));
  };

  app.get("/app", sendIndex);
  app.get("/app/*splat", sendIndex);

  app.use((err, _req, res, _next) => {
    console.error("[server] failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Server error" });
  });

  await new Promise((resolve) => {
    app.listen(cfg.PORT, () => {
      console.log("[server] started", { port: cfg.PORT, miniAppUrl: !!cfg.MINI_APP_URL });
      resolve();
    });
  });
}
