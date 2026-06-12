import "dotenv/config";

function safeErr(err) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || String(err);
}

process.on("unhandledRejection", (err) => {
  console.error("[process] unhandledRejection", { err: safeErr(err) });
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException", { err: safeErr(err) });
  process.exit(1);
});

async function boot() {
  try {
    console.log("[boot] start");
    const [{ cfg }, { createBot }, { startServer }, { startBotPolling }, { connectDb }] = await Promise.all([
      import("./lib/config.js"),
      import("./bot.js"),
      import("./server.js"),
      import("./telegram/polling.js"),
      import("./lib/db.js")
    ]);

    console.log("[boot] config", {
      telegramTokenSet: !!cfg.TELEGRAM_BOT_TOKEN,
      mongoSet: !!cfg.MONGODB_URI,
      publicBaseUrlSet: !!cfg.PUBLIC_BASE_URL,
      aiEndpointSet: !!cfg.COOKMYBOTS_AI_ENDPOINT,
      aiKeySet: !!cfg.COOKMYBOTS_AI_KEY
    });

    if (!cfg.TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN is required. Add it in env and redeploy.");
      process.exit(1);
    }

    await connectDb();
    const bot = createBot(cfg.TELEGRAM_BOT_TOKEN);
    await startServer(bot);
    await startBotPolling(bot);
    console.log("[boot] done");
  } catch (err) {
    console.error("[boot] failure", { err: safeErr(err), code: err?.code || "" });
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      console.error("Check ESM import paths and ensure all files exist.");
    }
    process.exit(1);
  }
}

boot();
