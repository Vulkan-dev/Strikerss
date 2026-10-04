const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getVerifiedRoleId, checkUserAuthorization, hasSimulationGrace } = require('../../Utils/oauthDeauthGuard');
const { isGuildActivated } = require('../../Utils/guildActivation');
const { assignUnverifiedRole, removeUnverifiedRole } = require('../../Utils/roleGuard');
const NameHistory = require('../../Schemas/nameHistorySchema');

const JUNIOR_STRIKERS_ROLE_ID = "1554580536159244338";
const STRIKERS_ROLE_ID = "1554580532363403357";
const OWNER_DISCORD_ID = "1127146188701970442";
const CLAN_MONIKER_PREFIX = "-͟͟͞ 𝐒𝐓𝐑 乂";
const monikerWarnCooldowns = new Map();

module.exports = {
    name: Events.GuildMemberUpdate,

    async execute(oldMember, newMember, client) {
        if (!newMember || !newMember.guild || newMember.user.bot) return;

        // ------------------------------------------------------------------
        // Feature A: Name History Tracking (Blame Bot Unique Feature)
        // ------------------------------------------------------------------
        try {
            if (oldMember.displayName !== newMember.displayName) {
                await NameHistory.create({
                    guildId: newMember.guild.id,
                    userId: newMember.id,
                    oldName: oldMember.displayName,
                    newName: newMember.displayName,
                    type: 'nickname',
                    timestamp: new Date()
                }).catch(() => null);
            }
        } catch (nhErr) {}

        // ------------------------------------------------------------------
        // Feature B: Strikers Moniker Enforcer Monitor
        // ------------------------------------------------------------------
        try {
            const hasJunior = newMember.roles.cache.has(JUNIOR_STRIKERS_ROLE_ID);
            const hasStriker = newMember.roles.cache.has(STRIKERS_ROLE_ID);

            if (hasJunior || hasStriker) {
                const currentName = newMember.displayName;
                const hasPrefix = currentName.includes(CLAN_MONIKER_PREFIX) || currentName.includes("𝐒𝐓𝐑 乂");

                if (!hasPrefix) {
                    const lastWarn = monikerWarnCooldowns.get(newMember.id) || 0;
                    const now = Date.now();

                    // Cooldown: 15 minutes between alerts per member
                    if (now - lastWarn > 15 * 60 * 1000) {
                        monikerWarnCooldowns.set(newMember.id, now);
                        console.warn(`[MONIKER ENFORCER] ${newMember.user.tag} (${newMember.id}) is missing clan prefix: ${CLAN_MONIKER_PREFIX}`);

                        // 1. Send warning DM to the member
                        try {
                            const warnEmbed = new EmbedBuilder()
                                .setTitle('⚠️ STRIKERS Moniker Required')
                                .setColor('#ef4444')
                                .setDescription(
                                    `Hello <@${newMember.id}>,\n\n` +
                                    `You currently hold an official **Strikers** role in **${newMember.guild.name}**, but your server nickname is missing the required clan moniker:\n` +
                                    `>>> **\`${CLAN_MONIKER_PREFIX}\`**\n\n` +
                                    `Please update your server nickname immediately to include **\`${CLAN_MONIKER_PREFIX}\`** so you can keep your role.`
                                )
                                .setFooter({ text: 'STRIKERS Clan Moniker Enforcer' })
                                .setTimestamp();

                            await newMember.send({ embeds: [warnEmbed] }).catch(() => null);
                        } catch (dmErr) {}

                        // 2. Send Action DM to Owner (1127146188701970442) with Role Removal Button
                        try {
                            const owner = await client.users.fetch(OWNER_DISCORD_ID).catch(() => null);
                            if (owner) {
                                const heldRoles = [];
                                if (hasStriker) heldRoles.push(`<@&${STRIKERS_ROLE_ID}> (\`Strikers\`)`);
                                if (hasJunior) heldRoles.push(`<@&${JUNIOR_STRIKERS_ROLE_ID}> (\`Junior Strikers\`)`);

                                const alertEmbed = new EmbedBuilder()
                                    .setTitle('🚨 Striker Moniker Missing / Removed')
                                    .setColor('#ef4444')
                                    .setDescription(`Member <@${newMember.id}> does not have the mandatory **\`${CLAN_MONIKER_PREFIX}\`** moniker in their nickname!`)
                                    .addFields(
                                        { name: '👤 Member', value: `<@${newMember.id}> (\`${newMember.user.tag}\` / \`${newMember.id}\`)`, inline: false },
                                        { name: '📛 Current Display Name', value: `\`${currentName}\``, inline: true },
                                        { name: '🎭 Assigned Roles', value: heldRoles.join(', '), inline: true },
                                        { name: '🌐 Server', value: `${newMember.guild.name} (\`${newMember.guild.id}\`)`, inline: false }
                                    )
                                    .setFooter({ text: 'STRIKERS Moniker Enforcer • Action Required' })
                                    .setTimestamp();

                                const actionRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`strip_striker_roles_${newMember.guild.id}_${newMember.id}`)
                                        .setLabel('Remove Striker Roles')
                                        .setStyle(ButtonStyle.Danger),
                                    new ButtonBuilder()
                                        .setCustomId(`dismiss_striker_violation_${newMember.guild.id}_${newMember.id}`)
                                        .setLabel('Keep Roles (Dismiss)')
                                        .setStyle(ButtonStyle.Secondary)
                                );

                                await owner.send({ embeds: [alertEmbed], components: [actionRow] }).catch(() => null);
                            }
                        } catch (ownerDmErr) {
                            console.error('[MONIKER ENFORCER OWNER DM ERROR]', ownerDmErr);
                        }
                    }
                } else {
                    // Prefix was restored! Clear cooldown
                    monikerWarnCooldowns.delete(newMember.id);
                }
            }
        } catch (monErr) {
            console.error('[MONIKER ENFORCER ERROR]', monErr);
        }

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
