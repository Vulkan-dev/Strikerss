# ⚡ Strikers Discord Bot

**Strikers** is an all-in-one Discord bot featuring a **Server Backup & Restore Engine**, an **OAuth2 Member Restorer** (anti-nuke member recovery), **Automated 24-Hour Rolling Backups**, Moderation, Automod, Tickets, Music (Lavalink), Economy, Games, and Community Tools.

*(Note: AI Chatbot and AI Image Generation features have been completely removed.)*

---

## 🛠️ Key New Features

### 1. 🔐 Member Restorer (Anti-Nuke Recovery)
- **`/setup verify`**:
  - Deploy an interactive verification panel in any channel.
  - Options:
    - `message`: Description text for the verification embed.
    - `role`: Role assigned to members upon successful verification.
    - `title` *(optional)*: Custom embed title.
    - `color` *(optional)*: Hex color code.
  - Clicking the **"Verify With Discord"** button prompts members to authorize via Discord OAuth2 (`identify guilds.join`).
  - Access tokens and verified members are saved into your MongoDB database.
- **`/restore members`**:
  - If your server is deleted or nuked, run `/restore members` to automatically pull all authorized members back into the new/recovered server using Discord's OAuth2 join API!
- **`/restore stats`**:
  - View how many verified members are saved in your recovery database.

### 2. 📅 Automated 24-Hour Backup with Rolling 3-Day Retention
- The bot automatically captures full server backups **every 24 hours** named by date (e.g., `Auto_2026-09-27`).
- **Rolling 3-Day Window**:
  - Backups older than 3 days (72 hours) are automatically pruned.
  - Day 1 backup is deleted on Day 4, Day 2 on Day 5, etc.
- **Commands**:
  - `/backup create [state]`: Take an instant manual backup.
  - `/backup list`: View all backups (manual & auto with retention badges).
  - `/backup auto-status`: View schedule and active rolling snapshots.
  - `/backup restore [state] [scope]`: Restore channels, roles, emojis, or all.

---

## ⚙️ Configuration (`.env`)

Fill in your bot details in `Strikers/.env`:

```env
############# BOT INFO #############
clientId=YOUR_DISCORD_BOT_CLIENT_ID
clientSecret=YOUR_DISCORD_BOT_CLIENT_SECRET
token=YOUR_DISCORD_BOT_TOKEN
developerId=YOUR_DISCORD_USER_ID

############ DATABASE & OAUTH #############
mongodbURL=mongodb+srv://...
REDIRECT_URI=http://localhost:3000/api/auth/callback
PORT=3000
```

### Discord Developer Portal Setup:
1. Go to [Discord Developer Portal](https://discord.com/developers/applications) > Your Application.
2. Under **OAuth2 > General**:
   - Add your Redirect URL: `http://localhost:3000/api/auth/callback` (or your domain/vps callback URL).
   - Copy your **Client ID** and **Client Secret** into `.env`.
3. Under **Bot**:
   - Enable **Privileged Gateway Intents** (Server Members Intent, Message Content Intent, Presence Intent).
   - Ensure the bot has **Administrator** permission (or Manage Roles & Create Instant Invite).

---

## 🚀 How to Run

1. Open a terminal in the `Strikers` folder:
   ```bash
   cd "Strikers"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the bot:
   ```bash
   npm start
   # or
   node index.js
   ```
