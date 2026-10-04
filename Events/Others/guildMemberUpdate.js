const { Events, EmbedBuilder } = require('discord.js');
const { getVerifiedRoleId, checkUserAuthorization, hasSimulationGrace } = require('../../Utils/oauthDeauthGuard');
const { isGuildActivated } = require('../../Utils/guildActivation');
const { assignUnverifiedRole, removeUnverifiedRole } = require('../../Utils/roleGuard');

module.exports = {
    name: Events.GuildMemberUpdate,

    async execute(oldMember, newMember, client) {
        if (!newMember || !newMember.guild || newMember.user.bot) return;

        try {
            // Check guild activation
            const active = await isGuildActivated(newMember.guild.id);
            if (!active) return;

            const verifiedRoleId = await getVerifiedRoleId(newMember.guild, client);
            if (!verifiedRoleId) return;

            const hadRole = oldMember.roles.cache.has(verifiedRoleId);
            const hasRole = newMember.roles.cache.has(verifiedRoleId);

            // 1. If Verified role was manually removed or lost by member:
            // "if someone manually take role of verified that immediately assign unverified as fast as you can"
            if (hadRole && !hasRole) {
                console.log(`[VERIFY GUARD] Verified role was removed from ${newMember.user.tag} (${newMember.id}). Instantly assigning Unverified role.`);
                await assignUnverifiedRole(newMember, 'Verified role was removed -> Instantly assigned Unverified');
                return;
            }

            // 2. If Verified role was newly added to this member:
            if (!hadRole && hasRole) {
                // If member has active simulation grace, allow them time to complete bot authorization
                if (hasSimulationGrace(newMember.id)) {
                    console.log(`[SIMULATION GUARD] ${newMember.user.tag} (${newMember.id}) has active simulation grace. Skipping immediate revocation.`);
                    await removeUnverifiedRole(newMember, 'Simulation active -> Removed Unverified role');
                    return;
                }

                // Force check OAuth authorization (no cache delay)
                const auth = await checkUserAuthorization(newMember.id, true);

                if (!auth.authorized) {
                    console.warn(`[DEAUTH GUARD] Blocked unauthorized Verified role on ${newMember.user.tag} (${newMember.id}) - Reason: ${auth.reason}`);

                    // Strip Verified role immediately
                    await newMember.roles.remove(
                        verifiedRoleId,
                        '[DEAUTH GUARD] Verified role requires active bot OAuth2 authorization.'
                    ).catch(() => {});

                    // Immediately assign Unverified role
                    await assignUnverifiedRole(
                        newMember,
                        '[DEAUTH GUARD] User not authorized with OAuth2 -> Assigned Unverified role.'
                    );

                    // Send alert DM to user
                    try {
                        await newMember.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('🔒 Verification Required')
                                    .setColor('#ff3333')
                                    .setDescription(
                                        `You were given the **Verified** role in **${newMember.guild.name}**, but you have **not authorized with the bot**.\n\n` +
                                        `The verified role is strictly reserved for users authorized through the verification portal.\n\n` +
                                        `👉 Please visit the server's verification channel, complete the captcha, and click **Authorize with Discord** to get verified!`
                                    )
                                    .setFooter({ text: 'Strikers Security & OAuth2 Guard' })
                                    .setTimestamp()
                            ]
                        });
                    } catch (dmErr) {}

                    // Log to server log channel
                    const logChannelId = client.config?.logchannel || client.config?.clanManager?.logChannelId;
                    const logChannel = logChannelId ? newMember.guild.channels.cache.get(logChannelId) : null;
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('🛡️ Unauthorized Verified Role Intercepted')
                            .setColor('#ffaa00')
                            .setDescription(
                                `**Member:** <@${newMember.id}> (${newMember.user.tag})\n` +
                                `**Action:** Role <@&${verifiedRoleId}> was revoked & Unverified role assigned.\n` +
                                `**Reason:** User is not authorized with the bot via OAuth2.`
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                    }
                } else {
                    // Valid authorized member got verified role: remove Unverified role
                    await removeUnverifiedRole(newMember, 'Verified role confirmed -> Removed Unverified');
                }
            }
        } catch (error) {
            console.error('[GUILD_MEMBER_UPDATE_GUARD_ERROR]', error);
        }
    }
};
