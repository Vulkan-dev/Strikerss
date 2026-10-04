const { model, Schema } = require("mongoose");

const goodbyeMessageSchema = new Schema({
  guildId: String,
  channelId: String,
  message: { type: String, default: "{user} Leave coz he was not worthy to be Strikers" },
  isEmbed: { type: Boolean, default: true },
  title: { type: String, default: "Member Departed" },
  color: { type: String, default: "#ef4444" },
  image: String,
  footer: { type: String, default: "STRIKERS Squad Roster Update" },
  thumbnailType: { type: String, default: "user" }, // none, user, bot, server
  thumbnailUrl: String,
  enabled: { type: Boolean, default: true },
});

module.exports = model("GoodbyeMessage", goodbyeMessageSchema);
