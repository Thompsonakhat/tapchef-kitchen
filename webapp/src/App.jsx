import { useEffect, useMemo, useState } from "react";

function tgInit() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes?.();
  }
  return tg;
}

function themeVars(tg, activeTheme) {
  const p = tg?.themeParams || {};
  return {
    bg: activeTheme?.colors?.bg || p.bg_color || "#fff7ed",
    card: activeTheme?.colors?.card || p.secondary_bg_color || "#ffffff",
    text: p.text_color || (activeTheme?.colors?.bg === "#111827" ? "#f9fafb" : "#1f2937"),
    button: activeTheme?.colors?.accent || p.button_color || "#f97316",
    buttonText: activeTheme?.colors?.accentText || p.button_text_color || "#ffffff"
  };
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

function TaskItem({ task }) {
  const pct = Math.min(100, Math.round((task.progress / task.target) * 100));
  return (
    <div className="rounded-2xl p-4 shadow-card" style={{ background: "rgba(255,255,255,0.85)" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{task.label}</div>
          <div className="text-xs text-slate-500">{task.progress}/{task.target}</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${task.completed ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
          {task.completed ? "Done" : "Active"}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-orange-100">
        <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl p-4 shadow-card" style={{ background: "rgba(255,255,255,0.88)" }}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function AchievementCard({ item }) {
  return (
    <div className={`rounded-2xl p-4 shadow-card ${item.unlocked ? "bg-amber-50" : "bg-white/85"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-800">{item.badge}</div>
          <div className="mt-1 text-xs text-slate-500">{item.description}</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${item.unlocked ? "bg-amber-200 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
          {item.unlocked ? "Unlocked" : "Locked"}
        </div>
      </div>
    </div>
  );
}

function RecipeCard({ recipe, busy, onUnlock }) {
  return (
    <div className="rounded-2xl bg-white/85 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-800">{recipe.name}</div>
          <div className="mt-1 text-xs text-slate-500">{recipe.blurb}</div>
          <div className="mt-2 text-xs text-slate-400">{recipe.rewardText}</div>
        </div>
        <div className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
          {recipe.cost} pts
        </div>
      </div>
      <button
        onClick={() => onUnlock(recipe.key)}
        disabled={busy || recipe.unlocked}
        className={`mt-4 h-11 w-full rounded-2xl text-sm font-semibold ${recipe.unlocked ? "bg-green-100 text-green-700" : "bg-orange-500 text-white"} ${busy ? "opacity-70" : ""}`}
      >
        {recipe.unlocked ? "Unlocked" : "Unlock Recipe"}
      </button>
    </div>
  );
}

function ThemeCard({ theme, busy, onChoose }) {
  return (
    <div className="rounded-2xl bg-white/85 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-800">{theme.name}</div>
          <div className="mt-1 text-xs text-slate-500">{theme.preview}</div>
        </div>
        <div className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          {theme.cost === 0 ? "Free" : `${theme.cost} pts`}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-8 flex-1 rounded-xl" style={{ background: theme.colors.bg }} />
        <div className="h-8 flex-1 rounded-xl" style={{ background: theme.colors.card }} />
        <div className="h-8 flex-1 rounded-xl" style={{ background: theme.colors.accent }} />
      </div>
      <button
        onClick={() => onChoose(theme.key)}
        disabled={busy}
        className={`mt-4 h-11 w-full rounded-2xl text-sm font-semibold ${theme.active ? "bg-green-600 text-white" : theme.owned ? "bg-slate-800 text-white" : "bg-purple-600 text-white"} ${busy ? "opacity-70" : ""}`}
      >
        {theme.active ? "Active Theme" : theme.owned ? "Use Theme" : "Buy Theme"}
      </button>
    </div>
  );
}

export default function App() {
  const tg = useMemo(() => tgInit(), []);
  const [state, setState] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ top: [], currentUserRank: null, currentUserEntry: null });
  const [message, setMessage] = useState("Loading your kitchen...");
  const [tab, setTab] = useState("play");
  const [busy, setBusy] = useState(false);
  const initData = tg?.initData || "";
  const colors = useMemo(() => themeVars(tg, state?.activeTheme), [tg, state?.activeTheme]);

  async function load() {
    try {
      setMessage("Loading your kitchen...");
      const json = await post("/api/game/bootstrap", { initData });
      if (!json.ok) {
        setMessage(json.message || "Could not load game");
        return;
      }
      setState(json.state);
      setLeaderboard(json.leaderboard || { top: [], currentUserRank: null, currentUserEntry: null });
      const newBadges = Array.isArray(json.state?.newlyUnlockedAchievements) ? json.state.newlyUnlockedAchievements : [];
      setMessage(newBadges.length ? `New badge: ${newBadges.map((item) => item.badge).join(", ")}` : "Kitchen ready");
    } catch {
      setMessage("Network error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function refreshLeaderboard() {
    const lb = await post("/api/game/leaderboard", { initData });
    if (lb.ok) setLeaderboard(lb.leaderboard || { top: [], currentUserRank: null, currentUserEntry: null });
  }

  async function doTap() {
    if (busy) return;
    setBusy(true);
    try {
      const json = await post("/api/game/tap", { initData });
      if (json.state) setState(json.state);
      setMessage(json.message || "Tapped");
      await refreshLeaderboard();
    } catch {
      setMessage("Tap failed");
    } finally {
      setBusy(false);
    }
  }

  async function doCook() {
    if (busy) return;
    setBusy(true);
    try {
      const json = await post("/api/game/cook", { initData });
      if (json.state) setState(json.state);
      setMessage(json.message || "Cooked");
      await refreshLeaderboard();
    } catch {
      setMessage("Cook failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSound() {
    if (!state || busy) return;
    setBusy(true);
    try {
      const json = await post("/api/game/settings/sound", { initData, soundEnabled: !state.profile.soundEnabled });
      if (json.state) setState(json.state);
      setMessage(json.message || "Settings updated");
    } catch {
      setMessage("Could not update sound");
    } finally {
      setBusy(false);
    }
  }

  async function unlockRecipe(recipeKey) {
    if (busy) return;
    setBusy(true);
    try {
      const json = await post("/api/game/recipes/unlock", { initData, recipeKey });
      if (json.state) setState(json.state);
      setMessage(json.message || "Recipe updated");
      await refreshLeaderboard();
    } catch {
      setMessage("Recipe unlock failed");
    } finally {
      setBusy(false);
    }
  }

  async function chooseTheme(themeKey) {
    if (busy) return;
    setBusy(true);
    try {
      const json = await post("/api/game/shop/theme", { initData, themeKey });
      if (json.state) setState(json.state);
      setMessage(json.message || "Theme updated");
      await refreshLeaderboard();
    } catch {
      setMessage("Theme update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <div className="min-h-screen px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+18px)]">
        <div className="mx-auto max-w-md rounded-3xl bg-white/90 p-6 shadow-card">
          <div className="text-lg font-bold">TapChef</div>
          <div className="mt-2 text-sm text-slate-600">{message}</div>
          <button onClick={load} className="mt-5 h-12 w-full rounded-2xl bg-orange-500 text-sm font-semibold text-white">Retry</button>
        </div>
      </div>
    );
  }

  const p = state.profile;
  const canCook = p.tapsNeededForMeal === 0;
  const unlockedAchievements = (state.achievements || []).filter((item) => item.unlocked).length;
  const unlockedRecipes = (state.recipeBook || []).filter((item) => item.unlocked).length;
  const ownEntryOutsideTop = leaderboard.currentUserEntry && !leaderboard.top.some((row) => row.telegramUserId === leaderboard.currentUserEntry.telegramUserId);

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="rounded-[28px] p-5 text-white shadow-card" style={{ background: `linear-gradient(135deg, ${colors.button} 0%, #f59e0b 100%)` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] opacity-80">TapChef Kitchen</div>
              <div className="mt-1 text-2xl font-extrabold">Hi, {p.displayName.split(" ")[0]}</div>
              <div className="mt-1 text-sm opacity-90">Tap ingredients. Cook meals. Climb the kitchen board.</div>
            </div>
            <div className="rounded-2xl px-3 py-2 text-right" style={{ background: "rgba(255,255,255,0.2)" }}>
              <div className="text-xs opacity-90">Chef Points</div>
              <div className="text-xl font-bold">{p.totalChefPoints}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label="Energy" value={`${p.currentEnergy}/${p.maxEnergy}`} accent="text-orange-600" />
          <StatCard label="Streak" value={`${p.streakCount} day`} accent="text-green-700" />
          <StatCard label="Meals" value={p.mealsCooked} accent="text-slate-800" />
          <StatCard label="Badges" value={`${unlockedAchievements}/4`} accent="text-amber-700" />
        </div>

        <div className="mt-4 flex rounded-2xl p-1 shadow-card" style={{ background: "rgba(255,255,255,0.72)" }}>
          {[
            ["play", "Play"],
            ["tasks", "Tasks"],
            ["recipes", "Recipes"],
            ["shop", "Shop"],
            ["board", "Board"],
            ["profile", "Profile"]
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`h-11 flex-1 rounded-xl text-xs font-semibold ${tab === key ? "text-white" : "text-slate-600"}`}
              style={tab === key ? { background: colors.button } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "play" && (
          <div className="mt-4 rounded-[28px] p-5 shadow-card" style={{ background: "rgba(255,255,255,0.88)" }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-slate-800">Ingredient Station</div>
                <div className="text-sm text-slate-500">Each tap uses 1 energy and gives 1 Chef Point.</div>
              </div>
              <div className="rounded-2xl bg-orange-50 px-3 py-2 text-right">
                <div className="text-xs text-orange-600">Next meal</div>
                <div className="text-base font-bold text-orange-700">{canCook ? "Ready" : `${p.tapsNeededForMeal} taps left`}</div>
              </div>
            </div>

            <button
              onClick={doTap}
              disabled={busy || p.currentEnergy <= 0}
              className={`mt-5 h-40 w-full rounded-[28px] border-4 border-orange-200 text-center shadow-inner transition active:scale-[0.98] ${busy || p.currentEnergy <= 0 ? "bg-slate-200 text-slate-500" : "bg-gradient-to-b from-orange-200 to-orange-100 text-slate-800"}`}
            >
              <div className="text-5xl">🍅</div>
              <div className="mt-2 text-lg font-extrabold">Tap Ingredient</div>
              <div className="mt-1 text-sm">Quick, fun, and chef-approved</div>
            </button>

            <button
              onClick={doCook}
              disabled={busy || !canCook}
              className={`mt-4 h-14 w-full rounded-2xl text-sm font-bold ${busy || !canCook ? "bg-slate-200 text-slate-500" : "bg-green-600 text-white"}`}
            >
              Cook Meal
            </button>

            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>
          </div>
        )}

        {tab === "tasks" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/85 p-4 shadow-card">
              <div className="text-lg font-bold text-slate-800">Daily Cooking Tasks</div>
              <div className="text-sm text-slate-500">Complete all 3 today to keep your kitchen hot.</div>
            </div>
            {state.daily.tasks.map((task) => <TaskItem key={task.key} task={task} />)}
            <div className="rounded-2xl bg-white/85 p-4 shadow-card">
              <div className="text-lg font-bold text-slate-800">Achievements</div>
              <div className="mt-3 space-y-3">
                {state.achievements.map((item) => <AchievementCard key={item.key} item={item} />)}
              </div>
            </div>
          </div>
        )}

        {tab === "recipes" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/85 p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-slate-800">Recipe Book</div>
                  <div className="text-sm text-slate-500">Unlock fictional recipes with Chef Points.</div>
                </div>
                <div className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">{unlockedRecipes}/{state.recipeBook.length} unlocked</div>
              </div>
            </div>
            {state.recipeBook.map((recipe) => (
              <RecipeCard key={recipe.key} recipe={recipe} busy={busy} onUnlock={unlockRecipe} />
            ))}
          </div>
        )}

        {tab === "shop" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/85 p-4 shadow-card">
              <div className="text-lg font-bold text-slate-800">Kitchen Shop</div>
              <div className="text-sm text-slate-500">Spend fictional Chef Points on cosmetic kitchen themes only.</div>
              <button
                onClick={toggleSound}
                disabled={busy}
                className="mt-4 flex h-12 w-full items-center justify-between rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-slate-800"
              >
                <span>Kitchen Sound</span>
                <span>{p.soundEnabled ? "On" : "Off"}</span>
              </button>
            </div>
            {state.kitchenShop.map((theme) => (
              <ThemeCard key={theme.key} theme={theme} busy={busy} onChoose={chooseTheme} />
            ))}
          </div>
        )}

        {tab === "board" && (
          <div className="mt-4 rounded-[28px] bg-white/85 p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-slate-800">Leaderboard</div>
                <div className="text-sm text-slate-500">Top 10 chefs by fictional Chef Points.</div>
              </div>
              {leaderboard.currentUserRank ? (
                <div className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  Your rank #{leaderboard.currentUserRank}
                </div>
              ) : null}
            </div>
            <div className="mt-3 space-y-3">
              {leaderboard.top.length === 0 && <div className="rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">No chefs yet. Start tapping.</div>}
              {leaderboard.top.map((row) => (
                <div key={row.telegramUserId} className={`flex items-center justify-between rounded-2xl px-4 py-3 ${row.isCurrentUser ? "bg-amber-100" : "bg-orange-50"}`}>
                  <div>
                    <div className="text-sm font-bold text-slate-800">#{row.rank} {row.displayName}</div>
                    <div className="text-xs text-slate-500">Meals {row.mealsCooked}</div>
                  </div>
                  <div className="text-sm font-bold text-orange-700">{row.totalChefPoints}</div>
                </div>
              ))}
              {ownEntryOutsideTop ? (
                <div className="rounded-2xl border border-dashed border-orange-300 bg-amber-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-800">#{leaderboard.currentUserEntry.rank} {leaderboard.currentUserEntry.displayName}</div>
                      <div className="text-xs text-slate-500">Your position outside the top 10</div>
                    </div>
                    <div className="text-sm font-bold text-orange-700">{leaderboard.currentUserEntry.totalChefPoints}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div className="mt-4 rounded-[28px] bg-white/85 p-5 shadow-card">
            <div className="text-lg font-bold text-slate-800">Chef Profile</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between"><span>Name</span><span className="font-semibold text-slate-800">{p.displayName}</span></div>
              <div className="flex justify-between"><span>Chef Points</span><span className="font-semibold text-slate-800">{p.totalChefPoints}</span></div>
              <div className="flex justify-between"><span>Energy</span><span className="font-semibold text-slate-800">{p.currentEnergy}/{p.maxEnergy}</span></div>
              <div className="flex justify-between"><span>Streak</span><span className="font-semibold text-slate-800">{p.streakCount}</span></div>
              <div className="flex justify-between"><span>Meals Cooked</span><span className="font-semibold text-slate-800">{p.mealsCooked}</span></div>
              <div className="flex justify-between"><span>Total Taps</span><span className="font-semibold text-slate-800">{p.totalTaps}</span></div>
              <div className="flex justify-between"><span>Recipes Unlocked</span><span className="font-semibold text-slate-800">{unlockedRecipes}</span></div>
              <div className="flex justify-between"><span>Tasks Done Today</span><span className="font-semibold text-slate-800">{state.daily.completed}/{state.daily.total}</span></div>
              <div className="flex justify-between"><span>Sound</span><span className="font-semibold text-slate-800">{p.soundEnabled ? "On" : "Off"}</span></div>
              <div className="flex justify-between"><span>Theme</span><span className="font-semibold text-slate-800">{state.activeTheme?.name || "Classic Kitchen"}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
