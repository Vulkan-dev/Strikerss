const { Events, EmbedBuilder, PermissionsBitField } = require("discord.js");
const { activateGuild, isGuildActivated } = require("../Utils/guildActivation");

module.exports = {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (!message || message.author.bot || !message.guild) return;

        const content = message.content.trim();

        // Check if message is "?redeem <key>"
        if (content.toLowerCase().startsWith('?redeem')) {
            // Require Administrator or Server Owner or Bot Developer
            const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                            message.author.id === message.guild.ownerId ||
                            message.author.id === process.env.developerId;

            if (!isAdmin) {
                return message.reply({
                    content: '❌ Only **Server Administrators** or the **Server Owner** can redeem bot activation keys on this server.'
                }).catch(() => {});
            }

            const parts = content.split(/\s+/);
            const key = parts[1] || '';

            if (!key) {
                return message.reply({
                    content: '⚠️ Please specify the activation key: `?redeem <key>`'
                }).catch(() => {});
            }

            const result = await activateGuild(message.guild, message.author, key);

            const embed = new EmbedBuilder()
                .setTitle(result.success ? '⚡ Strikers Activation Successful' : '❌ Activation Failed')
                .setColor(result.success ? '#00f5d4' : '#ff3333')
                .setDescription(result.message)
                .setFooter({ text: 'Strikers Security & Activation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] }).catch(() => {});
        }
    }
};
