export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply([
      "TapChef commands:",
      "/start - welcome and intro",
      "/help - commands and features",
      "/play - open the kitchen Mini App",
      "/profile - your stats, tasks, recipes, and badges",
      "/leaderboard - top 10 chefs plus your own rank",
      "/about - how TapChef works",
      "",
      "Mini App features:",
      "Achievements: earn badges for first tap, 100 taps, 10 meals, and a 7 day streak.",
      "Recipe Book: unlock fictional recipes with Chef Points.",
      "Kitchen Shop: spend fictional Chef Points on cosmetic kitchen themes only.",
      "Sound Toggle: switch kitchen sound on or off in settings.",
      "Leaderboard: your rank is shown even if you are outside the top 10."
    ].join("\n"));
  });
}
