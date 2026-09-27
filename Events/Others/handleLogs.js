const { EmbedBuilder, Events, MessageFlags } = require("discord.js");

function handleLogs(client) {
  const logSchema = require("../../Schemas/logschema");

  async function send_log(guildId, embed, logType) {
    const data = await logSchema.findOne({ Guild: guildId });
    if (!data || !data.LogChannels) return;

    const logChannels = data.LogChannels;
    let targetChannelId = null;

    // Check if a specific channel is configured for this log type
    if (logChannels[logType]) {
      targetChannelId = logChannels[logType];
    }
    // If no specific channel, check if "All Logs" channel is configured
    else if (logChannels.all) {
      targetChannelId = logChannels.all;
    }

    if (!targetChannelId) return;

    const logChannel = client.channels.cache.get(targetChannelId);
    if (!logChannel) return;

    embed.setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.log(`Error sending ${logType} log:`, err);
    }
  }

  // Message Logs
  client.on("messageDelete", function (message) {
    try {
      if (message.guild === null || !message.author) {
        console.log("Skipping message delete log: Message is partial or lacks author");
        return;
      }
      if (message.author.bot) return; // Skip bot messages
  
      const embed = new EmbedBuilder()
        .setTitle("> Message Deleted")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Author`, value: `> <@${message.author.id}> - *${message.author.tag}*` })
        .addFields({ name: `• Channel`, value: `> ${message.channel}` })
        .addFields({ name: `• Deleted Message`, value: `> ${message.content || "No content"}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Message Deleted` });
  
      return send_log(message.guild.id, embed, "message");
    } catch (err) {
      console.log("Error logging message delete:", err);
    }
  });

  client.on("messageContentEdited", (message, oldContent, newContent) => {
    try {
      if (message.guild === null || message.author.bot) return;

      const embed = new EmbedBuilder()
        .setTitle("> Message Edited")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${message.author}` })
        .addFields({ name: `• Old Message`, value: `> ${oldContent || "No content"}` })
        .addFields({ name: `• New Message`, value: `> ${newContent || "No content"}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Message Edited` });

      return send_log(message.guild.id, embed, "message");
    } catch (err) {
      console.log("Error logging message edit:", err);
    }
  });

  client.on("messagePinned", (message) => {
    try {
      if (message.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Message Pinned")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Pinner`, value: `> ${message.author}` })
        .addFields({ name: `• Message`, value: `> ${message.content || "No content"}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Message Pinned` });

      return send_log(message.guild.id, embed, "message");
    } catch (err) {
      console.log("Error logging pin add:", err);
    }
  });

  // Channel Logs
  client.on("guildChannelTopicUpdate", (channel, oldTopic, newTopic) => {
    try {
      if (channel.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Topic Changed")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Channel`, value: `> ${channel}` })
        .addFields({ name: `• Old Topic`, value: `> ${oldTopic || "None"}` })
        .addFields({ name: `• New Topic`, value: `> ${newTopic || "None"}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Topic Update` });

      return send_log(channel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging topic update:", err);
    }
  });

  client.on("guildChannelPermissionsUpdate", (channel, oldPermissions, newPermissions) => {
    try {
      if (channel.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Channel Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Channel`, value: `> ${channel}` })
        .addFields({ name: `• Changes`, value: `> Channel's permissions were updated` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Permissions Update` });

      return send_log(channel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging channel permissions update:", err);
    }
  });

  client.on("unhandledGuildChannelUpdate", (oldChannel, newChannel) => {
    try {
      if (oldChannel.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Channel Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Channel`, value: `> ${oldChannel}` })
        .addFields({ name: `• Changes`, value: `> Unhandled channel update detected` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Channel Update` });

      return send_log(oldChannel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging unhandled channel update:", err);
    }
  });

  client.on("channelCreate", (channel) => {
    try {
      if (channel.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Channel Created")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Channel`, value: `> ${channel}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Channel Created` });

      return send_log(channel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging channel create:", err);
    }
  });

  client.on("channelDelete", (channel) => {
    try {
      if (channel.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Channel Deleted")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Channel`, value: `> ${channel}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Channel Deleted` });

      return send_log(channel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging channel delete:", err);
    }
  });

  client.on("threadCreate", (thread) => {
    try {
      if (thread.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Thread Created")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Thread`, value: `> ${thread.name}` })
        .addFields({ name: `• Channel`, value: `> ${thread.parent}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Thread Created` });

      return send_log(thread.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging thread create:", err);
    }
  });

  client.on("threadDelete", (thread) => {
    try {
      if (thread.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Thread Deleted")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Thread`, value: `> ${thread.name}` })
        .addFields({ name: `• Channel`, value: `> ${thread.parent}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Thread Deleted` });

      return send_log(thread.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging thread delete:", err);
    }
  });

  client.on("threadUpdate", (oldThread, newThread) => {
    try {
      if (oldThread.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Thread Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Thread`, value: `> ${newThread.name}` })
        .addFields({ name: `• Old Name`, value: `> ${oldThread.name}` })
        .addFields({ name: `• New Name`, value: `> ${newThread.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Thread Updated` });

      return send_log(newThread.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging thread update:", err);
    }
  });

  // Guild Logs
  client.on("guildMemberBoost", (member) => {
    try {
      if (member.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle(`> ${member.user.username} started Boosting`)
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${member.user}` })
        .addFields({ name: `• Server`, value: `> ${member.guild.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Boosting Started` });

      return send_log(member.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging member boost start:", err);
    }
  });

  client.on("guildMemberUnboost", (member) => {
    try {
      if (member.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle(`> ${member.user.username} stopped Boosting`)
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${member.user}` })
        .addFields({ name: `• Server`, value: `> ${member.guild.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Boosting Stopped` });

      return send_log(member.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging member boost stop:", err);
    }
  });

  client.on("guildBoostLevelUp", (guild, oldLevel, newLevel) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle(`> ${guild.name} advanced a Boosting Level`)
        .setColor(client.config.embedColor)
        .addFields({
          name: `• Info`,
          value: `> **${guild.name}** advanced from level **${oldLevel}** to **${newLevel}**!`,
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Boosting Level Up` });

      return send_log(guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging boost level up:", err);
    }
  });

  client.on("guildBoostLevelDown", (guild, oldLevel, newLevel) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle(`> ${guild.name} lost a Boosting Level`)
        .setColor(client.config.embedColor)
        .addFields({
          name: `• Info`,
          value: `> **${guild.name}** lost a level, from **${oldLevel}** to **${newLevel}**!`,
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Boosting Level Down` });

      return send_log(guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging boost level down:", err);
    }
  });

  client.on("guildBannerAdd", (guild, bannerURL) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle(`${guild.name}'s Banner was Updated`)
        .setColor(client.config.embedColor)
        .addFields({ name: `• Banner URL`, value: `> ${bannerURL}` })
        .setImage(bannerURL)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Banner Updated` });

      return send_log(guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging banner change:", err);
    }
  });

  client.on("guildAfkChannelAdd", (guild, afkChannel) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> AFK Channel Added")
        .setColor(client.config.embedColor)
        .addFields({ name: `• AFK Channel`, value: `> ${afkChannel}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 AFK Channel Added` });

      return send_log(guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging afk channel add:", err);
    }
  });

  client.on("guildVanityURLAdd", (guild, vanityURL) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Vanity URL Added")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Vanity URL`, value: `> ${vanityURL}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Vanity Created` });

      return send_log(guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging vanity add:", err);
    }
  });

  client.on("guildVanityURLRemove", (guild, vanityURL) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Vanity URL Removed")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Old Vanity`, value: `> ${vanityURL}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Vanity Removed` });

      return send_log(guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging vanity remove:", err);
    }
  });

  client.on("guildVanityURLUpdate", (guild, oldVanityURL, newVanityURL) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Vanity URL Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Old Vanity`, value: `> ${oldVanityURL}` })
        .addFields({ name: `• New Vanity`, value: `> ${newVanityURL}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Vanity Updated` });

      return send_log(guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging vanity update:", err);
    }
  });

  client.on("guildUpdate", (oldGuild, newGuild) => {
    try {
      const changes = [];
      if (oldGuild.name !== newGuild.name) {
        changes.push(`Name changed from "${oldGuild.name}" to "${newGuild.name}"`);
      }
      if (oldGuild.icon !== newGuild.icon) {
        changes.push(`Icon updated`);
      }
      if (oldGuild.region !== newGuild.region) {
        changes.push(`Region changed from "${oldGuild.region || "None"}" to "${newGuild.region || "None"}"`);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Guild Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Guild`, value: `> ${newGuild.name}` })
        .addFields({ name: `• Changes`, value: `> ${changes.join("\n> ")}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Guild Updated` });

      return send_log(newGuild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging guild update:", err);
    }
  });

  client.on("emojiCreate", (emoji) => {
    try {
      if (emoji.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Emoji Created")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Emoji`, value: `> ${emoji}` })
        .addFields({ name: `• Emoji Name`, value: `> ${emoji.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Emoji Created` });

      return send_log(emoji.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging emoji create:", err);
    }
  });

  client.on("emojiDelete", (emoji) => {
    try {
      if (emoji.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Emoji Deleted")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Emoji Name`, value: `> ${emoji.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Emoji Deleted` });

      return send_log(emoji.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging emoji delete:", err);
    }
  });

  client.on("emojiUpdate", (oldEmoji, newEmoji) => {
    try {
      if (oldEmoji.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Emoji Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Emoji`, value: `> ${newEmoji}` })
        .addFields({ name: `• Old Name`, value: `> ${oldEmoji.name}` })
        .addFields({ name: `• New Name`, value: `> ${newEmoji.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Emoji Updated` });

      return send_log(newEmoji.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging emoji update:", err);
    }
  });

  client.on("stickerCreate", (sticker) => {
    try {
      if (sticker.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Sticker Created")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Sticker Name`, value: `> ${sticker.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Sticker Created` });

      return send_log(sticker.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging sticker create:", err);
    }
  });

  client.on("stickerDelete", (sticker) => {
    try {
      if (sticker.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Sticker Deleted")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Sticker Name`, value: `> ${sticker.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Sticker Deleted` });

      return send_log(sticker.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging sticker delete:", err);
    }
  });

  client.on("stickerUpdate", (oldSticker, newSticker) => {
    try {
      if (oldSticker.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Sticker Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Old Name`, value: `> ${oldSticker.name}` })
        .addFields({ name: `• New Name`, value: `> ${newSticker.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Sticker Updated` });

      return send_log(newSticker.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging sticker update:", err);
    }
  });

  client.on("integrationCreate", (integration) => {
    try {
      if (integration.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Integration Created")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Integration`, value: `> ${integration.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Integration Created` });

      return send_log(integration.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging integration create:", err);
    }
  });

  client.on("integrationDelete", (integration) => {
    try {
      if (integration.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Integration Deleted")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Integration`, value: `> ${integration.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Integration Deleted` });

      return send_log(integration.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging integration delete:", err);
    }
  });

  client.on("integrationUpdate", (integration) => {
    try {
      if (integration.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Integration Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Integration`, value: `> ${integration.name}` })
        .addFields({ name: `• Changes`, value: `> Integration settings updated` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Integration Updated` });

      return send_log(integration.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging integration update:", err);
    }
  });

  client.on("webhookUpdate", (channel) => {
    try {
      if (channel.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Webhook Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Channel`, value: `> ${channel}` })
        .addFields({ name: `• Changes`, value: `> Webhook created, updated, or deleted` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Webhook Updated` });

      return send_log(channel.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging webhook update:", err);
    }
  });

  client.on("inviteCreate", (invite) => {
    try {
      if (invite.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Invite Created")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Invite Code`, value: `> ${invite.code}` })
        .addFields({ name: `• Inviter`, value: `> ${invite.inviter || "Unknown"}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Invite Created` });

      return send_log(invite.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging invite create:", err);
    }
  });

  client.on("inviteDelete", (invite) => {
    try {
      if (invite.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Invite Deleted")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Invite Code`, value: `> ${invite.code}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Invite Deleted` });

      return send_log(invite.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging invite delete:", err);
    }
  });

  // Role Logs
  client.on("guildMemberRoleAdd", (member, role) => {
    try {
      if (member.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle(`> ${member.user.username} was given a Role`)
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${member.user}` })
        .addFields({ name: `• Role`, value: `> ${role}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Role Given` });

      return send_log(member.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging role give:", err);
    }
  });

  client.on("guildMemberRoleRemove", (member, role) => {
    try {
      if (member.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle(`> ${member.user.username} lost a Role`)
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${member.user}` })
        .addFields({ name: `• Role`, value: `> ${role}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Role Removed` });

      return send_log(member.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging role remove:", err);
    }
  });

  client.on("rolePositionUpdate", (role, oldPosition, newPosition) => {
    try {
      if (role.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Role Position Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Role`, value: `> ${role}` })
        .addFields({ name: `• Old Position`, value: `> ${oldPosition}` })
        .addFields({ name: `• New Position`, value: `> ${newPosition}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Role Position Updated` });

      return send_log(role.guild.id, embed, "role");
    } catch (err) {
      console.log("Error logging role position update:", err);
    }
  });

  client.on("rolePermissionsUpdate", (role, oldPermissions, newPermissions) => {
    try {
      if (role.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Role Permissions Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Role`, value: `> ${role}` })
        .addFields({ name: `• Changes`, value: `> Permissions updated` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Role Permissions Updated` });

      return send_log(role.guild.id, embed, "role");
    } catch (err) {
      console.log("Error logging role permissions update:", err);
    }
  });

  client.on("roleCreate", (role) => {
    try {
      if (role.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Role Created")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Role Name`, value: `> ${role.name}` })
        .addFields({ name: `• Role ID`, value: `> ${role.id}` })
        .addFields({ name: `• Role HEX`, value: `> ${role.hexColor}` })
        .addFields({ name: `• Role Pos`, value: `> ${role.position}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Role Created` });

      return send_log(role.guild.id, embed, "role");
    } catch (err) {
      console.log("Error logging role create:", err);
    }
  });

  client.on("roleDelete", (role) => {
    try {
      if (role.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Role Deleted")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Role Name`, value: `> ${role.name}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Role Deleted` });

      return send_log(role.guild.id, embed, "role");
    } catch (err) {
      console.log("Error logging role delete:", err);
    }
  });

  client.on("roleUpdate", (oldRole, newRole) => {
    try {
      if (oldRole.guild === null) return;

      const changes = [];
      if (oldRole.name !== newRole.name) {
        changes.push(`Name changed from "${oldRole.name}" to "${newRole.name}"`);
      }
      if (oldRole.color !== newRole.color) {
        changes.push(`Color changed from "${oldRole.hexColor}" to "${newRole.hexColor}"`);
      }
      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        changes.push(`Permissions updated`);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Role Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Role`, value: `> ${newRole}` })
        .addFields({ name: `• Changes`, value: `> ${changes.join("\n> ")}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Role Updated` });

      return send_log(newRole.guild.id, embed, "role");
    } catch (err) {
      console.log("Error logging role update:", err);
    }
  });

  // Voice Activity Logs
  client.on("voiceChannelSwitch", (member, oldChannel, newChannel) => {
    try {
      if (member.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Voice Channel Switched")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${member.user}` })
        .addFields({ name: `• From`, value: `> ${oldChannel}` })
        .addFields({ name: `• To`, value: `> ${newChannel}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Voice Switch` });

      return send_log(member.guild.id, embed, "voice");
    } catch (err) {
      console.log("Error logging voice channel switch:", err);
    }
  });

  // Member Logs
  client.on("guildMemberNicknameUpdate", (member, oldNickname, newNickname) => {
    try {
      const embed = new EmbedBuilder()
        .setTitle("> Nickname Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${member.user}` })
        .addFields({ name: `• Old Nickname`, value: `> ${oldNickname || "**None**"}` })
        .addFields({ name: `• New Nickname`, value: `> ${newNickname || "**None**"}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Nickname Changed` });

      return send_log(member.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging nickname update:", err);
    }
  });

  client.on("guildMemberAdd", (member) => {
    try {
      if (member.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> User Joined")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${member.user}` })
        .addFields({ name: `• Member ID`, value: `> ${member.user.id}` })
        .addFields({ name: `• Member Tag`, value: `> ${member.user.tag}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 User Joined` });

      return send_log(member.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging member add:", err);
    }
  });

  client.on("guildMemberRemove", (member) => {
    try {
      if (member.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> User Left")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${member.user}` })
        .addFields({ name: `• Member ID`, value: `> ${member.user.id}` })
        .addFields({ name: `• Member Tag`, value: `> ${member.user.tag}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 User Left` });

      return send_log(member.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging member leave:", err);
    }
  });

  client.on("guildMemberUpdate", (oldMember, newMember) => {
    try {
      if (oldMember.guild === null) return;

      const changes = [];
      if (oldMember.nickname !== newMember.nickname) {
        // Already handled by guildMemberNicknameUpdate
        return;
      }
      if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        // Already handled by guildMemberRoleAdd and guildMemberRoleRemove
        return;
      }
      if (oldMember.premiumSince !== newMember.premiumSince) {
        // Already handled by guildMemberBoost and guildMemberUnboost
        return;
      }
      // Add other member updates if needed (e.g., timeout status)
      if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
        changes.push(`Timeout status changed: ${oldMember.communicationDisabledUntil ? "Timed out" : "Not timed out"} to ${newMember.communicationDisabledUntil ? "Timed out until " + newMember.communicationDisabledUntil.toISOString() : "Not timed out"}`);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Member Updated")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${newMember.user}` })
        .addFields({ name: `• Changes`, value: `> ${changes.join("\n> ")}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 Member Updated` });

      return send_log(newMember.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging member update:", err);
    }
  });

  client.on("guildBanAdd", ({ guild, user }) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> User Banned")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${user}` })
        .addFields({ name: `• Member ID`, value: `> ${user.id}` })
        .addFields({ name: `• Member Tag`, value: `> ${user.tag}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 User Banned` });

      return send_log(guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging ban add:", err);
    }
  });

  client.on("guildBanRemove", ({ guild, user }) => {
    try {
      if (guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> User Unbanned")
        .setColor(client.config.embedColor)
        .addFields({ name: `• Member`, value: `> ${user}` })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: `🚧 Logging System` })
        .setFooter({ text: `🚧 User Unbanned` });

      return send_log(guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging ban remove:", err);
    }
  });
}

module.exports = { handleLogs };