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

function themeVars(tg) {
  const p = tg?.themeParams || {};
  return {
    bg: p.bg_color || "#fff7ed",
    card: p.secondary_bg_color || "#ffffff",
    text: p.text_color || "#1f2937",
    button: p.button_color || "#f97316",
    buttonText: p.button_text_color || "#ffffff"
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
    <div className="rounded-2xl bg-white/80 p-4 shadow-card">
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
    <div className="rounded-2xl bg-white/85 p-4 shadow-card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

export default function App() {
  const tg = useMemo(() => tgInit(), []);
  const colors = useMemo(() => themeVars(tg), [tg]);
  const [state, setState] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [message, setMessage] = useState("Loading your kitchen...");
  const [tab, setTab] = useState("play");
  const [busy, setBusy] = useState(false);
  const initData = tg?.initData || "";

  async function load() {
    try {
      setMessage("Loading your kitchen...");
      const json = await post("/api/game/bootstrap", { initData });
      if (!json.ok) {
        setMessage(json.message || "Could not load game");
        return;
      }
      setState(json.state);
      setLeaderboard(json.leaderboard?.top || []);
      setMessage("Kitchen ready");
    } catch {
      setMessage("Network error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doTap() {
    if (busy) return;
    setBusy(true);
    try {
      const json = await post("/api/game/tap", { initData });
      if (json.state) setState(json.state);
      setMessage(json.message || "Tapped");
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
      const lb = await post("/api/game/leaderboard", { initData });
      if (lb.ok) setLeaderboard(lb.leaderboard?.top || []);
    } catch {
      setMessage("Cook failed");
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

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="rounded-[28px] bg-gradient-to-br from-orange-500 to-amber-400 p-5 text-white shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-orange-100">TapChef Kitchen</div>
              <div className="mt-1 text-2xl font-extrabold">Hi, {p.displayName.split(" ")[0]}</div>
              <div className="mt-1 text-sm text-orange-50">Tap ingredients. Cook meals. Climb the kitchen board.</div>
            </div>
            <div className="rounded-2xl bg-white/20 px-3 py-2 text-right">
              <div className="text-xs text-orange-50">Chef Points</div>
              <div className="text-xl font-bold">{p.totalChefPoints}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label="Energy" value={`${p.currentEnergy}/${p.maxEnergy}`} accent="text-orange-600" />
          <StatCard label="Streak" value={`${p.streakCount} day`} accent="text-green-700" />
          <StatCard label="Meals" value={p.mealsCooked} accent="text-slate-800" />
          <StatCard label="Taps" value={p.totalTaps} accent="text-slate-800" />
        </div>

        <div className="mt-4 flex rounded-2xl bg-white/70 p-1 shadow-card">
          {[
            ["play", "Play"],
            ["tasks", "Tasks"],
            ["board", "Board"],
            ["profile", "Profile"]
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`h-11 flex-1 rounded-xl text-sm font-semibold ${tab === key ? "bg-orange-500 text-white" : "text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "play" && (
          <div className="mt-4 rounded-[28px] bg-white/85 p-5 shadow-card">
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
          </div>
        )}

        {tab === "board" && (
          <div className="mt-4 rounded-[28px] bg-white/85 p-5 shadow-card">
            <div className="text-lg font-bold text-slate-800">Leaderboard</div>
            <div className="mt-3 space-y-3">
              {leaderboard.length === 0 && <div className="rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">No chefs yet. Start tapping.</div>}
              {leaderboard.map((row) => (
                <div key={row.telegramUserId} className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">#{row.rank} {row.displayName}</div>
                    <div className="text-xs text-slate-500">Meals {row.mealsCooked}</div>
                  </div>
                  <div className="text-sm font-bold text-orange-700">{row.totalChefPoints}</div>
                </div>
              ))}
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
              <div className="flex justify-between"><span>Tasks Done Today</span><span className="font-semibold text-slate-800">{state.daily.completed}/{state.daily.total}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
