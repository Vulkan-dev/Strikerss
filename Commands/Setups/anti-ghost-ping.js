const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
} = require("discord.js");
const ghostSchema = require("../../Schemas/ghostpingSchema");
const numSchema = require("../../Schemas/ghostNum");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("anti-ghostping")
    .setDescription("Setup the anti ghost ping system")
    .addSubcommand((command) =>
      command
        .setName("setup")
        .setDescription("Setup the anti ghost ping system")
    )
    .addSubcommand((command) =>
      command
        .setName("disable")
        .setDescription("Disable the anti ghost ping system")
    )
    .addSubcommand((command) =>
      command
        .setName("number-reset")
        .setDescription("Reset a users ghost ping count")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription(
              "The user you want to reset the number of ghost pings of"
            )
            .setRequired(true)
        )
    ),
  async execute(interaction, client) {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    )
      return await interaction.reply({
        content: `${client.emoji.error} | You don't have perms to manage the anti ghost ping system`,
        flags: MessageFlags.Ephemeral,
      });

    const { options } = interaction;
    const sub = options.getSubcommand();

    const Data = await ghostSchema.findOne({ Guild: interaction.guild.id });

    switch (sub) {
      case "setup":
        if (Data)
          return await interaction.reply({
            content: `${client.emoji.warn} You already have the anti-ghost ping system setuped.`,
            flags: MessageFlags.Ephemeral,
          });
        else {
          await ghostSchema.create({
            Guild: interaction.guild.id,
          });

          const embed = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(
              `${client.emoji.tick} | The anti ghost ping system has been setup!`
            );

          await interaction.reply({ embeds: [embed] });
        }

        break;

      case "disable":
        if (!Data)
          return await interaction.reply({
            content: `${client.emoji.error} | There is no anti-ghost ping system in place here.`,
            flags: MessageFlags.Ephemeral,
          });
        else {
          await ghostSchema.deleteMany({ Guild: interaction.guild.id });

          const embed = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(
              `${client.emoji.tick} | The anti ghost ping system has been disabled`
            );

          await interaction.reply({ embeds: [embed] });
        }

        break;

      case "number-reset":
        const member = options.getUser("user");
        const data = await numSchema.findOne({
          Guild: interaction.guild.id,
          User: member.id,
        });

        if (!data)
          return await interaction.reply({
            content: `This member doesn't have any ghost pings yet`,
            flags: MessageFlags.Ephemeral,
          });
        else {
          await data.deleteOne({ User: member.id });

          await interaction.reply({
            content: `${member}'s ghost ping number is back at 0`,
          });
        }
    }
  },
};


/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */