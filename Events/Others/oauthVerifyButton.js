const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const OAuthVerify = require('../../Schemas/oauthVerifySchema');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        if (interaction.customId !== 'strikers_oauth_verify_btn') return;

        try {
            if (!interaction.guild) {
                return await interaction.reply({
                    content: 'This button can only be used inside a server.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const clientId = process.env.clientId;
            if (!clientId) {
                return await interaction.reply({
                    content: '⚠️ Bot Client ID is not configured in `.env`. Please ask server administrator to configure the bot.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const port = process.env.PORT || client.config.oauth?.port || 3000;
            const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
            const redirectUri = process.env.REDIRECT_URI
                || (railwayDomain ? `https://${railwayDomain}/api/auth/callback` : null)
                || `http://localhost:${port}/api/auth/callback`;
            const state = `${interaction.guild.id}_${interaction.user.id}`;
            const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify%20guilds.join&state=${state}`;

            const embed = new EmbedBuilder()
                .setTitle('🔐 Member Authorization & Verification')
                .setDescription(
                    `To complete verification in **${interaction.guild.name}**, please authorize with Discord.\n\n` +
                    `**Why authorize?**\n` +
                    `• Grants you the verified role immediately.\n` +
                    `• Protects your server access: if this server is ever nuked or recreated, you will be automatically restored!\n\n` +
                    `Click the button below to authorize.`
                )
                .setColor(client.config.embedColor || '#00f5d4')
                .setFooter({
                    text: 'Strikers Member Restorer',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Click to Authorize & Verify')
                    .setStyle(ButtonStyle.Link)
                    .setURL(authUrl)
                    .setEmoji('🔗')
            );

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('[OAUTH_VERIFY_BTN_ERROR]', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while generating your verification link.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};
