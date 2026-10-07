const {
    SlashCommandBuilder,
    PermissionsBitField,
    MessageFlags,
    ChannelType
} = require("discord.js");
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");
const { sendWelcomeMessage } = require("../../Events/Others/welcome");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("welcome")
        .setDescription("Welcome a member to the STRIKERS squad with the official welcome embed")
        .setDMPermission(false)
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The member to welcome (@user)")
                .setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Channel to send the welcome embed to (defaults to #welcome)")
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        ),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        // Permissions: allow admins, staff with ManageMessages, ManageGuild, Strikers Staff role, or server owner / bot dev
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
                content: "❌ You **do not** have permission to send welcome messages.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const targetUser = interaction.options.getUser("user");
        const customChannel = interaction.options.getChannel("channel");

        const targetMember = interaction.guild.members.cache.get(targetUser.id)
            || await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return await interaction.reply({
                content: `❌ Could not find member **${targetUser.tag || targetUser.username}** in this server.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let channelId = customChannel ? customChannel.id : null;
        if (!channelId) {
            const welcomeData = await WelcomeMessage.findOne({ guildId: interaction.guild.id }).catch(() => null);
            channelId = welcomeData?.channelId || "1554194442662051900";
        }

        const res = await sendWelcomeMessage(targetMember, channelId);

        if (res.success) {
            await interaction.editReply({
                content: `✅ Successfully welcomed **${targetMember.user.tag || targetMember.user.username}** in <#${channelId}>!`,
            });
        } else {
            await interaction.editReply({
                content: `❌ Failed to send welcome message: ${res.error || "Unknown error"}`,
            });
        }
    }
};
