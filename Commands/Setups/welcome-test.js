const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const { sendWelcomeMessage } = require("../../Events/Others/welcome");
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("welcome-test")
        .setDescription("Send a test welcome embed to the configured welcome channel")
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        const isAdmin =
            interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
            interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            interaction.user.id === interaction.guild.ownerId ||
            interaction.user.id === process.env.developerId;

        if (!isAdmin) {
            return await interaction.reply({
                content: "❌ You do not have permission to test welcome messages.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const data = await WelcomeMessage.findOne({ guildId: interaction.guild.id });
        if (!data || !data.channelId) {
            return await interaction.reply({
                content: "⚠️ No welcome channel configured yet! Please run `/welcome channel: #channel` first.",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const res = await sendWelcomeMessage(interaction.member, data.channelId);

        if (res.success) {
            await interaction.editReply({
                content: `✅ Test welcome message sent to <#${data.channelId}>!`,
            });
        } else {
            await interaction.editReply({
                content: `❌ Could not send test welcome message: ${res.error || "Unknown error"}`,
            });
        }
    },
};
