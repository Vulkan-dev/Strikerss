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

module.exports = (client) => {
    client.on(Events.MessageCreate, async (message) => {
        const countschema = require("../Schemas/counting");
        if (message.guild === null) return;
        const countdata = await countschema.findOne({ Guild: message.guild.id });
        let reaction = "";
      
        if (!countdata) return;
      
        let countchannel = client.channels.cache.get(countdata.Channel);
        if (!countchannel) return;
        if (!message.guild) return;
        if (message.author.bot) return;
        if (message.channel.id !== countchannel.id) return;
      
        if (countdata.Count > 98) {
          reaction = "✔️";
        } else if (countdata.Count > 48) {
          reaction = "☑️";
        } else {
          reaction = "✅";
        }
      
        if (message.author.id === countdata.LastUser) {
          message.reply({
            content: `You **cannot** count alone! You **messed up** the counter at **${countdata.Count}**! Back to **0**.`,
          });
          countdata.Count = 0;
          countdata.LastUser = " ";
      
          try {
            message.react("❌");
          } catch (err) {}
        } else {
          if (
            message.content - 1 < countdata.Count &&
            countdata.Count === 0 &&
            message.author.id !== countdata.LastUser
          ) {
            message.reply({ content: `The **counter** is at **0** by default!` });
            message.react("⚠");
          } else if (
            message.content - 1 < countdata.Count ||
            message.content === countdata.Count ||
            (message.content > countdata.Count + 1 &&
              message.author.id !== countdata.LastUser)
          ) {
            message.reply({
              content: `You **messed up** the counter at **${countdata.Count}**! Back to **0**.`,
            });
            countdata.Count = 0;
      
            try {
              message.react("❌");
            } catch (err) {}
          } else if (
            message.content - 1 === countdata.Count &&
            message.author.id !== countdata.LastUser
          ) {
            countdata.Count += 1;
      
            try {
              message.react(`${reaction}`);
            } catch (err) {}
      
            countdata.LastUser = message.author.id;
          }
        }
      
        countdata.save();
      });
};


/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */