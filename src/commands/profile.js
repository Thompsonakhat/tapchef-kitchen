import { bootstrapPlayer, formatProfileText } from "../services/game.js";

export default function register(bot) {
  bot.command("profile", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Profile unavailable.");
      return;
    }
    const state = await bootstrapPlayer(ctx.from);
    await ctx.reply(formatProfileText(state));
  });
}
