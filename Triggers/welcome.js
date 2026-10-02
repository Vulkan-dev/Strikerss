const { Events, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const WelcomeMessage = require("../Schemas/welcomeMessageSchema");
const { sendWelcomeMessage } = require("../Events/Others/welcome");

module.exports = {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (!message.guild || message.author.bot) return;

        const content = message.content.trim();
        const prefix = "?";

        if (content.toLowerCase().startsWith(prefix + "welcome") || content.toLowerCase().startsWith(prefix + "testwelcome")) {
            const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
                            message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                            message.author.id === message.guild.ownerId ||
                            message.author.id === process.env.developerId;

            if (!isAdmin) return;

            if (content.toLowerCase().startsWith(prefix + "testwelcome")) {
                const data = await WelcomeMessage.findOne({ guildId: message.guild.id });
                if (!data || !data.channelId) {
                    return message.reply("⚠️ No welcome channel configured yet. Run `?welcome #channel` or `/welcome channel:#channel`.").catch(() => {});
                }
                const res = await sendWelcomeMessage(message.member, data.channelId);
                if (res.success) {
                    return message.reply(`✅ Sent test welcome message to <#${data.channelId}>!`).catch(() => {});
                } else {
                    return message.reply(`❌ Could not send test welcome: ${res.error || "Unknown error"}`).catch(() => {});
                }
            }

            const channel = message.mentions.channels.first();
            if (!channel) {
                return message.reply("⚠️ Please mention a channel to set for welcome messages: `?welcome #welcome` (or use `/welcome channel:#welcome`).").catch(() => {});
            }

            await WelcomeMessage.findOneAndUpdate(
                { guildId: message.guild.id },
                {
                    guildId: message.guild.id,
                    channelId: channel.id,
                    isEmbed: true,
                    isImage: false,
                    color: "#FFFFFF",
                    footer: "FIGHT TOGETHER • WIN TOGETHER",
                    message: "**Welcome, {user}.**\n\n**You’re now part of the STRIKERS squad.**\n\n**Stay sharp. Trust your team. Make your mark.**"
                },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setTitle("⚡ Strikers Welcome System Configured")
                .setColor("#00f5d4")
                .setDescription(`Welcome messages have been activated! New members will receive the **STRIKERS squad** welcome embed in ${channel}.`)
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

            return message.reply({ embeds: [embed], components: [buttons] }).catch(() => {});
        }
    }
};
