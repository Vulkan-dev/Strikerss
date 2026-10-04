const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    ChannelType,
    MessageFlags
} = require("discord.js");
const GoodbyeMessage = require("../../Schemas/goodbyeMessageSchema");
const { sendGoodbyeMessage } = require("../../Events/Others/goodbye");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("goodbye")
        .setDescription("Configure and customize the leave/goodbye system for your server")
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("Configure or update the leave/goodbye message and channel")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("Channel where goodbye messages will be sent")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
                .addStringOption((option) =>
                    option
                        .setName("message")
                        .setDescription("Leave text (Default: {user} Leave coz he was not worthy to be Strikers)")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("title")
                        .setDescription("Title of the goodbye embed")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("color")
                        .setDescription("Embed hex color code (e.g., #ef4444 or #000000)")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("footer")
                        .setDescription("Footer text at bottom of embed")
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("view")
                .setDescription("View the current goodbye message configuration")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("test")
                .setDescription("Send a live test goodbye embed to verify the setup")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("disable")
                .setDescription("Disable the goodbye message system in this server")
        ),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        const isAdmin =
            interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
            interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            interaction.user.id === interaction.guild.ownerId ||
            interaction.user.id === "1127146188701970442";

        if (!isAdmin) {
            return await interaction.reply({
                content: "You do not have permission to manage the goodbye system.",
                flags: MessageFlags.Ephemeral
            });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === "setup") {
            const channel = interaction.options.getChannel("channel");
            const message = interaction.options.getString("message") || "{user} Leave coz he was not worthy to be Strikers";
            const title = interaction.options.getString("title") || "Member Departed";
            const color = interaction.options.getString("color") || "#ef4444";
            const footer = interaction.options.getString("footer") || "STRIKERS Squad Roster Update";

            await GoodbyeMessage.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    channelId: channel.id,
                    message: message,
                    title: title,
                    color: color,
                    footer: footer,
                    enabled: true
                },
                { upsert: true, new: true }
            );

            const successEmbed = new EmbedBuilder()
                .setTitle("✅ Goodbye System Configured")
                .setColor("#34d399")
                .setDescription(
                    `Goodbye notifications will now be dispatched to ${channel}.\n\n` +
                    `**Message Pattern:**\n\`\`\`${message}\`\`\``
                )
                .addFields(
                    { name: "Channel", value: `<#${channel.id}>`, inline: true },
                    { name: "Title", value: `\`${title}\``, inline: true },
                    { name: "Color", value: `\`${color}\``, inline: true }
                )
                .setFooter({ text: "Use /goodbye test to preview live message" })
                .setTimestamp();

            return await interaction.reply({ embeds: [successEmbed] });
        }

        if (sub === "view") {
            const current = await GoodbyeMessage.findOne({ guildId: interaction.guild.id });
            if (!current || !current.channelId) {
                return await interaction.reply({
                    content: "No goodbye system has been configured yet. Run `/goodbye setup` to get started.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const viewEmbed = new EmbedBuilder()
                .setTitle("⚙️ Goodbye System Configuration")
                .setColor(current.color || "#ef4444")
                .addFields(
                    { name: "Status", value: current.enabled ? "🟢 Enabled" : "🔴 Disabled", inline: true },
                    { name: "Channel", value: `<#${current.channelId}>`, inline: true },
                    { name: "Title", value: `\`${current.title || "Member Departed"}\``, inline: true },
                    { name: "Message Pattern", value: `\`\`\`${current.message || "{user} Leave coz he was not worthy to be Strikers"}\`\`\``, inline: false },
                    { name: "Footer", value: `\`${current.footer || "STRIKERS Squad Roster Update"}\``, inline: false }
                )
                .setTimestamp();

            return await interaction.reply({ embeds: [viewEmbed] });
        }

        if (sub === "test") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const result = await sendGoodbyeMessage(interaction.member);

            if (result.success) {
                return await interaction.editReply({
                    content: "✅ Live test goodbye message dispatched successfully to the configured channel!"
                });
            } else {
                return await interaction.editReply({
                    content: `⚠️ Failed to send test goodbye message: \`${result.error}\``
                });
            }
        }

        if (sub === "disable") {
            await GoodbyeMessage.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { enabled: false }
            );

            return await interaction.reply({
                content: "🔴 Goodbye message system has been disabled for this server.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
