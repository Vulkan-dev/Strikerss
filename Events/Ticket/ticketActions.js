const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { createTranscript } = require('discord-html-transcripts');
const TicketSetup = require('../../Schemas/TicketSetup');
const TicketSchema = require('../../Schemas/Ticket');
const config = require('../../ticketconfig');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        const { guild, member, customId, channel } = interaction;

        if (interaction.isStringSelectMenu() && customId === 'ticket-dropdown') {
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState !== 1) {
                return interaction.reply({ content: 'Database is connecting, please try again in a few seconds.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
            const docs = await TicketSetup.findOne({ GuildID: guild.id });
            if (!docs) {
                return interaction.reply({ embeds: [new EmbedBuilder().setDescription('Ticket system is not set up.').setColor('Red')], flags: MessageFlags.Ephemeral });
            }

            const findTicket = await TicketSchema.findOne({ GuildID: guild.id, OwnerID: member.id });
            if (findTicket) {
                return interaction.reply({ embeds: [new EmbedBuilder().setDescription('You already have an open ticket.').setColor('Red')], flags: MessageFlags.Ephemeral });
            }

            const modal = new ModalBuilder()
                .setCustomId('ticket_reason_modal')
                .setTitle('Ticket Creation Reason');

            const reasonInput = new TextInputBuilder()
                .setCustomId('ticket_reason')
                .setLabel('Reason for opening this ticket')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Please provide the reason for opening this ticket.')
                .setRequired(true)
                .setMaxLength(1000);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

            await interaction.showModal(modal);

            const selectedCategoryValue = interaction.values[0];

            const modalInteraction = await interaction.awaitModalSubmit({
                filter: (i) => i.user.id === interaction.user.id && i.customId === 'ticket_reason_modal',
                time: 60000,
            }).catch(async (err) => {
                console.error('Modal submission failed:', err);
                await interaction.followUp({ content: 'You did not provide a reason in time. Ticket creation cancelled.', flags: MessageFlags.Ephemeral }).catch(() => {});
                return null;
            });

            if (!modalInteraction) return;

            await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

            const reason = modalInteraction.fields.getTextInputValue('ticket_reason');
            const ticketId = Math.floor(Math.random() * 9000) + 10000;

            try {
                const selectedCategory = docs.Categories.find(cat => cat.value === selectedCategoryValue);
                const ticketChannel = await guild.channels.create({
                    name: `${config.ticketName}-${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: selectedCategory.ticketCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                        {
                            id: docs.Handlers,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
                        },
                        {
                            id: member.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                    ],
                });

                await TicketSchema.create({
                    GuildID: guild.id,
                    OwnerID: member.id,
                    MembersID: [member.id],
                    TicketID: ticketId,
                    ChannelID: ticketChannel.id,
                    Locked: false,
                    Claimed: false,
                    CreatedAt: new Date(),
                    Closed: false,
                });

                await ticketChannel.setTopic(`${config.ticketDescription} <@${member.id}>`).catch(error => { console.error('Failed to set topic:', error); });

                const embed = new EmbedBuilder()
                    .setTitle(config.ticketMessageTitle)
                    .setDescription(config.ticketMessageDescription)
                    .setColor(client.config.embedColor);

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket-close')
                        .setLabel(config.ticketClose)
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(config.ticketCloseEmoji),
                    new ButtonBuilder()
                        .setCustomId('ticket-lock')
                        .setLabel(config.ticketLock)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(config.ticketLockEmoji),
                    new ButtonBuilder()
                        .setCustomId('ticket-unlock')
                        .setLabel(config.ticketUnlock)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(config.ticketUnlockEmoji),
                    new ButtonBuilder()
                        .setCustomId('ticket-manage')
                        .setLabel(config.ticketManage)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(config.ticketManageEmoji),
                    new ButtonBuilder()
                        .setCustomId('ticket-claim')
                        .setLabel(config.ticketClaim)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(config.ticketClaimEmoji),
                );

                await ticketChannel.send({ embeds: [embed], components: [buttons] }).catch(error => { console.error('Failed to send ticket message:', error); });

                const ticketMessage = new EmbedBuilder()
                    .setDescription(`${config.ticketCreate} <#${ticketChannel.id}>`)
                    .setColor('Green');

                await modalInteraction.followUp({ embeds: [ticketMessage] });

                if (selectedCategory) {
                    await ticketChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`${selectedCategory.name} Ticket`)
                                .setDescription(`A ${selectedCategory.name.toLowerCase()} ticket has been created.\n**Reason:** ${reason}\nPlease describe your issue or request in detail.`)
                                .setColor(client.config.embedColor),
                        ],
                    }).catch(error => { console.error('Failed to send category message:', error); });
                }
            } catch (err) {
                console.error('Error creating ticket:', err);
                return modalInteraction.followUp({ content: 'An error occurred while creating the ticket.', flags: MessageFlags.Ephemeral });
            }
        }

        const ticketButtonIds = ['ticket-close', 'ticket-lock', 'ticket-unlock', 'ticket-claim', 'ticket-manage', 'ticket-reopen', 'ticket-delete', 'ticket-transcript', 'stop-delete'];
        if (interaction.isButton() && ticketButtonIds.includes(customId)) {
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState !== 1) {
                return interaction.reply({ content: 'Database is connecting, please try again in a few seconds.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            const docs = await TicketSetup.findOne({ GuildID: guild.id });
            if (!docs) return;

            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription(config.ticketError);
            if (!guild.members.me.permissions.has((r) => r.id === docs.Handlers)) {
                return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral }).catch(error => { console.error('Failed to reply to interaction:', error); });
            }

            const data = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
            if (!data) return;

            const hasHandlerRole = member.roles.cache.has(docs.Handlers);
            const isTicketOwner = member.id === data.OwnerID;
            const isTicketClosed = data.Closed;

            switch (customId) {
                case 'ticket-close':
                    if (isTicketClosed) {
                        return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });
                    }
                    if (!isTicketOwner && !hasHandlerRole) {
                        return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });
                    }
                    await handleCloseTicket(interaction, member, data, docs);
                    break;

                case 'ticket-lock':
                case 'ticket-unlock':
                case 'ticket-claim':
                case 'ticket-manage':
                    if (!hasHandlerRole) {
                        return interaction.reply({ content: 'You do not have permission to use this button.', flags: MessageFlags.Ephemeral });
                    }
                    if (isTicketClosed) {
                        return interaction.reply({ content: 'This ticket is closed and cannot be modified.', flags: MessageFlags.Ephemeral });
                    }
                    if (customId === 'ticket-lock') await handleLockTicket(interaction, member, data);
                    if (customId === 'ticket-unlock') await handleUnlockTicket(interaction, member, data);
                    if (customId === 'ticket-claim') {
                        if (data.Claimed) {
                            const claimedBy = data.ClaimedBy ? `<@${data.ClaimedBy}>` : 'Unknown';
                            return interaction.reply({ content: `This ticket is already claimed by ${claimedBy}.`, flags: MessageFlags.Ephemeral });
                        }
                        await handleClaimTicket(interaction, member, data);
                    }
                    if (customId === 'ticket-manage') await handleManageTicket(interaction, member, data);
                    break;

                case 'ticket-reopen':
                    if (!isTicketClosed) {
                        return interaction.reply({ content: 'This ticket is not closed.', flags: MessageFlags.Ephemeral });
                    }
                    if (!isTicketOwner && !hasHandlerRole) {
                        return interaction.reply({ content: 'You do not have permission to reopen this ticket.', flags: MessageFlags.Ephemeral });
                    }
                    await handleReopenTicket(interaction, member, data);
                    break;

                case 'ticket-delete':
                case 'ticket-transcript':
                case 'stop-delete':
                    if (!hasHandlerRole) {
                        return interaction.reply({ content: 'You do not have permission to use this button.', flags: MessageFlags.Ephemeral });
                    }
                    if (customId !== 'stop-delete' && !isTicketClosed) {
                        return interaction.reply({ content: 'This ticket must be closed first.', flags: MessageFlags.Ephemeral });
                    }
                    if (customId === 'ticket-delete') await handleDeleteTicket(interaction, member, data);
                    if (customId === 'ticket-transcript') await handleSendTranscript(interaction, member, data);
                    if (customId === 'stop-delete') await handleStopDelete(interaction);
                    break;

                default:
                    return interaction.reply({ content: 'Unknown action.', flags: MessageFlags.Ephemeral });
            }
        }

        if (interaction.isUserSelectMenu() && interaction.customId === 'ticket-manage-menu') {
            const selectedUserId = interaction.values[0];
            const selectedUser = await guild.members.fetch(selectedUserId);

            await channel.permissionOverwrites.edit(selectedUserId, {
                [PermissionFlagsBits.ViewChannel]: true,
                [PermissionFlagsBits.SendMessages]: true,
            }).catch(error => { console.error('Failed to edit channel permissions:', error); });

            await interaction.reply({ content: `${selectedUser} has been added to the ticket!`, flags: MessageFlags.Ephemeral }).catch(error => { console.error('Failed to reply to user select menu:', error); });
        }
    },
};

async function handleCloseTicket(interaction, member, data, docs) {
    const reason = await getReason(interaction, member);
    if (!reason) return;

    await interaction.channel.permissionOverwrites.edit(data.OwnerID, {
        [PermissionFlagsBits.SendMessages]: false,
        [PermissionFlagsBits.ReadMessageHistory]: false,
    }).catch(error => { console.error('Failed to update channel permissions:', error); });

    let transcript;
    try {
        transcript = await createTranscript(interaction.channel, {
            limit: -1,
            returnType: 'attachment',
            saveImages: true,
            poweredBy: false,
            filename: `${config.ticketName}-${data.TicketID}.html`,
        });
    } catch (error) {
        console.error('Failed to create transcript:', error);
        await interaction.followUp({ content: 'Failed to create transcript.', flags: MessageFlags.Ephemeral });
        return;
    }

    const closingTicketEmbed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription(`This ticket was closed by <@${member.id}> for the following reason: ${reason}`)
        .setColor('Red');

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket-reopen')
            .setLabel('Reopen Ticket')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('ticket-delete')
            .setLabel('Delete Ticket')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('ticket-transcript')
            .setLabel('Send Transcript')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({ embeds: [closingTicketEmbed], components: [buttons] }).catch(error => { console.error('Failed to send closing message:', error); });

    const ticketOwner = await interaction.guild.members.fetch(data.OwnerID).catch(error => {
        console.error('Failed to fetch ticket owner:', error);
        return null;
    });

    if (ticketOwner) {
        const claimedBy = data.ClaimedBy ? `<@${data.ClaimedBy}>` : 'Not claimed';
        const closedAt = new Date();
        const openedAt = data.CreatedAt ? data.CreatedAt.toLocaleString() : 'Unknown';

        const ownerEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setColor('Red')
            .addFields(
                { name: 'Ticket Opened At', value: openedAt, inline: true },
                { name: 'Ticket Closed At', value: closedAt.toLocaleString(), inline: true },
                { name: 'Claimed By', value: claimedBy, inline: true },
                { name: 'Closed By', value: `<@${member.id}>`, inline: true },
                { name: 'Reason', value: reason },
                { name: 'Transcript', value: 'Attached with Embed' }
            );

        await ticketOwner.send({ embeds: [ownerEmbed], files: [transcript] }).catch(error => {
            console.error('Failed to send DM to ticket owner:', error);
            interaction.channel.send(`Could not send transcript to <@${data.OwnerID}>. They may have DMs disabled.`).catch(err => console.error('Failed to send fallback message:', err));
        });
    } else {
        await interaction.channel.send(`Could not fetch ticket owner <@${data.OwnerID}>. They may have left the server.`).catch(error => console.error('Failed to send fallback message:', error));
    }

    // Send transcript to the transcripts channel
    if (docs.Transcripts) {
        try {
            const transcriptsChannel = await interaction.guild.channels.fetch(docs.Transcripts);
            if (transcriptsChannel) {
                const transcriptEmbed = new EmbedBuilder()
                    .setTitle(`Ticket Transcript - ${config.ticketName}-${data.TicketID}`)
                    .setColor('Purple')
                    .addFields(
                        { name: 'Ticket Owner', value: `<@${data.OwnerID}>`, inline: true },
                        { name: 'Ticket ID', value: data.TicketID.toString(), inline: true },
                        { name: 'Closed By', value: `<@${member.id}>`, inline: true },
                        { name: 'Claimed By', value: data.ClaimedBy ? `<@${data.ClaimedBy}>` : 'Not claimed', inline: true },
                        { name: 'Reason for Closure', value: reason, inline: false },
                        { name: 'Opened At', value: data.CreatedAt ? data.CreatedAt.toLocaleString() : 'Unknown', inline: true },
                        { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
                    )
                    .setTimestamp();

                await transcriptsChannel.send({
                    embeds: [transcriptEmbed],
                    files: [transcript],
                });
            } else {
                console.error('Transcripts channel not found:', docs.Transcripts);
            }
        } catch (error) {
            console.error('Failed to send transcript to transcripts channel:', error);
        }
    } else {
        console.error('Transcripts channel ID not set in TicketSetup for guild:', interaction.guild.id);
    }

    await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Closed: true });
}

async function handleReopenTicket(interaction, member, data) {
    await interaction.deferUpdate();
    await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Closed: false, Claimed: false });

    await interaction.channel.permissionOverwrites.edit(data.OwnerID, {
        [PermissionFlagsBits.SendMessages]: true,
        [PermissionFlagsBits.ReadMessageHistory]: true,
    }).catch(error => { console.error('Failed to restore channel permissions:', error); });

    const reopenedEmbed = new EmbedBuilder()
        .setTitle('Ticket Reopened')
        .setDescription(`This ticket has been reopened by <@${member.id}>.`)
        .setColor('Green');

    await interaction.channel.send({ embeds: [reopenedEmbed] }).catch(error => { console.error('Failed to send reopen message:', error); });
}

async function handleDeleteTicket(interaction, member, data) {
    await interaction.deferUpdate();

    const deleteMessage = await interaction.channel.send({
        content: 'Deleting the ticket channel in 10 seconds...',
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('stop-delete')
                    .setLabel('Stop')
                    .setStyle(ButtonStyle.Danger)
            ),
        ],
    }).catch(error => { console.error('Failed to send delete message:', error); });

    let stopped = false;
    const collector = interaction.channel.createMessageCollector({
        filter: (i) => i.customId === 'stop-delete' && i.user.id === member.id,
        time: 10000,
    });

    collector.on('collect', () => {
        stopped = true;
        collector.stop();
    });

    collector.on('end', async () => {
        if (stopped) {
            await deleteMessage.edit({
                content: 'Ticket deletion cancelled.',
                components: [],
            }).catch(error => { console.error('Failed to edit delete message:', error); });
            return;
        }

        await deleteMessage.edit({
            content: 'Deleting the ticket channel now...',
            components: [],
        }).catch(error => { console.error('Failed to edit delete message:', error); });

        await TicketSchema.findOneAndDelete({ GuildID: interaction.guild.id, ChannelID: interaction.channel.id }).catch(error => { console.error('Failed to delete ticket from database:', error); });
        await interaction.channel.delete().catch(error => { console.error('Failed to delete channel:', error); });
    });
}

async function handleStopDelete(interaction) {
    await interaction.deferUpdate();
}

async function handleSendTranscript(interaction, member, data) {
    await interaction.deferUpdate();
    const transcript = await createTranscript(interaction.channel, {
        limit: -1,
        returnType: 'attachment',
        saveImages: true,
        poweredBy: false,
        filename: `${config.ticketName}-${data.TicketID}.html`,
    }).catch(error => { console.error('Failed to create transcript:', error); return null; });

    if (!transcript) {
        await interaction.followUp({ content: 'Failed to create transcript.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.user.send({ content: 'Here is your ticket transcript:', files: [transcript] }).catch(error => { console.error('Failed to send transcript to user:', error); });
    await interaction.channel.send('The transcript has been sent to your DMs.').catch(error => { console.error('Failed to send transcript confirmation:', error); });
}

async function handleLockTicket(interaction, member, data) {
    await interaction.deferUpdate();

    await interaction.channel.permissionOverwrites.edit(data.OwnerID, {
        [PermissionFlagsBits.SendMessages]: false,
        [PermissionFlagsBits.ReadMessageHistory]: false,
    }).catch(error => { console.error('Failed to update channel permissions:', error); });

    await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Locked: true });
    await interaction.followUp({ content: 'The ticket has been locked. The ticket owner can no longer send messages or read past messages.', flags: MessageFlags.Ephemeral }).catch(error => { console.error('Failed to send lock confirmation:', error); });
}

async function handleUnlockTicket(interaction, member, data) {
    await interaction.deferUpdate();

    await interaction.channel.permissionOverwrites.edit(data.OwnerID, {
        [PermissionFlagsBits.SendMessages]: true,
        [PermissionFlagsBits.ReadMessageHistory]: true,
    }).catch(error => { console.error('Failed to restore channel permissions:', error); });

    await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Locked: false });
    await interaction.followUp({ content: 'The ticket has been unlocked. The ticket owner can now send messages and read past messages.', flags: MessageFlags.Ephemeral }).catch(error => { console.error('Failed to send unlock confirmation:', error); });
}

async function handleClaimTicket(interaction, member, data) {
    await interaction.deferUpdate();
    await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Claimed: true, ClaimedBy: member.id });
    await interaction.channel.setName(`${config.ticketClaimEmoji}-${config.ticketName}-${data.TicketID}`).catch(error => { console.error('Failed to set channel name:', error); });
    await interaction.followUp({ content: `You have claimed this ticket.`, flags: MessageFlags.Ephemeral }).catch(error => { console.error('Failed to send claim confirmation:', error); });

    const claimEmbed = new EmbedBuilder()
        .setTitle('Ticket Claimed')
        .setDescription(`This ticket has been claimed by <@${member.id}>.`)
        .setColor('Yellow');

    await interaction.channel.send({ embeds: [claimEmbed] }).catch(error => { console.error('Failed to send claim embed:', error); });
}

async function handleManageTicket(interaction, member, data) {
    await interaction.deferUpdate();
    const menu = new UserSelectMenuBuilder()
        .setCustomId('ticket-manage-menu')
        .setPlaceholder('Select a member to add to the ticket')
        .setMinValues(1)
        .setMaxValues(1);

    await interaction.followUp({ components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral }).catch(error => { console.error('Failed to send manage menu:', error); });
}

async function getReason(interaction, member) {
    const modal = new ModalBuilder()
        .setCustomId('close_reason_modal')
        .setTitle('Close Ticket Reason');

    const reasonInput = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Reason for closing this ticket')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Please provide the reason for closing this ticket.')
        .setRequired(true)
        .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

    await interaction.showModal(modal);

    const modalInteraction = await interaction.awaitModalSubmit({
        filter: (i) => i.user.id === member.id && i.customId === 'close_reason_modal',
        time: 30000,
    }).catch(async (err) => {
        console.error('Modal submission failed:', err);
        await interaction.followUp({ content: 'You did not provide a reason in time. The ticket will not be closed.', flags: MessageFlags.Ephemeral }).catch(() => {});
        return null;
    });

    if (!modalInteraction) return null;

    await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });
    const reason = modalInteraction.fields.getTextInputValue('close_reason');
    await modalInteraction.followUp({ content: 'Ticket closing in progress...', flags: MessageFlags.Ephemeral });
    return reason;
}