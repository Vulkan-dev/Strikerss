const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');
const OAuthMember = require('../../Schemas/oauthMemberSchema');
const { refreshAccessToken, addGuildMember } = require('../../Web/oauthHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restore')
        .setDescription('Member restoration and recovery system')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('members')
                .setDescription('Restore verified members into the server')
                .addStringOption(option =>
                    option.setName('target_guild_id')
                        .setDescription('The server ID to restore members into (defaults to current server)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('scope')
                        .setDescription('Select which verified members to restore')
                        .setRequired(false)
                        .addChoices(
                            { name: 'All Verified Members in Database', value: 'all' },
                            { name: 'Only Members Previously Verified in this Server', value: 'this_guild' }
                        ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View total verified members saved in recovery database')
        ),

    async execute(interaction, client) {
        const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
        const isDev = interaction.user.id === process.env.developerId;
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!isOwner && !isDev && !isAdmin) {
            return await interaction.reply({
                content: '⚠️ Only Server Administrators or Server Owner can execute member restoration.',
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'stats') {
            const totalMembers = await OAuthMember.countDocuments();
            const guildMembers = await OAuthMember.countDocuments({ guilds: interaction.guild.id });

            const embed = new EmbedBuilder()
                .setTitle('📊 Strikers Restorer Database Stats')
                .setColor(client.config.embedColor || '#00f5d4')
                .addFields(
                    { name: 'Total Database Members', value: `\`${totalMembers}\` verified users`, inline: true },
                    { name: 'Verified in this Server', value: `\`${guildMembers}\` users`, inline: true },
                    { name: 'Current Server Members', value: `\`${interaction.guild.memberCount}\` users`, inline: true }
                )
                .setFooter({ text: 'Strikers Member Restorer' })
                .setTimestamp();

            return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (subcommand === 'members') {
            const targetGuildId = interaction.options.getString('target_guild_id') || interaction.guild.id;
            const scope = interaction.options.getString('scope') || 'all';

            const targetGuild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);

            if (!targetGuild) {
                return await interaction.reply({
                    content: `⚠️ Could not find a server with ID \`${targetGuildId}\`. Make sure the bot is added to that server.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const query = scope === 'this_guild' ? { guilds: targetGuildId } : {};
            const candidates = await OAuthMember.find(query);

            if (!candidates.length) {
                return await interaction.reply({
                    content: `⚠️ No verified members found in database ${scope === 'this_guild' ? 'for this server.' : '.'}`,
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply();

            let restoredCount = 0;
            let alreadyPresentCount = 0;
            let failedCount = 0;
            let processed = 0;
            const total = candidates.length;

            const progressEmbed = new EmbedBuilder()
                .setTitle('🔄 Restoring Members in Progress...')
                .setDescription(`Restoring verified members into **${targetGuild.name}**\nTotal Candidates: **${total}**`)
                .setColor('#facc15')
                .addFields(
                    { name: 'Restored', value: '`0`', inline: true },
                    { name: 'Already In Server', value: '`0`', inline: true },
                    { name: 'Failed', value: '`0`', inline: true }
                )
                .setTimestamp();

            const statusMsg = await interaction.editReply({ embeds: [progressEmbed] });

            for (const userDoc of candidates) {
                processed++;

                try {
                    // Check if member is already in the server
                    let isAlreadyInGuild = targetGuild.members.cache.has(userDoc.userId);
                    if (!isAlreadyInGuild) {
                        const fetched = await targetGuild.members.fetch(userDoc.userId).catch(() => null);
                        if (fetched) isAlreadyInGuild = true;
                    }

                    if (isAlreadyInGuild) {
                        alreadyPresentCount++;
                    } else {
                        // Refresh token if expired or about to expire
                        let currentAccessToken = userDoc.accessToken;
                        if (userDoc.expiresAt <= new Date(Date.now() + 60000)) {
                            try {
                                const refreshResult = await refreshAccessToken(userDoc.refreshToken);
                                currentAccessToken = refreshResult.access_token;
                                userDoc.accessToken = refreshResult.access_token;
                                userDoc.refreshToken = refreshResult.refresh_token;
                                userDoc.expiresAt = new Date(Date.now() + (refreshResult.expires_in || 604800) * 1000);
                                await userDoc.save();
                            } catch (refreshErr) {
                                console.error(`[RESTORE] Token refresh failed for ${userDoc.userId}:`, refreshErr.message);
                            }
                        }

                        // Add member via Discord OAuth PUT endpoint
                        const result = await addGuildMember(targetGuildId, userDoc.userId, currentAccessToken);

                        if (result.status === 201) {
                            restoredCount++;
                        } else if (result.status === 204) {
                            alreadyPresentCount++;
                        } else {
                            failedCount++;
                        }
                    }
                } catch (memberErr) {
                    console.error(`[RESTORE ERROR] ${userDoc.userId}:`, memberErr.message);
                    failedCount++;
                }

                // Rate limit buffer: 1.2s delay per user
                await new Promise(r => setTimeout(r, 1200));

                // Update progress embed every 5 users
                if (processed % 5 === 0 || processed === total) {
                    progressEmbed.setFields(
                        { name: 'Restored', value: `\`${restoredCount}\``, inline: true },
                        { name: 'Already In Server', value: `\`${alreadyPresentCount}\``, inline: true },
                        { name: 'Failed', value: `\`${failedCount}\``, inline: true },
                        { name: 'Progress', value: `\`${processed} / ${total}\` (${Math.round((processed / total) * 100)}%)`, inline: false }
                    );
                    await interaction.editReply({ embeds: [progressEmbed] }).catch(() => null);
                }
            }

            // Final completion embed
            const finalEmbed = new EmbedBuilder()
                .setTitle('✅ Member Restoration Complete!')
                .setDescription(`Finished restoring verified members into **${targetGuild.name}**!`)
                .setColor('#10b981')
                .addFields(
                    { name: 'Total Candidates', value: `\`${total}\``, inline: true },
                    { name: 'Successfully Restored', value: `\`${restoredCount}\``, inline: true },
                    { name: 'Already In Server', value: `\`${alreadyPresentCount}\``, inline: true },
                    { name: 'Failed / Revoked', value: `\`${failedCount}\``, inline: true }
                )
                .setFooter({ text: 'Strikers Member Restorer' })
                .setTimestamp();

            await interaction.editReply({ embeds: [finalEmbed] });
        }
    }
};
