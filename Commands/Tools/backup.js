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
const { createGuildBackupData, retryOperation } = require('../../Utils/backupUtils');

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

const maxStates = 5;
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
        .setDescription('Manage server backups')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Creates a full backup of the server (structure + bot setups + member roles).')
                .addStringOption(option =>
                    option.setName('state').setDescription('State name (Default: latest).').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists all backups for this server.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto-status')
                .setDescription('View status of automated 24-hour rolling backups.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restores a backup of the server.')
                .addStringOption(option =>
                    option.setName('state').setDescription('State to restore from.').setRequired(false))
                .addStringOption(option =>
                    option.setName('scope').setDescription('What to restore.').setRequired(false)
                        .addChoices(
                            { name: 'All', value: 'all' },
                            { name: 'Channels & Categories', value: 'channels' },
                            { name: 'Roles & Member Roles', value: 'roles' },
                            { name: 'Emojis', value: 'emojis' },
                            { name: 'Bot Setups Only', value: 'configs' }
                        ))
        ),
    async execute(interaction) {
        try {
            if (!interaction.guild) {
                return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            }

            const subcommand = interaction.options.getSubcommand();
            const state = interaction.options.getString('state') || 'latest';

            if (!validateState(state)) {
                return interaction.reply({ content: 'Invalid state name. Use alphanumeric characters, dashes, and underscores (max 35).', flags: MessageFlags.Ephemeral });
            }

            if (subcommand === 'create') {
                await handleCreateBackup(interaction, state);
            } else if (subcommand === 'list') {
                await handleListBackups(interaction);
            } else if (subcommand === 'auto-status') {
                await handleAutoStatus(interaction);
            } else if (subcommand === 'restore') {
                await handleRestoreBackup(interaction, state, interaction.options.getString('scope') || 'all');
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

        await interaction.reply({ content: '⏳ Creating full backup (fetching all members, reading configs)...', flags: MessageFlags.Ephemeral });

        const serverDataString = await createGuildBackupData(interaction.guild);
        const serverData = JSON.parse(serverDataString);
        const size = Buffer.byteLength(serverDataString, 'utf8');

        // Prune old backups
        const guildBackups = await BackupSchema.find({ guildId: interaction.guild.id });
        if (guildBackups.length >= maxStates) {
            const latestIndex = guildBackups.findIndex(b => b.state === 'latest');
            const toDelete = guildBackups.filter((b, i) => i !== latestIndex).slice(0, guildBackups.length - maxStates + 1);
            for (const backup of toDelete) {
                await retryOperation(() => BackupSchema.findByIdAndDelete(backup._id));
            }
        }

        const existingBackup = await BackupSchema.findOne({ guildId: interaction.guild.id, state });
        if (existingBackup) {
            await retryOperation(() => BackupSchema.updateOne(
                { guildId: interaction.guild.id, state },
                { data: serverDataString, creatorId: interaction.user.id, size, updatedAt: new Date() }
            ));
        } else {
            await retryOperation(() => BackupSchema.create({
                data: serverDataString,
                guildId: interaction.guild.id,
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
            .setTitle('✅ Server Backup Created')
            .setColor('#80b918')
            .addFields(
                { name: 'State', value: `\`${state}\``, inline: true },
                { name: 'Size', value: `${(size / 1024).toFixed(2)} KB`, inline: true },
                { name: 'Schema', value: serverData.schemaVersion, inline: true },
                { name: 'Categories', value: `${serverData.categories?.length || 0}`, inline: true },
                { name: 'Channels', value: `${serverData.channels?.length || 0}`, inline: true },
                { name: 'Roles', value: `${serverData.roles?.length || 0}`, inline: true },
                { name: 'Members w/ Roles', value: `${serverData.members?.length || 0}`, inline: true },
                { name: 'Emojis', value: `${serverData.emojis?.length || 0}`, inline: true },
                { name: 'Bot Configs Stored', value: configsStored || 'none' }
            )
            .setTimestamp();

        await interaction.editReply({ content: '', embeds: [embed], flags: MessageFlags.Ephemeral });
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

async function handleRestoreBackup(interaction, state, scope) {
    try {
        if (!(await hasRequiredPermissions(interaction))) {
            return interaction.reply({ content: 'You need Administrator, Manage Server, or BackupAdmin role.', flags: MessageFlags.Ephemeral });
        }

        const rateLimitKey = `${interaction.guild.id}:restore`;
        if (rateLimit.has(rateLimitKey) && Date.now() - rateLimit.get(rateLimitKey) < 5 * 60 * 1000) {
            return interaction.reply({ content: 'Please wait 5 minutes before restoring another backup.', flags: MessageFlags.Ephemeral });
        }

        const backup = await BackupSchema.findOne({ guildId: interaction.guild.id, state });
        if (!backup) {
            return interaction.reply({ content: `No backup found for state: \`${state}\`. Use \`/backup list\` to see available backups.`, flags: MessageFlags.Ephemeral });
        }

        const serverData = JSON.parse(backup.data);
        if (!serverData.guildInfo || !Array.isArray(serverData.channels)) {
            return interaction.reply({ content: '❌ Backup data is corrupted or in an unrecognized format.', flags: MessageFlags.Ephemeral });
        }

        const scopeLabel = scope === 'all' ? 'everything (channels, roles, member roles, emojis, bot configs)' : scope;
        const confirmButton = new ButtonBuilder().setCustomId('confirm_restore').setLabel('Yes, Restore').setStyle(ButtonStyle.Danger);
        const cancelButton  = new ButtonBuilder().setCustomId('cancel_restore').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({
            content: `⚠️ **Restore \`${state}\`?**\nThis will restore **${scopeLabel}**.\nBackup from: <t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:R>\n\n**This cannot be undone. Confirm?**`,
            components: [row],
            flags: MessageFlags.Ephemeral
        });

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

                // ── PHASE 2: ROLES FIRST (channels need them for perms) ────
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

                // ── PHASE 3: CHANNELS & CATEGORIES ────────────────────────
                if (scope === 'all' || scope === 'channels') {
                    const catMap = await restoreCategories(interaction.guild, serverData, roleMap);
                    await restoreChannels(interaction.guild, serverData, roleMap, catMap);
                    log.push(`✅ Categories & channels restored (${serverData.categories?.length || 0} cats, ${serverData.channels?.length || 0} channels)`);
                }

                // ── PHASE 4: MEMBER ROLE ASSIGNMENTS ──────────────────────
                if (scope === 'all' || scope === 'roles') {
                    const memberResult = await restoreMemberRoles(interaction.guild, serverData, roleMap);
                    log.push(`✅ Member roles assigned (${memberResult.assigned} members)`);
                    if (memberResult.skipped > 0) warnings.push(`${memberResult.skipped} members not found (left server)`);
                }

                // ── PHASE 5: EMOJIS ───────────────────────────────────────
                if (scope === 'all' || scope === 'emojis') {
                    await wipeEmojis(interaction.guild);
                    const emojiResult = await restoreEmojis(interaction.guild, serverData.emojis || []);
                    log.push(`✅ Emojis restored (${emojiResult.restored})`);
                    if (emojiResult.failed > 0) warnings.push(`${emojiResult.failed} emojis failed to restore`);
                }

                // ── PHASE 6: BOT CONFIGS ──────────────────────────────────
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
        !r.permissions.has(PermissionsBitField.Flags.Administrator) &&
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
                color: roleData.color || null,
                permissions: roleData.permissions || [],
                hoist: roleData.hoist || false,
                mentionable: roleData.mentionable || false,
            };
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
            const parentId = chData.parentCategoryName ? catMap[chData.parentCategoryName] : null;

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

// ─── LIST ─────────────────────────────────────────────────────────────────────

async function handleListBackups(interaction) {
    try {
        const backups = await BackupSchema.find({ guildId: interaction.guild.id }).sort({ createdAt: -1 });
        if (!backups.length) {
            return interaction.reply({ content: 'No backups found for this server. Use `/backup create` to make one.', flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle('📦 Server Backups')
            .setDescription(`All backups for **${interaction.guild.name}**`)
            .setColor('#80b918')
            .setTimestamp()
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

        for (const [index, backup] of backups.entries()) {
            try {
                const serverData = JSON.parse(backup.data);
                const typeLabel = backup.isAuto ? '📅 Auto' : '💾 Manual';
                const hasConfigs = serverData.botConfigs && Object.keys(serverData.botConfigs).length > 0;
                const schemaV = serverData.schemaVersion || '1.0.0';
                embed.addFields({
                    name: `${index + 1}. \`${backup.state}\` [${typeLabel}]`,
                    value: [
                        `**Created:** <t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:R>`,
                        `**Size:** ${(backup.size / 1024).toFixed(2)} KB  |  **Schema:** v${schemaV}`,
                        `**Cats/Channels/Roles:** ${serverData.categories?.length || 0} / ${serverData.channels?.length || 0} / ${serverData.roles?.length || 0}`,
                        `**Members w/ Roles:** ${serverData.members?.length || 0}  |  **Emojis:** ${serverData.emojis?.length || 0}`,
                        `**Bot Configs:** ${hasConfigs ? Object.keys(serverData.botConfigs).join(', ') : 'none (old backup)'}`,
                        `**Creator:** ${backup.isAuto ? 'System' : `<@${backup.creatorId}>`}`
                    ].join('\n'),
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
