const { Events, EmbedBuilder, MessageFlags } = require("discord.js");
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");
const { Card } = require("welcomify");

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (!member || !member.guild) return;
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) return;

    const welcomeMessage = await WelcomeMessage.findOne({
      guildId: member.guild.id,
    });

    if (!welcomeMessage) return;

    const image = welcomeMessage.image || "https://i.imgur.com/GMuBRQo.jpeg";
    const author = welcomeMessage.author || "";
    const title = welcomeMessage.title || "";
    const color = welcomeMessage.color || "Random";
    const isImage = welcomeMessage.isImage;
    const isEmbed = welcomeMessage.isEmbed;
    const messageContent = welcomeMessage.message
      ? welcomeMessage.message.replace("{user}", member.user.toString())
      : null;

    const channel = member.guild.channels.cache.get(welcomeMessage.channelId);
    if (!channel) return;

    let sendOptions = {};

    if (isImage) {
      const card = new Card()
        .setTitle("Welcome")
        .setName(member.user.username)
        .setAvatar(member.user.displayAvatarURL({ format: "png", dynamic: true }))
        .setMessage(`You are the ${member.guild.memberCount}th to join`)
        .setBackground(image)
        .setColor("00FF38");
      const cardOutput = await card.build();
      sendOptions.files = [{ attachment: cardOutput, name: "welcome-card.png" }];
    }

    if (isEmbed) {
      const embed = new EmbedBuilder().setColor(color);

      if (author) {
        embed.setAuthor({ name: author });
      }
      if (title) {
        embed.setTitle(title);
      }

      sendOptions.embeds = [embed];
    }

    if (messageContent) {
      sendOptions.content = messageContent;
    }

    if (sendOptions.content || sendOptions.embeds || sendOptions.files) {
      await channel.send(sendOptions);
    }
  },
};