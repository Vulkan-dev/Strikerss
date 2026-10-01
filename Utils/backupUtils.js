const { ChannelType, PermissionsBitField } = require('discord.js');
const BackupSchema = require('../Schemas/backupSchema');

// Schema imports for bot config backup
const WelcomeSchema      = require('../Schemas/welcomeMessageSchema');
const VerifySchema       = require('../Schemas/verificationSchema');
const LogSchema          = require('../Schemas/logschema');
const TicketSetupSchema  = require('../Schemas/TicketSetup');
const AutoRoleSchema     = require('../Schemas/autorole');
const LevelSetupSchema   = require('../Schemas/levelsetup');
const LevelRoleSchema    = require('../Schemas/levelRoleSchema');
const JoinToCreateSchema = require('../Schemas/jointocreate');
const BoosterSchema      = require('../Schemas/boosterChannel');
const StaffRoleSchema    = require('../Schemas/staffrole');
const JoinPingSchema     = require('../Schemas/joinping');

const crypto = require('crypto');

function generateBackupId() {
    return 'XENON-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function retryOperation(operation, maxRetries = 3, delay = 1200) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
}

// Resolve channel ID -> name safely
function chName(guild, id) {
    if (!id) return null;
    return guild.channels.cache.get(id)?.name || null;
}

// Resolve role ID -> name safely
function rName(guild, id) {
    if (!id) return null;
    if (id === guild.id) return '@everyone';
    return guild.roles.cache.get(id)?.name || null;
}

// Serialize permission overwrites using role names (not IDs) for portability
function serializeOverwrites(guild, channel) {
    if (!channel.permissionOverwrites) return [];
    return channel.permissionOverwrites.cache
        .filter(p => p.type === 0) // only role overwrites (skip member-specific)
        .map(p => ({
            roleName: guild.roles.cache.get(p.id)?.name || (p.id === guild.id ? '@everyone' : null),
            allow: p.allow.toArray(),
            deny: p.deny.toArray()
        }))
        .filter(p => p.roleName !== null);
}

async function createGuildBackupData(guild) {
    try {
        // Fetch ALL members (not just online/cached) for full role backup
        let allMembers;
        try {
            allMembers = await guild.members.fetch();
        } catch (e) {
            allMembers = guild.members.cache;
            console.warn(`[BACKUP] Could not fetch all members for ${guild.name}: ${e.message}`);
        }

        const guildId = guild.id;

        // ── DISCORD STRUCTURE ──────────────────────────────────────────────

        // Categories sorted by position (lowest rawPosition = top)
        const categories = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildCategory)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map(c => ({
                name: c.name,
                rawPosition: c.rawPosition,
                permissions: serializeOverwrites(guild, c),
                // Child channels sorted by position
                channelNames: guild.channels.cache
                    .filter(ch => ch.parentId === c.id)
                    .sort((a, b) => a.rawPosition - b.rawPosition)
                    .map(ch => ch.name)
            }));

        // All non-category channels sorted by rawPosition
        const channels = guild.channels.cache
            .filter(c =>
                c.type !== ChannelType.GuildCategory &&
                c.id !== guild.rulesChannelId &&
                c.id !== guild.publicUpdatesChannelId &&
                c.id !== guild.systemChannelId
            )
            .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
            .map(c => ({
                name: c.name,
                type: c.type,
                topic: c.topic || null,
                slowmode: c.rateLimitPerUser || 0,
                autoArchiveDuration: c.defaultAutoArchiveDuration || null,
                rawPosition: c.rawPosition || 0,
                nsfw: c.nsfw || false,
                bitrate: c.bitrate || null,
                userLimit: c.userLimit || 0,
                parentCategoryName: c.parent?.name || null,
                permissions: serializeOverwrites(guild, c)
            }));

        // Forum channels extra settings
        const forumChannels = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildForum)
            .map(f => ({
                name: f.name,
                settings: {
                    availableTags: f.availableTags || [],
                    defaultAutoArchiveDuration: f.defaultAutoArchiveDuration,
                    defaultForumLayout: f.defaultForumLayout,
                    defaultReactionEmoji: f.defaultReactionEmoji,
                    defaultSortOrder: f.defaultSortOrder,
                    defaultThreadRateLimitPerUser: f.defaultThreadRateLimitPerUser,
                    nsfw: f.nsfw,
                    rateLimitPerUser: f.rateLimitPerUser,
                    topic: f.topic
                }
            }));

        // Roles sorted by position descending (highest first = correct hierarchy on restore)
        // Xenon-grade: DO NOT filter out Administrator roles like DEV; keep all user roles!
        const everyonePerms = guild.roles.everyone?.permissions?.toArray() || [];
        const roles = guild.roles.cache
            .filter(r => !r.managed && r.name !== '@everyone')
            .sort((a, b) => b.rawPosition - a.rawPosition)
            .map(r => ({
                name: r.name,
                permissions: r.permissions.toArray(),
                color: r.color,
                hoist: r.hoist,
                mentionable: r.mentionable,
                icon: r.iconURL ? r.iconURL({ dynamic: true }) : null,
                position: r.rawPosition
            }));

        // Members — all user-created roles (including admin roles)
        const members = allMembers
            .map(m => ({
                id: m.id,
                roles: m.roles.cache
                    .filter(r => r.name !== '@everyone' && !r.managed)
                    .map(r => r.name)
            }))
            .filter(m => m.roles.length > 0);

        // Emojis
        const emojis = guild.emojis.cache.map(e => ({ name: e.name, url: (typeof e.imageURL === 'function' ? e.imageURL() : e.url) }));

        // Stickers
        const stickers = guild.stickers
            ? guild.stickers.cache.map(s => ({ name: s.name, description: s.description, tags: s.tags, url: s.url }))
            : [];

        // ── BOT DB CONFIGS ─────────────────────────────────────────────────
        const botConfigs = {};

        // Welcome message setup
        try {
            const welcome = await WelcomeSchema.findOne({ guildId });
            if (welcome) {
                botConfigs.welcome = {
                    channelName: chName(guild, welcome.channelId),
                    message: welcome.message,
                    isEmbed: welcome.isEmbed,
                    isImage: welcome.isImage,
                    author: welcome.author,
                    title: welcome.title,
                    color: welcome.color,
                    image: welcome.image
                };
            }
        } catch (e) { console.warn('[BACKUP] welcome config:', e.message); }

        // Verification setup
        try {
            const verify = await VerifySchema.findOne({ Guild: guildId });
            if (verify) {
                botConfigs.verification = {
                    channelName: chName(guild, verify.Channel),
                    roleName: rName(guild, verify.Role),
                    messageContent: verify.MessageContent,
                    color: verify.Color,
                    thumbnail: verify.Thumbnail,
                    image: verify.Image,
                    footer: verify.Footer
                };
            }
        } catch (e) { console.warn('[BACKUP] verification config:', e.message); }

        // Logging setup
        try {
            const logs = await LogSchema.findOne({ Guild: guildId });
            if (logs && logs.LogChannels) {
                botConfigs.logging = {
                    all:     chName(guild, logs.LogChannels.all),
                    message: chName(guild, logs.LogChannels.message),
                    channel: chName(guild, logs.LogChannels.channel),
                    guild:   chName(guild, logs.LogChannels.guild),
                    role:    chName(guild, logs.LogChannels.role),
                    voice:   chName(guild, logs.LogChannels.voice),
                    member:  chName(guild, logs.LogChannels.member)
                };
            }
        } catch (e) { console.warn('[BACKUP] logging config:', e.message); }

        // Ticket setup
        try {
            const ticket = await TicketSetupSchema.findOne({ GuildID: guildId });
            if (ticket) {
                botConfigs.ticketSetup = {
                    channelName:     chName(guild, ticket.Channel),
                    categoryName:    chName(guild, ticket.Category),
                    transcriptsName: chName(guild, ticket.Transcripts),
                    handlersName:    rName(guild, ticket.Handlers),
                    everyoneName:    rName(guild, ticket.Everyone),
                    description:     ticket.Description,
                    categories: (ticket.Categories || []).map(cat => ({
                        emoji: cat.emoji,
                        name: cat.name,
                        value: cat.value,
                        description: cat.description,
                        ticketCategoryName: chName(guild, cat.ticketCategory)
                    }))
                };
            }
        } catch (e) { console.warn('[BACKUP] ticket config:', e.message); }

        // Autorole
        try {
            const autorole = await AutoRoleSchema.findOne({ GuildID: guildId });
            if (autorole && autorole.Roles) {
                botConfigs.autorole = {
                    roleNames: autorole.Roles.map(id => rName(guild, id)).filter(Boolean)
                };
            }
        } catch (e) { console.warn('[BACKUP] autorole config:', e.message); }

        // Level setup
        try {
            const level = await LevelSetupSchema.findOne({ Guild: guildId });
            if (level) {
                botConfigs.levelSetup = {
                    disabled: level.Disabled,
                    roleName: rName(guild, level.Role),
                    multi: level.Multi,
                    notificationChannelName: chName(guild, level.NotificationChannel)
                };
            }
        } catch (e) { console.warn('[BACKUP] level config:', e.message); }

        // Level roles
        try {
            const levelRoles = await LevelRoleSchema.findOne({ GuildID: guildId });
            if (levelRoles && levelRoles.LevelRoleData) {
                botConfigs.levelRoles = {
                    data: levelRoles.LevelRoleData.map(entry => {
                        const roleId = entry.roleId || entry.RoleID || entry.role;
                        return { level: entry.level || entry.Level, roleName: rName(guild, roleId) };
                    }).filter(e => e.roleName)
                };
            }
        } catch (e) { console.warn('[BACKUP] level roles config:', e.message); }

        // Join-to-create
        try {
            const jtc = await JoinToCreateSchema.findOne({ Guild: guildId });
            if (jtc) {
                botConfigs.joinToCreate = {
                    channelName:  chName(guild, jtc.Channel),
                    categoryName: chName(guild, jtc.Category),
                    voiceLimit:   jtc.VoiceLimit
                };
            }
        } catch (e) { console.warn('[BACKUP] join-to-create config:', e.message); }

        // Booster channel
        try {
            const booster = await BoosterSchema.findOne({ guildId });
            if (booster) {
                botConfigs.boosterChannel = { channelName: chName(guild, booster.channelId) };
            }
        } catch (e) { console.warn('[BACKUP] booster config:', e.message); }

        // Staff role
        try {
            const staff = await StaffRoleSchema.findOne({ Guild: guildId });
            if (staff) {
                botConfigs.staffRole = { roleName: rName(guild, staff.Role) };
            }
        } catch (e) { console.warn('[BACKUP] staff role config:', e.message); }

        // Join ping channels
        try {
            const joinPing = await JoinPingSchema.findOne({ Guild: guildId });
            if (joinPing && joinPing.Channel) {
                const ids = Array.isArray(joinPing.Channel) ? joinPing.Channel : [joinPing.Channel];
                botConfigs.joinPing = { channelNames: ids.map(id => chName(guild, id)).filter(Boolean) };
            }
        } catch (e) { console.warn('[BACKUP] join ping config:', e.message); }

        // ── ASSEMBLE ───────────────────────────────────────────────────────
        const serverData = {
            schemaVersion: '3.0.0',
            guildInfo: {
                name: guild.name,
                ownerId: guild.ownerId,
                icon: guild.iconURL({ dynamic: true, size: 4096 }),
                banner: guild.bannerURL ? guild.bannerURL({ dynamic: true, size: 4096 }) : null,
                splash: guild.splashURL ? guild.splashURL({ dynamic: true, size: 4096 }) : null,
                discoverySplash: guild.discoverySplashURL ? guild.discoverySplashURL({ dynamic: true, size: 4096 }) : null,
                afkChannelName: guild.afkChannel?.name || null,
                afkTimeout: guild.afkTimeout,
                systemChannelName: guild.systemChannel?.name || null,
                rulesChannelName: guild.rulesChannel?.name || null,
                publicUpdatesChannelName: guild.publicUpdatesChannel?.name || null,
                systemChannelFlags: guild.systemChannelFlags ? guild.systemChannelFlags.toArray() : [],
                verificationLevel: guild.verificationLevel,
                defaultMessageNotifications: guild.defaultMessageNotifications,
                explicitContentFilter: guild.explicitContentFilter,
                preferredLocale: guild.preferredLocale,
                everyonePermissions: everyonePerms
            },
            categories,
            channels,
            forumChannels,
            roles,
            members,
            emojis,
            stickers,
            botConfigs
        };

        return JSON.stringify(serverData);
    } catch (error) {
        console.error(`Create Backup Data Error [Guild: ${guild.id}]:`, error);
        throw new Error('Failed to create backup data: ' + error.message);
    }
}

async function cleanRollingAutoBackups(guildId, retentionDays = 3) {
    try {
        const cutoffTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const result = await BackupSchema.deleteMany({
            guildId: guildId,
            isAuto: true,
            createdAt: { $lt: cutoffTime }
        });
        if (result.deletedCount > 0) {
            console.log(`[AUTO-BACKUP] Purged ${result.deletedCount} rolling backup(s) older than ${retentionDays} days for guild ${guildId}`);
        }
        return result.deletedCount;
    } catch (error) {
        console.error(`[AUTO-BACKUP] Error pruning backups for guild ${guildId}:`, error);
        return 0;
    }
}

module.exports = {
    generateBackupId,
    retryOperation,
    createGuildBackupData,
    cleanRollingAutoBackups
};
