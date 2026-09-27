const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const warningSchema = require("../../Schemas/warnSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("This warns a server member")
    .addSubcommand((command) =>
      command
        .setName("user")
        .setDescription("Warn a user for their mistake or breaking any rule")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user you want to warn")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("The reason for warning the user")
            .setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("clear")
        .setDescription("This clears a member's warnings")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user you want to clear the warnings of")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("show")
        .setDescription("This gets a member's warnings")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The member you want to check the warns of")
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const { options, guildId, user, guild } = interaction;
    const target = options.getUser("user");

    try {
      if (sub === "user") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
          return await interaction.reply({
            content: "You don't have permission to warn people!",
            ephemeral: true,
          });
        }

        // Check if the target is the command issuer
        if (target.id === user.id) {
          return await interaction.reply({
            content: "You cannot warn yourself!",
            ephemeral: true,
          });
        }

        // Fetch the target member to check roles and ownership
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) {
          return await interaction.reply({
            content: "The specified user is not a member of this server!",
            ephemeral: true,
          });
        }

        // Check if the target is the server owner
        if (targetMember.id === guild.ownerId) {
          return await interaction.reply({
            content: "You cannot warn the server owner!",
            ephemeral: true,
          });
        }

        // Check if the target's highest role is higher or equal to the issuer's highest role
        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
          return await interaction.reply({
            content: "You cannot warn someone with a higher or equal role!",
            ephemeral: true,
          });
        }

        const reason = options.getString("reason") || "No reason given";
        const userTag = `${target.username}#${target.discriminator}`;

        let data = await warningSchema.findOne({
          GuildID: guildId,
          UserID: target.id,
          UserTag: userTag,
        });

        if (!data) {
          data = new warningSchema({
            GuildID: guildId,
            UserID: target.id,
            UserTag: userTag,
            Content: [
              {
                ExecuterId: user.id,
                ExecuterTag: user.tag,
                Reason: reason,
              },
            ],
          });
        } else {
          const warnContent = {
            ExecuterId: user.id,
            ExecuterTag: user.tag,
            Reason: reason,
          };
          data.Content.push(warnContent);
        }
        await data.save();

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle(`${client.emoji.warn} Important Notice`)
          .setDescription(
            `You have been warned in ${interaction.guild.name} by <@${interaction.user.id}>\nFor: \`${reason}\``
          );

        const embed2 = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setDescription(`✅ ${target.tag} has been **warned** | ${reason}`);

        await target.send({ embeds: [embed] }).catch(() => {});

        await interaction.reply({ embeds: [embed2] });
      }

      if (sub === "clear") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
          return await interaction.reply({
            content: "You don't have permission to clear people's warnings!",
            ephemeral: true,
          });
        }

        const data = await warningSchema.findOne({
          GuildID: guildId,
          UserID: target.id,
          UserTag: target.tag,
        });

        const embed = new EmbedBuilder();

        if (data) {
          await warningSchema.findOneAndDelete({
            GuildID: guildId,
            UserID: target.id,
            UserTag: target.tag,
          });

          embed
            .setColor(client.config.embedColor)
            .setDescription(`✅ ${target.tag}'s warnings have been cleared`);

          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply({
            content: `${target.tag} has no warnings to be cleared`,
            ephemeral: true,
          });
        }
      }

      if (sub === "show") {
        const data = await warningSchema.findOne({
          GuildID: guildId,
          UserID: target.id,
          UserTag: target.tag,
        });

        const embed = new EmbedBuilder();
        const noWarns = new EmbedBuilder();

        if (data) {
          embed
            .setColor(client.config.embedColor)
            .setDescription(
              `✅ ${
                target.tag
              }'s warnings: \n${data.Content.map(
                (w, i) =>
                  `
                  **Warning**: ${i + 1}
                  **Warning Moderator**: ${w.ExecuterTag}
                  **Warn Reason**: ${w.Reason}
                  `
              ).join("-")}`
            );

          await interaction.reply({ embeds: [embed] });
        } else {
          noWarns
            .setColor(client.config.embedColor)
            .setDescription(`✅ ${target.tag} has **0** warnings!`);

          await interaction.reply({ embeds: [noWarns] });
        }
      }
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: "An error occurred while processing the command.",
        ephemeral: true,
      });
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */