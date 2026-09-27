const { ChannelType, PermissionsBitField } = require('discord.js');
const BackupSchema = require('../Schemas/backupSchema');

async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function createGuildBackupData(guild) {
    try {
        const serverData = {
            schemaVersion: '1.0.0',
            guildInfo: {
                name: guild.name,
                ownerId: guild.ownerId,
                icon: guild.iconURL({ dynamic: true }),
                banner: guild.bannerURL({ dynamic: true }),
                afkChannel: guild.afkChannel?.name,
                afkTimeout: guild.afkTimeout,
                systemChannel: guild.systemChannel?.name,
                rulesChannel: guild.rulesChannel?.name,
                systemChannelFlags: guild.systemChannelFlags ? guild.systemChannelFlags.toArray() : []
            },
            categories: guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => ({
                name: c.name,
                rawPosition: c.rawPosition,
                channels: guild.channels.cache.filter(ch => ch.parentId === c.id).map(ch => ch.name)
            })),
            channels: guild.channels.cache.filter(c => 
                c.type !== ChannelType.GuildCategory && 
                c.id !== guild.rulesChannelId && 
                c.id !== guild.publicUpdatesChannelId && 
                c.id !== guild.systemChannelId
            ).map(c => ({
                name: c.name,
                type: c.type,
                description: c.topic,
                slowmode: c.rateLimitPerUser,
                autoArchiveDuration: c.defaultAutoArchiveDuration,
                rawPosition: c.rawPosition,
                permissions: c.permissionOverwrites ? c.permissionOverwrites.cache.filter(p => p.type === 0).map(p => ({
                    id: guild.roles.cache.get(p.id)?.name || '@everyone',
                    allow: p.allow.toArray(),
                    deny: p.deny.toArray()
                })) : []
            })),
            forumChannels: guild.channels.cache.filter(c => c.type === ChannelType.GuildForum).map(f => ({
                name: f.name,
                settings: {
                    availableTags: f.availableTags,
                    defaultAutoArchiveDuration: f.defaultAutoArchiveDuration,
                    defaultForumLayout: f.defaultForumLayout,
                    defaultReactionEmoji: f.defaultReactionEmoji,
                    defaultSortOrder: f.defaultSortOrder,
                    defaultThreadRateLimitPerUser: f.defaultThreadRateLimitPerUser,
                    nsfw: f.nsfw,
                    rateLimitPerUser: f.rateLimitPerUser,
                    topic: f.topic
                },
                permissions: f.permissionOverwrites ? f.permissionOverwrites.cache.filter(p => p.type === 0).map(p => ({
                    id: guild.roles.cache.get(p.id)?.name || '@everyone',
                    allow: p.allow.toArray(),
                    deny: p.deny.toArray()
                })) : []
            })),
            roles: guild.roles.cache.filter(r => !r.managed && r.name !== '@everyone' && !r.permissions.has(PermissionsBitField.Flags.Administrator)).map(r => ({
                id: r.id,
                name: r.name,
                permissions: r.permissions.toArray(),
                color: r.color,
                hoist: r.hoist,
                mentionable: r.mentionable,
                icon: r.iconURL ? r.iconURL({ dynamic: true }) : null,
                position: r.rawPosition
            })),
            members: guild.members.cache.map(m => ({
                id: m.id,
                roles: m.roles.cache.filter(r => r.name !== '@everyone' && !r.managed).map(r => r.name)
            })),
            emojis: guild.emojis.cache.map(e => ({
                name: e.name,
                url: e.url
            }))
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
    retryOperation,
    createGuildBackupData,
    cleanRollingAutoBackups
};
