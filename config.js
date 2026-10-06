module.exports = {
  // Bot Information //
  status: "online",
  eventListeners: 100,
  embedColor: "#00f5d4",
  dev: "Strikers Team",
  devBy: "| Strikers Bot",
  noPermsMessage: `You **do not** have permission to do that!`,

  // Logging Channels //
  slashCommandLoggingChannel: "",
  prefixCommandLoggingChannel: "",
  botsuggestions: "",
  bugreport: "",
  feedback: "",

  // Member Restorer (OAuth2)
  oauth: {
    port: process.env.PORT || 3000,
    redirectUri: process.env.REDIRECT_URI
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/auth/callback` : null)
      || `http://localhost:${process.env.PORT || 3000}/api/auth/callback`,
    scopes: ["identify", "guilds.join"]
  },

  // Auto Backup Settings
  autoBackup: {
    enabled: true,
    cronSchedule: "0 0 * * *", // Every 24 hours at midnight
    retentionDays: 3           // Rolling 3 days retention
  },

  // Clan Name Manager & Verification Category
  clanManager: {
    guildId: process.env.CLAN_GUILD_ID || "1553407415523999824",
    categoryId: process.env.CLAN_CATEGORY_ID || "1554194420377583708",
    staffRoleId: process.env.CLAN_STAFF_ROLE_ID || "1553810081915600946",
    memberRoleId: process.env.CLAN_MEMBER_ROLE_ID || "",
    verifiedRoleId: process.env.VERIFIED_ROLE_ID || "1554580539082809490",
    webhookUrl: process.env.SECURITY_WEBHOOK_URL || "https://discord.com/api/webhooks/1556296965367791789/mL6O6JxySSy2FWxzlgcxTO2WvWuTW9hw5klrrC9DLtxhkZGAYr9PrWd_W_x46fcwq9kP"
  },
  securityWebhookUrl: process.env.SECURITY_WEBHOOK_URL || "https://discord.com/api/webhooks/1556296965367791789/mL6O6JxySSy2FWxzlgcxTO2WvWuTW9hw5klrrC9DLtxhkZGAYr9PrWd_W_x46fcwq9kP"
};
