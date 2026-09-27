const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDMPermission(false)
    .setDescription("Bans specified user.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Specify the user you want to ban.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason as to why you want to ban specified user.")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("silent")
        .setDescription("Whether to perform the ban silently (visible only to you).")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("delete_messages")
        .setDescription("Whether to delete the user's recent messages (last 7 days).")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    try {
      const targetUser = interaction.options.getUser("user");
      const targetMember = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason") || "No reason provided";
      const isSilent = interaction.options.getBoolean("silent") || false;
      const deleteMessages = interaction.options.getBoolean("delete_messages") || false;
      
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return await interaction.reply({
          content: "❌ You do not have permission to ban members.",
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (interaction.user.id === targetUser.id) {
        return await interaction.reply({
          content: "❌ You cannot ban yourself.",
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (!targetMember) {
        return await interaction.reply({
          content: "❌ That user is not a member of this server.",
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (!this.canBanMember(interaction, targetMember)) {
        return await interaction.reply({
          content: "❌ I cannot ban this user. They may have higher permissions than me, or I lack the proper role hierarchy.",
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (!this.userCanBanTarget(interaction.member, targetMember)) {
        return await interaction.reply({
          content: "❌ You cannot ban this user due to role hierarchy. They may have an equal or higher role than you.",
          flags: MessageFlags.Ephemeral
        });
      }
      
      const banOptions = {
        reason: `Banned by ${interaction.user.tag} | Reason: ${reason}`,
        deleteMessageSeconds: deleteMessages ? 7 * 24 * 60 * 60 : 0
      };
      
      const dmEmbed = this.createDmEmbed(interaction, reason, client);
      
      try {
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Could not DM user ${targetUser.tag} about their ban: ${error.message}`);
      }
      
      try {
        await interaction.guild.members.ban(targetUser.id, banOptions);
        
        const banEmbed = this.createBanEmbed(targetUser, reason, client);
        
        await interaction.reply({ 
          embeds: [banEmbed],
          flags: MessageFlags.Ephemeral
        });
        
      } catch (banError) {
        console.error(`Failed to ban user ${targetUser.tag}:`, banError);
        return await interaction.reply({
          content: `❌ Failed to ban the user: ${banError.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      console.error("Error in ban command:", error);
      await interaction.reply({
        content: "❌ An error occurred while executing the ban command.",
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  },

  canBanMember(interaction, targetMember) {
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    
    if (!botMember) return false;
    if (!targetMember.bannable) return false;
    if (botMember.roles.highest.position <= targetMember.roles.highest.position) return false;
    
    return true;
  },

  userCanBanTarget(executorMember, targetMember) {
    if (executorMember.id === executorMember.guild.ownerId) return true;
    return executorMember.roles.highest.position > targetMember.roles.highest.position;
  },

  createDmEmbed(interaction, reason, client) {
    const embedColor = client.config?.embedColor || "#FF0000";
    
    return new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: "🔨 Ban Notification" })
      .setTitle(`You were banned from "${interaction.guild.name}"`)
      .addFields([
        {
          name: "Server",
          value: interaction.guild.name,
          inline: true
        },
        {
          name: "Banned by",
          value: interaction.user.tag,
          inline: true
        },
        {
          name: "Reason",
          value: reason,
          inline: false
        }
      ])
      .setFooter({ text: "You can appeal this ban by contacting a server administrator if appropriate." })
      .setTimestamp()
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || null);
  },

  createBanEmbed(targetUser, reason, client) {
    const embedColor = client.config?.embedColor || "#FF0000";
    
    return new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: "🔨 Ban Successful" })
      .setDescription(`**${targetUser.tag}** has been banned from the server.`)
      .addFields([
        {
          name: "User ID",
          value: targetUser.id,
          inline: true
        },
        {
          name: "Reason",
          value: reason,
          inline: true
        }
      ])
      .setFooter({ text: "Ban executed" })
      .setTimestamp()
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));
  }
};