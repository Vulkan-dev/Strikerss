const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    ChannelType,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");
const { sendWelcomeMessage } = require("../../Events/Others/welcome");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("welcome")
        .setDescription("Configure the welcome message channel and system")
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Channel where welcome messages will be sent")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        ),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        const isAdmin =
            interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
            interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            interaction.user.id === interaction.guild.ownerId ||
            interaction.user.id === process.env.developerId;

        if (!isAdmin) {
            return await interaction.reply({
                content: "❌ You **do not** have permission to configure welcome messages.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const channel = interaction.options.getChannel("channel");
        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (botMember) {
            const perms = channel.permissionsFor(botMember);
            if (perms) {
                const missing = [];
                if (!perms.has(PermissionsBitField.Flags.ViewChannel)) missing.push("View Channel");
                if (!perms.has(PermissionsBitField.Flags.SendMessages)) missing.push("Send Messages");
                if (!perms.has(PermissionsBitField.Flags.EmbedLinks)) missing.push("Embed Links");
                if (!perms.has(PermissionsBitField.Flags.AttachFiles)) missing.push("Attach Files");

                if (missing.length > 0) {
                    return await interaction.reply({
                        content: `⚠️ The bot is missing required permissions in ${channel}: **${missing.join(", ")}**.\nPlease adjust channel permissions so welcome embeds can be sent.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        }

        await WelcomeMessage.findOneAndUpdate(
            { guildId: interaction.guild.id },
            {
                guildId: interaction.guild.id,
                channelId: channel.id,
                isEmbed: true,
                isImage: false,
                color: "#FFFFFF",
                footer: "FIGHT TOGETHER • WIN TOGETHER",
                message: "**Welcome, {user}.**\n\n**You’re now part of the STRIKERS squad.**\n\n**Stay sharp. Trust your team. Make your mark.**",
            },
            { upsert: true, new: true }
        );

        const embed = new EmbedBuilder()
            .setTitle("⚡ Strikers Welcome System Configured")
            .setColor("#00f5d4")
            .setDescription(`Welcome messages have been successfully activated! New members will receive the **STRIKERS squad** welcome embed in ${channel}.`)
            .addFields(
                { name: "Target Channel", value: `${channel}`, inline: true },
                { name: "Layout", value: "Squad Embed + 1234.gif", inline: true },
                { name: "Footer", value: "FIGHT TOGETHER • WIN TOGETHER", inline: true }
            )
            .setFooter({ text: "Strikers Member Onboarding System" })
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`test_welcome_btn_${channel.id}`)
                .setLabel("Send Test Welcome")
                .setEmoji("🧪")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("disable_welcome_btn")
                .setLabel("Disable Welcome")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Danger)
        );

        const replyMsg = await interaction.reply({
            embeds: [embed],
            components: [buttons],
            withResponse: true,
        });

        const collector = replyMsg.resource?.message?.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60000,
        });

        if (collector) {
            collector.on("collect", async (i) => {
                if (i.customId.startsWith("test_welcome_btn")) {
                    await i.deferReply({ flags: MessageFlags.Ephemeral });
                    const res = await sendWelcomeMessage(interaction.member, channel.id);
                    if (res.success) {
                        await i.editReply({ content: `✅ Test welcome message sent to ${channel}! Go check it out.` });
                    } else {
                        await i.editReply({ content: `❌ Failed to send test welcome: ${res.error || "Unknown error"}` });
                    }
                } else if (i.customId === "disable_welcome_btn") {
                    await WelcomeMessage.deleteOne({ guildId: interaction.guild.id });
                    await i.reply({ content: `🗑️ Welcome system has been disabled for this server.`, flags: MessageFlags.Ephemeral });
                }
            });
        }
    },
};
