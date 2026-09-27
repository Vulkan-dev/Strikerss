const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleall')
        .setDescription('Assigns a specified role to members in the server.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('humans')
                .setDescription('Assigns a specified role to all human members.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign to all human members.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('bots')
                .setDescription('Assigns a specified role to all bot members.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign to all bot members.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('Assigns a specified role to all members (humans and bots).')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign to all members.')
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
            return interaction.reply({ content: 'I cannot assign this role because it is higher than my highest role.', flags: MessageFlags.Ephemeral });
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
                if (!member.roles.cache.has(role.id)) {
                    try {
                        await member.roles.add(role);
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to assign role to ${member.displayName}: ${error}`);
                        failureCount++;
                    }
                }
            }
        }

        const replyMessage = `Successfully assigned the role to ${successCount} members.\nFailed to assign the role to ${failureCount} members.`;
        await interaction.reply({ content: replyMessage, flags: MessageFlags.Ephemeral });
    }
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */
