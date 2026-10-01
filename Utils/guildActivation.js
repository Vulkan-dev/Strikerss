const ActivatedGuild = require('../Schemas/activatedGuildSchema');
const mongoose = require('mongoose');

// Built-in whitelisted servers that are permanently active
const PRE_ACTIVATED_GUILDS = new Set([
    '1553407415523999824', // STRIKERS main
    '1533328977727590521'  // darkwaveop server
]);

const VALID_ACTIVATION_KEY = 'kernelxbot';

// Memory cache for sub-millisecond guild activation checks
const activeGuildCache = new Set([...PRE_ACTIVATED_GUILDS]);

async function isGuildActivated(guildId) {
    if (!guildId) return true;
    if (activeGuildCache.has(guildId)) return true;
    if (PRE_ACTIVATED_GUILDS.has(guildId)) {
        activeGuildCache.add(guildId);
        return true;
    }

    if (mongoose.connection.readyState !== 1) {
        // If DB offline, allow pre-activated guilds
        return PRE_ACTIVATED_GUILDS.has(guildId);
    }

    try {
        const doc = await ActivatedGuild.findOne({ guildId, isActive: true });
        if (doc) {
            activeGuildCache.add(guildId);
            return true;
        }
    } catch (e) {
        console.error('[ACTIVATION] Error checking guild activation:', e.message);
    }

    return false;
}

async function activateGuild(guild, user, key) {
    if (!guild) return { success: false, message: 'Invalid guild.' };
    const cleanKey = (key || '').trim().toLowerCase();
    if (cleanKey !== VALID_ACTIVATION_KEY) {
        return {
            success: false,
            message: '❌ **Invalid activation key!** You must use the valid key: `kernelxbot`.'
        };
    }

    try {
        await ActivatedGuild.findOneAndUpdate(
            { guildId: guild.id },
            {
                guildId: guild.id,
                guildName: guild.name,
                redeemedBy: user.id,
                key: cleanKey,
                isActive: true,
                redeemedAt: new Date()
            },
            { upsert: true, new: true }
        );

        activeGuildCache.add(guild.id);
        return {
            success: true,
            message: `✅ **Server Successfully Activated!**\n> **${guild.name}** is now licensed and unlocked. All commands, verification, and features are fully operational!`
        };
    } catch (e) {
        return { success: false, message: `Failed to activate server: ${e.message}` };
    }
}

module.exports = {
    isGuildActivated,
    activateGuild,
    VALID_ACTIVATION_KEY,
    PRE_ACTIVATED_GUILDS
};
