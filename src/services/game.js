import { getDb } from "../lib/db.js";
import { utcDateKey, clamp, safeErr } from "../lib/utils.js";

const ENERGY_MAX = 30;
const ENERGY_REGEN_SECONDS = 60;
const TAPS_PER_MEAL = 10;
const TAP_POINTS = 1;
const MEAL_POINTS = 15;

const ACHIEVEMENTS = [
  {
    key: "first_tap",
    badge: "First Tap",
    description: "Make your first ingredient tap.",
    check: (user) => (user.totalTaps || 0) >= 1
  },
  {
    key: "hundred_taps",
    badge: "100 Taps",
    description: "Reach 100 total ingredient taps.",
    check: (user) => (user.totalTaps || 0) >= 100
  },
  {
    key: "ten_meals",
    badge: "Meal Master",
    description: "Cook 10 meals.",
    check: (user) => (user.mealsCooked || 0) >= 10
  },
  {
    key: "seven_day_streak",
    badge: "7 Day Streak",
    description: "Keep your kitchen streak alive for 7 days.",
    check: (user) => (user.streakCount || 0) >= 7
  }
];

const RECIPE_CATALOG = [
  {
    key: "sunrise_soup",
    name: "Sunrise Soup",
    cost: 25,
    blurb: "A bright tomato soup that wakes up the whole kitchen.",
    rewardText: "Adds flavor to your recipe book."
  },
  {
    key: "moon_pasta",
    name: "Moon Pasta",
    cost: 60,
    blurb: "Silky noodles tossed in a dreamy garlic cream.",
    rewardText: "A fictional favorite for late-night chefs."
  },
  {
    key: "cloud_cakes",
    name: "Cloud Cakes",
    cost: 120,
    blurb: "Soft stacked cakes with whipped vanilla foam.",
    rewardText: "Purely cosmetic recipe lore for your book."
  }
];

const THEME_CATALOG = [
  {
    key: "classic_kitchen",
    name: "Classic Kitchen",
    cost: 0,
    preview: "Warm orange counters and polished pans.",
    colors: {
      bg: "#fff7ed",
      card: "#ffffff",
      accent: "#f97316",
      accentText: "#ffffff"
    }
  },
  {
    key: "midnight_kitchen",
    name: "Midnight Kitchen",
    cost: 80,
    preview: "Dark counters with neon herb lights.",
    colors: {
      bg: "#111827",
      card: "#1f2937",
      accent: "#22c55e",
      accentText: "#f9fafb"
    }
  },
  {
    key: "pastel_kitchen",
    name: "Pastel Kitchen",
    cost: 140,
    preview: "Soft pink walls and mint cabinet trims.",
    colors: {
      bg: "#fdf2f8",
      card: "#ffffff",
      accent: "#ec4899",
      accentText: "#ffffff"
    }
  }
];

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
    unlockedRecipes: [],
    ownedThemes: ["classic_kitchen"],
    activeThemeKey: "classic_kitchen",
    soundEnabled: true,
    unlockedAchievements: [],
    createdAt: now,
    updatedAt: now
  };
}

function normalizeUser(user, tgUser = {}) {
  const base = defaultUser(tgUser);
  return {
    ...base,
    ...user,
    telegramUserId: String(user?.telegramUserId || tgUser.id || "guest"),
    username: tgUser.username || user?.username || "",
    firstName: tgUser.first_name || tgUser.firstName || user?.firstName || base.firstName,
    lastName: tgUser.last_name || tgUser.lastName || user?.lastName || base.lastName,
    displayName: [
      tgUser.first_name || tgUser.firstName || user?.firstName || base.firstName,
      tgUser.last_name || tgUser.lastName || user?.lastName || base.lastName
    ].join(" ").trim(),
    unlockedRecipes: Array.isArray(user?.unlockedRecipes) ? user.unlockedRecipes : [],
    ownedThemes: Array.isArray(user?.ownedThemes) && user.ownedThemes.length ? user.ownedThemes : ["classic_kitchen"],
    activeThemeKey: user?.activeThemeKey || "classic_kitchen",
    soundEnabled: typeof user?.soundEnabled === "boolean" ? user.soundEnabled : true,
    unlockedAchievements: Array.isArray(user?.unlockedAchievements) ? user.unlockedAchievements : []
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

function getThemeByKey(key) {
  return THEME_CATALOG.find((theme) => theme.key === key) || THEME_CATALOG[0];
}

function getAchievementState(user) {
  const unlocked = new Set(Array.isArray(user.unlockedAchievements) ? user.unlockedAchievements : []);
  return ACHIEVEMENTS.map((item) => ({
    key: item.key,
    badge: item.badge,
    description: item.description,
    unlocked: unlocked.has(item.key)
  }));
}

function applyAchievements(user) {
  const unlocked = new Set(Array.isArray(user.unlockedAchievements) ? user.unlockedAchievements : []);
  const newlyUnlocked = [];
  for (const item of ACHIEVEMENTS) {
    if (!unlocked.has(item.key) && item.check(user)) {
      unlocked.add(item.key);
      newlyUnlocked.push({ key: item.key, badge: item.badge, description: item.description });
    }
  }
  user.unlockedAchievements = [...unlocked];
  return newlyUnlocked;
}

function getRecipeBook(user) {
  const unlocked = new Set(Array.isArray(user.unlockedRecipes) ? user.unlockedRecipes : []);
  return RECIPE_CATALOG.map((recipe) => ({
    ...recipe,
    unlocked: unlocked.has(recipe.key)
  }));
}

function getKitchenShop(user) {
  const owned = new Set(Array.isArray(user.ownedThemes) ? user.ownedThemes : ["classic_kitchen"]);
  return THEME_CATALOG.map((theme) => ({
    ...theme,
    owned: owned.has(theme.key),
    active: String(user.activeThemeKey || "classic_kitchen") === theme.key
  }));
}

async function getOrCreateUserDoc(tgUser) {
  const db = await getDb();
  const userId = String(tgUser.id || "guest");
  if (!db) {
    const existing = normalizeUser(mem.users.get(userId), tgUser);
    mem.users.set(userId, existing);
    return existing;
  }

  try {
    const existing = await db.collection("users").findOne({ telegramUserId: userId });
    if (existing) return normalizeUser(existing, tgUser);
    const doc = defaultUser(tgUser);
    await db.collection("users").insertOne(doc);
    return doc;
  } catch (err) {
    console.error("[db] users findOne/insertOne failure", { err: safeErr(err) });
    const fallback = normalizeUser(mem.users.get(userId), tgUser);
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
    const doc = { telegramUserId: userId, dateKey, openedToday: true, tasks: taskTemplate(), updatedAt: new Date() };
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
  const doc = { ...event };
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

function stateFrom(user, tasksDoc, extras = {}) {
  const tasks = summarizeTasks(tasksDoc.tasks || []);
  const tapsNeeded = Math.max(0, TAPS_PER_MEAL - (user.todayTapsTowardMeal || 0));
  const activeTheme = getThemeByKey(user.activeThemeKey);
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
      lastActiveDate: user.lastActiveDate || "",
      soundEnabled: typeof user.soundEnabled === "boolean" ? user.soundEnabled : true,
      activeThemeKey: activeTheme.key
    },
    daily: tasks,
    achievements: getAchievementState(user),
    recipeBook: getRecipeBook(user),
    kitchenShop: getKitchenShop(user),
    activeTheme,
    ...extras
  };
}

export async function bootstrapPlayer(tgUser) {
  const dateKey = utcDateKey();
  const user = applyEnergy(await getOrCreateUserDoc(tgUser));
  if (user.lastActiveDate !== dateKey) applyStreak(user, dateKey);
  const tasksDoc = await getOrCreateTasks(String(user.telegramUserId), dateKey);
  const unlockedNow = applyAchievements(user);
  await saveUserDoc(user);
  await saveTasksDoc(tasksDoc);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "open_kitchen", dateKey });
  return stateFrom(user, tasksDoc, { newlyUnlockedAchievements: unlockedNow });
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

  const unlockedNow = applyAchievements(user);
  await saveUserDoc(user);
  await saveTasksDoc(tasksDoc);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "tap", dateKey, points: TAP_POINTS });

  const badgeText = unlockedNow.length ? ` Badge unlocked: ${unlockedNow.map((a) => a.badge).join(", ")}` : "";
  return { ok: true, message: `+1 Chef Point${badgeText}`, state: stateFrom(user, tasksDoc, { newlyUnlockedAchievements: unlockedNow }) };
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

  const unlockedNow = applyAchievements(user);
  await saveUserDoc(user);
  await saveTasksDoc(tasksDoc);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "cook", dateKey, points: MEAL_POINTS });

  const badgeText = unlockedNow.length ? ` Badge unlocked: ${unlockedNow.map((a) => a.badge).join(", ")}` : "";
  return { ok: true, message: `Meal cooked. +${MEAL_POINTS} Chef Points${badgeText}`, state: stateFrom(user, tasksDoc, { newlyUnlockedAchievements: unlockedNow }) };
}

export async function getProfile(tgUser) {
  return bootstrapPlayer(tgUser);
}

export async function getLeaderboard(limit = 10, currentUserId = "") {
  const db = await getDb();
  const size = Math.max(1, Math.min(Number(limit || 10), 20));
  let top = [];
  let currentUser = null;

  if (!db) {
    const allUsers = [...mem.users.values()].sort((a, b) => {
      if ((b.totalChefPoints || 0) !== (a.totalChefPoints || 0)) return (b.totalChefPoints || 0) - (a.totalChefPoints || 0);
      return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
    });
    top = allUsers.slice(0, size);
    currentUser = allUsers.find((u) => String(u.telegramUserId) === String(currentUserId)) || null;
    const currentUserRank = currentUser ? (allUsers.findIndex((u) => String(u.telegramUserId) === String(currentUserId)) + 1) : null;
    return {
      top: top.map((u, index) => ({
        rank: index + 1,
        telegramUserId: u.telegramUserId,
        displayName: u.displayName || u.firstName || "Chef",
        totalChefPoints: u.totalChefPoints || 0,
        mealsCooked: u.mealsCooked || 0,
        isCurrentUser: String(u.telegramUserId) === String(currentUserId)
      })),
      currentUserRank,
      currentUserEntry: currentUser
        ? {
            rank: currentUserRank,
            telegramUserId: currentUser.telegramUserId,
            displayName: currentUser.displayName || currentUser.firstName || "Chef",
            totalChefPoints: currentUser.totalChefPoints || 0,
            mealsCooked: currentUser.mealsCooked || 0,
            isCurrentUser: true
          }
        : null
    };
  }

  try {
    top = await db.collection("users")
      .find({})
      .sort({ totalChefPoints: -1, updatedAt: 1 })
      .limit(size)
      .toArray();

    if (currentUserId) {
      currentUser = await db.collection("users").findOne({ telegramUserId: String(currentUserId) });
    }
  } catch (err) {
    console.error("[db] users leaderboard find failure", { err: safeErr(err) });
    top = [];
  }

  let currentUserRank = null;
  let currentUserEntry = null;
  if (db && currentUser) {
    try {
      const betterCount = await db.collection("users").countDocuments({
        $or: [
          { totalChefPoints: { $gt: currentUser.totalChefPoints || 0 } },
          {
            totalChefPoints: currentUser.totalChefPoints || 0,
            updatedAt: { $lt: currentUser.updatedAt || currentUser.createdAt || new Date() }
          }
        ]
      });
      currentUserRank = betterCount + 1;
      currentUserEntry = {
        rank: currentUserRank,
        telegramUserId: currentUser.telegramUserId,
        displayName: currentUser.displayName || currentUser.firstName || "Chef",
        totalChefPoints: currentUser.totalChefPoints || 0,
        mealsCooked: currentUser.mealsCooked || 0,
        isCurrentUser: true
      };
    } catch (err) {
      console.error("[db] users leaderboard rank failure", { err: safeErr(err) });
    }
  }

  return {
    top: top.map((u, index) => ({
      rank: index + 1,
      telegramUserId: u.telegramUserId,
      displayName: u.displayName || u.firstName || "Chef",
      totalChefPoints: u.totalChefPoints || 0,
      mealsCooked: u.mealsCooked || 0,
      isCurrentUser: String(u.telegramUserId) === String(currentUserId)
    })),
    currentUserRank,
    currentUserEntry
  };
}

export async function updateSoundSetting(tgUser, soundEnabled) {
  const dateKey = utcDateKey();
  const user = applyEnergy(await getOrCreateUserDoc(tgUser));
  const tasksDoc = await getOrCreateTasks(String(user.telegramUserId), dateKey);
  user.soundEnabled = !!soundEnabled;
  await saveUserDoc(user);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "sound_setting", soundEnabled: user.soundEnabled, dateKey });
  return { ok: true, message: user.soundEnabled ? "Sound on" : "Sound off", state: stateFrom(user, tasksDoc) };
}

export async function unlockRecipe(tgUser, recipeKey) {
  const dateKey = utcDateKey();
  const user = applyEnergy(await getOrCreateUserDoc(tgUser));
  const tasksDoc = await getOrCreateTasks(String(user.telegramUserId), dateKey);
  const recipe = RECIPE_CATALOG.find((item) => item.key === recipeKey);

  if (!recipe) {
    return { ok: false, message: "Recipe not found.", state: stateFrom(user, tasksDoc) };
  }

  const unlocked = new Set(Array.isArray(user.unlockedRecipes) ? user.unlockedRecipes : []);
  if (unlocked.has(recipe.key)) {
    return { ok: false, message: "Recipe already unlocked.", state: stateFrom(user, tasksDoc) };
  }

  if ((user.totalChefPoints || 0) < recipe.cost) {
    return { ok: false, message: `Need ${recipe.cost} Chef Points to unlock this recipe.`, state: stateFrom(user, tasksDoc) };
  }

  user.totalChefPoints -= recipe.cost;
  unlocked.add(recipe.key);
  user.unlockedRecipes = [...unlocked];
  await saveUserDoc(user);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "unlock_recipe", recipeKey: recipe.key, cost: recipe.cost, dateKey });
  return { ok: true, message: `${recipe.name} unlocked for ${recipe.cost} Chef Points.`, state: stateFrom(user, tasksDoc) };
}

export async function buyTheme(tgUser, themeKey) {
  const dateKey = utcDateKey();
  const user = applyEnergy(await getOrCreateUserDoc(tgUser));
  const tasksDoc = await getOrCreateTasks(String(user.telegramUserId), dateKey);
  const theme = THEME_CATALOG.find((item) => item.key === themeKey);

  if (!theme) {
    return { ok: false, message: "Theme not found.", state: stateFrom(user, tasksDoc) };
  }

  const owned = new Set(Array.isArray(user.ownedThemes) ? user.ownedThemes : ["classic_kitchen"]);
  if (owned.has(theme.key)) {
    user.activeThemeKey = theme.key;
    await saveUserDoc(user);
    await logEvent({ telegramUserId: String(user.telegramUserId), type: "equip_theme", themeKey: theme.key, dateKey });
    return { ok: true, message: `${theme.name} is now active.`, state: stateFrom(user, tasksDoc) };
  }

  if ((user.totalChefPoints || 0) < theme.cost) {
    return { ok: false, message: `Need ${theme.cost} Chef Points to buy this theme.`, state: stateFrom(user, tasksDoc) };
  }

  user.totalChefPoints -= theme.cost;
  owned.add(theme.key);
  user.ownedThemes = [...owned];
  user.activeThemeKey = theme.key;
  await saveUserDoc(user);
  await logEvent({ telegramUserId: String(user.telegramUserId), type: "buy_theme", themeKey: theme.key, cost: theme.cost, dateKey });
  return { ok: true, message: `${theme.name} theme unlocked and equipped.`, state: stateFrom(user, tasksDoc) };
}

export function formatProfileText(state) {
  const p = state.profile;
  const unlockedAchievements = (state.achievements || []).filter((item) => item.unlocked).length;
  const unlockedRecipes = (state.recipeBook || []).filter((item) => item.unlocked).length;
  return [
    `${p.displayName}`,
    `Chef Points: ${p.totalChefPoints}`,
    `Energy: ${p.currentEnergy}/${p.maxEnergy}`,
    `Streak: ${p.streakCount}`,
    `Meals: ${p.mealsCooked}`,
    `Achievements: ${unlockedAchievements}/${ACHIEVEMENTS.length}`,
    `Recipes: ${unlockedRecipes}/${RECIPE_CATALOG.length}`,
    `Today tasks: ${state.daily.completed}/${state.daily.total}`
  ].join("\n");
}
