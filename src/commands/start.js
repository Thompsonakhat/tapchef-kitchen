import { InlineKeyboard } from "grammy";
import { cfg } from "../lib/config.js";
import { bootstrapPlayer } from "../services/game.js";

export default function register(bot) {
  bot.command("start", async (ctx) => {
    if (ctx.from) await bootstrapPlayer(ctx.from);
    const text = cfg.MINI_APP_URL
      ? "Welcome to TapChef. Tap ingredients, cook meals, finish daily tasks, and climb the Chef Points leaderboard. Use /play to open the kitchen."
      : "Welcome to TapChef. Tap ingredients, cook meals, finish daily tasks, and climb the Chef Points leaderboard. Mini App URL is not configured yet.";

    const keyboard = cfg.MINI_APP_URL
      ? new InlineKeyboard().webApp("Open Kitchen", cfg.MINI_APP_URL)
      : undefined;

    await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
  });
}
