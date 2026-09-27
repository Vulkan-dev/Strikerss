const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Get info of a member in the server.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user you want to get info from')
        .setRequired(false)
    ),
  async execute(interaction, client) {
    try {
      const user = interaction.options.getUser ('user') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id);
      const userFlags = user.flags.toArray();
      const topRole = member.roles.cache
        .sort((a, b) => b.position - a.position)
        .first();
      const bannerURL = await (await client.users.fetch(user.id, { force: true })).bannerURL({ size: 4096 });
      const isBooster = member.premiumSince ? `${client.emoji.boost} Yes` : 'No';
      const ownerEmoji = `${client.emoji.owner}`;
      const devEmoji = `${client.emoji.dev}`;
      const botOwners = process.env.developerId;
      const mutualServers = [];
      const joinPosition = (await interaction.guild.members.fetch())
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map(user => user.id)
        .indexOf(member.id) + 1;

      // Collect mutual servers
      for (const guild of client.guilds.cache.values()) {
        if (guild.members.cache.has(member.id)) {
          mutualServers.push(`[${guild.name}](https://discord.com/guilds/${guild.id})`);
        }
      }

      // Check if the user is a bot
      if (member.user.bot) {
        const botEmbed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setDescription('Bots are not available');
        return await interaction.reply({ embeds: [botEmbed] });
      }

      // Create the user info embed
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'User  Information', iconURL: member.displayAvatarURL() })
        .setTitle(`**${member.user.tag}**`)
        .setColor(client.config.embedColor)
        .setThumbnail(member.displayAvatarURL())
        .setDescription(
          `**ID** - ${member.id}\n` +
          `• **Boosted** - ${isBooster}\n` +
          `• **Top Role** - ${topRole ? topRole.name : 'None'}\n` +
          `• **Joined** - <t:${Math.floor(member.joinedAt / 1000)}:R>\n` +
          `• **Discord User** - <t:${Math.floor(user.createdAt / 1000)}:R>`
        )
        .addFields({ name: 'Banner', value: bannerURL ? ' ' : 'None' })
        .setImage(bannerURL)
        .setFooter({
          text: `Join Position - ${joinPosition} | Mutual Servers - ${mutualServers.length}`,
        });

      // Add emojis for server owner and bot owners
      if (member.id === interaction.guild.ownerId) {
        embed.setTitle(`**${member.user.tag}** ${ownerEmoji}`);
      }
      if (botOwners.includes(member.id)) {
        embed.setTitle(`**${member.user.tag}** ${devEmoji}`);
      }
      if (botOwners.includes(member.id) && member.id === interaction.guild.ownerId) {
        embed.setTitle(`**${member.user.tag}** ${devEmoji} ${ownerEmoji}`);
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching user info:', error);
      await interaction.reply({ content: 'There was an error fetching the user information.', flags: MessageFlags.Ephemeral });
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 */
