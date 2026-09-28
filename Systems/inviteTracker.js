const { Collection, Events, PermissionsBitField } = require("discord.js");
const Invite = require("../Schemas/inviteSchema");

const inviteCache = new Collection();

async function cacheGuildInvites(guild) {
    if (!guild || !guild.members.me) return new Collection();
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return new Collection();
    }

    try {
        const invites = await guild.invites.fetch().catch(() => null);
        if (!invites) return new Collection();

        const guildMap = new Collection();
        invites.forEach(inv => {
            guildMap.set(inv.code, {
                code: inv.code,
                uses: inv.uses || 0,
                maxUses: inv.maxUses || 0,
                inviterId: inv.inviter ? inv.inviter.id : null
            });
        });

        if (guild.vanityURLCode) {
            try {
                const vanity = await guild.fetchVanityData().catch(() => null);
                if (vanity) {
                    guildMap.set(guild.vanityURLCode, {
                        code: guild.vanityURLCode,
                        uses: vanity.uses || 0,
                        maxUses: 0,
                        inviterId: "VANITY"
                    });
                }
            } catch (e) {}
        }

        inviteCache.set(guild.id, guildMap);
        return guildMap;
    } catch (err) {
        return new Collection();
    }
}

module.exports = (client) => {
    client.once(Events.ClientReady, async () => {
        for (const guild of client.guilds.cache.values()) {
            await cacheGuildInvites(guild);
        }
        if (client.logs && client.logs.info) {
            client.logs.info("[INVITES] Cached invites for " + client.guilds.cache.size + " guilds.");
        }
    });

    client.on(Events.GuildCreate, async (guild) => {
        await cacheGuildInvites(guild);
    });

    client.on(Events.InviteCreate, (invite) => {
        if (!invite.guild) return;
        const guildMap = inviteCache.get(invite.guild.id) || new Collection();
        guildMap.set(invite.code, {
            code: invite.code,
            uses: invite.uses || 0,
            maxUses: invite.maxUses || 0,
            inviterId: invite.inviter ? invite.inviter.id : null
        });
        inviteCache.set(invite.guild.id, guildMap);
    });

    client.on(Events.InviteDelete, (invite) => {
        if (!invite.guild) return;
        const guildMap = inviteCache.get(invite.guild.id);
        if (guildMap) {
            guildMap.delete(invite.code);
        }
    });

    client.on(Events.GuildMemberAdd, async (member) => {
        if (!member || member.user?.bot) return;
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) return;
        const { guild } = member;

        const cachedInvites = inviteCache.get(guild.id);
        const currentInvites = await cacheGuildInvites(guild);

        let usedInvite = null;

        if (cachedInvites && currentInvites) {
            usedInvite = currentInvites.find(inv => {
                const prev = cachedInvites.get(inv.code);
                return prev && inv.uses > prev.uses;
            });

            if (!usedInvite) {
                cachedInvites.forEach(prev => {
                    if (!currentInvites.has(prev.code) && prev.maxUses > 0 && prev.uses === prev.maxUses - 1) {
                        usedInvite = prev;
                    }
                });
            }
        }

        if (usedInvite) {
            const isVanity = usedInvite.inviterId === "VANITY" || usedInvite.code === guild.vanityURLCode;
            const inviterId = isVanity ? "VANITY" : usedInvite.inviterId;

            await Invite.findOneAndUpdate(
                { guildId: guild.id, userId: member.id },
                {
                    guildId: guild.id,
                    userId: member.id,
                    inviterId: inviterId,
                    code: usedInvite.code
                },
                { upsert: true, new: true }
            );

            if (inviterId && inviterId !== "VANITY") {
                const isFake = inviterId === member.id;
                await Invite.findOneAndUpdate(
                    { guildId: guild.id, userId: inviterId },
                    {
                        $inc: {
                            tracked: isFake ? 0 : 1,
                            fake: isFake ? 1 : 0
                        }
                    },
                    { upsert: true, new: true }
                );
            }
        }
    });

    client.on(Events.GuildMemberRemove, async (member) => {
        if (!member || member.user?.bot) return;
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) return;
        const { guild } = member;

        const memberData = await Invite.findOne({ guildId: guild.id, userId: member.id });
        if (memberData && memberData.inviterId && memberData.inviterId !== "VANITY") {
            await Invite.findOneAndUpdate(
                { guildId: guild.id, userId: memberData.inviterId },
                { $inc: { left: 1 } },
                { upsert: true, new: true }
            );
        }
    });
};
