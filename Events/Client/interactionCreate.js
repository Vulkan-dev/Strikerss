const mongoose = require("mongoose");
const Premium = require("../../Schemas/premiumUserSchema");
const PremiumGuild = require("../../Schemas/premiumGuildSchema");

const isUserPremium = async (userId) => {
  if (mongoose.connection.readyState !== 1) return false;
  const isPremium = await Premium.findOne({ id: userId }).catch(() => null);
  return isPremium && isPremium.isPremium;
}
const isGuildPremium = async (guildId) => {
  if (mongoose.connection.readyState !== 1) return false;
  const isPremium = await PremiumGuild.findOne({ id: guildId }).catch(() => null);
  return isPremium && isPremium.isPremiumGuild;
}
const blacklistDB = require("../../Schemas/blacklistSchema");

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Handle Clan Applicant Review Buttons (Approve / Reject)
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('clan_approve_') || interaction.customId.startsWith('clan_reject_')) {
                const isApprove = interaction.customId.startsWith('clan_approve_');
                const targetUserId = interaction.customId.replace(isApprove ? 'clan_approve_' : 'clan_reject_', '');

                // Check staff permission
                const hasStaffRole = client.config.clanManager?.staffRoleId && interaction.member.roles.cache.has(client.config.clanManager.staffRoleId);
                const isAdmin = interaction.member.permissions.has('Administrator');

                if (!hasStaffRole && !isAdmin) {
                    return interaction.reply({
                        content: '❌ Only clan staff or administrators can review this applicant.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (isApprove) {
                    // Assign staff role or member role if configured
                    if (client.config.clanManager?.memberRoleId) {
                        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
                        if (targetMember) {
                            await targetMember.roles.add(client.config.clanManager.memberRoleId).catch(() => null);
                        }
                    }

                    await interaction.reply({
                        content: `✅ <@${targetUserId}> has been **APPROVED** by <@${interaction.user.id}>! Channel will remain for records or can be closed.`
                    });
                } else {
                    await interaction.reply({
                        content: `❌ <@${targetUserId}> has been **REJECTED** by <@${interaction.user.id}>. Channel closing in 10 seconds...`
                    });
                    setTimeout(async () => {
                        await interaction.channel.delete().catch(() => null);
                    }, 10000);
                }
                return;
            }
        }

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
        let userData = null;
        if (mongoose.connection.readyState === 1) {
          userData = await blacklistDB.findOne({
            userId: interaction.user.id,
          }).catch(() => null);
        }

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