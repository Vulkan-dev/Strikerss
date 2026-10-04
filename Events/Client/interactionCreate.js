const mongoose = require("mongoose");
const { MessageFlags, ActionRowBuilder, EmbedBuilder } = require("discord.js");
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

            // Handle Dual IP Filter Review Buttons (Approve / Reject)
            if (interaction.customId.startsWith('dualip_approve_') || interaction.customId.startsWith('dualip_reject_')) {
                const isApprove = interaction.customId.startsWith('dualip_approve_');
                const targetUserId = interaction.customId.replace(isApprove ? 'dualip_approve_' : 'dualip_reject_', '');

                // Check staff permission
                const staffRoleId = client.config.clanManager?.staffRoleId || process.env.CLAN_STAFF_ROLE_ID;
                const hasStaffRole = staffRoleId && interaction.member.roles.cache.has(staffRoleId);
                const isAdmin = interaction.member.permissions.has('Administrator') ||
                                interaction.member.permissions.has('ManageGuild') ||
                                interaction.user.id === interaction.guild.ownerId ||
                                interaction.user.id === (process.env.developerId || '1127146188701970442');

                if (!hasStaffRole && !isAdmin) {
                    return interaction.reply({
                        content: '❌ Only administrators or clan staff can review this flagged user.',
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

                const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
                const { getVerifiedRoleId, clearSimulationGrace, authValidationCache } = require('../../Utils/oauthDeauthGuard');
                const { transitionToVerified, transitionToUnverified } = require('../../Utils/roleGuard');
                const verifiedRoleId = await getVerifiedRoleId(interaction.guild, client);

                if (isApprove) {
                    if (targetMember && verifiedRoleId) {
                        await transitionToVerified(targetMember, verifiedRoleId);
                    }
                    clearSimulationGrace(targetUserId);
                    authValidationCache.set(targetUserId, { result: { authorized: true }, timestamp: Date.now() });

                    // Mark verified in VerificationSchema / VerifyUsers
                    const VerificationSchema = require('../../Schemas/verificationSchema');
                    const VerifyUsers = require('../../Schemas/verifyusers');
                    await VerificationSchema.updateOne(
                        { Guild: interaction.guild.id },
                        { $addToSet: { Verified: targetUserId } }
                    ).catch(() => {});
                    await VerifyUsers.deleteOne({ Guild: interaction.guild.id, User: targetUserId }).catch(() => {});

                    await interaction.followUp({
                        content: `✅ <@${targetUserId}> has been **APPROVED** by <@${interaction.user.id}>!\nTheir **Unverified** role has been removed and <@&${verifiedRoleId}> role has been assigned.`
                    });

                    // DM user confirmation
                    if (targetMember) {
                        try {
                            const approveEmbed = new EmbedBuilder()
                                .setTitle(`✅ Verification Approved in ${interaction.guild.name}`)
                                .setColor(0x10b981)
                                .setDescription(`Server staff have approved your verification review!\nYour **Verified** role (<@&${verifiedRoleId}>) has been assigned. You now have full access to **${interaction.guild.name}**!`)
                                .setTimestamp();
                            await targetMember.send({ embeds: [approveEmbed] }).catch(() => {});
                        } catch (e) {}
                    }
                } else {
                    if (targetMember && verifiedRoleId) {
                        await transitionToUnverified(targetMember, verifiedRoleId, 'Dual IP verification rejected by staff');
                    }

                    await interaction.followUp({
                        content: `❌ <@${targetUserId}> has been **REJECTED** by <@${interaction.user.id}>.\nThey will remain **Unverified**.`
                    });

                    // DM user notification
                    if (targetMember) {
                        try {
                            const rejectEmbed = new EmbedBuilder()
                                .setTitle(`❌ Verification Rejected in ${interaction.guild.name}`)
                                .setColor(0xff3333)
                                .setDescription(`Your verification review in **${interaction.guild.name}** was rejected by server staff due to dual IP / multi-account policy.`)
                                .setTimestamp();
                            await targetMember.send({ embeds: [rejectEmbed] }).catch(() => {});
                        } catch (e) {}
                    }
                }
                return;
            }

            // Handle Welcome System Buttons
            if (interaction.customId.startsWith('test_welcome_btn') || interaction.customId === 'disable_welcome_btn') {
                const isAdmin = interaction.member.permissions.has('ManageGuild') ||
                                interaction.member.permissions.has('Administrator') ||
                                interaction.user.id === interaction.guild.ownerId ||
                                interaction.user.id === process.env.developerId;

                if (!isAdmin) {
                    return interaction.reply({
                        content: '❌ Only administrators can interact with the welcome configuration.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.customId.startsWith('test_welcome_btn')) {
                    const WelcomeSchema = require('../../Schemas/welcomeMessageSchema');
                    const { sendWelcomeMessage } = require('../Others/welcome');
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const welcomeData = await WelcomeSchema.findOne({ guildId: interaction.guild.id });
                    if (!welcomeData || !welcomeData.channelId) {
                        return interaction.editReply({ content: '⚠️ No welcome channel is configured yet.' });
                    }
                    const res = await sendWelcomeMessage(interaction.member, welcomeData.channelId);
                    if (res.success) {
                        return interaction.editReply({ content: `✅ Test welcome message sent to <#${welcomeData.channelId}>!` });
                    } else {
                        return interaction.editReply({ content: `❌ Failed to send test welcome: ${res.error || 'Unknown error'}` });
                    }
                } else if (interaction.customId === 'disable_welcome_btn') {
                    const WelcomeSchema = require('../../Schemas/welcomeMessageSchema');
                    await WelcomeSchema.deleteOne({ guildId: interaction.guild.id });
                    return interaction.reply({
                        content: '🗑️ **Welcome system has been disabled for this server.**',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return;
            }

            // Handle Moniker Enforcer DM Buttons (Owner only: 1127146188701970442)
            if (interaction.customId.startsWith('strip_striker_roles_') || interaction.customId.startsWith('dismiss_striker_violation_')) {
                if (interaction.user.id !== '1127146188701970442') {
                    return interaction.reply({
                        content: '❌ Only the clan owner (<@1127146188701970442>) can perform this action.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.deferUpdate();

                const isStrip = interaction.customId.startsWith('strip_striker_roles_');
                const parts = interaction.customId.split('_');
                // Format: strip_striker_roles_<guildId>_<targetUserId> or dismiss_striker_violation_<guildId>_<targetUserId>
                const targetUserId = parts[parts.length - 1];
                const targetGuildId = parts[parts.length - 2];

                const targetGuild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
                let targetMember = null;
                if (targetGuild) {
                    targetMember = targetGuild.members.cache.get(targetUserId) || await targetGuild.members.fetch(targetUserId).catch(() => null);
                }

                const JUNIOR_ROLE = "1554580536159244338";
                const STRIKER_ROLE = "1554580532363403357";

                if (isStrip) {
                    if (targetMember) {
                        await targetMember.roles.remove([JUNIOR_ROLE, STRIKER_ROLE], 'Striker Moniker Enforcer: Missing -͟͟͞ 𝐒𝐓𝐑 乂').catch(() => null);

                        try {
                            const notifyEmbed = new EmbedBuilder()
                                .setTitle('⛔ STRIKERS Roles Revoked')
                                .setColor('#ef4444')
                                .setDescription(`Your **Strikers** / **Junior Strikers** roles have been removed by leadership because your nickname was missing the mandatory clan moniker:\n>>> **\`-͟͟͞ 𝐒𝐓𝐑 乂\`**\n\nTo restore your roles, add the moniker back to your server name and contact leadership.`)
                                .setFooter({ text: 'STRIKERS Moniker Enforcer' })
                                .setTimestamp();
                            await targetMember.send({ embeds: [notifyEmbed] }).catch(() => null);
                        } catch (e) {}
                    }

                    const originalEmbed = interaction.message.embeds[0];
                    const updatedEmbed = EmbedBuilder.from(originalEmbed)
                        .setColor('#10b981')
                        .addFields({ name: '⚡ Status', value: `✅ **ROLES REMOVED** by Owner (<@${interaction.user.id}>)`, inline: false });

                    await interaction.editReply({
                        embeds: [updatedEmbed],
                        components: []
                    });
                } else {
                    const originalEmbed = interaction.message.embeds[0];
                    const updatedEmbed = EmbedBuilder.from(originalEmbed)
                        .setColor('#6b7280')
                        .addFields({ name: '⚡ Status', value: `⚪ **DISMISSED** (Roles Kept) by Owner (<@${interaction.user.id}>)`, inline: false });

                    await interaction.editReply({
                        embeds: [updatedEmbed],
                        components: []
                    });
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
              .setDescription(`**• Premium Feature Discovered** \n> You **must** be a **Premium** user to use this command!\n**• Access**\n> Contact server administration to unlock premium features.`)
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