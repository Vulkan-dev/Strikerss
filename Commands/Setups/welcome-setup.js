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
        .setName("welcome-setup")
        .setDescription("Configure and customize the welcome system for your server")
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("Configure or update the welcome message and channel")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("Channel where welcome messages will be sent")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
                .addStringOption((option) =>
                    option
                        .setName("message")
                        .setDescription("Welcome text (use {user}, {server}, {members}, {username})")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("title")
                        .setDescription("Title of the welcome embed")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("image_url")
                        .setDescription("Custom Image or GIF URL (e.g., https://.../banner.gif)")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("color")
                        .setDescription("Embed hex color code (e.g., #00f5d4 or #FFFFFF)")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("footer")
                        .setDescription("Footer text at bottom of embed")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("thumbnail")
                        .setDescription("Type of thumbnail avatar to display")
                        .setRequired(false)
                        .addChoices(
                            { name: "None", value: "none" },
                            { name: "User Avatar", value: "user" },
                            { name: "Bot Avatar", value: "bot" },
                            { name: "Server Icon", value: "server" }
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("view")
                .setDescription("View the current welcome message configuration")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("test")
                .setDescription("Send a live test welcome embed to verify the setup")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("disable")
                .setDescription("Disable the welcome message system in this server")
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

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "setup") {
            const channel = interaction.options.getChannel("channel");
            const message = interaction.options.getString("message");
            const title = interaction.options.getString("title");
            const imageUrl = interaction.options.getString("image_url");
            const color = interaction.options.getString("color");
            const footer = interaction.options.getString("footer");
            const thumbnail = interaction.options.getString("thumbnail");

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

            // Existing configuration or defaults
            let current = await WelcomeMessage.findOne({ guildId: interaction.guild.id });

            const defaultDesc = "**Welcome, {user}.**\n\n**You’re now part of the STRIKERS squad.**\n\n**Stay sharp. Trust your team. Make your mark.**";
            const updatedMessage = message !== null ? message : (current?.message || defaultDesc);
            const updatedColor = color !== null ? color : (current?.color || "#FFFFFF");
            const updatedFooter = footer !== null ? footer : (current?.footer || "FIGHT TOGETHER • WIN TOGETHER");
            const updatedImage = imageUrl !== null ? imageUrl : (current?.image || "https://i.postimg.cc/d3XLkpHy/hmm.gif");
            const updatedTitle = title !== null ? title : (current?.title || null);
            const updatedThumbnail = thumbnail !== null ? thumbnail : (current?.thumbnailType || "none");

            await WelcomeMessage.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    channelId: channel.id,
                    enabled: true,
                    isEmbed: true,
                    isImage: false,
                    title: updatedTitle,
                    message: updatedMessage,
                    color: updatedColor,
                    footer: updatedFooter,
                    image: updatedImage,
                    thumbnailType: updatedThumbnail,
                },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setTitle("⚡ Welcome System Configured")
                .setColor(updatedColor && /^#?[0-9A-Fa-f]{6}$/.test(updatedColor) ? updatedColor : "#00f5d4")
                .setDescription(`Welcome messages have been successfully saved for ${channel}!`)
                .addFields(
                    { name: "📢 Target Channel", value: `${channel}`, inline: true },
                    { name: "🎨 Color", value: `\`${updatedColor}\``, inline: true },
                    { name: "🖼️ Thumbnail", value: `\`${updatedThumbnail}\``, inline: true },
                    { name: "📌 Embed Title", value: updatedTitle ? `\`${updatedTitle}\`` : "*None*", inline: true },
                    { name: "📄 Footer", value: `\`${updatedFooter}\``, inline: true },
                    { name: "GIF / Image", value: updatedImage ? `[View Media](${updatedImage})` : "*Default*", inline: true },
                    { name: "📝 Message Template", value: `\`\`\`${updatedMessage.slice(0, 500)}\`\`\``, inline: false },
                    { name: "💡 Available Placeholders", value: "`{user}` (mention) • `{username}` • `{tag}` • `{server}` • `{members}`", inline: false }
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
                        await WelcomeMessage.updateOne({ guildId: interaction.guild.id }, { $set: { enabled: false } });
                        await i.reply({ content: `🗑️ Welcome system has been disabled for this server.`, flags: MessageFlags.Ephemeral });
                    }
                });
            }
        } else if (subcommand === "view") {
            const current = await WelcomeMessage.findOne({ guildId: interaction.guild.id });
            if (!current || !current.channelId) {
                return await interaction.reply({
                    content: "⚠️ No welcome system configuration found for this server. Run `/welcome setup channel: #channel` to configure it!",
                    flags: MessageFlags.Ephemeral,
                });
            }

            const embed = new EmbedBuilder()
                .setTitle("⚙️ Welcome System Configuration")
                .setColor(current.color && /^#?[0-9A-Fa-f]{6}$/.test(current.color) ? current.color : "#00f5d4")
                .setDescription(current.enabled !== false ? "🟢 **Status:** Active & Enabled" : "🔴 **Status:** Disabled")
                .addFields(
                    { name: "📢 Target Channel", value: `<#${current.channelId}>`, inline: true },
                    { name: "🎨 Color", value: `\`${current.color || "#FFFFFF"}\``, inline: true },
                    { name: "🖼️ Thumbnail", value: `\`${current.thumbnailType || "none"}\``, inline: true },
                    { name: "📌 Embed Title", value: current.title ? `\`${current.title}\`` : "*None*", inline: true },
                    { name: "📄 Footer", value: `\`${current.footer || "FIGHT TOGETHER • WIN TOGETHER"}\``, inline: true },
                    { name: "Media Link", value: current.image ? `[View Media](${current.image})` : "*None*", inline: true },
                    { name: "📝 Message Template", value: `\`\`\`${(current.message || "Default squad template").slice(0, 500)}\`\`\``, inline: false },
                    { name: "💡 Placeholders", value: "`{user}` • `{username}` • `{tag}` • `{server}` • `{members}`", inline: false }
                )
                .setFooter({ text: "Use /welcome setup to edit any settings" })
                .setTimestamp();

            return await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        } else if (subcommand === "test") {
            const current = await WelcomeMessage.findOne({ guildId: interaction.guild.id });
            if (!current || !current.channelId) {
                return await interaction.reply({
                    content: "⚠️ No welcome channel configured yet! Please run `/welcome setup channel: #channel` first.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const res = await sendWelcomeMessage(interaction.member, current.channelId);

            if (res.success) {
                await interaction.editReply({
                    content: `✅ Live test welcome message successfully sent to <#${current.channelId}>!`,
                });
            } else {
                await interaction.editReply({
                    content: `❌ Could not send test welcome message: ${res.error || "Unknown error"}`,
                });
            }
        } else if (subcommand === "disable") {
            await WelcomeMessage.updateOne({ guildId: interaction.guild.id }, { $set: { enabled: false } });
            return await interaction.reply({
                content: `🗑️ **Welcome system has been disabled.** New members will not receive welcome messages until you run \`/welcome setup\`.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

