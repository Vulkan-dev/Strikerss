const { Events, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  name: Events.MessageCreate,

  async execute(message, client) {
    if (message.author.bot) return;
    if (message.content.includes(`<@${client.user.id}>`)) {
      const commands = client.commands;
      const commandList = commands
        .map(
          (command) =>
            `> **/${command.data.name}**: ${command.data.description}`
        )
        .join("\n");

      let embedColor = client.config.embedColor;
      try {
        if (client.config.embedColor) {
          embedColor = typeof client.config.embedColor === 'string' && client.config.embedColor.startsWith('#')
            ? client.config.embedColor
            : client.config.embedColor;
        }
      } catch (error) {
        console.warn(`Invalid embed color in config: ${client.config.embedColor}, using default color.`);
      }

      const pingEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`👋 Hello, I'm ${client.user.username}!`)
        .setDescription(
          "Your friendly neighborhood bot, here to assist you! 🤖"
        )
        .addFields(
          { name: "✨ Prefix", value: "`/`", inline: true },
          {
            name: "📚 Help",
            value: client.commands.get('help')
              ? `/help`
              : "Help command not found.",
            inline: true,
          },
          {
            name: "🔗 Invite Me",
            value: `[Click here to invite Razor to your server!](https://discord.com/api/oauth2/authorize?client_id=${client.config.clientID}&permissions=8&scope=bot%20applications.commands)`,
          }
        )
        .setFooter({
          text: "Thanks for using Razor! We're always here to help.",
        })
        .setTimestamp();

      try {
        return await message.reply({
          content: `Hey, <@${message.author.id}> pinged me!`,
          embeds: [pingEmbed],
        });
      } catch (error) {
        console.error(`Failed to send ping reply: ${error.message}`);
      }
    }
  },
};