const { EmbedBuilder, PermissionsBitField, SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("kickall")
        .setDescription("Kick all members except those with the specified role.")
        .addRoleOption(option => 
            option.setName("role")
                .setDescription("The role to exclude from kicking")
                .setRequired(true)),
    
    async execute(interaction, client) {
        // Check if the user is the server owner
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "You do not have permission to use this command. Only the server owner can execute it.", flags: MessageFlags.Ephemeral });
        }

        const roleToExclude = interaction.options.getRole("role");
        const members = await interaction.guild.members.fetch();

        // Create an array to hold the promises for kicking members
        const kickPromises = [];

        members.forEach(member => {
            // Check if the member is not the bot and does not have the specified role
            if (!member.user.bot && !member.roles.cache.has(roleToExclude.id)) {
                kickPromises.push(member.kick("Kicked by command: kickall"));
            }
        });

        // Execute all kick promises
        try {
            await Promise.all(kickPromises);
            return interaction.reply({ content: `Kicked all members except those with the role: ${roleToExclude.name}.`, flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "An error occurred while trying to kick members.", flags: MessageFlags.Ephemeral });
        }
    },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */