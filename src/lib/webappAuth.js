import crypto from "node:crypto";
import { cfg } from "./config.js";

function parseInitData(initData) {
  const params = new URLSearchParams(String(initData || ""));
  const data = {};
  for (const [k, v] of params.entries()) data[k] = v;
  return data;
}

export function validateTelegramInitData(initData) {
  const token = cfg.TELEGRAM_BOT_TOKEN || "";
  if (!token || !initData) return { ok: false, user: null };

  const data = parseInitData(initData);
  const hash = data.hash || "";
  delete data.hash;

  const checkString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const computed = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  if (!hash || computed !== hash) return { ok: false, user: null };

  let user = null;
  try {
    user = data.user ? JSON.parse(data.user) : null;
  } catch {
    user = null;
  }

  return { ok: true, user };
}
