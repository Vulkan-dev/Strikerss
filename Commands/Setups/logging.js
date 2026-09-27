const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    ChannelType,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
  } = require("discord.js");
  const logSchema = require("../../Schemas/logschema");
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("logs")
      .setDescription("Configure your logging system.")
      .setDMPermission(false)
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  
    async execute(interaction, client) {
      if (
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return await interaction.reply({
          content: "You **do not** have the permission to do that!",
          flags: MessageFlags.Ephemeral,
        });
      }
  
      let data = await logSchema.findOne({ Guild: interaction.guild.id });
      let collectedData = { LogChannels: {} }; // To store temporary configuration during setup
  
      const embed = new EmbedBuilder()
        .setTitle("Logging Configuration Panel")
        .setDescription("```md\n# Logging System\n> Configure logging channels for your server!\n```")
        .addFields(
          {
            name: "System Status",
            value: data && Object.keys(data.LogChannels || {}).some(key => data.LogChannels[key])
              ? "```ansi\n\u001b[32m□ 🟢 SYSTEM ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\n```"
              : "```ansi\n\u001b[32m□ 🔴 SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\n```",
          },
          {
            name: "Active Configuration",
            value: data
              ? "```yml\n" +
                `All Logs: "${data.LogChannels?.all ? "<#" + data.LogChannels.all + ">" : "Not Configured"}\"\n` +
                `Message Logs: "${data.LogChannels?.message ? "<#" + data.LogChannels.message + ">" : "Not Configured"}\"\n` +
                `Channel Logs: "${data.LogChannels?.channel ? "<#" + data.LogChannels.channel + ">" : "Not Configured"}\"\n` +
                `Guild Logs: "${data.LogChannels?.guild ? "<#" + data.LogChannels.guild + ">" : "Not Configured"}\"\n` +
                `Role Logs: "${data.LogChannels?.role ? "<#" + data.LogChannels.role + ">" : "Not Configured"}\"\n` +
                `Voice Activity Logs: "${data.LogChannels?.voice ? "<#" + data.LogChannels.voice + ">" : "Not Configured"}\"\n` +
                `Member Logs: "${data.LogChannels?.member ? "<#" + data.LogChannels.member + ">" : "Not Configured"}\"\n` +
                "```"
              : "```yml\n" +
                `All Logs: "Not Configured"\n` +
                `Message Logs: "Not Configured"\n` +
                `Channel Logs: "Not Configured"\n` +
                `Guild Logs: "Not Configured"\n` +
                `Role Logs: "Not Configured"\n` +
                `Voice Activity Logs: "Not Configured"\n` +
                `Member Logs: "Not Configured"\n` +
                "```",
          }
        )
        .setColor(client.config.embedColor || "Green")
        .setTimestamp()
        .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });
  
      const initialButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("setup_channel")
          .setLabel("Setup Channel")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("disable_logs")
          .setLabel("Disable")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!data || !Object.keys(data.LogChannels || {}).some(key => data.LogChannels[key]))
      );
  
      const logTypeDropdown = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select_log_type")
          .setPlaceholder("Select a log type to configure...")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("All Logs")
              .setValue("all")
              .setDescription("Logs all events in a single channel"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Message Logs")
              .setValue("message")
              .setDescription("Message events (e.g., deletions, edits, pins)"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Channel Logs")
              .setValue("channel")
              .setDescription("Channel events (e.g., create, delete, threads)"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Guild Logs")
              .setValue("guild")
              .setDescription("Guild events (e.g., banner, vanity, emojis, stickers)"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Role Logs")
              .setValue("role")
              .setDescription("Role events (e.g., create, delete, updates)"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Voice Activity Logs")
              .setValue("voice")
              .setDescription("Voice channel events (e.g., switches)"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Member Logs")
              .setValue("member")
              .setDescription("Member events (e.g., join, leave, role updates)")
          )
      );
  
      const message = await interaction.reply({
        embeds: [embed],
        components: [initialButtons],
        withResponse: true
      });
  
      const collector = message.resource.message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 120000,
      });
  
      let setupStage = null;
  
      const updateConfigurationField = () => {
        const config = data?.LogChannels || collectedData.LogChannels;
        embed.spliceFields(1, 1, {
          name: "Active Configuration",
          value: "```yml\n" +
            `All Logs: "${config.all ? "<#" + config.all + ">" : "Not Configured"}\"\n` +
            `Message Logs: "${config.message ? "<#" + config.message + ">" : "Not Configured"}\"\n` +
            `Channel Logs: "${config.channel ? "<#" + config.channel + ">" : "Not Configured"}\"\n` +
            `Guild Logs: "${config.guild ? "<#" + config.guild + ">" : "Not Configured"}\"\n` +
            `Role Logs: "${config.role ? "<#" + config.role + ">" : "Not Configured"}\"\n` +
            `Voice Activity Logs: "${config.voice ? "<#" + config.voice + ">" : "Not Configured"}\"\n` +
            `Member Logs: "${config.member ? "<#" + config.member + ">" : "Not Configured"}\"\n` +
            "```",
        });
      };
  
      const updateSystemStatus = () => {
        const hasConfig = data && Object.keys(data.LogChannels || {}).some(key => data.LogChannels[key]);
        embed.spliceFields(0, 1, {
          name: "System Status",
          value: hasConfig
            ? "```ansi\n\u001b[32m□ 🟢 SYSTEM ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\n```"
            : "```ansi\n\u001b[32m□ 🔴 SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\n```",
        });
      };
  
      collector.on("collect", async (i) => {
        if (i.customId === "setup_channel") {
          setupStage = "select_log_type";
          await i.update({
            embeds: [embed],
            components: [logTypeDropdown],
          });
        } else if (i.customId === "select_log_type") {
          const logType = i.values[0];
          setupStage = `channel_${logType}`;
          collectedData.LogChannels[logType] = collectedData.LogChannels[logType] || null;
  
          await i.reply({
            content: `Please mention the channel for **${logType.replace(/^\w/, c => c.toUpperCase())} Logs**.`,
            flags: MessageFlags.Ephemeral,
          });
  
          const channelFilter = (m) => m.author.id === i.user.id;
          const channelCollector = i.channel.createMessageCollector({
            filter: channelFilter,
            max: 1,
            time: 30000,
          });
  
          channelCollector.on("collect", async (m) => {
            const channel = m.mentions.channels.first();
            if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
              await i.followUp({
                content: "Invalid channel! Please mention a text or announcement channel.",
                flags: MessageFlags.Ephemeral,
              });
              setupStage = null;
              return;
            }
  
            collectedData.LogChannels[logType] = channel.id;
  
            // Save to schema
            if (data) {
              data.LogChannels = { ...data.LogChannels, ...collectedData.LogChannels };
              await data.save();
            } else {
              data = await logSchema.create({
                Guild: i.guild.id,
                LogChannels: collectedData.LogChannels,
              });
            }
  
            updateConfigurationField();
            updateSystemStatus();
  
            await i.message.edit({
              embeds: [embed],
              components: [initialButtons],
            });
  
            initialButtons.components[1].setDisabled(false); // Enable Disable button
  
            await i.followUp({
              content: `Channel for **${logType.replace(/^\w/, c => c.toUpperCase())} Logs** set to ${channel}.`,
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
          });
  
          channelCollector.on("end", (collected) => {
            if (collected.size === 0) {
              i.followUp({
                content: "You did not respond in time. Please try again.",
                flags: MessageFlags.Ephemeral,
              });
              setupStage = null;
              i.message.edit({
                embeds: [embed],
                components: [initialButtons],
              });
            }
          });
        } else if (i.customId === "disable_logs") {
          if (!data || !Object.keys(data.LogChannels || {}).some(key => data.LogChannels[key])) {
            await i.reply({
              content: "The logging system is not configured.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
  
          await logSchema.deleteOne({ Guild: i.guild.id });
          data = null;
          collectedData = { LogChannels: {} };
  
          updateSystemStatus();
          updateConfigurationField();
  
          initialButtons.components[1].setDisabled(true); // Disable the Disable button
  
          await i.update({
            embeds: [embed],
            components: [initialButtons],
          });
  
          await i.followUp({
            content: "Logging system has been disabled.",
            flags: MessageFlags.Ephemeral,
          });
        }
      });
  
      collector.on("end", async () => {
        initialButtons.components.forEach((component) => component.setDisabled(true));
        await message.edit({
          content: "The logging configuration panel has timed out.",
          embeds: [embed],
          components: [initialButtons],
        });
      });
    },
  };
  
  /**
   * Credits: Arpan | @arpandevv
   */