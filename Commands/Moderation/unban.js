const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
      .setName("unban")
      .setDescription("Unbans a member from your server")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addStringOption((options) =>
          options
              .setName("id")
              .setDescription("ID of the user to unban")
              .setRequired(true)
      )
      .addStringOption((options) =>
          options
              .setName("reason")
              .setDescription("Specify a reason")
              .setMaxLength(512)
      ),

  async execute(interaction, client) {
      const { options, member, guild } = interaction;
      const reason = options.getString("reason") || "Not specified";
      const targetId = options.getString("id");

      try {
          // Attempt to unban the user
          await interaction.guild.members.unban(targetId);
          const embed = new EmbedBuilder()
              .setAuthor({ name: "Ban Issues", iconURL: guild.iconURL() })
              .setColor(client.config.embedColor)
              .setDescription(
                  [`<@${targetId}> got unbanned by ${member}`, `\nReason: ${reason}`].join("\n")
              );

          await interaction.reply({ embeds: [embed] });

          // Attempt to notify the unbanned user
          try {
              const user = await client.users.fetch(targetId);
              await user.send({
                  content: `Hi, You have been unbanned from ${guild.name} for reason: ${reason}. You can now join again.`,
              });
          } catch (sendError) {
              console.error("Failed to send DM to the user:", sendError);
          }

      } catch (unbanError) {
          if (unbanError.code === 50013) {
              return interaction.reply({ content: "I do not have permission to unban this user." });
          } else if (unbanError.code === 10026) {
              return interaction.reply({ content: "The user ID provided is not valid or the user is not banned." });
          } else {
              return interaction.reply({ content: "An error occurred while trying to unban the user." });
          }
      }
  },
};
