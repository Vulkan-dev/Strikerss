const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  CommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  MessageFlags,
  ButtonStyle,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
} = require("discord.js");
const cooldown = new Set();
const sourcebin = require("sourcebin_js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`owner`)
    .setDescription(`Commands that are for managing bot and can be used by owner only!`)
    .addSubcommand((command) =>
      command
        .setName(`blacklist-add`)
        .setDescription(`Adds a user to the blacklist`)
        .addStringOption((option) =>
          option
            .setName("userid")
            .setDescription("The user to add to the blacklist")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("The reason for the blacklist")
            .setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName(`blacklist-remove`)
        .setDescription(`Removes a user from the blacklist`)
        .addStringOption((option) =>
          option
            .setName("user")
            .setDescription("The user to remove from the blacklist")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName(`send-changelogs`)
        .setDescription(`Send a new bot changelogs`)
    )
    .addSubcommand((command) =>
      command
        .setName(`restart`)
        .setDescription(`Shuts down and restarts bots (developer only)`)
    )
    .addSubcommand((command) =>
      command.setName("servers").setDescription("servers")
    ),
  developer: true,
  async execute(interaction, client) {
    if (interaction.user.id !== process.env.developerId) {
      return interaction.reply({
        content: `Only **the owner** of ${client.user} can use this command.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const sub = interaction.options.getSubcommand();

    // Declare blacklistDB and embed once outside the switch
    const blacklistDB = require("../../Schemas/blacklistSchema");
    let embed = new EmbedBuilder(); // Declare embed once and reuse/reassign

    switch (sub) {
      case "blacklist-add":
        const useridOption = interaction.options.getString("userid");
        const reasonOption =
          interaction.options.getString("reason") || "No reason provided";
        const errorArray = [];

        const blacklist = await blacklistDB.findOne({ userId: useridOption });

        const removeButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Remove")
            .setStyle(ButtonStyle.Danger)
            .setCustomId("remove")
        );

        // Reassign embed instead of redeclaring
        embed
          .setTitle("BlackList")
          .setColor(client.config.embedColor)
          .setDescription(
            `Successfully added user to blacklist with the reason: ${reasonOption}`
          );

        if (blacklist) {
          errorArray.push("That user is already blacklisted");
        }
        if (errorArray.length) {
          const errorEmbed = new EmbedBuilder()
            .setDescription(
              `${client.emoji.error} There was an error when adding user to blacklist.\nError(s):\n ${errorArray.join(
                `\n`
              )}`
            )
            .setColor(client.config.embedColor);
          await interaction.reply({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral,
          });
          return;
        } else {
          await blacklistDB.create({
            userId: useridOption,
            reason: reasonOption,
          });

          await interaction.reply({
            embeds: [embed],
            components: [removeButton],
          });

          const removeEmbed = new EmbedBuilder()
            .setTitle("BlackList")
            .setDescription("Successfully removed user from blacklist")
            .setColor(client.config.embedColor);

          const collector = interaction.channel.createMessageComponentCollector(
            { time: 60000 }
          );

          collector.on("collect", async (i) => {
            if (i.customId === "remove") {
              if (i.user.id !== interaction.user.id) {
                return await i.reply({
                  content: `Only ${interaction.client.user.username} can use this command!`,
                  flags: MessageFlags.Ephemeral,
                });
              }
              await blacklistDB.deleteOne({ userId: useridOption });
              await i.update({ embeds: [removeEmbed], components: [] });
            }
          });

          collector.on("end", (collected) => {
            console.log(`Collected ${collected.size} interactions.`);
          });
        }
        break;

      case "blacklist-remove":
        const user = interaction.options.getString("user");

        // Reassign embed instead of redeclaring
        embed
          .setTitle("Blacklist")
          .setColor(client.config.embedColor)
          .setDescription("Successfully removed the user from the blacklist");

        try {
          await blacklistDB.findOneAndDelete({ userId: user });
          interaction.reply({ embeds: [embed] });
        } catch (error) {
          console.error(error);
        }
        break;

      case "restart":
        if (interaction.user.id === `${process.env.developerId}`) {
          await interaction.reply({
            content: `**Shutting down..**`,
            flags: MessageFlags.Ephemeral,
          });
          await client.user.setStatus("invisible");
          process.exit();
        } else {
          return interaction.reply({
            content: `Only **the owner** of ${client.user} can use this command.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        break;

      case "servers":
        let list = "";
        client.guilds.cache.forEach((guild) => {
          list += `${guild.name} (${guild.id}) | ${guild.memberCount} Members | Owner: ${guild.ownerId}\n`;
        });

        sourcebin
          .create([
            {
              name: `Server list of ${client.user.tag}`,
              content: list,
              languageId: "js",
            },
          ])
          .then((src) => {
            interaction.reply({
              content: `My Server List - ${src.url}`,
              flags: MessageFlags.Ephemeral,
            });
          });
        break;

      case "send-changelogs":
        const modal = new ModalBuilder()
          .setCustomId("changelogs")
          .setTitle("Send changelogs");

        const title = new TextInputBuilder()
          .setCustomId("changelogs-title")
          .setLabel("Changelogs title")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(30)
          .setPlaceholder("April changelogs");

        const description = new TextInputBuilder()
          .setCustomId("changelogs-description")
          .setLabel("Changelogs description")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
          .setPlaceholder("Fixed bugs related to the help command");

        const footer = new TextInputBuilder()
          .setCustomId("changelogs-footer")
          .setLabel("Embed footer")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(20)
          .setPlaceholder("monthly update");

        const color = new TextInputBuilder()
          .setCustomId("changelogs-color")
          .setLabel("Embed color")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7)
          .setMinLength(7)
          .setPlaceholder("#ffffff || #000000");

        const type = new TextInputBuilder()
          .setCustomId("changelogs-type")
          .setLabel("Changelogs type")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(20)
          .setPlaceholder(
            "new commands implemented | bugs fixed | optimization"
          );

        const titleActionRow = new ActionRowBuilder().addComponents(title);
        const descriptionActionRow = new ActionRowBuilder().addComponents(
          description
        );
        const footerActionRow = new ActionRowBuilder().addComponents(footer);
        const colorActionRow = new ActionRowBuilder().addComponents(color);
        const typeActionRow = new ActionRowBuilder().addComponents(type);

        modal.addComponents(
          titleActionRow,
          descriptionActionRow,
          footerActionRow,
          colorActionRow,
          typeActionRow
        );

        await interaction.showModal(modal);
        break;
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */