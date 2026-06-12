# Changelog

All notable changes to this bot project are recorded here.

## 2026-06-12 01:50:24. UTC
- Request: hey i got an error duing build and deploy please check and fix
- Summary: Fixed the Vite build error by restoring the Mini App entry script in webapp/index.html. It was incorrectly pointing to /app/assets/index.js during build, which does not exist until after Vite outputs files. The file now…
- Files: .env.sample, package.json, webapp/index.html

## 2026-06-12 01:45:44. UTC
- Request: Build a Telegram Mini App game called TapChef. TapChef is a fun cooking-themed mobile game for Telegram users. Users tap ingredients, cook meals, earn Chef Points, complete daily cooking tasks, and climb a leaderboard. …
- Summary: Built the first complete TapChef version as a single Telegram bot plus Mini App service with commands, server-authoritative game APIs, Mongo-backed persistence with safe in-memory fallback, long polling, and a mobile-fi…
- Files: .env.sample, DOCS.md, README.md, package.json, project.json, src/bot.js, src/commands/about.js, src/commands/help.js, src/commands/leaderboard.js, src/commands/loader.js, src/commands/play.js, src/commands/profile.js, src/commands/start.js, src/features/agent…

