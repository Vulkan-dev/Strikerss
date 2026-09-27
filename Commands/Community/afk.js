const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const afkSchema = require("../../Schemas/afkschema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`afk`)
    .setDescription(`Go AFK within your server`)
    .addSubcommand((command) =>
      command
        .setName("set")
        .setDescription(`Go AFK within your server`)
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription(`The reason for going AFK`)
            .setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command.setName("remove").setDescription(`Remove AFK within your server`)
    ),
  async execute(interaction, client) {
    const { options } = interaction;
    const sub = options.getSubcommand();

    const Data = await afkSchema.findOne({
      Guild: interaction.guild.id,
      User: interaction.user.id,
    });

    
    function isValidAFKReason(reason) {
      const mentionRegex = /<@!?(\d+)>|@everyone|@here/g;
      return !mentionRegex.test(reason);
    }

    switch (sub) {
      case "set":
        if (Data) {
          return await interaction.reply({
            content: `You are already AFK within this server.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          const message = options.getString("message") || "No Reason Given";
          
          if (!isValidAFKReason(message)) {
            return await interaction.reply({
              content: "You cannot use mentions or @everyone/@here in your AFK reason.",
              flags: MessageFlags.Ephemeral,
            });
          }

          const nickname =
            interaction.member.nickname || interaction.user.username;
          await afkSchema.create({
            Guild: interaction.guild.id,
            User: interaction.user.id,
            Message: message,
            Nickname: nickname,
          });

          const name = `[AFK] ${nickname}`;
          await interaction.member.setNickname(`${name}`).catch((er) => {
            return;
          });

          await interaction.reply({
            content: `> ${client.emoji.tick} You are now AFK within this server! | Reason: **${message}**`,
            ephemeral: false,
          });
        }
        break;

      case "remove":
        if (!Data) {
          return await interaction.reply({
            content: `${client.emoji.error} | You are not AFK within this server.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          const nick = Data.Nickname;
          await afkSchema.deleteMany({
            Guild: interaction.guild.id,
            User: interaction.user.id,
          });

          await interaction.member.setNickname(`${nick}`).catch((err) => {
            return;
          });

          const embed = new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(
              `${client.emoji.tick} Your AFK has been removed`
            );

          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        break;
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */