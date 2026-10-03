const { Events } = require('discord.js');
const { isGuildActivated } = require('../../Utils/guildActivation');
const { checkUserAuthorization, getVerifiedRoleId } = require('../../Utils/oauthDeauthGuard');
const { assignUnverifiedRole, transitionToVerified, transitionToUnverified } = require('../../Utils/roleGuard');

module.exports = {
    name: Events.GuildMemberAdd,

    /**
     * Automatically handles Unverified / Verified role assignment when a member joins.
     * @param {import('discord.js').GuildMember} member 
     * @param {import('discord.js').Client} client 
     */
    async execute(member, client) {
        if (!member || !member.guild || member.user.bot) return;

        try {
            // Check guild activation
            const active = await isGuildActivated(member.guild.id);
            if (!active) return;

            const verifiedRoleId = await getVerifiedRoleId(member.guild, client);

            // Check if member already has valid OAuth authorization in DB
            const auth = await checkUserAuthorization(member.id);

            if (auth.authorized && verifiedRoleId) {
                console.log(`[MEMBER JOIN] Returning verified member ${member.user.tag} (${member.id}) detected. Restoring Verified role.`);
                await transitionToVerified(member, verifiedRoleId);
            } else {
                console.log(`[MEMBER JOIN] New/Unverified member ${member.user.tag} (${member.id}) joined. Assigning Unverified role.`);
                if (verifiedRoleId && member.roles.cache.has(verifiedRoleId)) {
                    await transitionToUnverified(member, verifiedRoleId, 'Member joined without active OAuth authorization');
                } else {
                    await assignUnverifiedRole(member, 'Auto-assigned Unverified role upon joining');
                }
            }
        } catch (error) {
            console.error(`[MEMBER JOIN GUARD ERROR] Error processing member ${member.id}:`, error);
        }
    }
};
