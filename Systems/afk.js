const afkSchema = require("../Schemas/afkschema");
const { Events, MessageFlags } = require('discord.js');

module.exports = (client) => {
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return;

        const check = await afkSchema.findOne({
            Guild: message.guild.id,
            User: message.author.id,
        });

        if (check) {
            const nick = check.Nickname;
            await afkSchema.deleteMany({
                Guild: message.guild.id,
                User: message.author.id,
            });

            await message.member.setNickname(`${nick}`).catch((err) => {
                return;
            });

            const m1 = await message.reply({
                content: `Welcome Back, ${message.author}! I have removed your AFK.`,
                flags: MessageFlags.Ephemeral,
            });

            setTimeout(() => {
                m1.delete();
            }, 5000);
        } else {
            const members = message.mentions.users.first();
            if (!members) return;

            const Data = await afkSchema.findOne({
                Guild: message.guild.id,
                User: members.id,
            });

            if (!Data) return;

            const member = message.guild.members.cache.get(members.id);
            const msg = Data.Message || `No Reason Given`;

            if (message.content.includes(members)) {
                const m = await message.reply({
                    content: `${member.user.tag} is currently AFK, don't mention them at this time - Reason: **${msg}**`,
                });

                setTimeout(() => {
                    m.delete();
                }, 5000);
            }
        }
    });
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */