const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const OAuthVerify = require('../../Schemas/oauthVerifySchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure server features and integrations')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('verify')
                .setDescription('Setup OAuth2 Member Restorer verification panel')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The text / embed message to display in the verification panel')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign to verified members')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Custom title for the verification embed (Default: Server Verification)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Hex color code for embed (e.g. #00f5d4)')
                        .setRequired(false))
        ),

    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
            interaction.user.id !== process.env.developerId) {
            return await interaction.reply({
                content: 'You do not have Administrator permissions to run this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'verify') {
            const messageText = interaction.options.getString('message');
            const role = interaction.options.getRole('role');
            const title = interaction.options.getString('title') || 'Server Verification';
            const color = interaction.options.getString('color') || client.config.embedColor || '#00f5d4';

            // Check bot permissions
            const botMember = interaction.guild.members.me;
            if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return await interaction.reply({
                    content: '⚠️ I need the **Manage Roles** permission to assign roles to verified members.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (role.position >= botMember.roles.highest.position) {
                return await interaction.reply({
                    content: `⚠️ The role <@&${role.id}> is higher than or equal to my highest role. Please move my role above <@&${role.id}> in Server Settings > Roles.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Create verification panel embed
            const verifyEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(messageText)
                .setColor(color)
                .setFooter({
                    text: 'Strikers Member Restorer & Verification',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            // Verification Button
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('strikers_oauth_verify_btn')
                    .setLabel('Verify With Discord')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔐')
            );

            // Send panel to current channel
            const panelMessage = await interaction.channel.send({
                embeds: [verifyEmbed],
                components: [row]
            });

            // Save configuration in database
            await OAuthVerify.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    channelId: interaction.channel.id,
                    roleId: role.id,
                    embedTitle: title,
                    embedMessage: messageText,
                    color: color,
                    messageId: panelMessage.id,
                    enabled: true,
                    updatedAt: new Date()
                },
                { upsert: true, new: true }
            );

            return await interaction.editReply({
                content: `✅ **Verification Panel successfully created!**\n- **Channel:** <#${interaction.channel.id}>\n- **Verified Role:** <@&${role.id}>\n- Members can now click **"Verify With Discord"** to authorize and be saved for server restoration.`
            });
        }
    }
};
