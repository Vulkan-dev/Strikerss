const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  Guild,
  Embed,
  MessageFlags,
} = require("discord.js");
const reaction = require("../../Schemas/reactionrole");

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`reaction-role`)
    .setDescription("Manage your reaction role system")
    .addSubcommand((command) =>
      command
        .setName("add")
        .setDescription("add a reaction role to a message")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message you want to set reaction role on.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji to react with.")
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("The role you want to give")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("remove")
        .setDescription("remove a reactionrole from a message")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message you want to remove rr from.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji you want to remove.")
            .setRequired(true)
        )
    ),
  async execute(interaction, client) {
    const { options, guild, channel } = interaction;
    const sub = options.getSubcommand();
    const emoji = options.getString("emoji");
    let e;
    const message = await channel.messages
      .fetch(options.getString("message-id"))
      .catch((err) => {
        e = err;
      });
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      )
        return await interaction.reply({
          content: "You **do not** have the permission to do that!",
          flags: MessageFlags.Ephemeral,
        });

    if (e)
      return await interaction.reply({
        content: `Be sure to a get a message from ${channel}`,
        flags: MessageFlags.Ephemeral,
      });

    const data = await reaction.findOne({
      Guild: guild.id,
      Message: message.id,
      Emoji: emoji,
    });

    switch (sub) {
      case "add":
        if (data) {
          return await interaction.reply({
            content: `It looks like you already have this reaction role system.`,
          });
        } else {
          const role = options.getRole("role");
          await reaction.create({
            Guild: guild.id,
            Message: message.id,
            Emoji: emoji,
            Role: role.id,
          });

          const embed1 = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(
              `I have added reaction role to ${message.url} with ${emoji} and the role ${role}`
            );
          await message.react(emoji).catch((err) => {
            return interaction.reply({
              content: `Please add this emoji from this server only`,
            });
          });
          await interaction.reply({ embeds: [embed1] });
        }

        break;
      case "remove":
        if (!data) {
          return await interaction.reply({
            content: `Reaction role system doesn't exist :v`,
          });
        } else {
          await reaction.deleteMany({
            Guild: guild.id,
            Message: message.id,
            Emoji: emoji,
          });

          const embed = new EmbedBuilder().setDescription(
            `I have removed reaction role from ${message.url} with ${emoji}`
          );

          const reactionObj = message.reactions.resolve(emoji);
          if (reactionObj) {
            await reactionObj.users.remove(client.user.id).catch((err) => {
              console.error('Failed to remove reaction:', err);
            });
          }

          await interaction.reply({ embeds: [embed] });
        }
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */