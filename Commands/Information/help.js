const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
} = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`help`)
    .setDescription("Get information about the Razor Bot Commands."),

  async execute(interaction, client) {
    let servers = await client.guilds.cache.size;
    let users = await client.guilds.cache.reduce(
      (a, b) => a + b.memberCount,
      0
    );

    // Fetch all registered slash commands to get their IDs
    let commandIds = new Map();
    try {
      const commands = await client.application.commands.fetch();
      commands.forEach((command) => {
        commandIds.set(command.name, command.id);
      });
    } catch (error) {
      console.error("Failed to fetch command IDs:", error);
    }

    const commandFolders = fs
      .readdirSync(`./Commands`)
      .filter((folder) => !folder.startsWith(".") && folder !== "Owner");
    const commandsByCategory = {};
    for (const folder of commandFolders) {
      const commandFiles = fs
        .readdirSync(`./Commands/${folder}`)
        .filter((file) => file.endsWith(".js"));
      const commands = [];

      for (const file of commandFiles) {
        try {
          const { default: command } = await import(`./../${folder}/${file}`);
          if (command.data && command.data.name && command.data.description) {
            const commandEntry = {
              name: command.data.name,
              description: command.data.description,
              subcommands: [],
            };

            // Check for subcommands
            if (command.data.options?.length > 0) {
              command.data.options.forEach((option) => {
                if (
                  option instanceof
                  require("discord.js").SlashCommandSubcommandBuilder
                ) {
                  commandEntry.subcommands.push({
                    name: option.name,
                    description:
                      option.description || "No description provided",
                  });
                }
              });
            }

            commands.push(commandEntry);
          }
        } catch (error) {
          console.error(
            `Failed to load command ${file} from ${folder}:`,
            error
          );
        }
      }

      // Remove duplicates based on command name
      const uniqueCommands = [];
      const seenCommands = new Set();
      for (const cmd of commands) {
        if (!seenCommands.has(cmd.name)) {
          seenCommands.add(cmd.name);
          uniqueCommands.push(cmd);
        }
      }
      // Sort commands alphabetically by name
      uniqueCommands.sort((a, b) => a.name.localeCompare(b.name));
      commandsByCategory[folder] = uniqueCommands;
    }

    const resolveEmoji = (emoji) => {
      if (!emoji) return undefined;

      const match = emoji.match(/^<a?:\w+:(\d+)>$/); // custom emoji format
      if (match) return { id: match[1] }; // Custom emoji
      return { name: emoji }; // Unicode emoji
    };

    const dropdownOptions = [
      {
        label: "Home",
        value: "home",
        emoji: resolveEmoji(client.emoji.home),
      },
      ...Object.keys(commandsByCategory).map((folder) => ({
        label: folder,
        value: folder,
        emoji: resolveEmoji(
          {
            Antinuke: client.emoji.antinuke,
            Automod: client.emoji.thunder,
            Economy: client.emoji.economy,
            Fun: client.emoji.fun,
            Community: client.emoji.community,
            PremiumCommands: client.emoji.premium,
            Socials: client.emoji.socials,
            Giveaway: client.emoji.giveaway,
            Images: client.emoji.images,
            Information: client.emoji.information,
            Moderation: client.emoji.moderation,
            Music: client.emoji.music,
            Setups: client.emoji.setups,
            Suggestion: client.emoji.suggestions,
            Tools: client.emoji.tools,
            Utility: client.emoji.utils,
          }[folder]
        ),
      })),
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`category-select`)
      .setPlaceholder(`Razor | Help Menu`)
      .addOptions(...dropdownOptions);

    const homeEmbed = new EmbedBuilder()
      .setAuthor({
        name: "Razor",
        iconURL: client.user.avatarURL(),
        url: "https://discord.com/api/oauth2/authorize?client_id=1002188910560026634&permissions=8&scope=bot%20applications.commands",
      })
      .setDescription(
        `• Hey! :wave:\n` +
          `• Total commands: ${client.commands.size}\n` +
          `• Get [\`Razor\`](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands) | [\`Support server\`](https://discord.gg/5FzKutmwSw) | [\`Vote Me\`](https://top.gg/bot/1002188910560026634/vote)\n` +
          `• In \`${servers}\` servers with \`${users}\` members`
      )
      .setImage(
        `https://media.discordapp.net/attachments/1077409692302721154/1089068340141641739/wallpaperflare.com_wallpaper.png?width=960&height=313`
      )
      .addFields({
        name: `__**Main**__`,
        value: [
          `${client.emoji.automod} Automod`,
          `${client.emoji.community} Community`,
          `${client.emoji.fun} Fun`,
          `${client.emoji.information} Information`,
          `${client.emoji.moderation} Moderation`,
          `${client.emoji.music} Music`,
          `${client.emoji.setups} Setups`,
        ]
          .sort()
          .join("\n"),
        inline: true,
      })
      .addFields({
        name: `**__Extras__**`,
        value: [
          `${client.emoji.economy} Economy`,
          `${client.emoji.giveaway} Giveaway`,
          `${client.emoji.images} Images`,
          `${client.emoji.premium} Premium Commands`,
          `${client.emoji.socials} Socials`,
          `${client.emoji.tools} Tools`,
          `${client.emoji.utils} Utility`,
        ]
          .sort()
          .join("\n"),
        inline: true,
      })

      .setThumbnail(client.user.avatarURL({ size: 512 }))
      .setFooter({
        text: `Made with 💖 by @arpandevv`,
        iconURL: client.user.avatarURL(),
      })
      .setColor(client.config.embedColor);

    const supportButton = new ButtonBuilder()
      .setLabel("Support Server")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.gg/5FzKutmwSw");

    const inviteButton = new ButtonBuilder()
      .setLabel("Invite Bot")
      .setStyle(ButtonStyle.Link)
      .setURL(
        `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands`
      );

    const voteButton = new ButtonBuilder()
      .setLabel("Vote Bot")
      .setStyle(ButtonStyle.Link)
      .setURL("https://top.gg/bot/1002188910560026634/vote");

    const buttonRow = new ActionRowBuilder().addComponents(
      supportButton,
      inviteButton,
      voteButton
    );
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      embeds: [homeEmbed],
      components: [selectRow, buttonRow],
    });

    const filter = (i) =>
      (i.isStringSelectMenu() && i.customId === "category-select") ||
      (i.isButton() && i.customId.startsWith("page_"));
    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 600000, // 10 minutes in milliseconds
    });

    let currentPage = 0;
    const commandsPerPage = 10;

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "This menu can only be operated by the interaction user.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (i.isStringSelectMenu() && i.values[0] === "home") {
        currentPage = 0;
        await i.update({
          embeds: [homeEmbed],
          components: [selectRow, buttonRow],
        });
      } else if (i.isStringSelectMenu()) {
        const selectedCategory = i.values[0];
        const categoryCommands = commandsByCategory[selectedCategory];
        currentPage = 0;

        // Flatten commands and subcommands into a single array
        const allCommands = [];
        categoryCommands.forEach((command) => {
          if (command.subcommands.length === 0) {
            allCommands.push({
              name: command.name,
              description: command.description,
              isSubcommand: false,
            });
          } else {
            command.subcommands.forEach((subcommand) => {
              allCommands.push({
                name: subcommand.name,
                description: subcommand.description,
                isSubcommand: true,
                parentName: command.name,
              });
            });
          }
        });

        const totalPages = Math.ceil(allCommands.length / commandsPerPage);
        const startIndex = currentPage * commandsPerPage;
        const endIndex = Math.min(
          startIndex + commandsPerPage,
          allCommands.length
        );
        const commandsToShow = allCommands.slice(startIndex, endIndex);

        const formattedCommands = commandsToShow
          .map((command) => {
            const commandId =
              commandIds.get(
                command.isSubcommand ? command.parentName : command.name
              ) || "0";
            const fullCommand = command.isSubcommand
              ? `</${command.parentName} ${command.name}:${commandId}>`
              : `</${command.name}:${commandId}>`;
            return `${client.emoji.dropdownLine} **${fullCommand}** - ${command.description}\n`;
          })
          .join("")
          .trim();

        const categoryEmbed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setAuthor({
            name: `${selectedCategory} Commands`,
            iconURL: client.user.avatarURL(),
            url: "https://discord.com/api/oauth2/authorize?client_id=1002188910560026634&permissions=8&scope=bot%20applications.commands",
          })
          .setDescription(formattedCommands)
          .setFooter({
            text: `Page ${
              currentPage + 1
            } of ${totalPages} • Made with 💖 by @arpandevv`,
            iconURL: client.user.avatarURL(),
          })
          .setThumbnail(client.user.displayAvatarURL());

        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`page_first_${selectedCategory}`)
            .setEmoji("⏪")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId(`page_prev_${selectedCategory}`)
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId(`page_stop`)
            .setEmoji("🛑")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`page_next_${selectedCategory}`)
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1),
          new ButtonBuilder()
            .setCustomId(`page_last_${selectedCategory}`)
            .setEmoji("⏩")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1)
        );

        await i.update({
          embeds: [categoryEmbed],
          components: [paginationRow, selectRow, buttonRow],
        });
      } else if (i.isButton()) {
        if (i.customId === "page_stop") {
          await i.message.delete();
          return;
        }

        const selectedCategory =
          i.customId.split("_").slice(2).join("_") ||
          i.message.embeds[0].author.name.split(" ")[0];
        const categoryCommands = commandsByCategory[selectedCategory];

        // Flatten commands and subcommands into a single array
        const allCommands = [];
        categoryCommands.forEach((command) => {
          if (command.subcommands.length === 0) {
            allCommands.push({
              name: command.name,
              description: command.description,
              isSubcommand: false,
            });
          } else {
            command.subcommands.forEach((subcommand) => {
              allCommands.push({
                name: subcommand.name,
                description: subcommand.description,
                isSubcommand: true,
                parentName: command.name,
              });
            });
          }
        });

        const totalPages = Math.ceil(allCommands.length / commandsPerPage);

        if (i.customId.startsWith("page_first")) {
          currentPage = 0;
        } else if (i.customId.startsWith("page_prev")) {
          currentPage = Math.max(currentPage - 1, 0);
        } else if (i.customId.startsWith("page_next")) {
          currentPage = Math.min(currentPage + 1, totalPages - 1);
        } else if (i.customId.startsWith("page_last")) {
          currentPage = totalPages - 1;
        }

        const startIndex = currentPage * commandsPerPage;
        const endIndex = Math.min(
          startIndex + commandsPerPage,
          allCommands.length
        );
        const commandsToShow = allCommands.slice(startIndex, endIndex);

        const formattedCommands = commandsToShow
          .map((command) => {
            const commandId =
              commandIds.get(
                command.isSubcommand ? command.parentName : command.name
              ) || "0";
            const fullCommand = command.isSubcommand
              ? `</${command.parentName} ${command.name}:${commandId}>`
              : `</${command.name}:${commandId}>`;
            return `${client.emoji.dropdownLine} **${fullCommand}** - ${command.description}\n`;
          })
          .join("")
          .trim();

        const categoryEmbed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setAuthor({
            name: `${selectedCategory} Commands`,
            iconURL: client.user.avatarURL(),
            url: "https://discord.com/api/oauth2/authorize?client_id=1002188910560026634&permissions=8&scope=bot%20applications.commands",
          })
          .setDescription(formattedCommands)
          .setFooter({
            text: `Page ${
              currentPage + 1
            } of ${totalPages} • Made with 💖 by @arpandevv`,
            iconURL: client.user.avatarURL(),
          })
          .setThumbnail(client.user.displayAvatarURL());

        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`page_first_${selectedCategory}`)
            .setEmoji("⏪")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId(`page_prev_${selectedCategory}`)
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId(`page_stop`)
            .setEmoji("🛑")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`page_next_${selectedCategory}`)
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1),
          new ButtonBuilder()
            .setCustomId(`page_last_${selectedCategory}`)
            .setEmoji("⏩")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1)
        );

        await i.update({
          embeds: [categoryEmbed],
          components: [paginationRow, selectRow, buttonRow],
        });
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [selectRow, buttonRow] });
    });
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */
