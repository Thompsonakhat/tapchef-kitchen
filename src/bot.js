import { Bot } from "grammy";
import { registerCommands } from "./commands/loader.js";
import { registerAgent } from "./features/agent.js";

export function createBot(token) {
  const bot = new Bot(token);

  bot.catch((err) => {
    const e = err?.error;
    const msg = e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || String(e);
    console.error("[bot] handler failure", { err: msg });
  });

  registerCommands(bot);
  registerAgent(bot);
  return bot;
}
