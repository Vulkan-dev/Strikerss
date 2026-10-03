const { model, Schema } = require("mongoose");

const welcomeMessageSchema = new Schema({
  guildId: String,
  channelId: String,
  message: String,
  isEmbed: Boolean,
  isImage: Boolean,
  author: String,
  authorIcon: String,
  title: String,
  color: String,
  image: String,
  footer: String,
  thumbnailType: { type: String, default: "none" }, // none, user, bot, server
  thumbnailUrl: String,
  enabled: { type: Boolean, default: true },
});

module.exports = model("WelcomeMessage", welcomeMessageSchema);