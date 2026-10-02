const OAuthMember = require('../Schemas/oauthMemberSchema');
const VerificationSchema = require('../Schemas/verificationSchema');
const OAuthVerify = require('../Schemas/oauthVerifySchema');
const VerifyUsers = require('../Schemas/verifyusers');
const { validateAndRefreshToken } = require('../Web/oauthHelper');
const { EmbedBuilder } = require('discord.js');

// In-memory cache for validated users to prevent rate limiting (valid for 10 minutes)
const authValidationCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Gets the configured verified role ID for a guild
 */
async function getVerifiedRoleId(guild, client) {
    if (!guild) return null;

    // 1. VerificationSchema (/verify-config)
    try {
        const capConfig = await VerificationSchema.findOne({ Guild: guild.id });
        if (capConfig && capConfig.Role && guild.roles.cache.has(capConfig.Role)) {
            return capConfig.Role;
        }
    } catch (e) {}

    // 2. OAuthVerify schema (/setup verify)
    try {
        const verifyConfig = await OAuthVerify.findOne({ guildId: guild.id, enabled: true });
        if (verifyConfig && verifyConfig.roleId && guild.roles.cache.has(verifyConfig.roleId)) {
            return verifyConfig.roleId;
        }
    } catch (e) {}

    // 3. client.config or environment variable
    if (client?.config?.clanManager?.verifiedRoleId && guild.roles.cache.has(client.config.clanManager.verifiedRoleId)) {
        return client.config.clanManager.verifiedRoleId;
    }
    if (process.env.VERIFIED_ROLE_ID && guild.roles.cache.has(process.env.VERIFIED_ROLE_ID)) {
        return process.env.VERIFIED_ROLE_ID;
    }

    // 4. Role named "Verified" or "member"
    const found = guild.roles.cache.find(r => 
        r.name.toLowerCase() === 'verified' || r.name.toLowerCase() === 'member'
    );
    return found ? found.id : null;
}

/**
 * Checks if a user is actively authorized with the bot.
 * Tests tokens and marks/cleans up deauthorizations.
 * @param {string} userId 
 * @param {boolean} forceCheck 
 * @returns {Promise<{ authorized: boolean, reason?: string }>}
 */
async function checkUserAuthorization(userId, forceCheck = false) {
    const cached = authValidationCache.get(userId);
    if (!forceCheck && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.result;
    }

    const oauthDoc = await OAuthMember.findOne({ userId });
    if (!oauthDoc) {
        const result = { authorized: false, reason: 'NOT_FOUND_IN_DB' };
        authValidationCache.set(userId, { result, timestamp: Date.now() });
        return result;
    }

    const val = await validateAndRefreshToken(oauthDoc);
    if (val.deauthorized) {
        // Clean up from MongoDB
        await OAuthMember.deleteOne({ userId }).catch(() => {});
        await VerificationSchema.updateMany({}, { $pull: { Verified: userId } }).catch(() => {});
        await VerifyUsers.deleteMany({ User: userId }).catch(() => {});

        const result = { authorized: false, reason: 'DEAUTHORIZED' };
        authValidationCache.set(userId, { result, timestamp: Date.now() });
        return result;
    }

    const result = { authorized: true };
    authValidationCache.set(userId, { result, timestamp: Date.now() });
    return result;
}

/**
 * Revokes the verified role from a user across all servers because they deauthorized the bot.
 */
async function revokeVerification(client, userId, reason = 'Deauthorized bot') {
    authValidationCache.set(userId, { result: { authorized: false, reason: 'REVOKED' }, timestamp: Date.now() });

    // Clean databases
    await OAuthMember.deleteOne({ userId }).catch(() => {});
    await VerificationSchema.updateMany({}, { $pull: { Verified: userId } }).catch(() => {});
    await VerifyUsers.deleteMany({ User: userId }).catch(() => {});

    for (const guild of client.guilds.cache.values()) {
        try {
            const roleId = await getVerifiedRoleId(guild, client);
            if (!roleId) continue;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member || !member.roles.cache.has(roleId)) continue;

            // Remove verified role
            await member.roles.remove(roleId, `[DEAUTH GUARD] ${reason}`);
            console.log(`[DEAUTH GUARD] Revoked verified role <@&${roleId}> from ${member.user.tag} (${userId}) in ${guild.name}`);

            // Send DM to the member to notify them
            try {
                await member.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🔒 Verification Revoked')
                            .setColor('#ff3333')
                            .setDescription(
                                `Your **Verified** status in **${guild.name}** was revoked because you deauthorized the bot in Discord settings.\n\n` +
                                `To regain access, please re-verify and authorize the bot inside the server.`
                            )
                            .setFooter({ text: 'Strikers Security & OAuth2 Guard' })
                            .setTimestamp()
                    ]
                });
            } catch (dmErr) {}

            // Send log to guild log channel if configured
            const logChannelId = client.config?.logchannel || client.config?.clanManager?.logChannelId;
            const logChannel = logChannelId ? guild.channels.cache.get(logChannelId) : null;
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Verified Role Revoked (Bot Deauthorized)')
                    .setColor('#ff3333')
                    .setDescription(
                        `**Member:** <@${userId}> (${member.user.tag})\n` +
                        `**Reason:** ${reason}\n` +
                        `**Action Taken:** <@&${roleId}> role removed automatically.`
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        } catch (e) {
            console.error(`[DEAUTH GUARD] Error revoking for user ${userId} in ${guild.id}:`, e.message);
        }
    }
}

/**
 * Audits all verified members in a guild and strips roles from anyone not authorized.
 */
async function auditGuildVerifiedMembers(guild, client) {
    if (!guild) return { totalVerified: 0, revokedCount: 0, revokedUsers: [] };

    const roleId = await getVerifiedRoleId(guild, client);
    if (!roleId) return { totalVerified: 0, revokedCount: 0, revokedUsers: [], error: 'No verified role configured' };

    let allMembers;
    try {
        allMembers = await guild.members.fetch();
    } catch (e) {
        allMembers = guild.members.cache;
    }

    const verifiedMembers = allMembers.filter(m => !m.user.bot && m.roles.cache.has(roleId));
    let revokedCount = 0;
    const revokedUsers = [];

    for (const member of verifiedMembers.values()) {
        const auth = await checkUserAuthorization(member.id, true);
        if (!auth.authorized) {
            try {
                await member.roles.remove(roleId, `[DEAUTH GUARD AUDIT] ${auth.reason}`);
                await VerificationSchema.updateOne({ Guild: guild.id }, { $pull: { Verified: member.id } }).catch(() => {});
                revokedCount++;
                revokedUsers.push({ id: member.id, tag: member.user.tag, reason: auth.reason });
                console.log(`[AUDIT] Removed verified role from unauthorized member ${member.user.tag} (${member.id}) - Reason: ${auth.reason}`);
            } catch (err) {
                console.error(`[AUDIT] Failed to remove role from ${member.id}:`, err.message);
            }
        }
    }

    return {
        totalVerified: verifiedMembers.size,
        validCount: verifiedMembers.size - revokedCount,
        revokedCount,
        revokedUsers,
        roleId
    };
}

module.exports = {
    getVerifiedRoleId,
    checkUserAuthorization,
    revokeVerification,
    auditGuildVerifiedMembers,
    authValidationCache
};
