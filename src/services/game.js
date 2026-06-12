import { getDb } from "../lib/db.js";
import { utcDateKey, clamp, safeErr } from "../lib/utils.js";

const ENERGY_MAX = 30;
const ENERGY_REGEN_SECONDS = 60;
const TAPS_PER_MEAL = 10;
const TAP_POINTS = 1;
const MEAL_POINTS = 15;

const mem = {
  users: new Map(),
  tasks: new Map(),
  events: []
};

function defaultUser(tgUser = {}) {
  const now = new Date();
  return {
    telegramUserId: String(tgUser.id || "guest"),
    username: tgUser.username || "",
    firstName: tgUser.first_name || tgUser.firstName || "Chef",
    lastName: tgUser.last_name || tgUser.lastName || "",
    displayName: [tgUser.first_name || tgUser.firstName || "Chef", tgUser.last_name || tgUser.lastName || ""].join(" ").trim(),
    totalChefPoints: 0,
    currentEnergy: ENERGY_MAX,
    maxEnergy: ENERGY_MAX,
    lastEnergyUpdateAt: now,
    streakCount: 0,
    lastActiveDate: "",
    mealsCooked: 0,
    totalTaps: 0,
    todayTapsTowardMeal: 0,
    createdAt: now,
    updatedAt: now
  };
}

function taskTemplate() {
  return [
    { key: "open_kitchen", label: "Open the kitchen today", target: 1, progress: 0, completed: false },
    { key: "tap_50", label: "Tap 50 ingredients", target: 50, progress: 0, completed: false },
    { key: "cook_3", label: "Cook 3 meals", target: 3, progress: 0, completed: false }
  ];
}

function dayDiff(a, b) {
  const da = new Date(`${a}T00:00:00.000Z`).getTime();
  const db = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((da - db) / 86400000);
}

function applyEnergy(user) {
  const now = new Date();
  const last = new Date(user.lastEnergyUpdateAt || now);
  const elapsed = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 1000));
  const gained = Math.floor(elapsed / ENERGY_REGEN_SECONDS);
  if (gained > 0) {
    user.currentEnergy = clamp((user.currentEnergy || 0) + gained, 0, user.maxEnergy || ENERGY_MAX);
    user.lastEnergyUpdateAt = new Date(last.getTime() + gained * ENERGY_REGEN_SECONDS * 1000);
  }
  return user;
}

function applyStreak(user, dateKey) {
  const prev = user.lastActiveDate || "";
  if (!prev) {
    user.streakCount = 1;
  } else {
    const diff = dayDiff(dateKey, prev);
    if (diff === 1) user.streakCount += 1;
    else if (diff > 1) user.streakCount = 1;
  }
  user.lastActiveDate = dateKey;
}

function completeTask(task) {
  task.completed = task.progress >= task.target;
}

function summarizeTasks(tasks) {
  const done = tasks.filter((t) => t.completed).length;
  return { completed: done, total: tasks.length, tasks };
}

async function getOrCreateUserDoc(tgUser) {
  const db = await getDb();
  const userId = String(tgUser.id || "guest");
  if (!db) {
    const existing = mem.users.get(userId) || defaultUser(tgUser);
    existing.username = tgUser.username || existing.username || "";
    existing.firstName = tgUser.first_name || tgUser.firstName || existing.firstName;
    existing.lastName = tgUser.last_name || tgUser.lastName || existing.lastName;
    existing.displayName = [existing.firstName, existing.lastName].join(" ").trim();
    mem.users.set(userId, existing);
    return existing;
  }

  try {
    const existing = await db.collection("users").findOne({ telegramUserId: userId });
    if (existing) return existing;
    const doc = defaultUser(tgUser);
    await db.collection("users").insertOne(doc);
    return doc;
  } catch (err) {
    console.error("[db] users findOne/insertOne failure", { err: safeErr(err) });
    const fallback = mem.users.get(userId) || defaultUser(tgUser);
    mem.users.set(userId, fallback);
    return fallback;
  }
}

async function saveUserDoc(user) {
  const db = await getDb();
  user.updatedAt = new Date();
  if (!db) {
    mem.users.set(String(user.telegramUserId), user);
    return;
  }

  try {
    const mutable = { ...user };
    delete mutable._id;
    delete mutable.createdAt;
    await db.collection("users").updateOne(
      { telegramUserId: String(user.telegramUserId) },
      {
        $setOnInsert: { createdAt: user.createdAt || new Date() },
        $set: { ...mutable, updatedAt: new Date() }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[db] users updateOne failure", { err: safeErr(err) });
  }
}

async function getOrCreateTasks(userId, dateKey) {
  const db = await getDb();
  const key = `${userId}:${dateKey}`;
  if (!db) {
    const existing = mem.tasks.get(key);
    if (existing) return existing;
    const doc = { telegramUserId: userId, dateKey, openedToday: true, tasks: taskTemplate(), updatedAt: new Date() };
    doc.tasks.find((t) => t.key === "open_kitchen").progress = 1;
    doc.tasks.find((t) => t.key === "open_kitchen").completed = true;
    mem.tasks.set(key, doc);
    return doc;
  }

  try {
    const existing = await db.collection("daily_task_progress").findOne({ telegramUserId: userId, dateKey });
    if (existing) return existing;
    const doc = { telegramUserId: userId, dateKey, openedToday: true, tasks: taskTemplate(), updatedAt: new Date() };
    doc.tasks.find((t) => t.key === "open_kitchen").progress = 1;
    doc.tasks.find((t) => t.key === "open_kitchen").completed = true;
    await db.collection("daily_task_progress").insertOne(doc);
    return doc;
  } catch (err) {
    console.error("[db] daily_task_progress findOne/insertOne failure", { err: safeErr(err) });
    const doc = { telegramUserId: userId, dateKey, openedToday: true, tasks: taskTemplate(), createdAt: new Date(), updatedAt: new Date() };
    doc.tasks.find((t) => t.key === "open_kitchen").progress = 1;
    doc.tasks.find((t) => t.key === "open_kitchen").completed = true;
    mem.tasks.set(key, doc);
    return doc;
  }
}

async function saveTasksDoc(doc) {
  const db = await getDb();
  doc.updatedAt = new Date();
  if (!db) {
    mem.tasks.set(`${doc.telegramUserId}:${doc.dateKey}`, doc);
    return;
  }

  try {
    const mutable = { ...doc };
    delete mutable._id;
    delete mutable.createdAt;
    await db.collection("daily_task_progress").updateOne(
      { telegramUserId: String(doc.telegramUserId), dateKey: doc.dateKey },
      {
        $setOnInsert: { createdAt: doc.createdAt || new Date() },
        $set: { ...mutable, updatedAt: new Date() }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[db] daily_task_progress updateOne failure", { err: safeErr(err) });
  }
}

async function logEvent(event) {
  const db = await getDb();
  const doc = { ...event, };
  if (!db) {
    mem.events.push(doc);
    if (mem.events.length > 5000) mem.events.splice(0, mem.events.length - 5000);
    return;
  }
  try {
    await db.collection("game_events").insertOne(doc);
  } catch (err) {
    console.error("[db] game_events insertOne failure", { err: safeErr(err) });
  }
}

function stateFrom(user, tasksDoc) {
  const tasks = summarizeTasks(tasksDoc.tasks || []);
  const tapsNeeded = Math.max(0, TAPS_PER_MEAL - (user.todayTapsTowardMeal || 0));
  return {
    profile: {
      telegramUserId: user.telegramUserId,
      displayName: user.displayName || user.firstName || "Chef",
      username: user.username || "",
      totalChefPoints: user.totalChefPoints || 0,
      currentEnergy: user.currentEnergy || 0,
      maxEnergy: user.maxEnergy || ENERGY_MAX,
      streakCount: user.streakCount || 0,
      mealsCooked: user.mealsCooked || 0,
      totalTaps: user.totalTaps || 0,
      todayTapsTowardMeal: user.todayTapsTowardMeal || 0,
      tapsNeededForMeal: tapsNeeded,
      lastActiveDate: user.lastActiveDate || ""
    },
    daily: tasks
  };
}

export async function bootstrapPlayer(tgUser) {
  const dateKey = utcDateKey();
  const user = applyEnergy(await getOrCreateUserDoc(tgUser));
  if (user.lastActiveDate !== dateKey) applyStreak(user, dateKey);
  const tasksDoc = await getOrCreateTasks(String(user.telegramUserId), dateKey);
  await saveUserDoc(user);
  await saveTasksDoc(tasksDoc);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "open_kitchen", dateKey });
  return stateFrom(user, tasksDoc);
}

export async function tapIngredient(tgUser) {
  const dateKey = utcDateKey();
  const user = applyEnergy(await getOrCreateUserDoc(tgUser));
  const tasksDoc = await getOrCreateTasks(String(user.telegramUserId), dateKey);

  if (user.currentEnergy <= 0) {
    return { ok: false, message: "No energy left. Come back in a minute.", state: stateFrom(user, tasksDoc) };
  }

  user.currentEnergy -= 1;
  user.totalChefPoints += TAP_POINTS;
  user.totalTaps += 1;
  user.todayTapsTowardMeal = (user.todayTapsTowardMeal || 0) + 1;

  const tapTask = tasksDoc.tasks.find((t) => t.key === "tap_50");
  if (tapTask) {
    tapTask.progress += 1;
    completeTask(tapTask);
  }

  await saveUserDoc(user);
  await saveTasksDoc(tasksDoc);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "tap", dateKey, points: TAP_POINTS });

  return { ok: true, message: "+1 Chef Point", state: stateFrom(user, tasksDoc) };
}

export async function cookMeal(tgUser) {
  const dateKey = utcDateKey();
  const user = applyEnergy(await getOrCreateUserDoc(tgUser));
  const tasksDoc = await getOrCreateTasks(String(user.telegramUserId), dateKey);

  if ((user.todayTapsTowardMeal || 0) < TAPS_PER_MEAL) {
    return { ok: false, message: `Need ${TAPS_PER_MEAL} ingredient taps to cook.`, state: stateFrom(user, tasksDoc) };
  }

  user.todayTapsTowardMeal -= TAPS_PER_MEAL;
  user.mealsCooked += 1;
  user.totalChefPoints += MEAL_POINTS;

  const mealTask = tasksDoc.tasks.find((t) => t.key === "cook_3");
  if (mealTask) {
    mealTask.progress += 1;
    completeTask(mealTask);
  }

  await saveUserDoc(user);
  await saveTasksDoc(tasksDoc);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "cook", dateKey, points: MEAL_POINTS });

  return { ok: true, message: `Meal cooked. +${MEAL_POINTS} Chef Points`, state: stateFrom(user, tasksDoc) };
}

export async function getProfile(tgUser) {
  return bootstrapPlayer(tgUser);
}

export async function getLeaderboard(limit = 10, currentUserId = "") {
  const db = await getDb();
  const size = Math.max(1, Math.min(Number(limit || 10), 20));
  let top = [];
  if (!db) {
    top = [...mem.users.values()]
      .sort((a, b) => (b.totalChefPoints || 0) - (a.totalChefPoints || 0))
      .slice(0, size);
  } else {
    try {
      top = await db.collection("users")
        .find({})
        .sort({ totalChefPoints: -1, updatedAt: 1 })
        .limit(size)
        .toArray();
    } catch (err) {
      console.error("[db] users leaderboard find failure", { err: safeErr(err) });
      top = [];
    }
  }

  let rank = null;
  if (currentUserId) {
    const all = db
      ? await db.collection("users").countDocuments({ totalChefPoints: { $gt: (await db.collection("users").findOne({ telegramUserId: String(currentUserId) }))?.totalChefPoints || 0 } }).catch(() => null)
      : [...mem.users.values()].filter((u) => (u.totalChefPoints || 0) > ((mem.users.get(String(currentUserId)) || {}).totalChefPoints || 0)).length;
    rank = all === null ? null : all + 1;
  }

  return {
    top: top.map((u, index) => ({
      rank: index + 1,
      telegramUserId: u.telegramUserId,
      displayName: u.displayName || u.firstName || "Chef",
      totalChefPoints: u.totalChefPoints || 0,
      mealsCooked: u.mealsCooked || 0
    })),
    currentUserRank: rank
  };
}

export function formatProfileText(state) {
  const p = state.profile;
  return [
    `${p.displayName}`,
    `Chef Points: ${p.totalChefPoints}`,
    `Energy: ${p.currentEnergy}/${p.maxEnergy}`,
    `Streak: ${p.streakCount}`,
    `Meals: ${p.mealsCooked}`,
    `Today tasks: ${state.daily.completed}/${state.daily.total}`
  ].join("\n");
}
