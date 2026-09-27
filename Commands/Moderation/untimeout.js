const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, MessageFlags, PermissionsBitField } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Untimesout a server member")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The user you would like to untimeout")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for untiming out the user")
    ),
  async execute(interaction, client, message) {
    await interaction.deferReply();

    const timeUser  = interaction.options.getUser ("target");
    const timeMember = await interaction.guild.members.fetch(timeUser .id);

    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    )
      return interaction.editReply({
        content: "You must have the Moderate Members permission to use this command!",
        flags: MessageFlags.Ephemeral
      });

    if (!timeMember.kickable)
      return interaction.editReply({
        content: "I cannot untimeout this user! This is either because they are higher than me or you.",
        flags: MessageFlags.Ephemeral
      });

    if (interaction.member.id === timeMember.id)
      return interaction.editReply({
        content: "You cannot untimeout yourself!",
        flags: MessageFlags.Ephemeral
      });

    if (timeMember.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.editReply({
        content: "You cannot untimeout staff members or people with the Administrator permission!",
        flags: MessageFlags.Ephemeral
      });

    let reason = interaction.options.getString("reason");
    if (!reason) reason = "No reason given.";

    try {
      await timeMember.timeout(null, reason);

      const minEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setDescription(`${timeUser .tag}'s timeout has been **removed** | ${reason}`);

      const dmEmbed = new EmbedBuilder()
        .setDescription(`You have been **untimed out** in ${interaction.guild.name} | ${reason}`)
        .setColor(client.config.embedColor);

      await timeMember.send({ embeds: [dmEmbed] }).catch((err) => {
        console.error("Failed to send DM:", err);
      });

      await interaction.editReply({ embeds: [minEmbed] });
    } catch (error) {
      console.error("Error during untimeout:", error);
      await interaction.editReply({
        content: "An error occurred while trying to untimeout the user.",
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
