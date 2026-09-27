const cron = require('node-cron');
const BackupSchema = require('../Schemas/backupSchema');
const { createGuildBackupData, cleanRollingAutoBackups, retryOperation } = require('../Utils/backupUtils');

module.exports = (client) => {
    // Function to run auto backup for all joined guilds
    async function runAutoBackupRoutine() {
        if (!client.guilds.cache.size) return;

        const dateStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        const stateName = `Auto_${dateStr}`;
        const retentionDays = client.config.autoBackup?.retentionDays || 3;

        client.logs ? client.logs.info(`[AUTO-BACKUP] Starting 24h automated backup routine for ${client.guilds.cache.size} server(s)...`)
                    : console.log(`[AUTO-BACKUP] Starting routine for ${client.guilds.cache.size} server(s)...`);

        for (const guild of client.guilds.cache.values()) {
            try {
                // Check if backup already exists for today
                const existing = await BackupSchema.findOne({
                    guildId: guild.id,
                    state: stateName
                });

                if (existing) {
                    // Still prune expired backups
                    await cleanRollingAutoBackups(guild.id, retentionDays);
                    continue;
                }

                // Generate server backup data
                const serverDataString = await createGuildBackupData(guild);
                const size = Buffer.byteLength(serverDataString, 'utf8');

                // Save new backup
                await retryOperation(() => BackupSchema.create({
                    data: serverDataString,
                    guildId: guild.id,
                    state: stateName,
                    backupDate: dateStr,
                    isAuto: true,
                    creatorId: 'System Auto-Backup',
                    size: size,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }));

                client.logs ? client.logs.success(`[AUTO-BACKUP] Created backup '${stateName}' for server '${guild.name}' (${guild.id})`)
                            : console.log(`[AUTO-BACKUP] Created backup '${stateName}' for '${guild.name}'`);

                // Prune rolling backups older than retention period (e.g. 3 days)
                await cleanRollingAutoBackups(guild.id, retentionDays);

            } catch (err) {
                console.error(`[AUTO-BACKUP ERROR] Failed for server '${guild.name}' (${guild.id}):`, err.message);
            }
        }

        client.logs ? client.logs.info(`[AUTO-BACKUP] Daily backup routine complete.`)
                    : console.log(`[AUTO-BACKUP] Daily backup routine complete.`);
    }

    // Schedule 24h cron job (default: 0 0 * * * = midnight every day)
    const scheduleExpression = client.config.autoBackup?.cronSchedule || '0 0 * * *';

    cron.schedule(scheduleExpression, async () => {
        await runAutoBackupRoutine();
    });

    // Also run an initial check when bot starts up (after 10s delay to allow guilds to cache)
    client.once('ready', () => {
        setTimeout(async () => {
            if (client.config.autoBackup?.enabled !== false) {
                await runAutoBackupRoutine();
            }
        }, 10000);
    });
};
