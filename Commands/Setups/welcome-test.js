const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const { sendWelcomeMessage } = require("../../Events/Others/welcome");
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("welcome-test")
        .setDescription("Send a test welcome embed to the configured welcome channel")
        .setDMPermission(false)
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("Optional member to test welcome for (defaults to you)")
                .setRequired(false)
        ),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        const staffRoleId = process.env.CLAN_STAFF_ROLE_ID || "1553810081915600946";
        const isStaff =
            interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
            interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
            interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            interaction.member.roles.cache.has(staffRoleId) ||
            interaction.user.id === interaction.guild.ownerId ||
            interaction.user.id === process.env.developerId;

        if (!isStaff) {
            return await interaction.reply({
                content: "❌ You do not have permission to test welcome messages.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const data = await WelcomeMessage.findOne({ guildId: interaction.guild.id }).catch(() => null);
        const channelId = data?.channelId || "1554194442662051900";

        const optUser = interaction.options.getUser("user");
        const targetMember = optUser
            ? (interaction.guild.members.cache.get(optUser.id) || await interaction.guild.members.fetch(optUser.id).catch(() => interaction.member))
            : interaction.member;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const res = await sendWelcomeMessage(targetMember, channelId);

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
