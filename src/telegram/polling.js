import { run } from "@grammyjs/runner";
import { safeErr, sleep, getMemoryStats } from "../lib/utils.js";

let runner = null;
let restartLock = false;
let cycle = 0;

export async function startBotPolling(bot) {
  if (runner) return;
  let backoff = 2000;

  while (true) {
    try {
      console.log("[polling] start");
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      await bot.init();
      runner = run(bot, { runner: { fetch: { allowed_updates: ["message", "callback_query"] } }, concurrency: 1 });
      console.log("[polling] started");

      const memTimer = setInterval(() => {
        console.log("[mem]", getMemoryStats());
      }, 60000);

      runner.task().catch(async (err) => {
        clearInterval(memTimer);
        runner = null;
        console.error("[polling] failure", { err: safeErr(err) });
        throw err;
      });

      while (runner) {
        cycle += 1;
        if (cycle % 60 === 0) console.log("[polling] cycle", { cycle });
        await sleep(1000);
      }
    } catch (err) {
      const msg = safeErr(err);
      console.error("[polling] restart", { err: msg, backoff });
      if (String(msg).includes("409")) {
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 20000);
        continue;
      }
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 20000);
    }
  }
}

export async function stopBotPolling() {
  if (restartLock) return;
  restartLock = true;
  try {
    if (runner) {
      await runner.stop();
      runner = null;
    }
  } finally {
    restartLock = false;
  }
}
