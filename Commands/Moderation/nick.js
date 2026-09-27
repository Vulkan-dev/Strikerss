const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nick")
    .setDMPermission(false)
    .setDescription(`Change specified user's nickname.`)
    .addStringOption((option) =>
      option
        .setName("nick")
        .setDescription(
          `Specified nickname will become specified user's new nickname.`
        )
        .setRequired(true)
        .setMaxLength(32)
        .setMinLength(2)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription(`Specified user's nickname will be changed.`)
    ),
  async execute(interaction, client) {
    const nick = await interaction.options.getString("nick");
    const user = await interaction.options.getUser("user");
    const member = await interaction.options.getMember("user");

    if (user === interaction.user || user === null) {
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ChangeNickname
        ) &&
        interaction.user.id !== client.config.developerid
      )
        return await interaction.reply({
          content: `${client.emoji.cross} | You **do not** have the permission to do that!`,
          flags: MessageFlags.Ephemeral
        });

      await interaction.member.setNickname(nick).catch((err) => {
        return interaction.reply({
          content: `${client.emoji.cross} | **Couldn't** change your nickname! **Check** my permissions and **role position** and try again.`,
          flags: MessageFlags.Ephemeral
        });
      });

      await interaction.reply({
        content: `${client.emoji.tick} | Your **nickname** has been set to "**${nick}**"!`,
        flags: MessageFlags.Ephemeral
      });
    } else {
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageNicknames
        ) &&
        interaction.user.id !== client.config.developerid
      )
        return await interaction.reply({
          content: `${client.emoji.cross} | You **do not** have the permission to change someone **else's** nickname!`,
          flags: MessageFlags.Ephemeral
        });
      else {
        await member.setNickname(nick).catch((err) => {
          return interaction.reply({
            content: `${client.emoji.cross} | **Couldn't** change the nickname of ${user}! **Check** my permissions and **role position** and try again.`,
            flags: MessageFlags.Ephemeral
          });
        });
        await interaction.reply({
          content: `${client.emoji.tick} | You **successfuly** set ${member}'s nickname to "**${nick}**"!`,
          flags: MessageFlags.Ephemeral
        });
      }
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */