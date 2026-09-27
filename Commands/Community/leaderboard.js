const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const levelSchema = require("../../Schemas/level");
const voiceLevelSchema = require("../../Schemas/voiceLevel"); // Import the voice level schema

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDMPermission(false)
    .setDescription("Displays the top 10 members of the server based on XP."),
  
  async execute(interaction) {
    const levelData = await levelSchema.find({ Guild: interaction.guild.id }).sort({ XP: -1 }).limit(10);
    const voiceData = await voiceLevelSchema.find({ Guild: interaction.guild.id }).sort({ XP: -1 }).limit(10);

    if (levelData.length === 0 && voiceData.length === 0) {
      return await interaction.reply({
        content: "No members have XP data yet.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Function to create the leaderboard embed
    const createLeaderboardEmbed = (data, title, type) => {
      const embed = new EmbedBuilder()
        .setColor("Gold")
        .setTitle(`🏆 ${title}`)
        .setDescription(`Top 10 Members by ${type} XP`)
        .setTimestamp();

      data.forEach((entry, index) => {
        const member = interaction.guild.members.cache.get(entry.User);
        const username = member ? member.user.username : "Unknown User";
        embed.addFields({
          name: `${index + 1}. ${username}`,
          value: `Level: ${entry.Level} | XP: ${entry.XP}`,
          inline: false,
        });
      });

      return embed;
    };

    // Create the initial leaderboard embed for message XP
    const leaderboardEmbed = createLeaderboardEmbed(levelData, "Message Leaderboard", "Message");

    // Create buttons for toggling between leaderboards
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('voice_leaderboard')
          .setLabel('Voice Leaderboard')
          .setStyle('Primary'),
        new ButtonBuilder()
          .setCustomId('message_leaderboard')
          .setLabel('Message Leaderboard')
          .setStyle('Secondary')
          .setDisabled(true) // Disable the message leaderboard button initially
      );

    await interaction.reply({ embeds: [leaderboardEmbed], components: [row] });

    // Handle button interaction
    const filter = i => (i.customId === 'voice_leaderboard' || i.customId === 'message_leaderboard') && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'voice_leaderboard') {
        const voiceLeaderboardEmbed = createLeaderboardEmbed(voiceData, "Voice Leaderboard", "Voice");

        // Update the embed and buttons
        await i.update({ embeds: [voiceLeaderboardEmbed], components: [row.setComponents(
          row.components[0].setDisabled(true), // Disable voice leaderboard button
          row.components[1].setDisabled(false) // Enable message leaderboard button
        )] });
      } else if (i.customId === 'message_leaderboard') {
        // Update the embed back to message leaderboard
        await i.update({ embeds: [leaderboardEmbed], components: [row.setComponents(
          row.components[0].setDisabled(false), // Enable voice leaderboard button
          row.components[1].setDisabled(true) // Disable message leaderboard button
        )] });
      }
    });

    collector.on('end', collected => {
      // Disable both buttons after the collector ends
      row.components.forEach(button => button.setDisabled(true));
      interaction.editReply({ components: [row] });
    });
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */