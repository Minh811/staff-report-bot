# Staff Report Bot

## Overview
This is a Discord bot that automatically tracks and summarizes staff daily activities. Staff members can log their completed tasks (help counts) using commands, and the bot compiles and sends automated reports at midnight each day. Built with Node.js and Discord.js.

**Current State:** Fully configured and running in Replit environment.

## Recent Changes
- **2025-11-10**: Imported project from GitHub and fully configured for Replit
  - Installed Node.js 20 and all npm dependencies (discord.js, dotenv, node-cron, json2csv)
  - Created .env.example for environment variable documentation
  - Configured workflow for running the bot
  - All required secrets configured and bot running successfully
  - Added !tongket command for instant manual reports
  - Improved report UI with Discord mentions, medals, and statistics
  - Configured timezone to Vietnam (GMT+7) for both display and auto-report scheduling

## Project Architecture
- **Language:** Node.js v20 (ES Modules)
- **Main File:** index.js
- **Dependencies:**
  - discord.js: Discord API interaction
  - dotenv: Environment variable management
  - node-cron: Scheduled tasks for daily reports
  - json2csv: CSV export functionality
- **Data Storage:**
  - `data/`: Daily JSON files storing staff help counts
  - `exports/`: Auto-generated CSV reports

## Required Environment Variables
All configured in Replit Secrets:
- `DISCORD_TOKEN`: Discord bot authentication token
- `PREFIX`: Command prefix (e.g., "!")
- `OWNER_ID`: Discord user ID of the bot owner (for admin commands)
- `LOG_CHANNEL_ID`: Channel where staff log their help counts
- `REPORT_CHANNEL_ID`: Channel where daily reports are sent

## Bot Features
- **!help [count]:** Log help count in the designated log channel (default: 1 if count not specified)
- **!tongket:** Admin command to instantly generate summary report and export CSV (owner only)
- **!exportcsv:** Export current day's data to CSV file (owner only)
- **Automated Daily Reports:** Bot sends a summary to the report channel at midnight (0:00) each day
- **Automatic CSV Export:** Generates CSV file with daily report data
- **Data Persistence:** Saves daily data to JSON files by date (YYYY-MM-DD.json)

## Running the Bot
The bot runs automatically via the configured workflow using:
```
npm start
```

The workflow starts on Repl boot and restarts automatically when needed.

## Setup Instructions
1. All required environment variables are configured in Replit Secrets
2. Bot automatically connects to Discord on startup
3. Staff use `!help [count]` in the log channel to record their activities
4. Bot sends automated reports at midnight and exports CSV files

## User Preferences
- **Language:** Communicate 100% in Vietnamese (tiếng Việt)
