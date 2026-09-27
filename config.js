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
    redirectUri: process.env.REDIRECT_URI || "http://localhost:3000/api/auth/callback",
    scopes: ["identify", "guilds.join"]
  },

  // Auto Backup Settings
  autoBackup: {
    enabled: true,
    cronSchedule: "0 0 * * *", // Every 24 hours at midnight
    retentionDays: 3           // Rolling 3 days retention
  },
};
