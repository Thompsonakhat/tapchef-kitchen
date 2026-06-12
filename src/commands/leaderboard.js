import { getLeaderboard } from "../services/game.js";

export default function register(bot) {
  bot.command("leaderboard", async (ctx) => {
    const board = await getLeaderboard(10, String(ctx.from?.id || ""));
    const lines = ["Top Chefs:"];
    for (const row of board.top) {
      lines.push(`${row.rank}. ${row.displayName} — ${row.totalChefPoints}`);
    }
    if (board.currentUserRank) lines.push(`Your rank: ${board.currentUserRank}`);
    await ctx.reply(lines.join("\n"));
  });
}
