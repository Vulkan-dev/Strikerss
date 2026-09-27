const { model, Schema } = require("mongoose");

const welcomeMessageSchema = new Schema({
  guildId: String,
  channelId: String,
  message: String,
  isEmbed: Boolean,
  isImage: Boolean,
  author: String,
  title: String,
  color: String,
  image: String,
});

module.exports = model("WelcomeMessage", welcomeMessageSchema);