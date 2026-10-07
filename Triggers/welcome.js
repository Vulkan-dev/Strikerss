const { Events, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const WelcomeMessage = require("../Schemas/welcomeMessageSchema");
const { sendWelcomeMessage } = require("../Events/Others/welcome");

module.exports = {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (!message.guild || message.author.bot) return;

        const content = message.content.trim().toLowerCase();
        const matched = ["?welcome", "!welcome", "/welcome", "?testwelcome", "!testwelcome"].some(p => content.startsWith(p));
        if (!matched) return;

        const staffRoleId = process.env.CLAN_STAFF_ROLE_ID || "1553810081915600946";
        const isStaff = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
                        message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                        message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                        message.member.roles.cache.has(staffRoleId) ||
                        message.author.id === message.guild.ownerId ||
                        message.author.id === process.env.developerId;

        if (!isStaff) return;

        if (content.startsWith("?testwelcome") || content.startsWith("!testwelcome")) {
            const data = await WelcomeMessage.findOne({ guildId: message.guild.id }).catch(() => null);
            const channelId = data?.channelId || "1554194442662051900";
            const res = await sendWelcomeMessage(message.member, channelId);
            if (res.success) {
                return message.reply(`✅ Sent test welcome message to <#${channelId}>!`).catch(() => {});
            } else {
                return message.reply(`❌ Could not send test welcome: ${res.error || "Unknown error"}`).catch(() => {});
            }
        }

        // If a member is mentioned: ?welcome @user -> welcomes that user!
        const targetMember = message.mentions.members.first();
        if (targetMember) {
            const data = await WelcomeMessage.findOne({ guildId: message.guild.id }).catch(() => null);
            const channelId = data?.channelId || "1554194442662051900";
            const res = await sendWelcomeMessage(targetMember, channelId);
            if (res.success) {
                return message.reply(`✅ Successfully welcomed ${targetMember.user} in <#${channelId}>!`).catch(() => {});
            } else {
                return message.reply(`❌ Could not send welcome: ${res.error || "Unknown error"}`).catch(() => {});
            }
        }

        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply("⚠️ Usage: `?welcome @user` (to welcome a member) or `?welcome #channel` (to configure channel).").catch(() => {});
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
