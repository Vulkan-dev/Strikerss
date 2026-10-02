const { Events, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");
const { isGuildActivated } = require("../../Utils/guildActivation");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

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
        description = welcomeData.message
            .replace(/\{user\}/g, `${member.user}`)
            .replace(/\{guild\}/g, member.guild.name)
            .replace(/\{members\}/g, member.guild.memberCount);
    } else {
        description = `**Welcome, ${member.user}.**\n\n**You’re now part of the STRIKERS squad.**\n\n**Stay sharp. Trust your team. Make your mark.**`;
    }

    const embed = new EmbedBuilder()
        .setColor(welcomeData?.color || "#FFFFFF")
        .setDescription(description)
        .setFooter({ text: welcomeData?.footer || "FIGHT TOGETHER • WIN TOGETHER" });

    const sendOptions = { embeds: [embed] };

    // Image/GIF handling:
    // If an external image URL is explicitly configured, use it.
    // Otherwise, attach and render the bundled 1234.gif!
    if (welcomeData?.image && (welcomeData.image.startsWith("http://") || welcomeData.image.startsWith("https://"))) {
        embed.setImage(welcomeData.image);
    } else {
        const localGifPath = path.join(__dirname, "../../Assets/1234.gif");
        if (fs.existsSync(localGifPath)) {
            const attachment = new AttachmentBuilder(localGifPath, { name: "1234.gif" });
            embed.setImage("attachment://1234.gif");
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
    async execute(member) {
        await sendWelcomeMessage(member).catch((err) => {
            console.error("[WELCOME] Error handling GuildMemberAdd:", err);
        });
    }
};