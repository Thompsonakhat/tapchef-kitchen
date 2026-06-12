# TapChef Bot Docs

TapChef is a Telegram Mini App game. Players open the kitchen, tap ingredients, spend energy, earn Chef Points, cook meals, complete daily tasks, keep a streak, and compete on the leaderboard.

## Public commands

### /start

What it does:
Welcomes the player and explains TapChef.

Usage:
`/start`

### /help

What it does:
Shows the main commands and short usage tips.

Usage:
`/help`

### /play

What it does:
Sends a button that opens the TapChef Mini App.

Usage:
`/play`

### /profile

What it does:
Shows your Chef Points, energy, streak, meals cooked, taps, and today task progress.

Usage:
`/profile`

### /leaderboard

What it does:
Shows the top players by Chef Points and your rank when available.

Usage:
`/leaderboard`

### /about

What it does:
Explains the game loop and rules.

Usage:
`/about`

### /reset

What it does:
Clears saved helper-chat memory for this user.
This does not delete game progress.

Usage:
`/reset`

## Environment variables

### TELEGRAM_BOT_TOKEN

Required.
Telegram bot token.

### MONGODB_URI

Optional but recommended.
Used to store users, tasks, leaderboard, and helper memory.
If missing, the app falls back to in-memory storage.

### PUBLIC_BASE_URL

Recommended for Mini App.
Base deployed URL, for example `https://your-service.onrender.com`.
Do not include `/app`.

### PORT

Optional.
HTTP port for the Node service. Defaults to `3000`.

### COOKMYBOTS_AI_ENDPOINT

Optional.
AI gateway base URL for optional helper chat.

### COOKMYBOTS_AI_KEY

Optional.
AI gateway key for optional helper chat.

### AI_TIMEOUT_MS

Optional.
AI request timeout in milliseconds. Defaults to `600000`.

### CONCURRENCY

Optional.
Reserved tuning env. Defaults to `20`.

## Setup

1. Install dependencies.
2. Set env vars.
3. Run `npm run dev` for local development.
4. Run `npm start` for production.

## Mini App routes

- `/app` — Mini App UI
- `/api/game/bootstrap` — load player game state
- `/api/game/tap` — perform one tap
- `/api/game/cook` — cook one meal when ready
- `/api/game/profile` — fetch profile summary
- `/api/game/leaderboard` — fetch leaderboard

## Notes

- Chef Points are fictional game points only.
- No money, wallets, crypto, or earnings are involved.
- Server logic decides points, energy, streaks, and tasks.
