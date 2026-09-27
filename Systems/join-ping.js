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
const pingschema = require("../Schemas/joinping");

module.exports = (client) => {
    client.on(Events.GuildMemberAdd, async (member, err) => {
        const pingdata = await pingschema.findOne({ Guild: member.guild.id });
      
        if (!pingdata) return;
        else {
          await Promise.all(
            pingdata.Channel.map(async (data) => {
              const pingchannels = await client.channels.fetch(data);
              const message = await pingchannels.send(`${member}`).catch(err);
      
              setTimeout(() => {
                try {
                  message.delete();
                } catch (err) {
                  return;
                }
              }, 1000);
            })
          );
        }
      });
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */