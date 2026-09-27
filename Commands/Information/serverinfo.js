const {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
  GuildVerificationLevel,
  MessageFlags,
  GuildExplicitContentFilter,
  GuildNSFWLevel,
  PermissionFlagsBits
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Displays information about the server.")
    .setDMPermission(false),
  async execute(interaction, client) {
    try {
      await interaction.deferReply();

      const { guild } = interaction;
      if (!guild) {
        return interaction.editReply({
          content: "This command can only be used in servers.",
          flags: MessageFlags.Ephemeral
        });
      }

      const { members, channels, emojis, roles, stickers } = guild;

      const sortedRoles = Array.from(roles.cache.values())
        .slice(1)
        .sort((a, b) => b.position - a.position);
      const userRoles = sortedRoles.filter(role => !role.managed);
      const managedRoles = sortedRoles.filter(role => role.managed);

      const botCount = members.cache.filter(member => member.user?.bot).size;

      const maxDisplayRoles = (roles, maxFieldLength = 1024) => {
        let totalLength = 0;
        const result = [];

        for (const role of roles) {
          const roleString = `<@&${role.id}>`;
          if (totalLength + roleString.length + 2 > maxFieldLength) break;
          totalLength += roleString.length + 2;
          result.push(roleString);
        }

        return result.length;
      };

      const splitPascal = (string, separator) => {
        if (!string) return "None";
        return string.split(/(?=[A-Z])/).join(separator);
      };

      const toPascalCase = (string, separator = false) => {
        if (!string) return "None";
        const pascal = string.charAt(0).toUpperCase() +
          string
            .slice(1)
            .toLowerCase()
            .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase());
        return separator ? splitPascal(pascal, separator) : pascal;
      };

      const getChannelTypeSize = (types) => {
        return channels.cache.filter(channel =>
          types.includes(channel.type)
        ).size;
      };

      const totalChannels = getChannelTypeSize([
        ChannelType.GuildText,
        ChannelType.GuildNews,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
        ChannelType.GuildForum,
        ChannelType.GuildPublicThread,
        ChannelType.GuildPrivateThread,
        ChannelType.GuildNewsThread,
        ChannelType.GuildCategory,
      ]);

      const botColor = members.me?.roles?.highest?.hexColor || "#5865F2";

      const serverInfoEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor || botColor)
        .setTitle(`${guild.name}'s Information`)
        .setThumbnail(guild.iconURL({ size: 1024, dynamic: true }) || null)
        .addFields(
          {
            name: "Description",
            value: `🔥 ${guild.description || "None"}`
          },
          {
            name: "General",
            value: [
              `🆕 **Created** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
              `🆔 **ID** \`${guild.id}\``,
              `👑 **Owner** <@${guild.ownerId}>`,
              `🌐 **Language** \`${new Intl.DisplayNames(["en"], { type: "language" }).of(guild.preferredLocale)}\``,
              `❌ **Vanity URL** ${guild.vanityURLCode || "None"}`,
            ].join("\n")
          },
          {
            name: "Features",
            value: guild.features && guild.features.length > 0
              ? guild.features.map(feature => `- ${toPascalCase(feature, " ")}`).join("\n")
              : "None",
            inline: true
          },
          {
            name: "Security",
            value: [
              `⚡ **Explicit Filter** \`${splitPascal(GuildExplicitContentFilter[guild.explicitContentFilter], " ")}\``,
              `🔞 **NSFW Level** \`${splitPascal(GuildNSFWLevel[guild.nsfwLevel], " ")}\``,
              `🔐 **Verification Level** \`${splitPascal(GuildVerificationLevel[guild.verificationLevel], " ")}\``,
            ].join("\n"),
            inline: true
          },
          {
            name: `Users (\`${guild.memberCount || 0}\`)`,
            value: [
              `👤 **Members** \`${(guild.memberCount || 0) - botCount}\``,
              `🤖 **Bots** \`${botCount}\``,
            ].join("\n"),
            inline: true
          }
        );

      const userRolesDisplay = userRoles.length > 0
        ? userRoles.slice(0, maxDisplayRoles(userRoles)).join(" ")
        : "None";

      const managedRolesDisplay = managedRoles.length > 0
        ? managedRoles.slice(0, maxDisplayRoles(managedRoles)).join(" ")
        : "None";

      serverInfoEmbed.addFields(
        {
          name: `User Roles (${maxDisplayRoles(userRoles)} of ${userRoles.length})`,
          value: userRolesDisplay
        },
        {
          name: `Managed Roles (${maxDisplayRoles(managedRoles)} of ${managedRoles.length})`,
          value: managedRolesDisplay
        },
        {
          name: `Channels, Threads & Categories (${totalChannels})`,
          value: [
            `💬 **Text** \`${getChannelTypeSize([
              ChannelType.GuildText,
              ChannelType.GuildForum,
              ChannelType.GuildNews,
            ])}\``,
            `🔊 **Voice** \`${getChannelTypeSize([
              ChannelType.GuildVoice,
              ChannelType.GuildStageVoice,
            ])}\``,
            `🧵 **Threads** \`${getChannelTypeSize([
              ChannelType.GuildPublicThread,
              ChannelType.GuildPrivateThread,
              ChannelType.GuildNewsThread,
            ])}\``,
            `📁 **Categories** \`${getChannelTypeSize([ChannelType.GuildCategory])}\``,
          ].join("\n"),
          inline: true
        },
        {
          name: `Emojis & Stickers (${(emojis?.cache?.size || 0) + (stickers?.cache?.size || 0)})`,
          value: [
            `🔄 **Animated** ${emojis?.cache?.filter(e => e.animated)?.size || 0}`,
            `🌀 **Static** ${emojis?.cache?.filter(e => !e.animated)?.size || 0}`,
            `🏷️ **Stickers** ${stickers?.cache?.size || 0}`,
          ].join("\n"),
          inline: true
        },
        {
          name: "Nitro",
          value: [
            `🚀 **Tier** ${guild.premiumTier ? `Tier ${guild.premiumTier}` : "None"}`,
            `🎉 **Boosts** ${guild.premiumSubscriptionCount || 0}`,
            `🎈 **Boosters** ${members.cache.filter(m => m.roles?.premiumSubscriberRole).size || 0}`,
            `✨ **Total Boosters** ${members.cache.filter(m => m.premiumSince).size || 0}`,
          ].join("\n"),
          inline: true
        }
      );

      if (guild.bannerURL()) {
        serverInfoEmbed.setImage(guild.bannerURL({ size: 1024 }));
        serverInfoEmbed.addFields({ name: "Banner", value: "** **" });
      } else {
        serverInfoEmbed.addFields({ name: "Banner", value: "None" });
      }

      await interaction.editReply({ embeds: [serverInfoEmbed] });

    } catch (error) {
      console.error(`Error in serverinfo command:`, error);

      const errorReply = {
        content: "An error occurred while fetching server information. Please try again later.",
        flags: MessageFlags.Ephemeral
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply).catch(console.error);
      } else {
        await interaction.reply(errorReply).catch(console.error);
      }
    }
  },
};
