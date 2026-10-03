const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const VerificationSchema = require('../../Schemas/verificationSchema');
const OAuthVerify = require('../../Schemas/oauthVerifySchema');
const { transitionToVerified } = require('../../Utils/roleGuard');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('clan_approve_') && !interaction.customId.startsWith('clan_reject_')) return;

        // Skip buttons that are already marked as processed
        if (interaction.customId.includes('_done_')) return;

        try {
            if (!interaction.guild) {
                return await interaction.reply({
                    content: 'This button can only be used inside a server.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const staffRoleId = client.config.clanManager?.staffRoleId || process.env.CLAN_STAFF_ROLE_ID;
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                (staffRoleId && interaction.member.roles.cache.has(staffRoleId));

            if (!isStaff) {
                return await interaction.reply({
                    content: '❌ **Access Denied:** Only clan staff and administrators can approve or reject applications.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const isApprove = interaction.customId.startsWith('clan_approve_');
            const targetUserId = interaction.customId.replace('clan_approve_', '').replace('clan_reject_', '').trim();

            await interaction.deferUpdate();

            const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);

            // Fetch and clone original message embed
            const originalEmbed = interaction.message.embeds[0];
            const updatedEmbed = originalEmbed ? EmbedBuilder.from(originalEmbed) : new EmbedBuilder().setTitle("Application Review");

            // Disabled Buttons after decision
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`clan_approve_done_${targetUserId}`)
                    .setLabel(isApprove ? "Approved ✓" : "Approve")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("✅")
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`clan_reject_done_${targetUserId}`)
                    .setLabel(!isApprove ? "Rejected ✕" : "Reject")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("❌")
                    .setDisabled(true)
            );

            if (isApprove) {
                updatedEmbed
                    .setColor(0x10b981)
                    .addFields({
                        name: "✅ Staff Review Decision",
                        value: `**Approved** by <@${interaction.user.id}> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
                        inline: false
                    });

                // Find Verified role to grant
                let targetRoleId = null;
                const capConfig = await VerificationSchema.findOne({ Guild: interaction.guild.id });
                if (capConfig && capConfig.Role) targetRoleId = capConfig.Role;
                if (!targetRoleId) {
                    const oauthCfg = await OAuthVerify.findOne({ guildId: interaction.guild.id, enabled: true });
                    if (oauthCfg?.roleId) targetRoleId = oauthCfg.roleId;
                }
                if (!targetRoleId) {
                    targetRoleId = client.config.clanManager?.verifiedRoleId || process.env.VERIFIED_ROLE_ID;
                }
                if (!targetRoleId) {
                    const foundRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified' || r.name.toLowerCase() === 'member');
                    if (foundRole) targetRoleId = foundRole.id;
                }

                if (member && targetRoleId) {
                    await transitionToVerified(member, targetRoleId);
                }

                await interaction.editReply({
                    embeds: [updatedEmbed],
                    components: [disabledRow]
                });

                await interaction.channel.send({
                    content: `🎉 <@${targetUserId}> **Congratulations!** Your clan application has been **APPROVED** by <@${interaction.user.id}>. Your verified role has been assigned!`
                });

                console.log(`[CLAN REVIEW] Applicant ${targetUserId} approved by staff ${interaction.user.tag}`);

            } else {
                updatedEmbed
                    .setColor(0xef4444)
                    .addFields({
                        name: "❌ Staff Review Decision",
                        value: `**Rejected** by <@${interaction.user.id}> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
                        inline: false
                    });

                await interaction.editReply({
                    embeds: [updatedEmbed],
                    components: [disabledRow]
                });

                await interaction.channel.send({
                    content: `⚠️ <@${targetUserId}> Your clan application has been reviewed and **REJECTED** by clan staff.`
                });

                console.log(`[CLAN REVIEW] Applicant ${targetUserId} rejected by staff ${interaction.user.tag}`);
            }

        } catch (error) {
            console.error('[CLAN_APP_BUTTON_ERROR]', error);
        }
    }
};
