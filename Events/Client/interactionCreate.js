const { Interaction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require("discord.js");
const Premium = require("../../Schemas/premiumUserSchema");
const PremiumGuild = require("../../Schemas/premiumGuildSchema");
const isUserPremium = async (userId) => {
  const isPremium = await Premium.findOne({ id: userId });
  return isPremium && isPremium.isPremium;
}
const isGuildPremium = async (guildId) => {
  const isPremium = await PremiumGuild.findOne({ id: guildId });
  return isPremium && isPremium.isPremiumGuild;
}
const blacklistDB = require("../../Schemas/blacklistSchema");

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) return

        if (command.premium) {
          const isPremium = await isUserPremium(interaction.user.id);
          const isPremiumServer = await isGuildPremium(interaction.guild.id);
          const premiumembed = new EmbedBuilder()
              .setTitle('✨ **Premium Subscription**')
              .setAuthor({ name: '> Wah There!'})
              .setDescription(`**• Premium Feature Discovered** \n> You **must** be a **Premium** user to use this command!\n**• Buy Premium**\n> https://discord.gg/qkZaSgGDuq`)
              .setFooter({ text: `✨ Premium Required `})
              .setColor('Yellow')
              .setThumbnail('https://cdn.discordapp.com/attachments/1188547936494293012/1198638318011822232/Not-Background.png?ex=6648bdec&is=66476c6c&hm=870b4befd1993ac934fbaad15c46299cc54d4fe1a6eed4f4e8b965058b737692&')
              .setTimestamp();
          if (!isPremium && !isPremiumServer) {
              return interaction.reply({
                  embeds: [premiumembed],
                  flags: MessageFlags.Ephemeral
              });
          }
      }
        if (command.developer) {
            const userId = interaction.user.id;
            const isDeveloper = process.env.developerId
    
            if (userId !== isDeveloper) {
                return interaction.reply({
                    content: `You are not a developer of this bot!`,
                    flags: MessageFlags.Ephemeral,
                }); 
            }
        }
        const userData = await blacklistDB.findOne({
          userId: interaction.user.id,
        });

        // Blacklist
        if (userData) {
          return interaction.reply({
            content: `**You are blacklisted from using this bot.**\nReason: **${userData.reason}**`,
            flags: MessageFlags.Ephemeral,
          });
        }

        try{
            await command.execute(interaction, client);
          } catch (error) {
            console.log(error);
          
        await interaction.reply({
          content: 'There was an error while executing this command. If this persists, please contact the developer by making a support request.',
          flags: MessageFlags.Ephemeral,
        });
       }
      }
    }