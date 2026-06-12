import { cfg } from "../lib/config.js";
import { addTurn, clearUserMemory, getRecentTurns } from "../lib/memory.js";
import { aiChat } from "../lib/ai.js";
import { BOT_PROFILE } from "../lib/botProfile.js";
import { safeErr } from "../lib/utils.js";

const inFlightByChat = new Map();
let globalInFlight = 0;
const GLOBAL_CAP = 1;

export function registerAgent(bot) {
  bot.command("reset", async (ctx) => {
    await clearUserMemory({ platform: "telegram", userId: ctx.from?.id, chatId: ctx.chat?.id });
    await ctx.reply("Helper memory cleared.");
  });

  bot.on("message:text", async (ctx, next) => {
    const raw = ctx.message?.text || "";
    if (raw.startsWith("/")) return next();

    const chatType = ctx.chat?.type || "private";
    const isPrivate = chatType === "private";
    const botUsername = ctx.me?.username || ctx.botInfo?.username || "";
    const replyTo = ctx.message?.reply_to_message;
    const isReplyToBot = !!replyTo?.from?.is_bot && String(replyTo?.from?.username || "").toLowerCase() === String(botUsername || "").toLowerCase();
    const entities = Array.isArray(ctx.message?.entities) ? ctx.message.entities : [];
    const isMentioned = !!botUsername && entities.some((e) => {
      if (e?.type !== "mention") return false;
      const s = raw.slice(e.offset, e.offset + e.length);
      return s.toLowerCase() === `@${String(botUsername).toLowerCase()}`;
    });

    if (!isPrivate && !isMentioned && !isReplyToBot) return next();

    let text = raw;
    if (botUsername) {
      const re = new RegExp(`@${String(botUsername)}`, "ig");
      text = text.replace(re, "").trim();
    }
    if (!text) return next();
    if (!cfg.NATURAL_CHAT_MODE) return next();
    if (!cfg.COOKMYBOTS_AI_ENDPOINT || !cfg.COOKMYBOTS_AI_KEY) return next();

    const chatKey = String(ctx.chat?.id || ctx.from?.id || "");
    if (inFlightByChat.get(chatKey)) {
      await ctx.reply("I’m working on your last request…");
      return;
    }
    if (globalInFlight >= GLOBAL_CAP) {
      await ctx.reply("Busy, try again in a moment.");
      return;
    }

    inFlightByChat.set(chatKey, true);
    globalInFlight += 1;

    try {
      await addTurn({ platform: "telegram", userId: ctx.from?.id, chatId: ctx.chat?.id, role: "user", text });
      const history = await getRecentTurns({ platform: "telegram", userId: ctx.from?.id, chatId: ctx.chat?.id, limit: 10 });
      const messages = [
        { role: "system", content: BOT_PROFILE },
        ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.text || "").slice(0, 1000) })),
        { role: "user", content: text.slice(0, 1000) }
      ];

      console.log("[ai] chat start", { platform: "telegram", feature: "helper" });
      const res = await aiChat(cfg, { messages, meta: { platform: "telegram", feature: "helper" } }, { retries: 1, timeoutMs: cfg.AI_TIMEOUT_MS });
      if (!res.ok) {
        console.error("[ai] chat failure", { platform: "telegram", feature: "helper", err: res.error || "AI failure" });
        await ctx.reply("I can help with TapChef commands. Try /help.");
        return;
      }

      const reply = res?.json?.output?.content || "I can help with TapChef. Try /help.";
      console.log("[ai] chat success", { platform: "telegram", feature: "helper" });
      await addTurn({ platform: "telegram", userId: ctx.from?.id, chatId: ctx.chat?.id, role: "assistant", text: reply });
      await ctx.reply(String(reply).slice(0, 1200));
    } catch (err) {
      console.error("[ai] chat failure", { platform: "telegram", feature: "helper", err: safeErr(err) });
      await ctx.reply("Try /help for the game commands.");
    } finally {
      inFlightByChat.delete(chatKey);
      globalInFlight = Math.max(0, globalInFlight - 1);
    }
  });
}
