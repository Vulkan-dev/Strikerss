const mongoose = require("mongoose");
const { MessageFlags, ActionRowBuilder } = require("discord.js");
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
const { isGuildActivated } = require("../../Utils/guildActivation");

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Enforce Server Activation: unactivated servers cannot run commands or buttons (except /redeem)
        if (interaction.guild) {
            const isRedeemCommand = interaction.isCommand() && interaction.commandName === 'redeem';
            if (!isRedeemCommand) {
                const active = await isGuildActivated(interaction.guild.id);
                if (!active) {
                    return interaction.reply({
                        content: '🔒 **Bot Inactive On This Server**',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
            }
        }

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

                // Disable review buttons immediately to prevent duplicate actions
                try {
                    const updatedComponents = interaction.message.components.map(row => {
                        const builder = ActionRowBuilder.from(row);
                        builder.components.forEach(c => c.setDisabled(true));
                        return builder;
                    });
                    await interaction.update({ components: updatedComponents }).catch(() => {});
                } catch (e) {}

                if (isApprove) {
                    let roleAssignedText = "";
                    const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
                    if (targetMember) {
                        const roleId = client.config.clanManager?.memberRoleId;
                        const role = (roleId && interaction.guild.roles.cache.get(roleId))
                            || interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'strikers' || r.name.toLowerCase().includes('striker'));
                        if (role) {
                            await targetMember.roles.add(role.id).catch(() => null);
                            roleAssignedText = ` and received the **${role.name}** role`;
                        }
                    }

                    await interaction.followUp({
                        content: `✅ <@${targetUserId}> has been **APPROVED** by <@${interaction.user.id}>${roleAssignedText}! This channel will remain for records or can be closed.`
                    });
                } else {
                    await interaction.followUp({
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

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(`[COMMAND ERROR] /${interaction.commandName}:`, error);
          
            const errorMsg = {
                content: 'There was an error while executing this command. If this persists, please contact the developer by making a support request.',
                flags: MessageFlags.Ephemeral,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMsg).catch(() => {});
            } else {
                await interaction.reply(errorMsg).catch(() => {});
            }
        }
      }
    }