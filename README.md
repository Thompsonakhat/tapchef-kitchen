# TapChef Bot

TapChef is a Telegram Mini App game where players tap ingredients, cook meals, earn Chef Points, complete daily cooking tasks, and climb a leaderboard.

## Features

- Telegram bot built with grammY
- Telegram Mini App built with React + Vite
- Mobile-first cooking game UI
- Server-authoritative gameplay
- Energy system with regeneration
- Daily tasks and daily streaks
- Player profile and leaderboard
- MongoDB persistence with safe fallbacks
- Single Node.js service for bot and web app

## Architecture

- `src/index.js`: boots Express server and Telegram bot
- `src/bot.js`: bot creation and feature wiring
- `src/commands/*`: public Telegram commands
- `src/features/agent.js`: optional plain-chat helper for bot usage questions
- `src/server.js`: Express server for Mini App and API routes
- `src/routes/api.js`: Mini App backend API
- `src/services/game.js`: game logic and persistence
- `src/lib/*`: config, DB, auth, utils, bot profile
- `webapp/`: React + Vite Telegram Mini App

## Setup

### Prerequisites

- Node.js 18+
- MongoDB database
- Telegram bot token from BotFather

### Install

bash
npm install
npm --prefix webapp install


### Configure

Copy `.env.sample` to `.env` and set values.

Required env vars:

- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `PUBLIC_BASE_URL`: deployed service base URL, for example `https://your-service.onrender.com`

Recommended env vars:

- `MONGODB_URI`: MongoDB connection string for persistent game data

Optional env vars:

- `PORT`: HTTP server port, defaults to `3000`
- `AI_TIMEOUT_MS`: AI timeout for optional helper replies, defaults to `600000`
- `CONCURRENCY`: reserved tuning env, defaults to `20`
- `COOKMYBOTS_AI_ENDPOINT`: optional AI gateway base URL
- `COOKMYBOTS_AI_KEY`: optional AI gateway key

### Run locally

bash
npm run dev


### Build

bash
npm run build


### Start

bash
npm start


## Commands

- `/start` — welcome and quick intro
- `/help` — command list and usage
- `/play` — opens the Mini App
- `/profile` — shows your stats summary
- `/leaderboard` — shows top players
- `/about` — explains the game
- `/reset` — clears saved chat memory for helper chat only

Examples:

- `/play` → bot sends an Open Kitchen button
- `/profile` → bot shows Chef Points, energy, streak, meals, and today tasks
- `/leaderboard` → bot shows the top players and your rank

## Integrations

### Telegram Bot API

Used through grammY.

### Telegram Web App

The Mini App reads Telegram WebApp init data in the browser and sends it to the backend for validation.

### MongoDB

Collections:

- `users`
- `daily_task_progress`
- `memory_messages`
- `game_events`

Indexes created safely:

- `users.telegramUserId` unique
- `users.totalChefPoints` descending
- `daily_task_progress.telegramUserId + dateKey` unique
- `memory_messages.userId + chatId + ts`

## Database notes

Gameplay remains usable without MongoDB, but data becomes in-memory and will reset on restart. For production, set `MONGODB_URI`.

## Deployment on Render

1. Create one Node web service.
2. Set build command to `npm run build`.
3. Set start command to `npm start`.
4. Add env vars:
   - `TELEGRAM_BOT_TOKEN`
   - `PUBLIC_BASE_URL`
   - `MONGODB_URI`
5. Deploy.

The service hosts the Mini App at `/app` and runs the Telegram bot in the same process.

## Troubleshooting

- If bot startup fails, check `TELEGRAM_BOT_TOKEN`.
- If `/play` says URL is not configured, set `PUBLIC_BASE_URL` without `/app`.
- If progress resets after restart, set `MONGODB_URI`.
- If Telegram polling overlaps during deploy, the bot retries automatically.
- Check logs for `[boot]`, `[polling]`, `[db]`, and `[api]` messages.

## Extending the project

- Add commands in `src/commands/`
- Add API routes in `src/routes/api.js`
- Add gameplay logic in `src/services/game.js`
- Update `DOCS.md` and bot command menu when adding public commands
