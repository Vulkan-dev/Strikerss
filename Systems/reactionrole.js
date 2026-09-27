const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionsBitField,
    ButtonStyle,
} = require('discord.js');
const reactions = require("../Schemas/reactionrole.js");
const { default: axios } = require("axios");

module.exports = (client) => {
    // Event: MessageReactionAdd (Animated Emoji)
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (!reaction.message.guildId) return;
        if (user.bot) return;

        let cID = `<a:${reaction.emoji.name}:${reaction.emoji.id}>`;
        if (!reaction.emoji.id) cID = reaction.emoji.name;

        const data = await reactions.findOne({
            Guild: reaction.message.guildId,
            Message: reaction.message.id,
            Emoji: cID,
        });

        if (!data) return;

        const guild = client.guilds.cache.get(reaction.message.guildId);
        const member = guild.members.cache.get(user.id);

        try {
            await member.roles.add(data.Role);
        } catch (e) {
            console.log("Error adding role!");
        }
    });

    // Event: MessageReactionRemove (Animated Emoji)
    client.on(Events.MessageReactionRemove, async (reaction, user) => {
        if (!reaction.message.guildId) return;
        if (user.bot) return;

        let cID = `<a:${reaction.emoji.name}:${reaction.emoji.id}>`;
        if (!reaction.emoji.id) cID = reaction.emoji.name;

        const data = await reactions.findOne({
            Guild: reaction.message.guildId,
            Message: reaction.message.id,
            Emoji: cID,
        });

        if (!data) return;

        const guild = client.guilds.cache.get(reaction.message.guildId);
        const member = guild.members.cache.get(user.id);

        try {
            await member.roles.remove(data.Role);
        } catch (e) {
            console.log("Error removing role!");
        }
    });

    // Event: MessageReactionAdd (Static Emoji)
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (!reaction.message.guildId) return;
        if (user.bot) return;

        let cID = `<:${reaction.emoji.name}:${reaction.emoji.id}>`;
        if (!reaction.emoji.id) cID = reaction.emoji.name;

        const data = await reactions.findOne({
            Guild: reaction.message.guildId,
            Message: reaction.message.id,
            Emoji: cID,
        });

        if (!data) return;

        const guild = client.guilds.cache.get(reaction.message.guildId);
        const member = guild.members.cache.get(user.id);

        try {
            await member.roles.add(data.Role);
        } catch (e) {
            console.log("Error adding role!");
        }
    });

    // Event: MessageReactionRemove (Static Emoji)
    client.on(Events.MessageReactionRemove, async (reaction, user) => {
        if (!reaction.message.guildId) return;
        if (user.bot) return;

        let cID = `<:${reaction.emoji.name}:${reaction.emoji.id}>`;
        if (!reaction.emoji.id) cID = reaction.emoji.name;

        const data = await reactions.findOne({
            Guild: reaction.message.guildId,
            Message: reaction.message.id,
            Emoji: cID,
        });

        if (!data) return;

        const guild = client.guilds.cache.get(reaction.message.guildId);
        const member = guild.members.cache.get(user.id);

        try {
            await member.roles.remove(data.Role);
        } catch (e) {
            console.log("Error removing role!");
        }
    });
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */