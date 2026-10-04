const { Events, EmbedBuilder } = require("discord.js");
const GoodbyeMessage = require("../../Schemas/goodbyeMessageSchema");
const { isGuildActivated } = require("../../Utils/guildActivation");
const mongoose = require("mongoose");

/**
 * Replaces placeholders in text with live member and guild details.
 * @param {string} text 
 * @param {import('discord.js').GuildMember} member 
 * @returns {string}
 */
function formatPlaceholders(text, member) {
    if (!text || typeof text !== 'string') return '';
    const userDisplay = member.user ? `${member.user.username}` : (member.displayName || 'Member');
    return text
        .replace(/\{user\}/g, member.user ? `<@${member.user.id}>` : userDisplay)
        .replace(/\{username\}/g, member.user ? member.user.username : userDisplay)
        .replace(/\{tag\}/g, member.user ? (member.user.tag || member.user.username) : userDisplay)
        .replace(/\{displayName\}/g, member.displayName || userDisplay)
        .replace(/\{guild\}/g, member.guild.name)
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{members\}/g, String(member.guild.memberCount))
        .replace(/\{memberCount\}/g, String(member.guild.memberCount));
}

/**
 * Builds and sends the Strikers departure / goodbye message
 * @param {import('discord.js').GuildMember} member 
 * @param {string|null} customChannelId 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendGoodbyeMessage(member, customChannelId = null) {
    if (!member || !member.guild) {
        return { success: false, error: "Invalid member or guild object." };
    }
    if (mongoose.connection.readyState !== 1) {
        return { success: false, error: "Database is not connected." };
    }

    const isActivated = await isGuildActivated(member.guild.id);
    if (!isActivated) {
        return { success: false, error: "Bot is inactive on this server." };
    }

    const goodbyeData = await GoodbyeMessage.findOne({ guildId: member.guild.id });
    if (goodbyeData && goodbyeData.enabled === false && !customChannelId) {
        return { success: false, error: "Goodbye messages are disabled for this server." };
    }

    const targetChannelId = customChannelId || goodbyeData?.channelId;
    if (!targetChannelId) {
        return { success: false, error: "No goodbye channel configured for this server." };
    }

    const channel = member.guild.channels.cache.get(targetChannelId) 
        || await member.guild.channels.fetch(targetChannelId).catch(() => null);

    if (!channel) {
        return { success: false, error: `Could not find goodbye channel <#${targetChannelId}>.` };
    }

    // Default message specified by user:
    // "{user} Leave coz he was not worthy to be Strikers"
    let rawMsg = goodbyeData?.message || "{user} Leave coz he was not worthy to be Strikers";
    const description = formatPlaceholders(rawMsg, member);

    let embedColor = "#ef4444";
    if (goodbyeData?.color && /^#?[0-9A-Fa-f]{6}$/.test(goodbyeData.color)) {
        embedColor = goodbyeData.color.startsWith('#') ? goodbyeData.color : `#${goodbyeData.color}`;
    }

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(`**${description}**`)
        .setFooter({ text: formatPlaceholders(goodbyeData?.footer || "STRIKERS Squad Roster Update", member) })
        .setTimestamp();

    if (goodbyeData?.title) {
        embed.setTitle(formatPlaceholders(goodbyeData.title, member));
    }

    if (goodbyeData?.thumbnailType === 'user' && member.user) {
        embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
    } else if (goodbyeData?.thumbnailType === 'server') {
        const icon = member.guild.iconURL({ dynamic: true, size: 256 });
        if (icon) embed.setThumbnail(icon);
    }

    if (goodbyeData?.image && (goodbyeData.image.startsWith("http://") || goodbyeData.image.startsWith("https://"))) {
        embed.setImage(goodbyeData.image);
    }

    try {
        await channel.send({ embeds: [embed] });
        return { success: true };
    } catch (err) {
        console.error("[GOODBYE SEND ERROR]", err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    name: Events.GuildMemberRemove,
    sendGoodbyeMessage,
    async execute(member) {
        try {
            await sendGoodbyeMessage(member);
        } catch (err) {
            console.error("[GOODBYE EVENT ERROR]", err);
        }
    }
};
