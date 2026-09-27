const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDMPermission(false)
    .setDescription("Kicks specified user.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Specify the user you want to kick.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason as to why you want to kick specified user.")
        .setRequired(false)
    ),
  async execute(interaction, client) {
    const users = interaction.options.getUser("user");
    const ID = users.id;
    const kickedmember = interaction.options.getMember("user");

    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)
    )
      return await interaction.reply({
        content: `${client.emoji.cross} | You **do not** have the permission to do that!`,
        flags: MessageFlags.Ephemeral
      });
    if (interaction.member.id === ID)
      return await interaction.reply({
        content: `${client.emoji.cross} | You **cannot** use the kick power on you, silly goose..`,
        flags: MessageFlags.Ephemeral
      });

    if (!kickedmember)
      return await interaction.reply({
        content: `${client.emoji.cross} | That user **does not** exist within your server.`,
        flags: MessageFlags.Ephemeral
      });

    const reason =
      interaction.options.getString("reason") || "No reason provided :(";

    const dmembed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setAuthor({ name: "🔨 Kick Tool" })
      .setTitle(`> You were kicked from "${interaction.guild.name}"`)
      .addFields({
        name: "• Server",
        value: `> ${interaction.guild.name}`,
        inline: true,
      })
      .addFields({ name: "• Reason", value: `> ${reason}`, inline: true })
      .setFooter({ text: "🔨 Kicked from a server" })
      .setTimestamp()
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }));

    const embed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setAuthor({ name: "🔨 Kick Tool" })
      .setTitle(`> User was kicked!`)
      .addFields({ name: "• User", value: `> ${users.tag}`, inline: true })
      .addFields({ name: "• Reason", value: `> ${reason}`, inline: true })
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "🔨 Someone got kicked hard" })
      .setTimestamp();

    await kickedmember.kick().catch((err) => {
      return interaction.reply({
        content: `${client.emoji.cross} | **Couldn't** kick this member! Check my **role position** and try again.`,
        flags: MessageFlags.Ephemeral
      });
    });

    await kickedmember.send({ embeds: [dmembed] }).catch((err) => {
      return;
    });

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */