const {
    SlashCommandBuilder,
    ChannelType,
    PermissionsBitField,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const BackupSchema = require('../../Schemas/backupSchema');
const { generateBackupId, createGuildBackupData, retryOperation } = require('../../Utils/backupUtils');

// Schemas needed for restore
const WelcomeSchema      = require('../../Schemas/welcomeMessageSchema');
const VerifySchema       = require('../../Schemas/verificationSchema');
const LogSchema          = require('../../Schemas/logschema');
const TicketSetupSchema  = require('../../Schemas/TicketSetup');
const AutoRoleSchema     = require('../../Schemas/autorole');
const LevelSetupSchema   = require('../../Schemas/levelsetup');
const LevelRoleSchema    = require('../../Schemas/levelRoleSchema');
const JoinToCreateSchema = require('../../Schemas/jointocreate');
const BoosterSchema      = require('../../Schemas/boosterChannel');
const StaffRoleSchema    = require('../../Schemas/staffrole');
const JoinPingSchema     = require('../../Schemas/joinping');

const maxStates = 10;
const rateLimit = new Map();

async function hasRequiredPermissions(interaction) {
    return interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
           interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
           interaction.member.id === interaction.guild.ownerId ||
           interaction.member.roles.cache.some(role => role.name === 'BackupAdmin');
}

function validateState(state) {
    return /^[a-zA-Z0-9_-]{1,35}$/.test(state);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Manage server backups (Strikers Engine)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Creates a full Strikers backup of the server (structure, roles, bot setups, emojis).')
                .addStringOption(option =>
                    option.setName('state').setDescription('Custom name/state (Default: latest).').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restores a backup onto this server (supports cross-server restore).')
                .addStringOption(option =>
                    option.setName('state').setDescription('State name (e.g. 1, latest) or Backup ID to restore.').setRequired(false))
                .addStringOption(option =>
                    option.setName('backup_id').setDescription('Unique Backup ID (e.g. STRIKERS-XXXXXXXX) to restore from any server.').setRequired(false))
                .addStringOption(option =>
                    option.setName('server_id').setDescription('Source Server ID to pull backup from.').setRequired(false))
                .addStringOption(option =>
                    option.setName('scope').setDescription('What to restore.').setRequired(false)
                        .addChoices(
                            { name: 'All (Everything)', value: 'all' },
                            { name: 'Channels & Categories', value: 'channels' },
                            { name: 'Roles & Member Roles', value: 'roles' },
                            { name: 'Emojis', value: 'emojis' },
                            { name: 'Bot Setups Only', value: 'configs' }
                        ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get detailed information about a backup by its ID.')
                .addStringOption(option =>
                    option.setName('backup_id').setDescription('Unique Backup ID (e.g. STRIKERS-XXXXXXXX)').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists all backups for this server or a specific server.')
                .addStringOption(option =>
                    option.setName('server_id').setDescription('Server ID to view backups for (Default: this server).').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto-status')
                .setDescription('View status of automated 24-hour rolling backups.')
        ),
    async execute(interaction) {
        try {
            if (!interaction.guild) {
                return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'create') {
                const state = interaction.options.getString('state') || 'latest';
                if (!validateState(state)) {
                    return interaction.reply({ content: 'Invalid state name. Use alphanumeric characters, dashes, and underscores (max 35).', flags: MessageFlags.Ephemeral });
                }
                await handleCreateBackup(interaction, state);
            } else if (subcommand === 'restore') {
                const backupId = interaction.options.getString('backup_id');
                const serverId = interaction.options.getString('server_id');
                const state = interaction.options.getString('state') || 'latest';
                const scope = interaction.options.getString('scope') || 'all';
                await handleRestoreBackup(interaction, backupId, serverId, state, scope);
            } else if (subcommand === 'info') {
                const backupId = interaction.options.getString('backup_id');
                await handleInfoBackup(interaction, backupId);
            } else if (subcommand === 'list') {
                const serverId = interaction.options.getString('server_id');
                await handleListBackups(interaction, serverId);
            } else if (subcommand === 'auto-status') {
                await handleAutoStatus(interaction);
            }
        } catch (error) {
            console.error(`[BACKUP] Execute Error [Guild: ${interaction.guild.id}]:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'An error occurred while processing the command.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content: 'An error occurred while processing the command.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    },
};

// ─── CREATE ──────────────────────────────────────────────────────────────────

async function handleCreateBackup(interaction, state) {
    try {
        if (!(await hasRequiredPermissions(interaction))) {
            return interaction.reply({ content: 'You need Administrator, Manage Server, or BackupAdmin role.', flags: MessageFlags.Ephemeral });
        }

        const now = Date.now();
        const rateLimitKey = `${interaction.guild.id}:create`;
        if (rateLimit.has(rateLimitKey) && now - rateLimit.get(rateLimitKey) < 5 * 60 * 1000) {
            return interaction.reply({ content: 'Please wait 5 minutes before creating another backup.', flags: MessageFlags.Ephemeral });
        }
        rateLimit.set(rateLimitKey, now);

        await interaction.reply({ content: '⏳ Creating full Strikers backup (structure, roles, bot setups, member roles)...', flags: MessageFlags.Ephemeral });

        const serverDataString = await createGuildBackupData(interaction.guild);
        const serverData = JSON.parse(serverDataString);
        const size = Buffer.byteLength(serverDataString, 'utf8');
        const backupId = generateBackupId();

        // Prune old backups for this guild
        const guildBackups = await BackupSchema.find({ guildId: interaction.guild.id });
        if (guildBackups.length >= maxStates) {
            const latestIndex = guildBackups.findIndex(b => b.state === 'latest');
            const toDelete = guildBackups.filter((b, i) => i !== latestIndex).slice(0, guildBackups.length - maxStates + 1);
            for (const backup of toDelete) {
                await retryOperation(() => BackupSchema.findByIdAndDelete(backup._id));
            }
        }

        const existingBackup = await BackupSchema.findOne({ guildId: interaction.guild.id, state });
        let effectiveBackupId = backupId;
        if (existingBackup) {
            effectiveBackupId = existingBackup.backupId || backupId;
            await retryOperation(() => BackupSchema.updateOne(
                { guildId: interaction.guild.id, state },
                {
                    backupId: effectiveBackupId,
                    guildName: interaction.guild.name,
                    data: serverDataString,
                    creatorId: interaction.user.id,
                    size,
                    updatedAt: new Date()
                }
            ));
        } else {
            await retryOperation(() => BackupSchema.create({
                backupId: effectiveBackupId,
                data: serverDataString,
                guildId: interaction.guild.id,
                guildName: interaction.guild.name,
                state,
                creatorId: interaction.user.id,
                size,
                createdAt: new Date(),
                updatedAt: new Date()
            }));
        }

        // Purge very old
        await BackupSchema.deleteMany({ guildId: interaction.guild.id, createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });

        const configsStored = Object.keys(serverData.botConfigs || {}).join(', ') || 'none';
        const embed = new EmbedBuilder()
            .setTitle('✅ Strikers Server Backup Created')
            .setColor('#80b918')
            .setDescription(`Full server snapshot taken and saved to cloud database.\n\n**Backup ID:** \`${effectiveBackupId}\`\n*This Backup ID can be restored on ANY server!*`)
            .addFields(
                { name: 'Backup ID', value: `\`${effectiveBackupId}\``, inline: true },
                { name: 'State', value: `\`${state}\``, inline: true },
                { name: 'Size', value: `${(size / 1024).toFixed(2)} KB`, inline: true },
                { name: 'Schema', value: serverData.schemaVersion, inline: true },
                { name: 'Categories', value: `${serverData.categories?.length || 0}`, inline: true },
                { name: 'Channels', value: `${serverData.channels?.length || 0}`, inline: true },
                { name: 'Roles', value: `${serverData.roles?.length || 0}`, inline: true },
                { name: 'Members w/ Roles', value: `${serverData.members?.length || 0}`, inline: true },
                { name: 'Emojis', value: `${serverData.emojis?.length || 0}`, inline: true },
                { name: 'Bot Configs Stored', value: configsStored || 'none' },
                { name: 'Restore Command', value: `\`/backup restore state:${state}\``, inline: false },
                { name: 'Cross-Server Restore Command', value: `\`/backup restore backup_id:${effectiveBackupId}\``, inline: false }
            )
            .setFooter({ text: 'Strikers Cross-Server Engine' })
            .setTimestamp();

        const quickRestoreRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`quick_restore_${effectiveBackupId}`)
                .setLabel(`Restore State: ${state}`)
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔄')
        );

        await interaction.editReply({ content: '', embeds: [embed], components: [quickRestoreRow], flags: MessageFlags.Ephemeral });

        // Quick restore button collector
        const quickFilter = btnI => btnI.user.id === interaction.user.id && btnI.customId === `quick_restore_${effectiveBackupId}`;
        const quickCollector = interaction.channel.createMessageComponentCollector({ filter: quickFilter, time: 60000 });
        quickCollector.on('collect', async btnI => {
            quickCollector.stop();
            await handleRestoreBackup(btnI, effectiveBackupId, null, state, 'all');
        });
    } catch (error) {
        console.error(`[BACKUP] Create Error [Guild: ${interaction.guild.id}]:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: `Failed to create backup: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        } else {
            await interaction.reply({ content: `Failed to create backup: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
}

// ─── RESTORE ─────────────────────────────────────────────────────────────────

async function handleRestoreBackup(interaction, backupId, serverId, state, scope) {
    try {
        if (!(await hasRequiredPermissions(interaction))) {
            return interaction.reply({ content: 'You need Administrator, Manage Server, or BackupAdmin role.', flags: MessageFlags.Ephemeral });
        }

        const rateLimitKey = `${interaction.guild.id}:restore`;
        if (rateLimit.has(rateLimitKey) && Date.now() - rateLimit.get(rateLimitKey) < 5 * 60 * 1000) {
            return interaction.reply({ content: 'Please wait 5 minutes before restoring another backup.', flags: MessageFlags.Ephemeral });
        }

        let backup = null;

        // 1. Check if backupId provided
        if (backupId) {
            const cleanId = backupId.trim();
            backup = await BackupSchema.findOne({ backupId: cleanId }) ||
                     await BackupSchema.findOne({ backupId: new RegExp('^' + cleanId + '$', 'i') });
        }

        // 2. Check if state passed is actually a backup ID (e.g. STRIKERS-XXXX or XENON-XXXX or hex)
        if (!backup && state) {
            const cleanState = state.trim();
            if (/^(STRIKERS|XENON)-/i.test(cleanState) || cleanState.length >= 8) {
                backup = await BackupSchema.findOne({ backupId: cleanState }) ||
                         await BackupSchema.findOne({ backupId: new RegExp('^' + cleanState + '$', 'i') });
            }
        }

        // 3. If explicit server_id was passed
        if (!backup && serverId) {
            const cleanServer = serverId.trim();
            backup = await BackupSchema.findOne({ guildId: cleanServer, state: state || 'latest' }) ||
                     await BackupSchema.findOne({ guildId: cleanServer }).sort({ createdAt: -1 });
        }

        // 4. Try current guild with state
        if (!backup && state) {
            backup = await BackupSchema.findOne({ guildId: interaction.guild.id, state: state.trim() });
        }

        // 5. Cross-server fallback: Try finding by state among backups created by this user
        if (!backup && state) {
            backup = await BackupSchema.findOne({ creatorId: interaction.user.id, state: state.trim() }).sort({ createdAt: -1 });
        }

        // 6. Cross-server fallback: Try finding by state globally across any server
        if (!backup && state && state !== 'latest') {
            backup = await BackupSchema.findOne({ state: state.trim() }).sort({ createdAt: -1 });
        }

        // 7. Fallback to latest backup in current guild
        if (!backup && (!state || state === 'latest')) {
            backup = await BackupSchema.findOne({ guildId: interaction.guild.id, state: 'latest' }) ||
                     await BackupSchema.findOne({ guildId: interaction.guild.id }).sort({ createdAt: -1 });
        }

        // 8. Fallback to latest backup created anywhere by this user
        if (!backup) {
            backup = await BackupSchema.findOne({ creatorId: interaction.user.id }).sort({ createdAt: -1 });
        }

        if (!backup) {
            const errContent = `❌ No backup found for state: \`${state || 'latest'}\`${backupId ? ` or ID: \`${backupId}\`` : ''}. Use \`/backup list\` to see available backups or specify \`backup_id\`.`;
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ content: errContent, flags: MessageFlags.Ephemeral });
            } else {
                return interaction.reply({ content: errContent, flags: MessageFlags.Ephemeral });
            }
        }

        const serverData = JSON.parse(backup.data);
        if (!serverData.guildInfo || !Array.isArray(serverData.channels)) {
            return interaction.reply({ content: '❌ Backup data is corrupted or in an unrecognized format.', flags: MessageFlags.Ephemeral });
        }

        const scopeLabel = scope === 'all' ? 'everything (channels, roles, member roles, emojis, bot configs)' : scope;
        const confirmButton = new ButtonBuilder().setCustomId('confirm_restore').setLabel('Yes, Restore').setStyle(ButtonStyle.Danger);
        const cancelButton  = new ButtonBuilder().setCustomId('cancel_restore').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const sourceGuildName = backup.guildName || serverData.guildInfo?.name || backup.guildId;
        const backupIdDisplay = backup.backupId ? `\`${backup.backupId}\`` : `State: \`${backup.state}\``;

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: `⚠️ **Restore Backup ${backupIdDisplay}?**\n` +
                         `> Source Server: **${sourceGuildName}** (\`${backup.guildId}\`)\n` +
                         `> Target Server: **${interaction.guild.name}** (\`${interaction.guild.id}\`)\n` +
                         `> Restoring: **${scopeLabel}**\n` +
                         `> Backup Created: <t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:R>\n\n` +
                         `**WARNING: This will wipe and rebuild existing server structure & configurations. Confirm?**`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({
                content: `⚠️ **Restore Backup ${backupIdDisplay}?**\n` +
                         `> Source Server: **${sourceGuildName}** (\`${backup.guildId}\`)\n` +
                         `> Target Server: **${interaction.guild.name}** (\`${interaction.guild.id}\`)\n` +
                         `> Restoring: **${scopeLabel}**\n` +
                         `> Backup Created: <t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:R>\n\n` +
                         `**WARNING: This will wipe and rebuild existing server structure & configurations. Confirm?**`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }

        const filter = i => i.user.id === interaction.user.id && ['confirm_restore', 'cancel_restore'].includes(i.customId);
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async i => {
            try {
                if (i.customId === 'cancel_restore') {
                    await i.update({ content: 'Restore cancelled.', components: [], flags: MessageFlags.Ephemeral });
                    return collector.stop();
                }

                rateLimit.set(rateLimitKey, Date.now());
                await i.update({ content: '⏳ Restoring backup... This may take a few minutes. Please wait.', components: [], flags: MessageFlags.Ephemeral });

                const log = [];
                const warnings = [];

                // ── PHASE 1: WIPE ──────────────────────────────────────────
                if (scope === 'all' || scope === 'channels') {
                    await wipeChannels(interaction.guild);
                    log.push('✅ Channels wiped');
                }
                if (scope === 'all' || scope === 'roles') {
                    await wipeRoles(interaction.guild);
                    log.push('✅ Roles wiped');
                }

                // ── PHASE 2: GUILD SETTINGS ────────────────────────────────
                if (scope === 'all') {
                    try {
                        const gi = serverData.guildInfo;
                        if (gi) {
                            if (gi.name && interaction.guild.name !== gi.name) {
                                await interaction.guild.setName(gi.name).catch(() => {});
                            }
                            if (gi.verificationLevel !== undefined) {
                                await interaction.guild.setVerificationLevel(gi.verificationLevel).catch(() => {});
                            }
                            if (gi.defaultMessageNotifications !== undefined) {
                                await interaction.guild.setDefaultMessageNotifications(gi.defaultMessageNotifications).catch(() => {});
                            }
                            if (gi.explicitContentFilter !== undefined) {
                                await interaction.guild.setExplicitContentFilter(gi.explicitContentFilter).catch(() => {});
                            }
                            if (gi.everyonePermissions && interaction.guild.roles.everyone) {
                                await interaction.guild.roles.everyone.setPermissions(gi.everyonePermissions).catch(() => {});
                            }
                            if (gi.icon) {
                                await interaction.guild.setIcon(gi.icon).catch(() => {});
                            }
                            log.push('✅ Guild settings restored');
                        }
                    } catch (e) {
                        warnings.push(`Guild settings: ${e.message}`);
                    }
                }

                // ── PHASE 3: ROLES FIRST (channels need them for perms) ────
                const roleMap = {}; // roleName -> new role ID
                if (scope === 'all' || scope === 'roles') {
                    const result = await restoreRoles(interaction.guild, serverData);
                    Object.assign(roleMap, result.roleMap);
                    if (result.warnings.length) warnings.push(...result.warnings);
                    log.push(`✅ Roles restored (${Object.keys(roleMap).length})`);
                } else {
                    // Build roleMap from existing roles for channel perm lookup
                    interaction.guild.roles.cache.forEach(r => { roleMap[r.name] = r.id; });
                }

                // ── PHASE 4: CHANNELS & CATEGORIES ────────────────────────
                if (scope === 'all' || scope === 'channels') {
                    const catMap = await restoreCategories(interaction.guild, serverData, roleMap);
                    await restoreChannels(interaction.guild, serverData, roleMap, catMap);
                    log.push(`✅ Categories & channels restored (${serverData.categories?.length || 0} cats, ${serverData.channels?.length || 0} channels)`);
                }

                // ── PHASE 5: MEMBER ROLE ASSIGNMENTS ──────────────────────
                if (scope === 'all' || scope === 'roles') {
                    const memberResult = await restoreMemberRoles(interaction.guild, serverData, roleMap);
                    log.push(`✅ Member roles assigned (${memberResult.assigned} members)`);
                    if (memberResult.skipped > 0) warnings.push(`${memberResult.skipped} members not found (left server)`);
                }

                // ── PHASE 6: EMOJIS ───────────────────────────────────────
                if (scope === 'all' || scope === 'emojis') {
                    await wipeEmojis(interaction.guild);
                    const emojiResult = await restoreEmojis(interaction.guild, serverData.emojis || []);
                    log.push(`✅ Emojis restored (${emojiResult.restored})`);
                    if (emojiResult.failed > 0) warnings.push(`${emojiResult.failed} emojis failed to restore`);
                }

                // ── PHASE 7: BOT CONFIGS ──────────────────────────────────
                if (scope === 'all' || scope === 'configs') {
                    // Refresh channel/role cache after restore
                    await interaction.guild.channels.fetch().catch(() => {});
                    await interaction.guild.roles.fetch().catch(() => {});

                    const configResult = await restoreBotConfigs(interaction.guild, serverData.botConfigs || {});
                    log.push(`✅ Bot configs restored: ${configResult.restored.join(', ') || 'none'}`);
                    if (configResult.warnings.length) warnings.push(...configResult.warnings);
                }

                const summaryLines = [...log];
                if (warnings.length) summaryLines.push('', '⚠️ **Warnings:**', ...warnings.map(w => `• ${w}`));

                await i.followUp({
                    content: `✅ **Restore Complete!**\n\n${summaryLines.join('\n')}`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                console.error(`[BACKUP] Restore Error [Guild: ${interaction.guild.id}]:`, error);
                await i.followUp({ content: `❌ Restore failed: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
            } finally {
                collector.stop();
            }
        });

        collector.on('end', async collected => {
            if (!collected.size) {
                await interaction.editReply({ content: 'Restore timed out.', components: [] }).catch(() => {});
            }
        });
    } catch (error) {
        console.error(`[BACKUP] Restore setup Error [Guild: ${interaction.guild.id}]:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `Failed: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        } else {
            await interaction.reply({ content: `Failed: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
}

// ─── WIPE HELPERS ─────────────────────────────────────────────────────────────

async function wipeChannels(guild) {
    const toDelete = guild.channels.cache.filter(c =>
        c.id !== guild.rulesChannelId &&
        c.id !== guild.publicUpdatesChannelId &&
        c.id !== guild.systemChannelId
    );
    for (const ch of toDelete.values()) {
        await retryOperation(() => ch.delete('Backup restore').catch(() => {}));
        await sleep(300);
    }
}

async function wipeRoles(guild) {
    const toDelete = guild.roles.cache.filter(r =>
        !r.managed &&
        r.name !== '@everyone' &&
        r.editable
    );
    for (const role of toDelete.values()) {
        await retryOperation(() => role.delete('Backup restore').catch(() => {}));
        await sleep(300);
    }
}

async function wipeEmojis(guild) {
    for (const emoji of guild.emojis.cache.values()) {
        await retryOperation(() => emoji.delete('Backup restore').catch(() => {}));
        await sleep(200);
    }
}

// ─── ROLE RESTORE ─────────────────────────────────────────────────────────────

async function restoreRoles(guild, serverData) {
    const roleMap = {}; // roleName -> new role ID
    const warnings = [];

    // Roles are stored highest-position first; create them that way
    // so Discord assigns increasing positions correctly
    for (const roleData of (serverData.roles || [])) {
        try {
            const options = {
                name: roleData.name,
                permissions: roleData.permissions || [],
                hoist: roleData.hoist || false,
                mentionable: roleData.mentionable || false,
            };
            if (typeof roleData.color === 'number' && roleData.color > 0) {
                options.color = roleData.color;
            }
            // Icon requires ROLE_ICONS feature
            if (roleData.icon && guild.features?.includes('ROLE_ICONS')) {
                options.icon = roleData.icon;
            }
            const newRole = await retryOperation(() => guild.roles.create(options));
            roleMap[roleData.name] = newRole.id;
            await sleep(400);
        } catch (e) {
            warnings.push(`Role "${roleData.name}" failed: ${e.message}`);
        }
    }

    // Restore role positions in bulk
    try {
        const positionUpdates = (serverData.roles || [])
            .filter(rd => roleMap[rd.name])
            .map(rd => ({ role: roleMap[rd.name], position: rd.position }))
            .sort((a, b) => a.position - b.position);
        if (positionUpdates.length > 0) {
            await retryOperation(() => guild.roles.setPositions(positionUpdates));
        }
    } catch (e) {
        warnings.push(`Role position ordering failed: ${e.message}`);
    }

    return { roleMap, warnings };
}

// ─── CATEGORY RESTORE ─────────────────────────────────────────────────────────

async function restoreCategories(guild, serverData, roleMap) {
    const catMap = {}; // categoryName -> new category ID

    // Already sorted by rawPosition in backup
    for (const catData of (serverData.categories || [])) {
        try {
            const permOverwrites = buildPermOverwrites(guild, roleMap, catData.permissions || []);
            const newCat = await retryOperation(() => guild.channels.create({
                name: catData.name,
                type: ChannelType.GuildCategory,
                permissionOverwrites: permOverwrites
            }));
            catMap[catData.name] = newCat.id;
            await sleep(400);
        } catch (e) {
            console.warn(`[RESTORE] Category "${catData.name}" failed: ${e.message}`);
        }
    }

    // Set positions
    try {
        const posUpdates = (serverData.categories || [])
            .filter(c => catMap[c.name])
            .map((c, idx) => ({ channel: catMap[c.name], position: idx }));
        if (posUpdates.length > 0) {
            await retryOperation(() => guild.channels.setPositions(posUpdates));
        }
    } catch (e) {
        console.warn('[RESTORE] Category position set failed:', e.message);
    }

    return catMap;
}

// ─── CHANNEL RESTORE ──────────────────────────────────────────────────────────

async function restoreChannels(guild, serverData, roleMap, catMap) {
    // Sort channels by rawPosition to restore in the right order
    const sortedChannels = [...(serverData.channels || [])].sort((a, b) => a.rawPosition - b.rawPosition);

    for (const chData of sortedChannels) {
        try {
            const permOverwrites = buildPermOverwrites(guild, roleMap, chData.permissions || []);

            // v2.0: parentCategoryName stored directly on channel
            // v1.0: no parentCategoryName — must search categories array for one that lists this channel
            let parentCategoryName = chData.parentCategoryName || null;
            if (!parentCategoryName && serverData.categories?.length) {
                const owningCat = serverData.categories.find(cat => {
                    const list = cat.channelNames || cat.channels || [];
                    return list.includes(chData.name);
                });
                parentCategoryName = owningCat?.name || null;
            }
            const parentId = parentCategoryName ? (catMap[parentCategoryName] || null) : null;

            const options = {
                name: chData.name,
                type: chData.type,
                topic: chData.topic || null,
                rateLimitPerUser: chData.slowmode || 0,
                nsfw: chData.nsfw || false,
                parent: parentId || null,
                permissionOverwrites: permOverwrites
            };

            // Voice-specific
            if (chData.type === ChannelType.GuildVoice || chData.type === ChannelType.GuildStageVoice) {
                if (chData.bitrate) options.bitrate = chData.bitrate;
                if (chData.userLimit !== undefined) options.userLimit = chData.userLimit;
            }

            const newChannel = await retryOperation(() => guild.channels.create(options));

            // Forum extra settings
            if (chData.type === ChannelType.GuildForum) {
                const forumExtra = (serverData.forumChannels || []).find(f => f.name === chData.name);
                if (forumExtra?.settings) {
                    const s = forumExtra.settings;
                    if (s.availableTags?.length) await retryOperation(() => newChannel.setAvailableTags(s.availableTags)).catch(() => {});
                    if (s.defaultAutoArchiveDuration) await retryOperation(() => newChannel.setDefaultAutoArchiveDuration(s.defaultAutoArchiveDuration)).catch(() => {});
                    if (s.defaultForumLayout !== undefined) await retryOperation(() => newChannel.setDefaultForumLayout(s.defaultForumLayout)).catch(() => {});
                }
            }

            await sleep(400);
        } catch (e) {
            console.warn(`[RESTORE] Channel "${chData.name}" failed: ${e.message}`);
        }
    }
}

// ─── MEMBER ROLE RESTORE ──────────────────────────────────────────────────────

async function restoreMemberRoles(guild, serverData, roleMap) {
    let assigned = 0;
    let skipped = 0;

    // Fetch ALL members fresh
    let allMembers;
    try {
        allMembers = await guild.members.fetch();
    } catch (e) {
        allMembers = guild.members.cache;
    }

    for (const memberData of (serverData.members || [])) {
        try {
            const member = allMembers.get(memberData.id);
            if (!member) { skipped++; continue; }

            const roleIds = (memberData.roles || [])
                .map(name => roleMap[name])
                .filter(Boolean);

            if (roleIds.length > 0) {
                // Get current roles that we should keep (bot/admin/managed)
                const keepRoles = member.roles.cache
                    .filter(r => r.managed || r.permissions.has(PermissionsBitField.Flags.Administrator) || r.name === '@everyone')
                    .map(r => r.id);

                await retryOperation(() => member.roles.set([...new Set([...keepRoles, ...roleIds])]));
                assigned++;
                await sleep(200);
            }
        } catch (e) {
            console.warn(`[RESTORE] Member ${memberData.id} roles failed: ${e.message}`);
        }
    }

    return { assigned, skipped };
}

// ─── EMOJI RESTORE ────────────────────────────────────────────────────────────

async function restoreEmojis(guild, emojis) {
    let restored = 0;
    let failed = 0;
    for (const emojiData of emojis) {
        try {
            await retryOperation(() => guild.emojis.create({ attachment: emojiData.url, name: emojiData.name }));
            restored++;
            await sleep(500);
        } catch (e) {
            failed++;
            console.warn(`[RESTORE] Emoji "${emojiData.name}" failed: ${e.message}`);
        }
    }
    return { restored, failed };
}

// ─── BOT CONFIG RESTORE ───────────────────────────────────────────────────────

async function restoreBotConfigs(guild, botConfigs) {
    const restored = [];
    const warnings = [];
    const guildId = guild.id;

    // Helper: resolve channel name -> ID
    function findChannel(name, type) {
        if (!name) return null;
        const ch = guild.channels.cache.find(c =>
            c.name === name && (type === undefined || c.type === type)
        );
        return ch?.id || null;
    }

    // Helper: resolve role name -> ID
    function findRole(name) {
        if (!name) return null;
        if (name === '@everyone') return guild.id;
        return guild.roles.cache.find(r => r.name === name)?.id || null;
    }

    // Welcome
    if (botConfigs.welcome) {
        try {
            const cfg = botConfigs.welcome;
            const channelId = findChannel(cfg.channelName);
            if (!channelId) warnings.push(`Welcome: channel "${cfg.channelName}" not found`);
            await WelcomeSchema.findOneAndUpdate(
                { guildId },
                {
                    guildId,
                    channelId: channelId || cfg.channelName,
                    message: cfg.message,
                    isEmbed: cfg.isEmbed,
                    isImage: cfg.isImage,
                    author: cfg.author,
                    title: cfg.title,
                    color: cfg.color,
                    image: cfg.image
                },
                { upsert: true, new: true }
            );
            restored.push('welcome');
        } catch (e) { warnings.push(`Welcome restore failed: ${e.message}`); }
    }

    // Verification
    if (botConfigs.verification) {
        try {
            const cfg = botConfigs.verification;
            const channelId = findChannel(cfg.channelName);
            const roleId = findRole(cfg.roleName);
            if (!channelId) warnings.push(`Verification: channel "${cfg.channelName}" not found`);
            if (!roleId) warnings.push(`Verification: role "${cfg.roleName}" not found`);

            await VerifySchema.findOneAndUpdate(
                { Guild: guildId },
                {
                    Guild: guildId,
                    Channel: channelId || cfg.channelName,
                    Role: roleId || cfg.roleName,
                    MessageContent: cfg.messageContent,
                    Color: cfg.color,
                    Thumbnail: cfg.thumbnail,
                    Image: cfg.image,
                    Footer: cfg.footer
                },
                { upsert: true, new: true }
            );

            // Re-post active Verification Embed and Button in the restored channel!
            if (channelId) {
                const vChannel = guild.channels.cache.get(channelId);
                if (vChannel && vChannel.isTextBased()) {
                    const verifyButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("verify")
                            .setLabel("✅ Verify")
                            .setStyle(ButtonStyle.Success)
                    );

                    const verifyEmbed = new EmbedBuilder()
                        .setColor(cfg.color || "Green")
                        .setTimestamp()
                        .setTitle("• Verification Message")
                        .setAuthor({ name: `✅ Verification Process` })
                        .setDescription(`> ${cfg.messageContent || "Complete the Captcha and verify with Discord to get full access to the server!"}`);

                    if (cfg.thumbnail) verifyEmbed.setThumbnail(cfg.thumbnail);
                    if (cfg.image) verifyEmbed.setImage(cfg.image);
                    if (cfg.footer) verifyEmbed.setFooter({ text: cfg.footer });
                    else verifyEmbed.setFooter({ text: `✅ Verification Prompt` });

                    const msg = await vChannel.send({
                        embeds: [verifyEmbed],
                        components: [verifyButtons]
                    }).catch(e => {
                        warnings.push(`Verification embed post: ${e.message}`);
                    });

                    if (msg) {
                        await VerifySchema.updateOne(
                            { Guild: guildId },
                            { $set: { Message: msg.id } }
                        );
                    }
                }
            }

            restored.push('verification');
        } catch (e) { warnings.push(`Verification restore failed: ${e.message}`); }
    }

    // Logging
    if (botConfigs.logging) {
        try {
            const cfg = botConfigs.logging;
            const channels = {};
            for (const key of ['all', 'message', 'channel', 'guild', 'role', 'voice', 'member']) {
                channels[key] = findChannel(cfg[key]) || cfg[key] || null;
                if (cfg[key] && !channels[key]) warnings.push(`Logging: "${key}" channel "${cfg[key]}" not found`);
            }
            await LogSchema.findOneAndUpdate(
                { Guild: guildId },
                { Guild: guildId, LogChannels: channels },
                { upsert: true, new: true }
            );
            restored.push('logging');
        } catch (e) { warnings.push(`Logging restore failed: ${e.message}`); }
    }

    // Ticket Setup
    if (botConfigs.ticketSetup) {
        try {
            const cfg = botConfigs.ticketSetup;
            const channelId     = findChannel(cfg.channelName);
            const categoryId    = findChannel(cfg.categoryName, ChannelType.GuildCategory);
            const transcriptsId = findChannel(cfg.transcriptsName);
            const handlersId    = findRole(cfg.handlersName);
            const everyoneId    = findRole(cfg.everyoneName) || guild.id;

            const categories = (cfg.categories || []).map(cat => ({
                emoji: cat.emoji,
                name: cat.name,
                value: cat.value,
                description: cat.description,
                ticketCategory: findChannel(cat.ticketCategoryName, ChannelType.GuildCategory) || cat.ticketCategoryName
            }));

            await TicketSetupSchema.findOneAndUpdate(
                { GuildID: guildId },
                {
                    GuildID: guildId,
                    Channel: channelId || cfg.channelName,
                    Category: categoryId || cfg.categoryName,
                    Transcripts: transcriptsId || cfg.transcriptsName,
                    Handlers: handlersId || cfg.handlersName,
                    Everyone: everyoneId,
                    Description: cfg.description,
                    Categories: categories
                },
                { upsert: true, new: true }
            );
            restored.push('ticket');
        } catch (e) { warnings.push(`Ticket setup restore failed: ${e.message}`); }
    }

    // Autorole
    if (botConfigs.autorole) {
        try {
            const cfg = botConfigs.autorole;
            const roleIds = (cfg.roleNames || []).map(name => findRole(name)).filter(Boolean);
            if (roleIds.length < (cfg.roleNames || []).length) {
                warnings.push(`Autorole: ${(cfg.roleNames || []).length - roleIds.length} roles not found`);
            }
            await AutoRoleSchema.findOneAndUpdate(
                { GuildID: guildId },
                { GuildID: guildId, Roles: roleIds },
                { upsert: true, new: true }
            );
            restored.push('autorole');
        } catch (e) { warnings.push(`Autorole restore failed: ${e.message}`); }
    }

    // Level Setup
    if (botConfigs.levelSetup) {
        try {
            const cfg = botConfigs.levelSetup;
            const roleId = findRole(cfg.roleName);
            const channelId = findChannel(cfg.notificationChannelName);
            await LevelSetupSchema.findOneAndUpdate(
                { Guild: guildId },
                {
                    Guild: guildId,
                    Disabled: cfg.disabled,
                    Role: roleId || cfg.roleName,
                    Multi: cfg.multi,
                    NotificationChannel: channelId || cfg.notificationChannelName
                },
                { upsert: true, new: true }
            );
            restored.push('levelSetup');
        } catch (e) { warnings.push(`Level setup restore failed: ${e.message}`); }
    }

    // Level Roles
    if (botConfigs.levelRoles) {
        try {
            const cfg = botConfigs.levelRoles;
            const data = (cfg.data || []).map(entry => ({
                level: entry.level,
                roleId: findRole(entry.roleName) || entry.roleName
            })).filter(e => e.roleId);
            await LevelRoleSchema.findOneAndUpdate(
                { GuildID: guildId },
                { GuildID: guildId, LevelRoleData: data },
                { upsert: true, new: true }
            );
            restored.push('levelRoles');
        } catch (e) { warnings.push(`Level roles restore failed: ${e.message}`); }
    }

    // Join To Create
    if (botConfigs.joinToCreate) {
        try {
            const cfg = botConfigs.joinToCreate;
            const channelId  = findChannel(cfg.channelName);
            const categoryId = findChannel(cfg.categoryName, ChannelType.GuildCategory);
            await JoinToCreateSchema.findOneAndUpdate(
                { Guild: guildId },
                {
                    Guild: guildId,
                    Channel: channelId || cfg.channelName,
                    Category: categoryId || cfg.categoryName,
                    VoiceLimit: cfg.voiceLimit
                },
                { upsert: true, new: true }
            );
            restored.push('joinToCreate');
        } catch (e) { warnings.push(`Join-to-create restore failed: ${e.message}`); }
    }

    // Booster Channel
    if (botConfigs.boosterChannel) {
        try {
            const cfg = botConfigs.boosterChannel;
            const channelId = findChannel(cfg.channelName);
            await BoosterSchema.findOneAndUpdate(
                { guildId },
                { guildId, channelId: channelId || cfg.channelName },
                { upsert: true, new: true }
            );
            restored.push('boosterChannel');
        } catch (e) { warnings.push(`Booster channel restore failed: ${e.message}`); }
    }

    // Staff Role
    if (botConfigs.staffRole) {
        try {
            const cfg = botConfigs.staffRole;
            const roleId = findRole(cfg.roleName);
            await StaffRoleSchema.findOneAndUpdate(
                { Guild: guildId },
                { Guild: guildId, Role: roleId || cfg.roleName },
                { upsert: true, new: true }
            );
            restored.push('staffRole');
        } catch (e) { warnings.push(`Staff role restore failed: ${e.message}`); }
    }

    // Join Ping
    if (botConfigs.joinPing) {
        try {
            const cfg = botConfigs.joinPing;
            const channelIds = (cfg.channelNames || []).map(name => findChannel(name)).filter(Boolean);
            await JoinPingSchema.findOneAndUpdate(
                { Guild: guildId },
                { Guild: guildId, Channel: channelIds },
                { upsert: true, new: true }
            );
            restored.push('joinPing');
        } catch (e) { warnings.push(`Join ping restore failed: ${e.message}`); }
    }

    return { restored, warnings };
}

// ─── PERMISSION HELPER ────────────────────────────────────────────────────────

function buildPermOverwrites(guild, roleMap, permissions) {
    return (permissions || []).map(p => {
        const name = p.roleName || p.id; // support both old (id) and new (roleName) format
        let id;
        if (name === '@everyone') {
            id = guild.id;
        } else {
            id = roleMap[name] || guild.roles.cache.find(r => r.name === name)?.id;
        }
        if (!id) return null;
        return { id, allow: p.allow || [], deny: p.deny || [] };
    }).filter(Boolean);
}

// ─── INFO ─────────────────────────────────────────────────────────────────────

async function handleInfoBackup(interaction, backupId) {
    try {
        if (!backupId) {
            return interaction.reply({ content: 'Please provide a valid Backup ID.', flags: MessageFlags.Ephemeral });
        }
        const cleanId = backupId.trim();
        const backup = await BackupSchema.findOne({ backupId: cleanId }) ||
                       await BackupSchema.findOne({ backupId: new RegExp('^' + cleanId + '$', 'i') });

        if (!backup) {
            return interaction.reply({ content: `❌ Backup with ID \`${cleanId}\` not found in database.`, flags: MessageFlags.Ephemeral });
        }

        let serverData;
        try {
            serverData = JSON.parse(backup.data);
        } catch (e) {
            return interaction.reply({ content: '❌ Backup data is corrupted or cannot be parsed.', flags: MessageFlags.Ephemeral });
        }

        const configsStored = Object.keys(serverData.botConfigs || {}).join(', ') || 'none';
        const embed = new EmbedBuilder()
            .setTitle(`ℹ️ Backup Information [${backup.backupId || cleanId}]`)
            .setColor('#00b4d8')
            .setDescription(`Detailed snapshot info for **${backup.guildName || serverData.guildInfo?.name || 'Unknown Guild'}**`)
            .addFields(
                { name: 'Backup ID', value: `\`${backup.backupId || cleanId}\``, inline: true },
                { name: 'Origin Server', value: `**${backup.guildName || serverData.guildInfo?.name || 'Unknown'}** (\`${backup.guildId}\`)`, inline: true },
                { name: 'State', value: `\`${backup.state}\``, inline: true },
                { name: 'Created', value: `<t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:R>`, inline: true },
                { name: 'Size', value: `${((backup.size || Buffer.byteLength(backup.data, 'utf8')) / 1024).toFixed(2)} KB`, inline: true },
                { name: 'Type', value: backup.isAuto ? '📅 24h Auto' : '💾 Manual Snapshot', inline: true },
                { name: 'Categories', value: `${serverData.categories?.length || 0}`, inline: true },
                { name: 'Channels', value: `${serverData.channels?.length || 0}`, inline: true },
                { name: 'Roles', value: `${serverData.roles?.length || 0}`, inline: true },
                { name: 'Members w/ Roles', value: `${serverData.members?.length || 0}`, inline: true },
                { name: 'Emojis', value: `${serverData.emojis?.length || 0}`, inline: true },
                { name: 'Bot Configs', value: configsStored, inline: true },
                { name: 'Cross-Server Restore Command', value: `\`/backup restore backup_id:${backup.backupId || cleanId}\``, inline: false }
            )
            .setFooter({ text: 'Strikers Cross-Server Engine' })
            .setTimestamp();

        if (serverData.guildInfo?.icon) {
            embed.setThumbnail(serverData.guildInfo.icon);
        }

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('[BACKUP] Info Error:', error);
        return interaction.reply({ content: `Failed to retrieve backup info: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

async function handleListBackups(interaction, serverId) {
    try {
        const targetGuildId = (serverId || interaction.guild.id).trim();
        const backups = await BackupSchema.find({ guildId: targetGuildId }).sort({ createdAt: -1 });
        if (!backups.length) {
            return interaction.reply({ content: `No backups found for server \`${targetGuildId}\`. Use \`/backup create\` to make one.`, flags: MessageFlags.Ephemeral });
        }

        const firstBackup = backups[0];
        const serverName = firstBackup.guildName || (targetGuildId === interaction.guild.id ? interaction.guild.name : targetGuildId);

        const embed = new EmbedBuilder()
            .setTitle('📦 Strikers Server Backups')
            .setDescription(`Backups for **${serverName}** (\`${targetGuildId}\`)`)
            .setColor('#80b918')
            .setTimestamp();

        for (const [index, backup] of backups.entries()) {
            try {
                const serverData = JSON.parse(backup.data);
                const typeLabel = backup.isAuto ? '📅 Auto' : '💾 Manual';
                const hasConfigs = serverData.botConfigs && Object.keys(serverData.botConfigs).length > 0;
                const schemaV = serverData.schemaVersion || '1.0.0';
                const bId = backup.backupId ? `\`${backup.backupId}\`` : '*(legacy)*';

                embed.addFields({
                    name: `${index + 1}. ID: ${bId} | State: \`${backup.state}\` [${typeLabel}]`,
                    value: [
                        `**Created:** <t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:R>`,
                        `**Size:** ${((backup.size || Buffer.byteLength(backup.data, 'utf8')) / 1024).toFixed(2)} KB  |  **Schema:** v${schemaV}`,
                        `**Cats/Channels/Roles:** ${serverData.categories?.length || 0} / ${serverData.channels?.length || 0} / ${serverData.roles?.length || 0}`,
                        `**Members w/ Roles:** ${serverData.members?.length || 0}  |  **Emojis:** ${serverData.emojis?.length || 0}`,
                        `**Bot Configs:** ${hasConfigs ? Object.keys(serverData.botConfigs).join(', ') : 'none'}`,
                        backup.backupId ? `**Restore:** \`/backup restore backup_id:${backup.backupId}\`` : ''
                    ].filter(Boolean).join('\n'),
                    inline: false
                });
            } catch (e) {
                embed.addFields({ name: `${index + 1}. \`${backup.state}\``, value: '⚠️ Could not read backup data', inline: false });
            }
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('[BACKUP] List Error:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Failed to list backups.', flags: MessageFlags.Ephemeral }).catch(() => {});
        } else {
            await interaction.reply({ content: 'Failed to list backups.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
}

// ─── AUTO STATUS ──────────────────────────────────────────────────────────────

async function handleAutoStatus(interaction) {
    try {
        const autoBackups = await BackupSchema.find({ guildId: interaction.guild.id, isAuto: true }).sort({ createdAt: -1 });

        const embed = new EmbedBuilder()
            .setTitle('📅 Automated 24-Hour Backup Status')
            .setDescription(`Information about automated rolling backups for **${interaction.guild.name}**`)
            .setColor('#00f5d4')
            .addFields(
                { name: 'Schedule', value: '`Every 24 Hours` (Daily at Midnight)', inline: true },
                { name: 'Retention', value: '`Rolling 3 Days`', inline: true },
                { name: 'Auto Backups', value: `\`${autoBackups.length}\` snapshot(s)`, inline: true }
            )
            .setTimestamp();

        if (autoBackups.length) {
            const listText = autoBackups.map((b, i) => {
                const ageDays = ((Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24)).toFixed(1);
                return `**${i + 1}. \`${b.state}\`** — <t:${Math.floor(new Date(b.createdAt).getTime() / 1000)}:R> (~${ageDays}d old)`;
            }).join('\n');
            embed.addFields({ name: 'Recent Snapshots', value: listText });
        } else {
            embed.addFields({ name: 'Recent Snapshots', value: 'No automated backups yet.' });
        }

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[BACKUP] Auto Status Error:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Failed to retrieve auto-backup status.', flags: MessageFlags.Ephemeral }).catch(() => {});
        } else {
            await interaction.reply({ content: 'Failed to retrieve auto-backup status.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
}
