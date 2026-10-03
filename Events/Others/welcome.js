const { Events, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");
const { isGuildActivated } = require("../../Utils/guildActivation");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

/**
 * Replaces placeholders in text with live member and guild details.
 * @param {string} text 
 * @param {import('discord.js').GuildMember} member 
 * @returns {string}
 */
function formatPlaceholders(text, member) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\{user\}/g, `${member.user}`)
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{tag\}/g, member.user.tag || member.user.username)
        .replace(/\{displayName\}/g, member.displayName)
        .replace(/\{guild\}/g, member.guild.name)
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{members\}/g, String(member.guild.memberCount))
        .replace(/\{memberCount\}/g, String(member.guild.memberCount));
}

/**
 * Builds and sends the Strikers Squad welcome message
 * @param {import('discord.js').GuildMember} member 
 * @param {string|null} customChannelId 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendWelcomeMessage(member, customChannelId = null) {
    if (!member || !member.guild) {
        return { success: false, error: "Invalid member or guild object." };
    }
    if (mongoose.connection.readyState !== 1) {
        return { success: false, error: "Database is not connected." };
    }

    // Check if guild is activated
    const isActivated = await isGuildActivated(member.guild.id);
    if (!isActivated) {
        return { success: false, error: "Bot is inactive on this server." };
    }

    const welcomeData = await WelcomeMessage.findOne({ guildId: member.guild.id });
    if (welcomeData && welcomeData.enabled === false && !customChannelId) {
        return { success: false, error: "Welcome messages are disabled for this server." };
    }

    const targetChannelId = customChannelId || welcomeData?.channelId;

    if (!targetChannelId) {
        return { success: false, error: "No welcome channel configured for this server." };
    }

    const channel = member.guild.channels.cache.get(targetChannelId) 
        || await member.guild.channels.fetch(targetChannelId).catch(() => null);

    if (!channel) {
        return { success: false, error: `Could not find welcome channel <#${targetChannelId}>.` };
    }

    // Default Strikers squad welcome text matching exact user specification & screenshot:
    // Welcome, {user}
    // You’re now part of the STRIKERS squad.
    // Stay sharp. Trust your team. Make your mark.
    let description;
    if (welcomeData?.message && welcomeData.message.trim() !== '') {
        description = formatPlaceholders(welcomeData.message, member);
    } else {
        description = `**Welcome, ${member.user}.**\n\n**You’re now part of the STRIKERS squad.**\n\n**Stay sharp. Trust your team. Make your mark.**`;
    }

    // Embed Color parsing
    let embedColor = "#FFFFFF";
    if (welcomeData?.color && /^#?[0-9A-Fa-f]{6}$/.test(welcomeData.color)) {
        embedColor = welcomeData.color.startsWith('#') ? welcomeData.color : `#${welcomeData.color}`;
    }

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(description);

    // Title
    if (welcomeData?.title) {
        embed.setTitle(formatPlaceholders(welcomeData.title, member));
    }

    // Author
    if (welcomeData?.author) {
        const authorOptions = { name: formatPlaceholders(welcomeData.author, member) };
        if (welcomeData.authorIcon) authorOptions.iconURL = welcomeData.authorIcon;
        embed.setAuthor(authorOptions);
    }

    // Footer
    const footerText = formatPlaceholders(welcomeData?.footer || "FIGHT TOGETHER • WIN TOGETHER", member);
    embed.setFooter({ text: footerText });

    // Thumbnail
    if (welcomeData?.thumbnailUrl) {
        embed.setThumbnail(welcomeData.thumbnailUrl);
    } else if (welcomeData?.thumbnailType === 'user') {
        embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
    } else if (welcomeData?.thumbnailType === 'bot') {
        embed.setThumbnail(member.client.user.displayAvatarURL({ dynamic: true, size: 256 }));
    } else if (welcomeData?.thumbnailType === 'server') {
        const icon = member.guild.iconURL({ dynamic: true, size: 256 });
        if (icon) embed.setThumbnail(icon);
    }

    const sendOptions = { embeds: [embed] };

    // Image/GIF handling:
    // Uses the STRIKERS emblem GIF (https://i.postimg.cc/d3XLkpHy/hmm.gif) as shown in the screenshot
    const gifUrl = welcomeData?.image || "https://i.postimg.cc/d3XLkpHy/hmm.gif";
    if (gifUrl && (gifUrl.startsWith("http://") || gifUrl.startsWith("https://"))) {
        embed.setImage(gifUrl);
    } else {
        const localGifPath = path.join(__dirname, "../../Assets/hmm.gif");
        const fallbackPath = path.join(__dirname, "../../Assets/1234.gif");
        const activePath = fs.existsSync(localGifPath) ? localGifPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);
        if (activePath) {
            const attachment = new AttachmentBuilder(activePath, { name: "welcome.gif" });
            embed.setImage("attachment://welcome.gif");
            sendOptions.files = [attachment];
        }
    }

    try {
        await channel.send(sendOptions);
        return { success: true };
    } catch (err) {
        console.error(`[WELCOME] Failed to send welcome message in #${channel.name}:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    name: Events.GuildMemberAdd,
    sendWelcomeMessage,
    formatPlaceholders,
    async execute(member) {
        await sendWelcomeMessage(member).catch((err) => {
            console.error("[WELCOME] Error handling GuildMemberAdd:", err);
        });
    }
};