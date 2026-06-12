import { getDb } from "./db.js";
import { safeErr } from "./utils.js";

const COL = "memory_messages";
const memoryStore = new Map();

function keyOf({ platform, userId, chatId }) {
  return [platform, String(userId || ""), String(chatId || "")].join(":");
}

export async function addTurn({ mongoUri, platform, userId, chatId, role, text }) {
  const doc = {
    platform,
    userId: String(userId || ""),
    chatId: String(chatId || ""),
    role,
    text: String(text || "").slice(0, 2000),
    ts: new Date()
  };

  const db = await getDb();
  if (!db) {
    const k = keyOf({ platform, userId, chatId });
    const arr = memoryStore.get(k) || [];
    arr.push({ role: doc.role, text: doc.text, ts: doc.ts });
    if (arr.length > 20) arr.splice(0, arr.length - 20);
    memoryStore.set(k, arr);
    return;
  }

  try {
    await db.collection(COL).insertOne(doc);
  } catch (err) {
    console.error("[db] memory_messages insertOne failure", { err: safeErr(err) });
  }
}

export async function getRecentTurns({ platform, userId, chatId, limit = 14 }) {
  const db = await getDb();
  if (!db) {
    const arr = memoryStore.get(keyOf({ platform, userId, chatId })) || [];
    return arr.slice(-limit).map((r) => ({ role: r.role, text: r.text }));
  }

  try {
    const rows = await db.collection(COL)
      .find({ platform, userId: String(userId || ""), chatId: String(chatId || "") })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();
    return rows.reverse().map((r) => ({ role: r.role, text: r.text }));
  } catch (err) {
    console.error("[db] memory_messages find failure", { err: safeErr(err) });
    return [];
  }
}

export async function clearUserMemory({ platform, userId, chatId }) {
  const db = await getDb();
  if (!db) {
    memoryStore.delete(keyOf({ platform, userId, chatId }));
    return;
  }

  try {
    await db.collection(COL).deleteMany({ platform, userId: String(userId || ""), chatId: String(chatId || "") });
  } catch (err) {
    console.error("[db] memory_messages deleteMany failure", { err: safeErr(err) });
  }
}
