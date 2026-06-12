import { MongoClient } from "mongodb";
import { cfg } from "./config.js";
import { safeErr } from "./utils.js";

let client = null;
let db = null;
let warnedNoDb = false;

export async function connectDb() {
  if (!cfg.MONGODB_URI) {
    if (!warnedNoDb) {
      warnedNoDb = true;
      console.warn("[db] MONGODB_URI missing, using in-memory fallback");
    }
    return null;
  }
  if (db) return db;
  try {
    client = new MongoClient(cfg.MONGODB_URI, { maxPoolSize: 10, ignoreUndefined: true });
    await client.connect();
    db = client.db();
    await ensureIndexes(db);
    console.log("[db] connected", { mongoSet: true });
    return db;
  } catch (err) {
    console.error("[db] connect failure", { err: safeErr(err) });
    return null;
  }
}

export async function getDb() {
  if (db) return db;
  return connectDb();
}

async function ensureIndexes(database) {
  try {
    await database.collection("users").createIndex({ telegramUserId: 1 }, { unique: true });
    await database.collection("users").createIndex({ totalChefPoints: -1 });
    await database.collection("daily_task_progress").createIndex({ telegramUserId: 1, dateKey: 1 }, { unique: true });
    await database.collection("memory_messages").createIndex({ userId: 1, chatId: 1, ts: -1 });
    await database.collection("game_events").createIndex({ telegramUserId: 1, createdAt: -1 });
  } catch (err) {
    console.error("[db] ensureIndexes failure", { err: safeErr(err) });
  }
}
