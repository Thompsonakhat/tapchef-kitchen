const base = (
  process.env.RENDER_EXTERNAL_URL ||
  process.env.PUBLIC_BASE_URL ||
  process.env.WEBAPP_URL ||
  process.env.WEB_APP_URL ||
  process.env.PUBLIC_URL ||
  ""
).replace(/\/+$/, "").replace(/\/app$/i, "");

export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  MONGODB_URI: process.env.MONGODB_URI || "",
  PORT: Number(process.env.PORT || 3000),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "",
  MINI_APP_URL: base ? (base + "/app") : "",
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS || 600000),
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES || 2),
  CONCURRENCY: Number(process.env.CONCURRENCY || 20),
  COOKMYBOTS_AI_ENDPOINT: process.env.COOKMYBOTS_AI_ENDPOINT || "",
  COOKMYBOTS_AI_KEY: process.env.COOKMYBOTS_AI_KEY || "",
  AI_DEBUG: String(process.env.AI_DEBUG || "0") === "1",
  AI_MODEL: process.env.AI_MODEL || "",
  NATURAL_CHAT_MODE: String(process.env.NATURAL_CHAT_MODE || "1") === "1",
  NATURAL_CHAT_GROUP_REQUIRE_MENTION: String(process.env.NATURAL_CHAT_GROUP_REQUIRE_MENTION || "1") === "1",
  WEB3_CHAT_MODE: String(process.env.WEB3_CHAT_MODE || "off")
};
