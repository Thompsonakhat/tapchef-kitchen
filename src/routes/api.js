import express from "express";
import { validateTelegramInitData } from "../lib/webappAuth.js";
import {
  bootstrapPlayer,
  buyTheme,
  cookMeal,
  getLeaderboard,
  getProfile,
  tapIngredient,
  unlockRecipe,
  updateSoundSetting
} from "../services/game.js";
import { safeErr } from "../lib/utils.js";

const router = express.Router();
const rateMap = new Map();

function takeRate(key, limit = 8, windowMs = 4000) {
  const now = Date.now();
  const arr = rateMap.get(key) || [];
  const next = arr.filter((t) => now - t < windowMs);
  if (next.length >= limit) {
    rateMap.set(key, next);
    return false;
  }
  next.push(now);
  rateMap.set(key, next);
  return true;
}

function authFrom(req) {
  const initData = req.body?.initData || req.headers["x-telegram-init-data"] || "";
  const auth = validateTelegramInitData(initData);
  return auth;
}

router.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

router.post("/game/bootstrap", async (req, res) => {
  try {
    console.log("[api] bootstrap start");
    const auth = authFrom(req);
    if (!auth.ok || !auth.user?.id) return res.status(401).json({ ok: false, message: "Unauthorized" });
    const state = await bootstrapPlayer(auth.user);
    const leaderboard = await getLeaderboard(10, String(auth.user.id));
    console.log("[api] bootstrap success");
    res.json({ ok: true, state, leaderboard });
  } catch (err) {
    console.error("[api] bootstrap failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Failed to load game" });
  }
});

router.post("/game/tap", async (req, res) => {
  try {
    const auth = authFrom(req);
    if (!auth.ok || !auth.user?.id) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!takeRate(`tap:${auth.user.id}`)) return res.status(429).json({ ok: false, message: "Slow down" });
    const result = await tapIngredient(auth.user);
    res.json(result);
  } catch (err) {
    console.error("[api] tap failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Tap failed" });
  }
});

router.post("/game/cook", async (req, res) => {
  try {
    const auth = authFrom(req);
    if (!auth.ok || !auth.user?.id) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!takeRate(`cook:${auth.user.id}`, 4, 4000)) return res.status(429).json({ ok: false, message: "Slow down" });
    const result = await cookMeal(auth.user);
    res.json(result);
  } catch (err) {
    console.error("[api] cook failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Cook failed" });
  }
});

router.post("/game/profile", async (req, res) => {
  try {
    const auth = authFrom(req);
    if (!auth.ok || !auth.user?.id) return res.status(401).json({ ok: false, message: "Unauthorized" });
    const state = await getProfile(auth.user);
    res.json({ ok: true, state });
  } catch (err) {
    console.error("[api] profile failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Profile failed" });
  }
});

router.post("/game/leaderboard", async (req, res) => {
  try {
    const auth = authFrom(req);
    if (!auth.ok || !auth.user?.id) return res.status(401).json({ ok: false, message: "Unauthorized" });
    const leaderboard = await getLeaderboard(10, String(auth.user.id));
    res.json({ ok: true, leaderboard });
  } catch (err) {
    console.error("[api] leaderboard failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Leaderboard failed" });
  }
});

router.post("/game/settings/sound", async (req, res) => {
  try {
    const auth = authFrom(req);
    if (!auth.ok || !auth.user?.id) return res.status(401).json({ ok: false, message: "Unauthorized" });
    const result = await updateSoundSetting(auth.user, !!req.body?.soundEnabled);
    res.json(result);
  } catch (err) {
    console.error("[api] sound setting failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Settings update failed" });
  }
});

router.post("/game/recipes/unlock", async (req, res) => {
  try {
    const auth = authFrom(req);
    if (!auth.ok || !auth.user?.id) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!takeRate(`recipe:${auth.user.id}`, 4, 4000)) return res.status(429).json({ ok: false, message: "Slow down" });
    const result = await unlockRecipe(auth.user, String(req.body?.recipeKey || ""));
    res.json(result);
  } catch (err) {
    console.error("[api] recipe unlock failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Recipe unlock failed" });
  }
});

router.post("/game/shop/theme", async (req, res) => {
  try {
    const auth = authFrom(req);
    if (!auth.ok || !auth.user?.id) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!takeRate(`theme:${auth.user.id}`, 4, 4000)) return res.status(429).json({ ok: false, message: "Slow down" });
    const result = await buyTheme(auth.user, String(req.body?.themeKey || ""));
    res.json(result);
  } catch (err) {
    console.error("[api] theme shop failure", { err: safeErr(err) });
    res.status(500).json({ ok: false, message: "Theme update failed" });
  }
});

export function createApiRouter() {
  return router;
}
