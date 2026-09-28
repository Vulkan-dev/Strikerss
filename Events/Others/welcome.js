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
      try {
        const card = new Card()
          .setTitle("Welcome")
          .setName(member.user.username)
          .setAvatar(member.user.displayAvatarURL({ format: "png", dynamic: true }))
          .setMessage(`You are the ${member.guild.memberCount}th to join`)
          .setBackground(image)
          .setColor("00FF38");
        const cardOutput = await card.build();
        sendOptions.files = [{ attachment: cardOutput, name: "welcome-card.png" }];
      } catch (imgErr) {
        console.error("Failed to build welcome image card on member join:", imgErr);
      }
    }

    if (isEmbed) {
      const embed = new EmbedBuilder();
      try {
        embed.setColor(color && color !== "Random" ? color : "#00f5d4");
      } catch (e) {
        embed.setColor("#00f5d4");
      }

      if (author && author.trim() !== "") {
        embed.setAuthor({ name: author });
      }
      if (title && title.trim() !== "") {
        embed.setTitle(title);
      }
      if (messageContent && messageContent.trim() !== "") {
        embed.setDescription(messageContent);
      } else if (!title && !author) {
        embed.setDescription(`Welcome to **${member.guild.name}**, ${member.user}!`);
      }

      if (embed.data.title || embed.data.description || embed.data.author) {
        sendOptions.embeds = [embed];
      }
    } else if (messageContent) {
      sendOptions.content = messageContent;
    }

    if (sendOptions.content || sendOptions.embeds || sendOptions.files) {
      await channel.send(sendOptions).catch((err) => {
        console.error(`Failed to send welcome message in channel ${channel.id}:`, err.message);
      });
    }
  },
};