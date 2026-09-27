const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unroleall')
        .setDescription('Removes a specified role from members in the server.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('humans')
                .setDescription('Removes a specified role from all human members.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove from all human members.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('bots')
                .setDescription('Removes a specified role from all bot members.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove from all bot members.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('Removes a specified role from all members (humans and bots).')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove from all members.')
                        .setRequired(true)
                )
        ),
        
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: 'You do not have permission to manage roles.', flags: MessageFlags.Ephemeral });
        }

        const role = interaction.options.getRole('role');
        const botMember = interaction.guild.members.me;

        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: 'I do not have permission to manage roles.', flags: MessageFlags.Ephemeral });
        }

        // Check if the role is higher than the bot's highest role
        if (role.position >= botMember.roles.highest.position) {
            return interaction.reply({ content: 'I cannot remove this role because it is higher than my highest role.', flags: MessageFlags.Ephemeral });
        }

        const members = await interaction.guild.members.fetch();
        let successCount = 0;
        let failureCount = 0;

        const subcommand = interaction.options.getSubcommand();

        for (const member of members.values()) {
            const isBot = member.user.bot;

            // Ignore the server owner
            if (member.id === interaction.guild.ownerId) {
                continue;
            }
            
            if ((subcommand === 'humans' && !isBot) || 
                (subcommand === 'bots' && isBot) || 
                (subcommand === 'all')) {
                if (member.roles.cache.has(role.id)) {
                    try {
                        await member.roles.remove(role);
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to remove role from ${member.displayName}: ${error}`);
                        failureCount++;
                    }
                }
            }
        }

        const replyMessage = `Successfully removed the role from ${successCount} members.\nFailed to remove the role from ${failureCount} members.`;
        await interaction.reply({ content: replyMessage, flags: MessageFlags.Ephemeral });
    }
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */
