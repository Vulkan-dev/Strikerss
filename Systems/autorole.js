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
const roleSchema = require("../Schemas/autorole");

module.exports = (client) => {
    client.on("guildMemberAdd", async (member) => {
        if (!member || !member.guild) return;
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) return;
        const { guild } = member;
      
        const data = await roleSchema.findOne({ GuildID: guild.id });
        if (!data) return;
        if (data.Roles.length < 0) return;
        for (const r of data.Roles) {
          await member.roles.add(r);
        }
      });
};

/**
 * Credits: Arpan | @arpandevv
 */