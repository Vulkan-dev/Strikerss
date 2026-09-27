const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
 
module.exports = {
    data: new SlashCommandBuilder()
        .setName('mass-unban')
        .setDMPermission(false)
        .setDescription('Unban all members in the server. Use with caution!'),
 
    async execute(interaction, client) {
 
        // Check if the user is the server owner
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "You do not have permission to use this command. Only the server owner can execute it.", flags: MessageFlags.Ephemeral });
        }
 
        try {
 
            const bannedMembers = await interaction.guild.bans.fetch();
 
            await Promise.all(bannedMembers.map(member => {
                return interaction.guild.members.unban(member.user.id).catch(err);
            }));
 
            return interaction.reply({ content: `${client.emoji.tick} | All members have been **unbanned** from the server.`, flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: `${client.emoji.tick} | An error occurred while **unbanning** members.`, flags: MessageFlags.Ephemeral });
        }
    }
}

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */