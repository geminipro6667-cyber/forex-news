# Forex News Alert Bot

Real-time Telegram bot for Forex news alerts with analysis.

## Features
- 🔔 Alerts 5 minutes before High/Medium impact news
- ✅ Instant result notification with Actual value
- 📊 Automatic analysis: "Actual > Forecast = Strong currency"
- 📅 View upcoming news with `/next`
- 🎛️ Subscribe/Unsubscribe with simple commands
- 💾 Persistent user preferences with SQLite
- 🚀 Deployable on Render (Free tier)

## Commands
- `/start` - Welcome message
- `/subscribe` - Turn on notifications
- `/unsubscribe` - Turn off notifications
- `/status` - Check subscription status
- `/next` - See upcoming news
- `/help` - Help guide

## Deployment on Render
1. Push code to GitHub
2. Create Web Service on Render
3. Add Environment Variables: `BOT_TOKEN`, `PORT`
4. Start Command: `npm start`
5. Deploy

## Tech Stack
- Node.js
- Telegraf (Telegram Bot API)
- SQLite3
- Express (for health check)
- Fetch API (for news data)
