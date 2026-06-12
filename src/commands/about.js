export default function register(bot) {
  bot.command("about", async (ctx) => {
    await ctx.reply("TapChef is a cooking game for Telegram. Tap ingredients, spend energy, cook meals, finish daily tasks, and earn fictional Chef Points.");
  });
}
