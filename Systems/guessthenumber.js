const Schema = require("../Schemas/guess");
const { Events, MessageFlags } = require('discord.js');

module.exports = (client) => {
    client.on(Events.MessageCreate, async (message) => {
        if (!message || message.author?.bot) return;
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) return;

        const data = await Schema.findOne({ channelId: message.channel.id });
        if (!data) return;

        if (message.content === `${data.number}`) {
            message.react(`${client.emoji.tick}`);
            message.reply(`Wow! That was the right number! 🥳`);
            message.pin();

            await data.delete();
            message.channel.send(
                `Successfully deleted number, use \`/guess enable\` to get a new number!`
            );
        } else {
            message.react(`❌`);
        }
    });
};

/**
 * Credits: Arpan | @arpandevv
 */