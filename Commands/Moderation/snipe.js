const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require("discord.js");

let lastDeletedMessage = null;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Snipes the last deleted message!"),

  async execute(interaction, client) {
    if (!lastDeletedMessage) {
      return interaction.reply("There are no deleted messages to snipe!");
    }

    const embed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setTitle("Sniped Message")
      .setDescription(`**Message:** ${lastDeletedMessage.content}`)
      .addFields(
        {
          name: "Author",
          value: lastDeletedMessage.author.username,
          inline: true,
        },
        {
          name: "Channel",
          value: lastDeletedMessage.channel.name,
          inline: true,
        },
        {
          name: "Deleted At",
          value: `<t:${Math.floor(
            lastDeletedMessage.createdTimestamp / 1000
          )}:f>`,
          inline: true,
        }
      )
      .setTimestamp(lastDeletedMessage.createdTimestamp);

    await interaction.reply({ embeds: [embed] });
  },
};

// Event listener to capture deleted messages
module.exports.onMessageDelete = (message) => {
  lastDeletedMessage = {
    content: message.content,
    author: message.author,
    channel: message.channel,
    createdTimestamp: Date.now(),
  };
};


/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */