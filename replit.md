# Staff Report Bot

## Overview
This is a Discord bot that allows staff members to report activities and sends automated reports to a designated channel. The bot is built with Node.js and Discord.js.

**Current State:** Imported from GitHub and configured for Replit environment.

## Recent Changes
- **2025-11-10**: Imported project from GitHub and set up for Replit
  - Installed Node.js 20 and npm dependencies
  - Created .env.example for environment variable documentation
  - Configured workflow for running the bot

## Project Architecture
- **Language:** Node.js (ES Modules)
- **Main File:** index.js
- **Dependencies:**
  - discord.js: Discord API interaction
  - dotenv: Environment variable management

## Required Environment Variables
The bot requires the following environment variables to be set in Replit Secrets:
- `DISCORD_TOKEN`: Your Discord bot token
- `PREFIX`: Command prefix (e.g., "!")
- `OWNER_ID`: Discord user ID of the bot owner
- `REPORT_CHANNEL_ID`: Channel ID where reports will be sent

## Bot Features
- **Command Prefix:** Configurable via PREFIX environment variable
- **!ping:** Basic command to check if bot is responsive
- **!report @user [reason]:** Report a staff member with an optional reason

## Running the Bot
The bot runs automatically via the configured workflow. It uses the command:
```
npm start
```

## Setup Instructions
1. Set the required environment variables in Replit Secrets
2. The bot will automatically start and connect to Discord
3. Use the configured prefix to interact with the bot in Discord

## User Preferences
None documented yet.
