const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const capschema = require("../../Schemas/verificationSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify-config")
    .setDMPermission(false)
    .setDescription("Configure your verification system using captcha."),

  async execute(interaction, client) {
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
      interaction.user.id !== process.env.developerId
    ) {
      return await interaction.reply({
        content: "You **do not** have the permission to do that!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const data = await capschema.findOne({ Guild: interaction.guild.id });
    let collectedData = {}; // Initialize collectedData early

    const embed = new EmbedBuilder()
      .setTitle("Verification Configuration Panel")
      .setDescription("```md\n# Welcome to the Verification System\n> Secure your server with captcha verification!\n```")
      .addFields(
        {
          name: "System Status",
          value: data
            ? "```ansi\n\u001b[32m□ 🟢 SYSTEM ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\n```"
            : "```ansi\n\u001b[32m□ 🔴 SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\n```",
        },
        {
          name: "Active Configuration",
          value: data
            ? "```yml\n" +
              `\"role\": \"<@&${data.Role}>\"\n` +
              `\"channel\": \"<#${data.Channel}>\"\n` +
              `\"message\": \"${data.MessageContent || "Configured"}\"\n` +
              `\"color\": \"${data.Color || "Not Set"}\"\n` +
              `\"thumbnail\": \"${data.Thumbnail || "Not Set"}\"\n` +
              `\"image\": \"${data.Image || "Not Set"}\"\n` +
              `\"footer\": \"${data.Footer || "Not Set"}\"\n` +
              "```"
            : "```yml\n\"role\": \"Not Configured\"\n\"channel\": \"Not Configured\"\n\"message\": \"Not Configured\"\n\"color\": \"Not Set\"\n\"thumbnail\": \"Not Set\"\n\"image\": \"Not Set\"\n\"footer\": \"Not Set\"\n```",
        }
      )
      .setColor("Green")
      .setTimestamp()
      .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

    const mainButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("set_role")
        .setLabel("Set Role")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("set_channel")
        .setLabel("Set Channel")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("set_message")
        .setLabel("Set Message")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("set_color")
        .setLabel("Set Color")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("disable_verify")
        .setLabel("Disable")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!data)
    );

    const extraButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("set_thumbnail")
        .setLabel("Set Thumbnail")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("set_image")
        .setLabel("Set Image")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("set_footer")
        .setLabel("Set Footer")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("done")
        .setLabel("Done")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!!data) // Initially disabled, updated by updateDoneButton
    );

    const message = await interaction.reply({
      embeds: [embed],
      components: [mainButtons, extraButtons],
      withResponse: true
    });

    const collector = message.resource.message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120000,
    });

    let setupStage = null;

    const updateDoneButton = () => {
      extraButtons.components[3].setDisabled(!(collectedData.role && collectedData.channel && collectedData.message));
    };

    const updateConfigurationField = () => {
      embed.spliceFields(1, 1, {
        name: "Active Configuration",
        value: "```yml\n" +
          `\"role\": \"${collectedData.role ? "<@&" + collectedData.role + ">" : "Not Configured"}\"\n` +
          `\"channel\": \"${collectedData.channel ? "<#" + collectedData.channel + ">" : "Not Configured"}\"\n` +
          `\"message\": \"${collectedData.message || "Not Configured"}\"\n` +
          `\"color\": \"${collectedData.color || "Not Set"}\"\n` +
          `\"thumbnail\": \"${collectedData.thumbnail || "Not Set"}\"\n` +
          `\"image\": \"${collectedData.image || "Not Set"}\"\n` +
          `\"footer\": \"${collectedData.footer || "Not Set"}\"\n` +
          "```",
      });
    };

    collector.on("collect", async (i) => {
      if (i.customId === "set_role") {
        setupStage = "role";
        await i.reply({
          content: "Please mention the role to assign to verified users.",
          flags: MessageFlags.Ephemeral,
        });

        const roleFilter = (m) => m.author.id === i.user.id;
        const roleCollector = i.channel.createMessageCollector({
          filter: roleFilter,
          max: 1,
          time: 30000,
        });

        roleCollector.on("collect", async (m) => {
          const role = m.mentions.roles.first();
          if (!role) {
            await i.followUp({
              content: "Invalid role! Please mention a valid role.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.role = role.id;
          mainButtons.components[0].setDisabled(true);
          updateDoneButton();
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Role set to ${role}.`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        roleCollector.on("end", (collected) => {
          if (collected.size === 0) {
            i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
          }
        });
      } else if (i.customId === "set_channel") {
        setupStage = "channel";
        await i.reply({
          content: "Please mention the channel for the verification message.",
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

          collectedData.channel = channel.id;
          mainButtons.components[1].setDisabled(true);
          updateDoneButton();
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Channel set to ${channel}.`,
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
          }
        });
      } else if (i.customId === "set_message") {
        setupStage = "message";
        await i.reply({
          content: "Please send the custom message for the verification embed (max 1000 characters).",
          flags: MessageFlags.Ephemeral,
        });

        const messageFilter = (m) => m.author.id === i.user.id;
        const messageCollector = i.channel.createMessageCollector({
          filter: messageFilter,
          max: 1,
          time: 30000000,
        });

        messageCollector.on("collect", async (m) => {
          const messageContent = m.content;
          if (messageContent.length > 1000) {
            await i.followUp({
              content: "Message is too long! Please keep it under 1000 characters.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.message = messageContent;
          mainButtons.components[2].setDisabled(true);
          updateDoneButton();
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Message set to: "${messageContent}".`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        messageCollector.on("end", (collected) => {
          if (collected.size === 0) {
            i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
          }
        });
      } else if (i.customId === "set_color") {
        setupStage = "color";
        await i.reply({
          content: "Please provide a hex color code for the embed (e.g., #FF0000).",
          flags: MessageFlags.Ephemeral,
        });

        const colorFilter = (m) => m.author.id === i.user.id;
        const colorCollector = i.channel.createMessageCollector({
          filter: colorFilter,
          max: 1,
          time: 30000,
        });

        colorCollector.on("collect", async (m) => {
          const color = m.content.trim();
          if (!color.match(/^#[0-9A-Fa-f]{6}$/)) {
            await i.followUp({
              content: "Invalid hex color code! Please provide a valid code like #FF0000.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.color = color;
          mainButtons.components[3].setDisabled(true);
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Color set to: ${color}`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        colorCollector.on("end", (collected) => {
          if (collected.size === 0) {
            i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
          }
        });
      } else if (i.customId === "set_thumbnail") {
        setupStage = "thumbnail";
        await i.reply({
          content: "Please provide a URL for the thumbnail image.",
          flags: MessageFlags.Ephemeral,
        });

        const thumbnailFilter = (m) => m.author.id === i.user.id;
        const thumbnailCollector = i.channel.createMessageCollector({
          filter: thumbnailFilter,
          max: 1,
          time: 30000,
        });

        thumbnailCollector.on("collect", async (m) => {
          const url = m.content;
          if (!url.match(/^https?:\/\/.+\.(png|jpg|jpeg|gif)$/i)) {
            await i.followUp({
              content: "Invalid image URL! Please provide a valid PNG, JPG, JPEG, or GIF URL.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.thumbnail = url;
          extraButtons.components[0].setDisabled(true);
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Thumbnail set to: ${url}`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        thumbnailCollector.on("end", (collected) => {
          if (collected.size === 0) {
            i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
          }
        });
      } else if (i.customId === "set_image") {
        setupStage = "image";
        await i.reply({
          content: "Please provide a URL for the embed image.",
          flags: MessageFlags.Ephemeral,
        });

        const imageFilter = (m) => m.author.id === i.user.id;
        const imageCollector = i.channel.createMessageCollector({
          filter: imageFilter,
          max: 1,
          time: 30000,
        });

        imageCollector.on("collect", async (m) => {
          const url = m.content;
          if (!url.match(/^https?:\/\/.+\.(png|jpg|jpeg|gif)$/i)) {
            await i.followUp({
              content: "Invalid image URL! Please provide a valid PNG, JPG, JPEG, or GIF URL.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.image = url;
          extraButtons.components[1].setDisabled(true);
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Image set to: ${url}`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        imageCollector.on("end", (collected) => {
          if (collected.size === 0) {
            i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
          }
        });
      } else if (i.customId === "set_footer") {
        setupStage = "footer";
        await i.reply({
          content: "Please provide the footer text for the verification embed (max 2048 characters).",
          flags: MessageFlags.Ephemeral,
        });

        const footerFilter = (m) => m.author.id === i.user.id;
        const footerCollector = i.channel.createMessageCollector({
          filter: footerFilter,
          max: 1,
          time: 30000,
        });

        footerCollector.on("collect", async (m) => {
          const footerText = m.content;
          if (footerText.length > 2048) {
            await i.followUp({
              content: "Footer text is too long! Please keep it under 2048 characters.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.footer = footerText;
          extraButtons.components[2].setDisabled(true);
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Footer set to: "${footerText}"`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        footerCollector.on("end", (collected) => {
          if (collected.size === 0) {
            i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
          }
        });
      } else if (i.customId === "done") {
        if (!collectedData.role || !collectedData.channel || !collectedData.message) {
          await i.reply({
            content: "Please set the role, channel, and message before finalizing.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await capschema.create({
          Guild: i.guild.id,
          Role: collectedData.role,
          Channel: collectedData.channel,
          Message: "empty",
          MessageContent: collectedData.message,
          Verified: [],
          Color: collectedData.color,
          Thumbnail: collectedData.thumbnail,
          Image: collectedData.image,
          Footer: collectedData.footer,
        });

        const verifyButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("verify")
            .setLabel("✅ Verify")
            .setStyle(ButtonStyle.Success)
        );

        const verifyEmbed = new EmbedBuilder()
          .setColor(collectedData.color || "Green")
          .setTimestamp()
          .setTitle("• Verification Message")
          .setAuthor({ name: `✅ Verification Process` })
          .setDescription(`> ${collectedData.message}`);

        if (collectedData.thumbnail) {
          verifyEmbed.setThumbnail(collectedData.thumbnail);
        }
        if (collectedData.image) {
          verifyEmbed.setImage(collectedData.image);
        }
        if (collectedData.footer) {
          verifyEmbed.setFooter({ text: collectedData.footer });
        } else {
          verifyEmbed.setFooter({ text: `✅ Verification Prompt` });
        }

        const channel = i.guild.channels.cache.get(collectedData.channel);
        const msg = await channel.send({
          embeds: [verifyEmbed],
          components: [verifyButtons],
        });

        await capschema.updateOne(
          { Guild: i.guild.id },
          { $set: { Message: msg.id } }
        );

        embed.spliceFields(0, 2, {
          name: "System Status",
          value: "```ansi\n\u001b[32m□ 🟢 SYSTEM ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\n```",
        }, {
          name: "Active Configuration",
          value: "```yml\n" +
            `\"role\": \"<@&${collectedData.role}>\"\n` +
            `\"channel\": \"<#${collectedData.channel}>\"\n` +
            `\"message\": \"${collectedData.message}\"\n` +
            `\"color\": \"${collectedData.color || "Not Set"}\"\n` +
            `\"thumbnail\": \"${collectedData.thumbnail || "Not Set"}\"\n` +
            `\"image\": \"${collectedData.image || "Not Set"}\"\n` +
            `\"footer\": \"${collectedData.footer || "Not Set"}\"\n` +
            "```",
        });

        mainButtons.components.forEach((component) => component.setDisabled(true));
        extraButtons.components.forEach((component) => component.setDisabled(true));
        mainButtons.components[4].setDisabled(false); // Enable Disable button

        await i.message.edit({
          embeds: [embed],
          components: [mainButtons, extraButtons],
        });

        await i.followUp({
          content: `Verification system set up successfully! Verification message sent to <#${collectedData.channel}>.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (i.customId === "disable_verify") {
        if (!data) {
          await i.reply({
            content: "The verification system is not configured.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const channel = client.channels.cache.get(data.Channel);
        if (channel) {
          try {
            const deletemsg = await channel.messages.fetch(data.Message);
            await deletemsg.delete();
          } catch (error) {
            console.error("Failed to delete verification message:", error);
          }
        }

        await capschema.deleteMany({ Guild: i.guild.id });

        embed.spliceFields(0, 2, {
          name: "System Status",
          value: "```ansi\n\u001b[32m□ 🔴 SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\n```",
        }, {
          name: "Active Configuration",
          value: "```yml\n\"role\": \"Not Configured\"\n\"channel\": \"Not Configured\"\n\"message\": \"Not Configured\"\n\"color\": \"Not Set\"\n\"thumbnail\": \"Not Set\"\n\"image\": \"Not Set\"\n\"footer\": \"Not Set\"\n```",
        });

        mainButtons.components.forEach((component) => component.setDisabled(false));
        extraButtons.components.forEach((component) => component.setDisabled(false));
        mainButtons.components[4].setDisabled(true); // Disable button
        extraButtons.components[3].setDisabled(true); // Done button

        await i.update({
          embeds: [embed],
          components: [mainButtons, extraButtons],
        });

        await i.followUp({
          content: "Verification system has been disabled.",
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on("end", async () => {
      mainButtons.components.forEach((component) => component.setDisabled(true));
      extraButtons.components.forEach((component) => component.setDisabled(true));
      await message.edit({
        content: "The verification configuration panel has timed out.",
        embeds: [embed],
        components: [mainButtons, extraButtons],
      });
    });
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */