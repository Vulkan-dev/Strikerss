const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    PermissionsBitField,
    TextInputStyle,
} = require('discord.js');
const TicketSetup = require('../../Schemas/TicketSetup');
const TicketSchema = require('../../Schemas/Ticket');
const config = require('../../ticketconfig');
const { createTranscript } = require('discord-html-transcripts');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage the ticket system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Setup the ticket system')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remind')
                .setDescription('Remind the ticket owner about inactivity (closes after 24 hours)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Close the current ticket')
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for closing the ticket')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reopen')
                .setDescription('Reopen the current ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to the current ticket')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to add to the ticket')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('claim')
                .setDescription('Claim the current ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('lock')
                .setDescription('Lock the current ticket')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlock')
                .setDescription('Unlock the current ticket')
        ),

    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({
              content: `${client.emoji.error} | You don't have perms to manage the ticket system.`,
              flags: MessageFlags.Ephemeral,
            });
          }
        const { guild, member, channel, options } = interaction;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            let data = await TicketSetup.findOne({ GuildID: guild.id });
            let collectedData = {
                Channel: null,
                Transcripts: null,
                Handlers: null,
                Everyone: null,
                Description: null,
                Categories: data?.Categories || [],
            };

            const embed = new EmbedBuilder()
                .setTitle('Ticket System Configuration Panel')
                .setDescription('```md\n# Ticket System\n> Configure the ticket system for your server!\n```')
                .addFields(
                    {
                        name: 'System Status',
                        value: data
                            ? '```ansi\n\u001b[32m□ 🟢 SYSTEM ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\n```'
                            : '```ansi\n\u001b[32m□ 🔴 SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\n```',
                    },
                    {
                        name: 'Active Configuration',
                        value: formatConfiguration(data || collectedData),
                    }
                )
                .setColor(client.config.embedColor || 'Green')
                .setTimestamp()
                .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}`, iconURL: guild.iconURL({ dynamic: true }) });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_ticket_panel')
                    .setLabel('Setup Ticket Panel')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!!data),
                new ButtonBuilder()
                    .setCustomId('setup_ticket_categories')
                    .setLabel('Setup Ticket Categories')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!!data || !collectedData.Channel),
                new ButtonBuilder()
                    .setCustomId('done')
                    .setLabel('Done')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!!data || !collectedData.Channel),
                new ButtonBuilder()
                    .setCustomId('disable')
                    .setLabel('Disable')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(!data)
            );

            const message = await interaction.reply({
                embeds: [embed],
                components: [buttons],
                withResponse: true
            });

            const collector = message.resource.message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 1200000,
            });

            let setupStage = null;

            function formatConfiguration(config) {
                return '```yml\n' +
                    `Ticket Panel Channel: "${config.Channel ? "<#" + config.Channel + ">" : "Not Configured"}\"\n` +
                    `Transcripts Channel: "${config.Transcripts ? "<#" + config.Transcripts + ">" : "Not Configured"}\"\n` +
                    `Handlers Role: "${config.Handlers ? "<@&" + config.Handlers + ">" : "Not Configured"}\"\n` +
                    `Everyone Role: "${config.Everyone ? config.Everyone : "Not Configured"}\"\n` +
                    `Description: "${config.Description || "Not Configured"}\"\n` +
                    `Categories: "${config.Categories?.length ? config.Categories.map(c => `${c.emoji} ${c.name} (Category: ${c.ticketCategory ? "<#" + c.ticketCategory + ">" : 'Not Set'})`).join(", ") : "Not Configured"}\"\n` +
                    '```';
            }

            function updateConfigurationField() {
                const config = data || collectedData;
                embed.spliceFields(1, 1, {
                    name: 'Active Configuration',
                    value: formatConfiguration(config),
                });
            }

            function updateSystemStatus() {
                const hasConfig = data || (collectedData.Channel && collectedData.Categories.length > 0);
                embed.spliceFields(0, 1, {
                    name: 'System Status',
                    value: hasConfig
                        ? '```ansi\n\u001b[32m□ 🟢 SYSTEM ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\n```'
                        : '```ansi\n\u001b[32m□ 🔴 SYSTEM OFFLINE\n\u001b[32m├───> Features: NOT CONFIGURED\n\u001b[32m└───> Updates: Disabled\n```',
                });
            }

            async function safeEditMessage(i, embed, components) {
                try {
                    await i.message.edit({ embeds: [embed], components });
                } catch (error) {
                    if (error.code === 10008) {
                        await i.followUp({
                            content: 'The configuration panel message was deleted. Setup process has been cancelled.',
                            flags: MessageFlags.Ephemeral,
                        });
                        collector.stop('message_deleted');
                    } else {
                        console.error(error);
                        await i.followUp({
                            content: 'An error occurred while updating the panel. Please try again.',
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                }
            }

            collector.on('collect', async (i) => {
                if (i.customId === 'setup_ticket_panel') {
                    setupStage = 'ticket_channel';
                    await i.reply({
                        content: 'Please mention the channel where the ticket panel should be sent (e.g., #ticket-support or channel ID).',
                        flags: MessageFlags.Ephemeral,
                    });

                    const filter = (m) => m.author.id === i.user.id;
                    const channelCollector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

                    channelCollector.on('collect', async (m) => {
                        const channel = m.mentions.channels.first() || guild.channels.cache.get(m.content);
                        if (!channel || channel.type !== ChannelType.GuildText) {
                            await i.followUp({ content: 'Please provide a valid text channel.', flags: MessageFlags.Ephemeral });
                            setupStage = null;
                            return;
                        }

                        collectedData.Channel = channel.id;
                        updateConfigurationField();
                        await safeEditMessage(i, embed, [buttons]);

                        setupStage = 'transcripts_channel';
                        await i.followUp({
                            content: 'Please mention the channel where the transcripts should be sent (e.g., #transcripts or channel ID).',
                            flags: MessageFlags.Ephemeral,
                        });

                        const transcriptsCollector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

                        transcriptsCollector.on('collect', async (m) => {
                            const transcripts = m.mentions.channels.first() || guild.channels.cache.get(m.content);
                            if (!transcripts || transcripts.type !== ChannelType.GuildText) {
                                await i.followUp({ content: 'Please provide a valid text channel for transcripts.', flags: MessageFlags.Ephemeral });
                                setupStage = null;
                                return;
                            }

                            collectedData.Transcripts = transcripts.id;
                            updateConfigurationField();
                            await safeEditMessage(i, embed, [buttons]);

                            setupStage = 'handlers_role';
                            await i.followUp({
                                content: 'Please mention the role that will handle the tickets (or type the role name or ID).',
                                flags: MessageFlags.Ephemeral,
                            });

                            const handlersCollector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

                            handlersCollector.on('collect', async (m) => {
                                const handlers = m.mentions.roles.first() ||
                                    guild.roles.cache.find(role => role.name.toLowerCase() === m.content.toLowerCase()) ||
                                    guild.roles.cache.get(m.content);

                                if (!handlers) {
                                    await i.followUp({ content: 'Please mention a valid role for handlers, type the role name, or provide the role ID.', flags: MessageFlags.Ephemeral });
                                    setupStage = null;
                                    return;
                                }

                                collectedData.Handlers = handlers.id;
                                updateConfigurationField();
                                await safeEditMessage(i, embed, [buttons]);

                                setupStage = 'everyone_role';
                                await i.followUp({
                                    content: 'Please mention the @everyone role (type "everyone" for @everyone).',
                                    flags: MessageFlags.Ephemeral,
                                });

                                const everyoneCollector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

                                everyoneCollector.on('collect', async (m) => {
                                    const everyone = m.content.toLowerCase() === 'everyone' ? 'everyone' :
                                        m.mentions.roles.first() || guild.roles.cache.get(m.content);

                                    if (!everyone) {
                                        await i.followUp({ content: 'Please mention a valid role for everyone or type "everyone".', flags: MessageFlags.Ephemeral });
                                        setupStage = null;
                                        return;
                                    }

                                    collectedData.Everyone = everyone === 'everyone' ? '@everyone' : everyone.id;
                                    updateConfigurationField();
                                    await safeEditMessage(i, embed, [buttons]);

                                    setupStage = 'description';
                                    await i.followUp({
                                        content: 'Please provide a description for the ticket embed.',
                                        flags: MessageFlags.Ephemeral,
                                    });

                                    const descriptionCollector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

                                    descriptionCollector.on('collect', async (m) => {
                                        const description = m.content.replace(/\|/g, '\n');
                                        collectedData.Description = description;
                                        updateConfigurationField();
                                        updateSystemStatus();

                                        buttons.components[1].setDisabled(false);
                                        buttons.components[2].setDisabled(false);
                                        await safeEditMessage(i, embed, [buttons]);

                                        await i.followUp({
                                            content: 'Ticket panel setup completed. You can now set up ticket categories or click "Done" to finalize.',
                                            flags: MessageFlags.Ephemeral,
                                        });
                                        setupStage = null;
                                    });
                                });
                            });
                        });
                    });
                } else if (i.customId === 'setup_ticket_categories') {
                    setupStage = 'category_select';
                    const categoryOptions = Array.from({ length: 5 }, (_, index) => {
                        const existingCategory = collectedData.Categories[index];
                        return {
                            label: `Category ${index + 1} ${existingCategory ? `(${existingCategory.emoji} ${existingCategory.name})` : '(Not Setup)'}`,
                            value: `category_${index}`,
                            description: existingCategory ? `Edit ${existingCategory.name} category` : `Setup Category ${index + 1}`,
                        };
                    });

                    const categoryDropdown = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('category_dropdown')
                            .setPlaceholder('Select a category to configure')
                            .addOptions(categoryOptions)
                    );

                    await safeEditMessage(i, embed, [categoryDropdown]);
                    await i.reply({ content: 'Please select a category to configure.', flags: MessageFlags.Ephemeral });
                } else if (i.customId === 'category_dropdown') {
                    const selectedCategoryIndex = parseInt(i.values[0].split('_')[1]);
                    setupStage = `category_details_${selectedCategoryIndex}`;

                    await i.reply({
                        content: `Configuring Category ${selectedCategoryIndex + 1}: Please provide the emoji and name in the format: Emoji \\ Name (e.g., 🔥 \\ Report).`,
                        flags: MessageFlags.Ephemeral,
                    });

                    const filter = (m) => m.author.id === i.user.id;
                    const categoryCollector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

                    categoryCollector.on('collect', async (m) => {
                        const [emoji, name] = m.content.split('\\').map(part => part.trim());
                        if (!emoji || !name) {
                            await i.followUp({ content: 'Invalid format. Please use: Emoji \\ Name (e.g., 🔥 \\ Report).', flags: MessageFlags.Ephemeral });
                            setupStage = null;
                            await safeEditMessage(i, embed, [buttons]);
                            return;
                        }

                        setupStage = `category_channel_${selectedCategoryIndex}`;
                        await i.followUp({
                            content: `Please mention the server category where ${name} tickets should be created (e.g., category ID or mention).`,
                            flags: MessageFlags.Ephemeral,
                        });

                        const channelCollector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

                        channelCollector.on('collect', async (m) => {
                            const ticketCategory = m.mentions.channels.first() || guild.channels.cache.get(m.content);
                            if (!ticketCategory || ticketCategory.type !== ChannelType.GuildCategory) {
                                await i.followUp({ content: 'Please provide a valid server category.', flags: MessageFlags.Ephemeral });
                                setupStage = null;
                                await safeEditMessage(i, embed, [buttons]);
                                return;
                            }

                            collectedData.Categories[selectedCategoryIndex] = {
                                emoji,
                                name,
                                value: name.toLowerCase().replace(/\s+/g, '-'),
                                description: `Create a ${name} ticket`,
                                ticketCategory: ticketCategory.id,
                            };

                            updateConfigurationField();
                            updateSystemStatus();
                            await safeEditMessage(i, embed, [buttons]);
                            await i.followUp({
                                content: `Category ${selectedCategoryIndex + 1} configured successfully. Select "Setup Ticket Categories" to add more or "Done" to finalize.`,
                                flags: MessageFlags.Ephemeral
                            });
                            setupStage = null;
                        });

                        channelCollector.on('end', (collected) => {
                            if (collected.size === 0) {
                                i.followUp({ content: 'You did not respond in time. Category setup cancelled.', flags: MessageFlags.Ephemeral });
                                setupStage = null;
                                safeEditMessage(i, embed, [buttons]);
                            }
                        });
                    });

                    categoryCollector.on('end', (collected) => {
                        if (collected.size === 0) {
                            i.followUp({ content: 'You did not respond in time. Category setup cancelled.', flags: MessageFlags.Ephemeral });
                            setupStage = null;
                            safeEditMessage(i, embed, [buttons]);
                        }
                    });
                } else if (i.customId === 'done') {
                    if (!collectedData.Channel || !collectedData.Categories.length) {
                        await i.reply({ content: 'Please complete the ticket panel setup and set at least one category before finalizing.', flags: MessageFlags.Ephemeral });
                        return;
                    }

                    try {
                        await TicketSetup.findOneAndUpdate(
                            { GuildID: guild.id },
                            {
                                Channel: collectedData.Channel,
                                Transcripts: collectedData.Transcripts,
                                Handlers: collectedData.Handlers,
                                Everyone: collectedData.Everyone,
                                Description: collectedData.Description,
                                Categories: collectedData.Categories,
                            },
                            { new: true, upsert: true }
                        );

                        const channel = guild.channels.cache.get(collectedData.Channel);
                        const finalEmbed = new EmbedBuilder()
                            .setAuthor({
                                name: `${guild.name}'s Ticket Panel`,
                                iconURL: guild.iconURL({ dynamic: true, size: 1024 })
                            })
                            .setDescription(collectedData.Description)
                            .setColor(client.config.embedColor)
                            .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
                            .setFooter({
                                text: `Powered by ${client.user.username}`,
                                iconURL: client.user.displayAvatarURL({ dynamic: true, size: 1024 })
                            });

                        const dropdown = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('ticket-dropdown')
                                .setPlaceholder('Select a ticket type')
                                .addOptions(collectedData.Categories.map(category => ({
                                    label: category.name,
                                    description: category.description,
                                    emoji: category.emoji,
                                    value: category.value,
                                })))
                        );

                        await channel.send({
                            embeds: [finalEmbed],
                            components: [dropdown],
                        });

                        buttons.components[0].setDisabled(true);
                        buttons.components[1].setDisabled(true);
                        buttons.components[2].setDisabled(true);
                        buttons.components[3].setDisabled(false);
                        await i.update({
                            content: 'Ticket system setup completed!',
                            embeds: [embed],
                            components: [buttons],
                        });

                        data = await TicketSetup.findOne({ GuildID: guild.id });
                    } catch (err) {
                        console.log(err);
                        await i.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription(config.ticketError)], flags: MessageFlags.Ephemeral });
                    }
                } else if (i.customId === 'disable') {
                    try {
                        await TicketSetup.findOneAndDelete({ GuildID: guild.id });
                        data = null;
                        collectedData = {
                            Channel: null,
                            Transcripts: null,
                            Handlers: null,
                            Everyone: null,
                            Description: null,
                            Categories: [],
                        };

                        updateSystemStatus();
                        updateConfigurationField();

                        buttons.components[0].setDisabled(false);
                        buttons.components[1].setDisabled(true);
                        buttons.components[2].setDisabled(true);
                        buttons.components[3].setDisabled(true);
                        await i.update({ embeds: [embed], components: [buttons] });

                        await i.followUp({ content: 'The ticket system has been disabled.', flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        console.log(err);
                        await i.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription(config.ticketError)], flags: MessageFlags.Ephemeral });
                    }
                }
            });

            collector.on('end', async (reason) => {
                if (reason === 'message_deleted') return;
                buttons.components.forEach(component => component.setDisabled(true));
                try {
                    await message.edit({
                        content: 'The ticket configuration panel has timed out.',
                        embeds: [embed],
                        components: [buttons],
                    });
                } catch (error) {
                    if (error.code === 10008) {
                        return;
                    }
                    console.error(error);
                }
            });
        } else {
            const ticketData = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
            if (!ticketData) {
                return interaction.reply({ content: 'This command must be used in a ticket channel.', flags: MessageFlags.Ephemeral });
            }

            const ticketSetup = await TicketSetup.findOne({ GuildID: guild.id });
            if (!ticketSetup) {
                return interaction.reply({ content: 'Ticket system is not set up.', flags: MessageFlags.Ephemeral });
            }

            const hasHandlerRole = member.roles.cache.has(ticketSetup.Handlers);
            const isTicketOwner = member.id === ticketData.OwnerID;
            const isTicketClosed = ticketData.Closed;

            if (subcommand === 'remind') {
                if (!hasHandlerRole) {
                    return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
                }
                if (isTicketClosed) {
                    return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });
                }
                if (ticketData.RemindTimeout) {
                    return interaction.reply({ content: 'A reminder is already active for this ticket.', flags: MessageFlags.Ephemeral });
                }

                const remindEmbed = new EmbedBuilder()
                    .setTitle('Ticket Inactivity Warning')
                    .setDescription(`<@${ticketData.OwnerID}>, this ticket will be closed in 24 hours due to inactivity. Please send a message to keep it open.`)
                    .setColor('Yellow')
                    .setTimestamp();

                await interaction.reply({ embeds: [remindEmbed] });

                const timeoutId = setTimeout(async () => {
                    const updatedTicket = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
                    if (!updatedTicket || updatedTicket.Closed) return;

                    const reason = 'Inactivity';
                    await channel.permissionOverwrites.edit(ticketData.OwnerID, {
                        [PermissionFlagsBits.SendMessages]: false,
                        [PermissionFlagsBits.ReadMessageHistory]: false,
                    }).catch(error => console.error('Failed to update channel permissions:', error));

                    let transcript;
                    try {
                        transcript = await createTranscript(channel, {
                            limit: -1,
                            returnType: 'attachment',
                            saveImages: true,
                            poweredBy: false,
                            filename: `${config.ticketName}-${ticketData.TicketID}.html`,
                        });
                    } catch (error) {
                        console.error('Failed to create transcript:', error);
                        await channel.send({ content: 'Failed to create transcript.' }).catch(err => console.error('Failed to send message:', err));
                        return;
                    }

                    const closingTicketEmbed = new EmbedBuilder()
                        .setTitle('Ticket Closed')
                        .setDescription(`This ticket was closed automatically due to: ${reason}`)
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

                    await channel.send({ embeds: [closingTicketEmbed], components: [buttons] }).catch(error => console.error('Failed to send closing message:', error));

                    const ticketOwner = await guild.members.fetch(ticketData.OwnerID).catch(error => {
                        console.error('Failed to fetch ticket owner:', error);
                        return null;
                    });

                    if (ticketOwner) {
                        const claimedBy = ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Not claimed';
                        const closedAt = new Date();
                        const openedAt = ticketData.CreatedAt ? ticketData.CreatedAt.toLocaleString() : 'Unknown';

                        const ownerEmbed = new EmbedBuilder()
                            .setTitle('Ticket Closed')
                            .setColor('Red')
                            .addFields(
                                { name: 'Ticket Opened At', value: openedAt, inline: true },
                                { name: 'Ticket Closed At', value: closedAt.toLocaleString(), inline: true },
                                { name: 'Claimed By', value: claimedBy, inline: true },
                                { name: 'Closed By', value: 'Automatic', inline: true },
                                { name: 'Reason', value: reason },
                                { name: 'Transcript', value: 'Attached with Embed' }
                            );

                        await ticketOwner.send({ embeds: [ownerEmbed], files: [transcript] }).catch(error => {
                            console.error('Failed to send DM to ticket owner:', error);
                            channel.send(`Could not send transcript to <@${ticketData.OwnerID}>. They may have DMs disabled.`).catch(err => console.error('Failed to send fallback message:', err));
                        });
                    } else {
                        await channel.send(`Could not fetch ticket owner <@${ticketData.OwnerID}>. They may have left the server.`).catch(error => console.error('Failed to send fallback message:', error));
                    }

                    // Send transcript to the transcripts channel
                    if (ticketSetup.Transcripts) {
                        try {
                            const transcriptsChannel = await guild.channels.fetch(ticketSetup.Transcripts);
                            if (transcriptsChannel) {
                                const transcriptEmbed = new EmbedBuilder()
                                    .setTitle(`Ticket Transcript - ${config.ticketName}-${ticketData.TicketID}`)
                                    .setColor('Purple')
                                    .addFields(
                                        { name: 'Ticket Owner', value: `<@${ticketData.OwnerID}>`, inline: true },
                                        { name: 'Ticket ID', value: ticketData.TicketID.toString(), inline: true },
                                        { name: 'Closed By', value: 'Automatic', inline: true },
                                        { name: 'Claimed By', value: ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Not claimed', inline: true },
                                        { name: 'Reason for Closure', value: reason, inline: false },
                                        { name: 'Opened At', value: ticketData.CreatedAt ? ticketData.CreatedAt.toLocaleString() : 'Unknown', inline: true },
                                        { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
                                    )
                                    .setTimestamp();

                                await transcriptsChannel.send({
                                    embeds: [transcriptEmbed],
                                    files: [transcript],
                                });
                            } else {
                                console.error('Transcripts channel not found:', ticketSetup.Transcripts);
                            }
                        } catch (error) {
                            console.error('Failed to send transcript to transcripts channel:', error);
                        }
                    } else {
                        console.error('Transcripts channel ID not set in TicketSetup for guild:', guild.id);
                    }

                    await TicketSchema.updateOne({ ChannelID: channel.id }, { Closed: true, RemindTimeout: null });
                }, 24 * 60 * 60 * 1000); // 24 hours

                await TicketSchema.updateOne(
                    { ChannelID: channel.id },
                    { RemindTimeout: timeoutId[Symbol.toPrimitive]() }
                );
            } else if (subcommand === 'close') {
                if (isTicketClosed) {
                    return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });
                }
                if (!isTicketOwner && !hasHandlerRole) {
                    return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });
                }

                let reason = options.getString('reason');
                let modalInteraction = null;
                if (!reason) {
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

                    modalInteraction = await interaction.awaitModalSubmit({
                        filter: (i) => i.user.id === member.id && i.customId === 'close_reason_modal',
                        time: 30000,
                    }).catch(async (err) => {
                        console.error('Modal submission failed:', err);
                        await interaction.followUp({ content: 'You did not provide a reason in time. The ticket will not be closed.', flags: MessageFlags.Ephemeral }).catch(() => {});
                        return null;
                    });

                    if (!modalInteraction) return;

                    await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });
                    reason = modalInteraction.fields.getTextInputValue('close_reason');
                    await modalInteraction.followUp({ content: 'Ticket closing in progress...', flags: MessageFlags.Ephemeral });
                }

                await channel.permissionOverwrites.edit(ticketData.OwnerID, {
                    [PermissionFlagsBits.SendMessages]: false,
                    [PermissionFlagsBits.ReadMessageHistory]: false,
                }).catch(error => console.error('Failed to update channel permissions:', error));

                let transcript;
                try {
                    transcript = await createTranscript(channel, {
                        limit: -1,
                        returnType: 'attachment',
                        saveImages: true,
                        poweredBy: false,
                        filename: `${config.ticketName}-${ticketData.TicketID}.html`,
                    });
                } catch (error) {
                    console.error('Failed to create transcript:', error);
                    if (reason && modalInteraction) {
                        await modalInteraction.followUp({ content: 'Failed to create transcript.', flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ content: 'Failed to create transcript.', flags: MessageFlags.Ephemeral });
                    }
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

                await channel.send({ embeds: [closingTicketEmbed], components: [buttons] }).catch(error => console.error('Failed to send closing message:', error));

                const ticketOwner = await guild.members.fetch(ticketData.OwnerID).catch(error => {
                    console.error('Failed to fetch ticket owner:', error);
                    return null;
                });

                if (ticketOwner) {
                    const claimedBy = ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Not claimed';
                    const closedAt = new Date();
                    const openedAt = ticketData.CreatedAt ? ticketData.CreatedAt.toLocaleString() : 'Unknown';

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
                        channel.send(`Could not send transcript to <@${ticketData.OwnerID}>. They may have DMs disabled.`).catch(err => console.error('Failed to send fallback message:', err));
                    });
                } else {
                    await channel.send(`Could not fetch ticket owner <@${ticketData.OwnerID}>. They may have left the server.`).catch(error => console.error('Failed to send fallback message:', error));
                }

                // Send transcript to the transcripts channel
                if (ticketSetup.Transcripts) {
                    try {
                        const transcriptsChannel = await guild.channels.fetch(ticketSetup.Transcripts);
                        if (transcriptsChannel) {
                            const transcriptEmbed = new EmbedBuilder()
                                .setTitle(`Ticket Transcript - ${config.ticketName}-${ticketData.TicketID}`)
                                .setColor('Purple')
                                .addFields(
                                    { name: 'Ticket Owner', value: `<@${ticketData.OwnerID}>`, inline: true },
                                    { name: 'Ticket ID', value: ticketData.TicketID.toString(), inline: true },
                                    { name: 'Closed By', value: `<@${member.id}>`, inline: true },
                                    { name: 'Claimed By', value: ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Not claimed', inline: true },
                                    { name: 'Reason for Closure', value: reason, inline: false },
                                    { name: 'Opened At', value: ticketData.CreatedAt ? ticketData.CreatedAt.toLocaleString() : 'Unknown', inline: true },
                                    { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
                                )
                                .setTimestamp();

                            await transcriptsChannel.send({
                                embeds: [transcriptEmbed],
                                files: [transcript],
                            });
                        } else {
                            console.error('Transcripts channel not found:', ticketSetup.Transcripts);
                        }
                    } catch (error) {
                        console.error('Failed to send transcript to transcripts channel:', error);
                    }
                } else {
                    console.error('Transcripts channel ID not set in TicketSetup for guild:', guild.id);
                }

                await TicketSchema.updateOne({ ChannelID: channel.id }, { Closed: true, RemindTimeout: null });
                if (reason && modalInteraction) {
                    await modalInteraction.followUp({ content: 'Ticket closed successfully.', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: 'Ticket closed successfully.', flags: MessageFlags.Ephemeral });
                }
            } else if (subcommand === 'reopen') {
                if (!isTicketClosed) {
                    return interaction.reply({ content: 'This ticket is not closed.', flags: MessageFlags.Ephemeral });
                }
                if (!isTicketOwner && !hasHandlerRole) {
                    return interaction.reply({ content: 'You do not have permission to reopen this ticket.', flags: MessageFlags.Ephemeral });
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                await TicketSchema.updateOne({ ChannelID: channel.id }, { Closed: false, Claimed: false, RemindTimeout: null });

                await channel.permissionOverwrites.edit(ticketData.OwnerID, {
                    [PermissionFlagsBits.SendMessages]: true,
                    [PermissionFlagsBits.ReadMessageHistory]: true,
                }).catch(error => console.error('Failed to restore channel permissions:', error));

                const reopenedEmbed = new EmbedBuilder()
                    .setTitle('Ticket Reopened')
                    .setDescription(`This ticket has been reopened by <@${member.id}>.`)
                    .setColor('Green');

                await channel.send({ embeds: [reopenedEmbed] }).catch(error => console.error('Failed to send reopen message:', error));
                await interaction.followUp({ content: 'Ticket reopened successfully.', flags: MessageFlags.Ephemeral });
            } else if (subcommand === 'add') {
                if (!hasHandlerRole) {
                    return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
                }
                if (isTicketClosed) {
                    return interaction.reply({ content: 'This ticket is closed and cannot be modified.', flags: MessageFlags.Ephemeral });
                }

                const user = options.getUser('user');
                const selectedUser = await guild.members.fetch(user.id).catch(() => null);

                if (!selectedUser) {
                    return interaction.reply({ content: 'Could not find the specified user in this server.', flags: MessageFlags.Ephemeral });
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const findMembers = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id, MembersID: user.id });
                if (findMembers) {
                    return interaction.followUp({ content: `${selectedUser} is already in the ticket.`, flags: MessageFlags.Ephemeral });
                }

                ticketData.MembersID.push(user.id);
                await channel.permissionOverwrites.edit(user.id, {
                    [PermissionFlagsBits.ViewChannel]: true,
                    [PermissionFlagsBits.SendMessages]: true,
                    [PermissionFlagsBits.ReadMessageHistory]: true,
                }).catch(error => console.error('Failed to edit channel permissions:', error));

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('Green')
                        .setDescription(`${selectedUser} has been added to the ticket.`)]
                }).catch(error => console.error('Failed to send add message:', error));

                await ticketData.save();
                await interaction.followUp({ content: `${selectedUser} has been added to the ticket!`, flags: MessageFlags.Ephemeral });
            } else if (subcommand === 'claim') {
                if (!hasHandlerRole) {
                    return interaction.reply({ content: 'You do not have permission to claim this ticket.', flags: MessageFlags.Ephemeral });
                }
                if (isTicketClosed) {
                    return interaction.reply({ content: 'This ticket is closed and cannot be claimed.', flags: MessageFlags.Ephemeral });
                }
                if (ticketData.Claimed) {
                    const claimedBy = ticketData.ClaimedBy ? `<@${ticketData.ClaimedBy}>` : 'Unknown';
                    return interaction.reply({ content: `This ticket is already claimed by ${claimedBy}.`, flags: MessageFlags.Ephemeral });
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                await TicketSchema.updateOne({ ChannelID: channel.id }, { Claimed: true, ClaimedBy: member.id });
                await channel.setName(`${config.ticketClaimEmoji}-${config.ticketName}-${ticketData.TicketID}`).catch(error => console.error('Failed to set channel name:', error));

                const claimEmbed = new EmbedBuilder()
                    .setTitle('Ticket Claimed')
                    .setDescription(`This ticket has been claimed by <@${member.id}>.`)
                    .setColor('Yellow');

                await channel.send({ embeds: [claimEmbed] }).catch(error => console.error('Failed to send claim embed:', error));
                await interaction.followUp({ content: 'You have claimed this ticket.', flags: MessageFlags.Ephemeral });
            } else if (subcommand === 'lock') {
                if (!hasHandlerRole) {
                    return interaction.reply({ content: 'You do not have permission to lock this ticket.', flags: MessageFlags.Ephemeral });
                }
                if (isTicketClosed) {
                    return interaction.reply({ content: 'This ticket is closed and cannot be modified.', flags: MessageFlags.Ephemeral });
                }
                if (ticketData.Locked) {
                    return interaction.reply({ content: 'This ticket is already locked.', flags: MessageFlags.Ephemeral });
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                await channel.permissionOverwrites.edit(ticketData.OwnerID, {
                    [PermissionFlagsBits.SendMessages]: false,
                    [PermissionFlagsBits.ReadMessageHistory]: false,
                }).catch(error => console.error('Failed to update channel permissions:', error));

                await TicketSchema.updateOne({ ChannelID: channel.id }, { Locked: true });
                await interaction.followUp({ content: 'The ticket has been locked. The ticket owner can no longer send messages or read past messages.', flags: MessageFlags.Ephemeral });
            } else if (subcommand === 'unlock') {
                if (!hasHandlerRole) {
                    return interaction.reply({ content: 'You do not have permission to unlock this ticket.', flags: MessageFlags.Ephemeral });
                }
                if (isTicketClosed) {
                    return interaction.reply({ content: 'This ticket is closed and cannot be modified.', flags: MessageFlags.Ephemeral });
                }
                if (!ticketData.Locked) {
                    return interaction.reply({ content: 'This ticket is already unlocked.', flags: MessageFlags.Ephemeral });
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                await channel.permissionOverwrites.edit(ticketData.OwnerID, {
                    [PermissionFlagsBits.SendMessages]: true,
                    [PermissionFlagsBits.ReadMessageHistory]: true,
                }).catch(error => console.error('Failed to restore channel permissions:', error));

                await TicketSchema.updateOne({ ChannelID: channel.id }, { Locked: false });
                await interaction.followUp({ content: 'The ticket has been unlocked. The ticket owner can now send messages and read past messages.', flags: MessageFlags.Ephemeral });
            }
        }
    },
};

// Message event listener to cancel remind timeout on owner activity
module.exports.setupMessageListener = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const ticketData = await TicketSchema.findOne({
            GuildID: message.guild.id,
            ChannelID: message.channel.id,
            OwnerID: message.author.id,
            RemindTimeout: { $ne: null },
        });

        if (!ticketData) return;

        clearTimeout(ticketData.RemindTimeout);
        await TicketSchema.updateOne(
            { ChannelID: message.channel.id },
            { RemindTimeout: null }
        );

        const activityEmbed = new EmbedBuilder()
            .setTitle('Ticket Activity Detected')
            .setDescription(`<@${ticketData.OwnerID}> has sent a message. The inactivity auto-close has been cancelled.`)
            .setColor('Green')
            .setTimestamp();

        await message.channel.send({ embeds: [activityEmbed] }).catch(error => console.error('Failed to send activity message:', error));
    });
};