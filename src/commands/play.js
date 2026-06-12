import { InlineKeyboard } from "grammy";
import { cfg } from "../lib/config.js";
import { bootstrapPlayer } from "../services/game.js";

export default function register(bot) {
  bot.command("play", async (ctx) => {
    if (ctx.from) await bootstrapPlayer(ctx.from);
    if (!cfg.MINI_APP_URL) {
      await ctx.reply("Mini App URL is not configured yet.");
      return;
    }
    const keyboard = new InlineKeyboard().webApp("Open Kitchen", cfg.MINI_APP_URL);
    await ctx.reply("Your kitchen is ready.", { reply_markup: keyboard });
  });
}
