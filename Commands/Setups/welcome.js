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
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");
const { Card } = require("welcomify");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("welcome-message")
    .setDescription("Configure the welcome message system")
    .setDMPermission(false),

  async execute(interaction, client) {
  
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
      interaction.user.id !== process.env.developerId
    ) {
      return await interaction.reply({
        content: "You **do not** have the permission to do that!",
        flags: MessageFlags.Ephemeral,
      });
    }

    let data = await WelcomeMessage.findOne({ guildId: interaction.guild.id });
    let collectedData = {}; // Initialize collectedData early

    const embed = new EmbedBuilder()
      .setTitle("Welcome Message Configuration Panel")
      .setDescription("```md\n# Welcome Message System\n> Configure a warm welcome for new members!\n```")
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
              `\"channel\": \"${data.channelId ? "<#" + data.channelId + ">" : "Not Configured"}\"\n` +
              `\"message\": \"${data.message || "Not Configured"}\"\n` +
              `\"embed\": \"${data.isEmbed ? "Yes" : "No"}\"\n` +
              `\"welcome-image\": \"${data.isImage ? "Yes" : "No"}\"\n` +
              `\"author\": \"${data.author || "Not Set"}\"\n` +
              `\"title\": \"${data.title || "Not Set"}\"\n` +
              `\"color\": \"${data.color || "Not Set"}\"\n` +
              `\"image-bg\": \"${data.image || "Not Set"}\"\n` +
              "```"
            : "```yml\n\"channel\": \"Not Configured\"\n\"message\": \"Not Configured\"\n\"embed\": \"Not Configured\"\n\"welcome-image\": \"Not Configured\"\n\"author\": \"Not Set\"\n\"title\": \"Not Set\"\n\"color\": \"Not Set\"\n\"image-bg\": \"Not Set\"\n```",
        }
      )
      .setColor("Green")
      .setTimestamp()
      .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

    const mainButtons = new ActionRowBuilder().addComponents(
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
        .setCustomId("set_embed")
        .setLabel("Set Embed")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("set_image")
        .setLabel("Set Welcome Image")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("set_image_bg")
        .setLabel("Set Image BG")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data)
    );

    const extraButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("set_author")
        .setLabel("Set Author")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("set_title")
        .setLabel("Set Title")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("disable_welcome")
        .setLabel("Disable")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!data),
      new ButtonBuilder()
        .setCustomId("done")
        .setLabel("Done")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!!data),
      new ButtonBuilder()
        .setCustomId("test_welcome")
        .setLabel("Test")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!data)
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
      extraButtons.components[3].setDisabled(!(collectedData.channel && (collectedData.message || collectedData.isImage)));
    };

    const updateConfigurationField = () => {
      embed.spliceFields(1, 1, {
        name: "Active Configuration",
        value: "```yml\n" +
          `\"channel\": \"${collectedData.channel ? "<#" + collectedData.channel + ">" : "Not Configured"}\"\n` +
          `\"message\": \"${collectedData.message || "Not Configured"}\"\n` +
          `\"embed\": \"${collectedData.isEmbed !== undefined ? (collectedData.isEmbed ? "Yes" : "No") : "Not Configured"}\"\n` +
          `\"welcome-image\": \"${collectedData.isImage !== undefined ? (collectedData.isImage ? "Yes" : "No") : "Not Configured"}\"\n` +
          `\"author\": \"${collectedData.author || "Not Set"}\"\n` +
          `\"title\": \"${collectedData.title || "Not Set"}\"\n` +
          `\"color\": \"${collectedData.color || "Not Set"}\"\n` +
          `\"image-bg\": \"${collectedData.image || "Not Set"}\"\n` +
          "```",
      });
    };

    collector.on("collect", async (i) => {
      if (i.customId === "set_channel") {
        setupStage = "channel";
        await i.reply({
          content: "Please mention the channel for welcome messages.",
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
          mainButtons.components[0].setDisabled(true);
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

        channelCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            setupStage = null;
          }
        });
      } else if (i.customId === "set_message") {
        setupStage = "message";
        await i.reply({
          content: "Please send the welcome message (max 1000 characters). Use {user} to mention the user.",
          flags: MessageFlags.Ephemeral,
        });

        const messageFilter = (m) => m.author.id === i.user.id;
        const messageCollector = i.channel.createMessageCollector({
          filter: messageFilter,
          max: 1,
          time: 30000,
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
          mainButtons.components[1].setDisabled(true);
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

        messageCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            setupStage = null;
          }
        });
      } else if (i.customId === "set_embed") {
        setupStage = "embed";
        await i.reply({
          content: "Do you want to send the welcome message as an embed? Reply with 'yes' or 'no'.",
          flags: MessageFlags.Ephemeral,
        });

        const embedFilter = (m) => m.author.id === i.user.id;
        const embedCollector = i.channel.createMessageCollector({
          filter: embedFilter,
          max: 1,
          time: 30000,
        });

        embedCollector.on("collect", async (m) => {
          const response = m.content.toLowerCase();
          if (!["yes", "no"].includes(response)) {
            await i.followUp({
              content: "Invalid response! Please reply with 'yes' or 'no'.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.isEmbed = response === "yes";
          mainButtons.components[2].setDisabled(true);
          updateDoneButton();
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Embed set to: ${response === "yes" ? "Yes" : "No"}.`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        embedCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            setupStage = null;
          }
        });
      } else if (i.customId === "set_image") {
        setupStage = "image";
        await i.reply({
          content: "Do you want to use a welcome image? Reply with 'yes' or 'no'.",
          flags: MessageFlags.Ephemeral,
        });

        const imageFilter = (m) => m.author.id === i.user.id;
        const imageCollector = i.channel.createMessageCollector({
          filter: imageFilter,
          max: 1,
          time: 30000,
        });

        imageCollector.on("collect", async (m) => {
          const response = m.content.toLowerCase();
          if (!["yes", "no"].includes(response)) {
            await i.followUp({
              content: "Invalid response! Please reply with 'yes' or 'no'.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.isImage = response === "yes";
          mainButtons.components[3].setDisabled(true);
          updateDoneButton();
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Welcome Image set to: ${response === "yes" ? "Yes" : "No"}.`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        imageCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            setupStage = null;
          }
        });
      } else if (i.customId === "set_image_bg") {
        setupStage = "image_bg";
        await i.reply({
          content: "Please provide a URL for the welcome image background (PNG, JPG, JPEG). Reply 'none' to skip.",
          flags: MessageFlags.Ephemeral,
        });

        const imageBgFilter = (m) => m.author.id === i.user.id;
        const imageBgCollector = i.channel.createMessageCollector({
          filter: imageBgFilter,
          max: 1,
          time: 30000,
        });

        imageBgCollector.on("collect", async (m) => {
          const url = m.content;
          if (url.toLowerCase() !== "none" && !url.match(/^https?:\/\/.+\.(png|jpg|jpeg)$/i)) {
            await i.followUp({
              content: "Invalid image URL! Please provide a valid PNG, JPG, or JPEG or reply 'none'.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.image = url.toLowerCase() === "none" ? "" : url;
          mainButtons.components[4].setDisabled(true);
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Image background set to: "${collectedData.image || "Not Set"}".`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        imageBgCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            setupStage = null;
          }
        });
      } else if (i.customId === "set_author") {
        setupStage = "author";
        await i.reply({
          content: "Please provide the author text for the embed (max 256 characters). Reply 'none' to skip.",
          flags: MessageFlags.Ephemeral,
        });

        const authorFilter = (m) => m.author.id === i.user.id;
        const authorCollector = i.channel.createMessageCollector({
          filter: authorFilter,
          max: 1,
          time: 30000,
        });

        authorCollector.on("collect", async (m) => {
          const authorText = m.content;
          if (authorText.length > 256 && authorText.toLowerCase() !== "none") {
            await i.followUp({
              content: "Author text is too long! Please keep it under 256 characters or reply 'none'.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.author = authorText.toLowerCase() === "none" ? "" : authorText;
          extraButtons.components[0].setDisabled(true);
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Author set to: "${collectedData.author || "Not Set"}".`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        authorCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            setupStage = null;
          }
        });
      } else if (i.customId === "set_title") {
        setupStage = "title";
        await i.reply({
          content: "Please provide the title text for the embed (max 256 characters). Reply 'none' to skip.",
          flags: MessageFlags.Ephemeral,
        });

        const titleFilter = (m) => m.author.id === i.user.id;
        const titleCollector = i.channel.createMessageCollector({
          filter: titleFilter,
          max: 1,
          time: 30000,
        });

        titleCollector.on("collect", async (m) => {
          const titleText = m.content;
          if (titleText.length > 256 && titleText.toLowerCase() !== "none") {
            await i.followUp({
              content: "Title text is too long! Please keep it under 256 characters or reply 'none'.",
              flags: MessageFlags.Ephemeral,
            });
            setupStage = null;
            return;
          }

          collectedData.title = titleText.toLowerCase() === "none" ? "" : titleText;
          extraButtons.components[1].setDisabled(true);
          updateConfigurationField();

          await i.message.edit({
            embeds: [embed],
            components: [mainButtons, extraButtons],
          });

          await i.followUp({
            content: `Title set to: "${collectedData.title || "Not Set"}".`,
            flags: MessageFlags.Ephemeral,
          });
          setupStage = null;
        });

        titleCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await i.followUp({
              content: "You did not respond in time. Please try again.",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            setupStage = null;
          }
        });
      } else if (i.customId === "disable_welcome") {
        if (!data) {
          await i.reply({
            content: "The welcome message system is not configured.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await WelcomeMessage.deleteOne({ guildId: i.guild.id });
        data = null; // Reset data
        collectedData = {}; // Reset collectedData

        embed.spliceFields(0, 2, {
          name: "System Status",
          value: "```ansi\n\u001b[32m□ 🔴 SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\n```",
        }, {
          name: "Active Configuration",
          value: "```yml\n\"channel\": \"Not Configured\"\n\"message\": \"Not Configured\"\n\"embed\": \"Not Configured\"\n\"welcome-image\": \"Not Configured\"\n\"author\": \"Not Set\"\n\"title\": \"Not Set\"\n\"color\": \"Not Set\"\n\"image-bg\": \"Not Set\"\n```",
        });

        mainButtons.components.forEach((component) => component.setDisabled(false));
        extraButtons.components[0].setDisabled(false); // Set Author
        extraButtons.components[1].setDisabled(false); // Set Title
        extraButtons.components[2].setDisabled(true); // Disable
        extraButtons.components[3].setDisabled(true); // Done
        extraButtons.components[4].setDisabled(true); // Test

        await i.update({
          embeds: [embed],
          components: [mainButtons, extraButtons],
        });

        await i.followUp({
          content: "Welcome message system has been disabled.",
          flags: MessageFlags.Ephemeral,
        });
      } else if (i.customId === "done") {
        if (!collectedData.channel || (!collectedData.message && !collectedData.isImage)) {
          await i.reply({
            content: "Please set the channel and at least a message or welcome image before finalizing.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await WelcomeMessage.findOneAndUpdate(
          { guildId: i.guild.id },
          {
            guildId: i.guild.id,
            channelId: collectedData.channel,
            message: collectedData.message || "",
            isEmbed: collectedData.isEmbed !== undefined ? collectedData.isEmbed : false,
            isImage: collectedData.isImage || false,
            author: collectedData.author || "",
            title: collectedData.title || "",
            color: collectedData.color || "#FFFFFF",
            image: collectedData.image || "",
          },
          { upsert: true }
        );

        data = await WelcomeMessage.findOne({ guildId: i.guild.id }); // Reload data

        embed.spliceFields(0, 2, {
          name: "System Status",
          value: "```ansi\n\u001b[32m□ 🟢 SYSTEM ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\n```",
        }, {
          name: "Active Configuration",
          value: "```yml\n" +
            `\"channel\": \"<#" + ${collectedData.channel} + ">\"\n` +
            `\"message\": \"${collectedData.message || "Not Configured"}\"\n` +
            `\"embed\": \"${collectedData.isEmbed !== undefined ? (collectedData.isEmbed ? "Yes" : "No") : "No"}\"\n` +
            `\"welcome-image\": \"${collectedData.isImage ? "Yes" : "No"}\"\n` +
            `\"author\": \"${collectedData.author || "Not Set"}\"\n` +
            `\"title\": \"${collectedData.title || "Not Set"}\"\n` +
            `\"color\": \"${collectedData.color || "Not Set"}\"\n` +
            `\"image-bg\": \"${collectedData.image || "Not Set"}\"\n` +
            "```",
        });

        mainButtons.components.forEach((component) => component.setDisabled(true));
        extraButtons.components[0].setDisabled(true); // Set Author
        extraButtons.components[1].setDisabled(true); // Set Title
        extraButtons.components[2].setDisabled(false); // Disable
        extraButtons.components[3].setDisabled(true); // Done
        extraButtons.components[4].setDisabled(false); // Test

        await i.message.edit({
          embeds: [embed],
          components: [mainButtons, extraButtons],
        });

        await i.followUp({
          content: `Welcome message system set up successfully! Messages will be sent to <#${collectedData.channel}>.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (i.customId === "test_welcome") {
        await i.deferReply({ flags: MessageFlags.Ephemeral }); // Defer to avoid Unknown interaction

        // Reload the latest data to ensure we're using the current configuration
        data = await WelcomeMessage.findOne({ guildId: i.guild.id });

        if (!data) {
          await i.followUp({
            content: "The welcome message system is not configured.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const image = data.image || "https://i.imgur.com/GMuBRQo.jpeg";
        const author = data.author || "";
        const title = data.title || "";
        const color = data.color || "Random";
        const isImage = data.isImage || false;
        const isEmbed = data.isEmbed || false;
        const messageContent = data.message && data.message.trim() !== ""
          ? data.message.replace("{user}", i.user.toString())
          : null;

        const channel = i.guild.channels.cache.get(data.channelId);
        if (!channel || !channel.permissionsFor(i.guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
          await i.followUp({
            content: "The configured channel was not found or I lack permission to send messages there. Please reconfigure the welcome system.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        let sendOptions = {};

        if (isImage) {
          const card = new Card()
            .setTitle("Welcome")
            .setName(i.user.username)
            .setAvatar(i.user.displayAvatarURL({ format: "png", dynamic: true }))
            .setMessage(`You are the ${i.guild.memberCount}th to join`)
            .setBackground(image)
            .setColor("00FF38");
          const cardOutput = await card.build();
          sendOptions.files = [{ attachment: cardOutput, name: "welcome-card.png" }];
        }

        if (isEmbed) {
          const embed = new EmbedBuilder().setColor(color);

          if (author && author.trim() !== "") {
            embed.setAuthor({ name: author });
          }
          if (title && title.trim() !== "") {
            embed.setTitle(title);
          }

          sendOptions.embeds = [embed];
        }

        if (messageContent) {
          sendOptions.content = messageContent;
        }

        if (sendOptions.content || sendOptions.embeds || sendOptions.files) {
          try {
            await channel.send(sendOptions);
            await i.followUp({
              content: `Test welcome message sent to <#${data.channelId}>!`,
              flags: MessageFlags.Ephemeral,
            });
          } catch (error) {
            await i.followUp({
              content: "Failed to send the test message. Please ensure the bot has permission to send messages in the configured channel.",
              flags: MessageFlags.Ephemeral,
            });
          }
        } else {
          await i.followUp({
            content: "No message, embed, or image is configured to send.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });

    collector.on("end", async () => {
      mainButtons.components.forEach((component) => component.setDisabled(true));
      extraButtons.components.forEach((component) => component.setDisabled(true));
      try {
        await interaction.editReply({
          content: "The welcome message configuration panel has timed out.",
          embeds: [embed],
          components: [mainButtons, extraButtons],
        }).catch(() => {});
      } catch (error) {
        // Silently ignore timeout edit errors
      }
    });
  },
};

/**
 * Credits: Arpan | @arpandevv
 */