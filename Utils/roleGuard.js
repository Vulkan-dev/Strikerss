const { PermissionsBitField } = require('discord.js');
const VerificationSchema = require('../Schemas/verificationSchema');

/**
 * Finds or creates the "Unverified" role in a guild.
 * @param {import('discord.js').Guild} guild 
 * @returns {Promise<import('discord.js').Role|null>}
 */
async function getOrCreateUnverifiedRole(guild) {
    if (!guild) return null;

    // 1. Check if configured in VerificationSchema
    try {
        const schema = await VerificationSchema.findOne({ Guild: guild.id });
        if (schema && schema.UnverifiedRole && guild.roles.cache.has(schema.UnverifiedRole)) {
            return guild.roles.cache.get(schema.UnverifiedRole);
        }
    } catch (e) {}

    // 2. Search guild roles for an existing role named "Unverified"
    let role = guild.roles.cache.find(r => r.name.toLowerCase() === 'unverified');
    if (role) return role;

    // 3. Auto-create "Unverified" role
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        console.warn(`[ROLE GUARD] Missing MANAGE_ROLES permission in guild: ${guild.name} (${guild.id})`);
        return null;
    }

    try {
        role = await guild.roles.create({
            name: 'Unverified',
            color: '#80848e',
            reason: 'Auto-created Unverified role for verification system',
            permissions: []
        });

        // Save to schema for fast lookups
        await VerificationSchema.updateOne(
            { Guild: guild.id },
            { $set: { UnverifiedRole: role.id } },
            { upsert: true }
        ).catch(() => {});

        console.log(`[ROLE GUARD] Successfully auto-created Unverified role (<@&${role.id}>) in ${guild.name}`);
        return role;
    } catch (err) {
        console.error(`[ROLE GUARD] Failed to auto-create Unverified role in ${guild.name}:`, err.message);
        return null;
    }
}

/**
 * Assigns the Unverified role to a member.
 * @param {import('discord.js').GuildMember} member 
 * @param {string} reason 
 */
async function assignUnverifiedRole(member, reason = 'Assigned Unverified role') {
    if (!member || !member.guild || member.user.bot) return null;

    try {
        const unverifiedRole = await getOrCreateUnverifiedRole(member.guild);
        if (!unverifiedRole) return null;

        if (!member.roles.cache.has(unverifiedRole.id)) {
            await member.roles.add(unverifiedRole.id, reason);
            console.log(`[ROLE GUARD] Assigned Unverified role to ${member.user.tag} in ${member.guild.name} (${reason})`);
        }
        return unverifiedRole;
    } catch (err) {
        console.error(`[ROLE GUARD] Error assigning Unverified role to ${member.id}:`, err.message);
        return null;
    }
}

/**
 * Removes the Unverified role from a member.
 * @param {import('discord.js').GuildMember} member 
 * @param {string} reason 
 */
async function removeUnverifiedRole(member, reason = 'Removed Unverified role') {
    if (!member || !member.guild || member.user.bot) return;

    try {
        // Find by schema or role name
        let unverifiedRole = member.guild.roles.cache.find(r => r.name.toLowerCase() === 'unverified');
        if (!unverifiedRole) {
            const schema = await VerificationSchema.findOne({ Guild: member.guild.id });
            if (schema && schema.UnverifiedRole) {
                unverifiedRole = member.guild.roles.cache.get(schema.UnverifiedRole);
            }
        }

        if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            await member.roles.remove(unverifiedRole.id, reason);
            console.log(`[ROLE GUARD] Removed Unverified role from ${member.user.tag} in ${member.guild.name}`);
        }
    } catch (err) {
        console.error(`[ROLE GUARD] Error removing Unverified role from ${member.id}:`, err.message);
    }
}

/**
 * Transitions a member to Verified state:
 * - Adds the Verified role
 * - Removes the Unverified role
 * @param {import('discord.js').GuildMember} member 
 * @param {string} verifiedRoleId 
 */
async function transitionToVerified(member, verifiedRoleId) {
    if (!member || !member.guild || member.user.bot) return;

    try {
        if (verifiedRoleId && !member.roles.cache.has(verifiedRoleId)) {
            await member.roles.add(verifiedRoleId, '[VERIFY] Verification completed.');
        }
        await removeUnverifiedRole(member, '[VERIFY] Completed verification.');
    } catch (err) {
        console.error(`[ROLE GUARD] Error in transitionToVerified for ${member.id}:`, err.message);
    }
}

/**
 * Transitions a member to Unverified state:
 * - Strips the Verified role
 * - Immediately assigns the Unverified role
 * @param {import('discord.js').GuildMember} member 
 * @param {string} verifiedRoleId 
 * @param {string} reason 
 */
async function transitionToUnverified(member, verifiedRoleId, reason = 'User is unverified') {
    if (!member || !member.guild || member.user.bot) return;

    try {
        if (verifiedRoleId && member.roles.cache.has(verifiedRoleId)) {
            await member.roles.remove(verifiedRoleId, `[ROLE GUARD] ${reason}`);
        }
        await assignUnverifiedRole(member, `[ROLE GUARD] ${reason}`);
    } catch (err) {
        console.error(`[ROLE GUARD] Error in transitionToUnverified for ${member.id}:`, err.message);
    }
}

module.exports = {
    getOrCreateUnverifiedRole,
    assignUnverifiedRole,
    removeUnverifiedRole,
    transitionToVerified,
    transitionToUnverified,
};
