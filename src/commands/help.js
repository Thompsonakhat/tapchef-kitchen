export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply([
      "TapChef commands:",
      "/start - welcome",
      "/help - commands",
      "/play - open the kitchen",
      "/profile - your stats",
      "/leaderboard - top chefs",
      "/about - how TapChef works"
    ].join("\n"));
  });
}
