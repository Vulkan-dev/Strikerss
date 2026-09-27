const { Events } = require('discord.js');
const Giveaway = require('../../Schemas/giveawaySchema');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (!interaction.isButton()) return;
            if (interaction.customId !== 'giveaway_enter') return;

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const giveawayId = interaction.message.id;
            const giveaway = await Giveaway.findOne({ giveawayId });
            if (!giveaway) {
                return interaction.editReply({ content: 'This giveaway no longer exists!' });
            }

            if (new Date() > giveaway.endTime || giveaway.hasEnded) {
                return interaction.editReply({ content: 'This giveaway has ended!' });
            }

            const hasEntered = giveaway.entrants.includes(interaction.user.id);

            if (!hasEntered) {
                let messageCount = 0;
                const channels = interaction.guild.channels.cache.filter(ch => ch.isTextBased());
                for (const channel of channels.values()) {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    messageCount += messages.filter(msg => msg.author.id === interaction.user.id).size;
                }
                if (messageCount < giveaway.requiredMessages) {
                    return interaction.editReply({ content: `You need at least ${giveaway.requiredMessages} messages to enter this giveaway! You have ${messageCount}.` });
                }

                const invites = await interaction.guild.invites.fetch();
                const userInvites = invites.filter(inv => inv.inviterId === interaction.user.id);
                const inviteCount = userInvites.reduce((count, inv) => count + (inv.uses || 0), 0);
                if (inviteCount < giveaway.requiredInvites) {
                    return interaction.editReply({ content: `You need at least ${giveaway.requiredInvites} invites to enter this giveaway! You have ${inviteCount}.` });
                }

                // Use atomic $push to add the user to entrants
                let totalEntries = 1;
                const updateOps = { $push: { entrants: interaction.user.id } };
                if (giveaway.bonusRole && interaction.member.roles.cache.has(giveaway.bonusRole)) {
                    totalEntries += giveaway.bonusEntries;
                    for (let i = 0; i < giveaway.bonusEntries; i++) {
                        updateOps.$push.entrants = interaction.user.id;
                    }
                }

                // Atomically update the entrants array
                await Giveaway.updateOne(
                    { giveawayId, hasEnded: false },
                    updateOps
                );

                // Fetch the updated giveaway document to get the latest entrants count
                const updatedGiveaway = await Giveaway.findOne({ giveawayId });
                console.log(`[Enter Giveaway] User ${interaction.user.id} entered giveaway ID: ${giveawayId}. Total entries: ${updatedGiveaway.entrants.length}, Entrants: ${updatedGiveaway.entrants.join(', ')}`);

                const enterButton = new ButtonBuilder()
                    .setCustomId('giveaway_enter')
                    .setLabel('Enter')
                    .setStyle(ButtonStyle.Primary);

                const showEntriesButton = new ButtonBuilder()
                    .setCustomId('giveaway_show_entries')
                    .setLabel(`Show Entries: ${updatedGiveaway.entrants.length}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const row = new ActionRowBuilder().addComponents(enterButton, showEntriesButton);
                await interaction.message.edit({ components: [row] });

                await interaction.editReply({ content: `You’ve entered the giveaway${totalEntries > 1 ? ` with ${totalEntries} entries (including ${giveaway.bonusEntries} bonus entries)` : ''}!` });
            } else {
                // Use atomic $pull to remove all instances of the user from entrants
                await Giveaway.updateOne(
                    { giveawayId, hasEnded: false },
                    { $pull: { entrants: interaction.user.id } }
                );

                // Fetch the updated giveaway document
                const updatedGiveaway = await Giveaway.findOne({ giveawayId });
                console.log(`[Leave Giveaway] User ${interaction.user.id} left giveaway ID: ${giveawayId}. Total entries: ${updatedGiveaway.entrants.length}, Entrants: ${updatedGiveaway.entrants.join(', ')}`);

                const enterButton = new ButtonBuilder()
                    .setCustomId('giveaway_enter')
                    .setLabel('Enter')
                    .setStyle(ButtonStyle.Primary);

                const showEntriesButton = new ButtonBuilder()
                    .setCustomId('giveaway_show_entries')
                    .setLabel(`Show Entries: ${updatedGiveaway.entrants.length}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const row = new ActionRowBuilder().addComponents(enterButton, showEntriesButton);
                await interaction.message.edit({ components: [row] });

                await interaction.editReply({ content: 'You’ve been removed from the giveaway!' });
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'An error occurred while processing your entry!' }).catch(err => {
                console.error('Failed to follow up on deferred reply:', err);
            });
        }
    },
};