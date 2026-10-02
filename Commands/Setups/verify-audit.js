const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");
const { auditGuildVerifiedMembers, sweepDeauthorizedOAuthMembers } = require("../../Utils/oauthDeauthGuard");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verify-audit")
        .setDescription("Audit all verified members and revoke roles from anyone who deauthorized the bot")
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        const isAdmin =
            interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
            interaction.user.id === interaction.guild.ownerId ||
            interaction.user.id === process.env.developerId;

        if (!isAdmin) {
            return await interaction.reply({
                content: "❌ You **do not** have permission to run the verification audit.",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();

        const progressEmbed = new EmbedBuilder()
            .setTitle("🔍 Running OAuth2 Verification Audit...")
            .setColor("#00f5d4")
            .setDescription("Scanning all verified members in this server, testing tokens with Discord, and sweeping deauthorized database entries. Please wait a few moments...")
            .setFooter({ text: "Strikers OAuth2 Security & Deauth Guard" })
            .setTimestamp();

        await interaction.editReply({ embeds: [progressEmbed] });

        try {
            // 1. Sweep entire OAuthMember database
            const sweepResult = await sweepDeauthorizedOAuthMembers(client).catch(() => ({ deletedCount: 0 }));

            // 2. Audit current guild verified members
            const report = await auditGuildVerifiedMembers(interaction.guild, client);

            if (report.error) {
                return await interaction.editReply({
                    content: `⚠️ ${report.error}. Please configure the verification system using \`/verify-config\` first.`,
                    embeds: []
                });
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle("🛡️ Verification & OAuth2 Audit Report")
                .setColor((report.revokedCount > 0 || sweepResult.deletedCount > 0) ? "#ff9900" : "#00f5d4")
                .setDescription(
                    `Audit finished for **${interaction.guild.name}**.\n\n` +
                    `Members with verified role must have an active authorization with the bot. Anyone who deauthorized the bot has had their verified role revoked and database entry deleted.`
                )
                .addFields(
                    { name: "Verified Role", value: `<@&${report.roleId}>`, inline: true },
                    { name: "Server Verified Members", value: `${report.totalVerified}`, inline: true },
                    { name: "Authorized Members", value: `✅ ${report.validCount}`, inline: true },
                    { name: "Server Roles Revoked", value: `❌ ${report.revokedCount}`, inline: true },
                    { name: "Deauth DB Entries Deleted", value: `🗑️ ${sweepResult.deletedCount}`, inline: true }
                )
                .setFooter({ text: "Strikers OAuth2 Security Engine" })
                .setTimestamp();

            if (report.revokedUsers && report.revokedUsers.length > 0) {
                const names = report.revokedUsers.slice(0, 15).map(u => `• <@${u.id}> (${u.tag}) — \`${u.reason}\``).join("\n");
                const extra = report.revokedUsers.length > 15 ? `\n*...and ${report.revokedUsers.length - 15} more.*` : "";
                resultEmbed.addFields({
                    name: "Revoked Members (Deauthorized or Unlinked)",
                    value: names + extra
                });
            }

            await interaction.editReply({ embeds: [resultEmbed] });
        } catch (error) {
            console.error('[VERIFY_AUDIT_COMMAND_ERROR]', error);
            await interaction.editReply({
                content: `❌ An error occurred while running the audit: ${error.message}`,
                embeds: []
            });
        }
    }
};
