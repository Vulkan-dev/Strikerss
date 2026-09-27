const { Events, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageFlags } = require('discord.js');
const joinschema = require("../Schemas/jointocreate");
const joinchannelschema = require("../Schemas/jointocreatechannels");
const jtcpanelschema = require("../Schemas/jtc-panel");

module.exports = (client) => {
    // Event: VoiceStateUpdate (Join to Create)
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (!newState.guild) return;

        try {
            if (newState.member.guild === null) return;
        } catch (err) {
            return;
        }

        if (!newState.member.guild) return;
        if (newState.member.id === client.config.clientID) return;

        const joindata = await joinschema.findOne({ Guild: newState.member.guild.id });
        const joinchanneldata1 = await joinchannelschema.findOne({
            Guild: newState.member.guild.id,
            User: newState.member.id,
        });

        const voicechannel = newState.channel;

        if (!joindata) return;
        if (!voicechannel) return;

        if (voicechannel.id === joindata.Channel) {
            if (joinchanneldata1) {
                try {
                    const joinfail = new EmbedBuilder()
                        .setColor(client.config.embedColor)
                        .setTimestamp()
                        .setAuthor({ name: `🔊 Join to Create System` })
                        .setFooter({ text: `🔊 Issue Faced` })
                        .setTitle("> You tried creating a \n> voice channel but..")
                        .addFields({
                            name: `• Error Occurred`,
                            value: `> You already have a voice channel \n> open at the moment.`,
                        });

                    return await newState.member.send({ embeds: [joinfail] });
                } catch (err) {
                    return;
                }
            } else {
                try {
                    const channel = await newState.member.guild.channels.create({
                        type: ChannelType.GuildVoice,
                        name: `${newState.member.user.username}-room`,
                        userLimit: joindata.VoiceLimit,
                        parent: joindata.Category,
                        permissionOverwrites: [
                            {
                                id: newState.member.id,
                                allow: [
                                    PermissionsBitField.Flags.ManageChannels,
                                    PermissionsBitField.Flags.Connect,
                                    PermissionsBitField.Flags.ViewChannel,
                                ],
                            },
                            {
                                id: newState.member.guild.roles.everyone,
                                allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel],
                            },
                        ],
                    });

                    try {
                        await newState.member.voice.setChannel(channel.id);
                    } catch (err) {
                        console.log("Error moving member to the new channel:", err);
                    }

                    setTimeout(() => {
                        joinchannelschema.create({
                            Guild: newState.member.guild.id,
                            Channel: channel.id,
                            User: newState.member.id,
                        });
                    }, 500);

                    // Create control panel embed
                    const controlPanel = new EmbedBuilder()
                        .setColor(client.config.embedColor)
                        .setTimestamp()
                        .setAuthor({ name: `🔊 Join to Create Control Panel` })
                        .setFooter({ text: `🔊 Channel Management` })
                        .setTitle(`> Manage Your Voice Channel`)
                        .addFields({
                            name: `• Channel`,
                            value: `> ${channel.name} (<#${channel.id}>)`,
                        })
                        .addFields({
                            name: `• Current User Limit`,
                            value: `> ${channel.userLimit || 'Unlimited'}`,
                        })
                        .addFields({
                            name: `• Status`,
                            value: `> Unlocked`,
                        });

                    // Create buttons for control panel
                    const buttons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`jtc_setlimit_${channel.id}`)
                            .setLabel('Set User Limit')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`jtc_lock_${channel.id}`)
                            .setLabel('Lock Channel')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`jtc_unlock_${channel.id}`)
                            .setLabel('Unlock Channel')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`jtc_kick_${channel.id}`)
                            .setLabel('Kick User')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    // Send control panel to user's DMs
                    try {
                        const panelMessage = await newState.member.send({
                            embeds: [controlPanel],
                            components: [buttons],
                        });

                        // Save control panel message ID
                        await jtcpanelschema.create({
                            Guild: newState.member.guild.id,
                            Channel: channel.id,
                            User: newState.member.id,
                            MessageId: panelMessage.id,
                        });
                    } catch (err) {
                        console.log("Error sending control panel to DMs:", err);
                    }

                    // Send success message
                    try {
                        const joinsuccess = new EmbedBuilder()
                            .setColor(client.config.embedColor)
                            .setTimestamp()
                            .setAuthor({ name: `🔊 Join to Create System` })
                            .setFooter({ text: `🔊 Channel Created` })
                            .setTitle("> Channel Created")
                            .addFields({
                                name: `• Channel Created`,
                                value: `> Your voice channel has been \n> created in **${newState.member.guild.name}**!\n> Check your DMs for the control panel.`,
                            });

                        await newState.member.send({ embeds: [joinsuccess] });
                    } catch (err) {
                        return;
                    }
                } catch (err) {
                    console.log("Error creating channel:", err);

                    try {
                        const joinfail = new EmbedBuilder()
                            .setColor(client.config.embedColor)
                            .setTimestamp()
                            .setAuthor({ name: `🔊 Join to Create System` })
                            .setFooter({ text: `🔊 Issue Faced` })
                            .setTitle("> You tried creating a \n> voice channel but..")
                            .addFields({
                                name: `• Error Occurred`,
                                value: `> I could not create your channel, \n> perhaps I am missing some permissions.`,
                            });

                        await newState.member.send({ embeds: [joinfail] });
                    } catch (err) {
                        return;
                    }

                    return;
                }
            }
        }
    });

    // Event: VoiceStateUpdate (Channel Deletion)
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        try {
            if (oldState.member.guild === null) return;
        } catch (err) {
            return;
        }

        if (oldState.member.id === client.config.clientID) return;

        const leavechanneldata = await joinchannelschema.findOne({
            Guild: oldState.member.guild.id,
            User: oldState.member.id,
        });

        if (!leavechanneldata) return;

        const voicechannel = await oldState.member.guild.channels.cache.get(leavechanneldata.Channel);

        if (newState.channel === voicechannel) return;

        try {
            await voicechannel.delete();
        } catch (err) {
            console.log("Error deleting channel:", err);
            return;
        }

        // Delete control panel message
        const panelData = await jtcpanelschema.findOne({
            Guild: oldState.guild.id,
            Channel: leavechanneldata.Channel,
            User: oldState.member.id,
        });

        if (panelData) {
            try {
                const user = await client.users.fetch(oldState.member.id);
                const dmChannel = await user.createDM();
                const panelMessage = await dmChannel.messages.fetch(panelData.MessageId);
                await panelMessage.delete();
            } catch (err) {
                console.log("Error deleting control panel message:", err);
            }

            await jtcpanelschema.deleteMany({
                Guild: oldState.guild.id,
                Channel: leavechanneldata.Channel,
                User: oldState.member.id,
            });
        }

        await joinchannelschema.deleteMany({
            Guild: oldState.guild.id,
            User: oldState.member.id,
        });

        try {
            const deletechannel = new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setTimestamp()
                .setAuthor({ name: `🔊 Join to Create System` })
                .setFooter({ text: `🔊 Channel Deleted` })
                .setTitle("> Channel Deleted")
                .addFields({
                    name: `• Channel Deleted`,
                    value: `> Your voice channel has been \n> deleted in **${newState.member.guild.name}**!`,
                });

            await newState.member.send({ embeds: [deletechannel] });
        } catch (err) {
            return;
        }
    });

    // Button Interaction Handler
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton()) return;

        if (!interaction.customId.startsWith('jtc_')) return;

        const [prefix, action, channelId] = interaction.customId.split('_');
        if (prefix !== 'jtc') return;

        // Verify the interaction is from the channel owner
        const panelData = await jtcpanelschema.findOne({
            Channel: channelId,
            User: interaction.user.id,
        });

        if (!panelData) {
            await interaction.reply({ content: 'You are not authorized to manage this channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        const guild = client.guilds.cache.get(panelData.Guild);
        if (!guild) {
            await interaction.reply({ content: 'Guild not found.', flags: MessageFlags.Ephemeral });
            return;
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            await interaction.reply({ content: 'This channel no longer exists.', flags: MessageFlags.Ephemeral });
            return;
        }

        // Function to update control panel embed
        const updatePanel = async (fields) => {
            const updatedEmbed = new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setTimestamp()
                .setAuthor({ name: `🔊 Join to Create Control Panel` })
                .setFooter({ text: `🔊 Channel Management` })
                .setTitle(`> Manage Your Voice Channel`)
                .addFields(fields);

            try {
                const dmChannel = await interaction.user.createDM();
                const panelMessage = await dmChannel.messages.fetch(panelData.MessageId);
                await panelMessage.edit({ embeds: [updatedEmbed], components: [panelMessage.components[0]] });
            } catch (err) {
                console.log("Error updating control panel:", err);
            }
        };

        // Defer interaction to prevent timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        switch (action) {
            case 'setlimit':
                await interaction.editReply({
                    content: 'Please enter the new user limit (2-10):',
                });

                const limitFilter = (m) => m.author.id === interaction.user.id && !isNaN(m.content) && Number(m.content) >= 2 && Number(m.content) <= 10;
                const limitCollector = interaction.channel.createMessageCollector({
                    filter: limitFilter,
                    max: 1,
                    time: 30000,
                });

                limitCollector.on('collect', async (m) => {
                    const newLimit = parseInt(m.content);
                    try {
                        await channel.setUserLimit(newLimit);
                        await updatePanel([
                            { name: `• Channel`, value: `> ${channel.name} (<#${channel.id}>)` },
                            { name: `• Current User Limit`, value: `> ${newLimit}` },
                            { name: `• Status`, value: `> ${channel.permissionsFor(guild.roles.everyone).has(PermissionsBitField.Flags.Connect) ? 'Unlocked' : 'Locked'}` },
                        ]);
                        await interaction.followUp({ content: `User limit set to ${newLimit}.`, flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        await interaction.followUp({ content: 'Failed to set user limit. Please try again.', flags: MessageFlags.Ephemeral });
                    }
                    await m.delete().catch(() => {});
                });

                limitCollector.on('end', (collected) => {
                    if (!collected.size) {
                        interaction.followUp({ content: 'No valid input received within 30 seconds.', flags: MessageFlags.Ephemeral });
                    }
                });
                break;

            case 'lock':
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        Connect: false,
                    });
                    await updatePanel([
                        { name: `• Channel`, value: `> ${channel.name} (<#${channel.id}>)` },
                        { name: `• Current User Limit`, value: `> ${channel.userLimit || 'Unlimited'}` },
                        { name: `• Status`, value: `> Locked` },
                    ]);
                    await interaction.editReply({ content: 'Channel is now locked.' });
                } catch (err) {
                    await interaction.editReply({ content: 'Failed to lock channel. Please try again.' });
                }
                break;

            case 'unlock':
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        Connect: true,
                    });
                    await updatePanel([
                        { name: `• Channel`, value: `> ${channel.name} (<#${channel.id}>)` },
                        { name: `• Current User Limit`, value: `> ${channel.userLimit || 'Unlimited'}` },
                        { name: `• Status`, value: `> Unlocked` },
                    ]);
                    await interaction.editReply({ content: 'Channel is now unlocked.' });
                } catch (err) {
                    await interaction.editReply({ content: 'Failed to unlock channel. Please try again.' });
                }
                break;

            case 'kick':
                const members = channel.members.filter((member) => member.id !== interaction.user.id);
                if (members.size === 0) {
                    await interaction.editReply({ content: 'No other users in the channel to kick.' });
                    return;
                }

                const memberList = members.map((m) => `${m.user.tag} (${m.id})`).join('\n');
                await interaction.editReply({
                    content: `Please enter the ID of the user to kick:\n${memberList}`,
                });

                const kickFilter = (m) => m.author.id === interaction.user.id && members.has(m.content);
                const kickCollector = interaction.channel.createMessageCollector({
                    filter: kickFilter,
                    max: 1,
                    time: 30000,
                });

                kickCollector.on('collect', async (m) => {
                    const userId = m.content;
                    const member = channel.members.get(userId);
                    try {
                        await member.voice.disconnect();
                        await interaction.followUp({ content: `${member.user.tag} has been kicked from the channel.`, flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        await interaction.followUp({ content: 'Failed to kick user. Please try again.', flags: MessageFlags.Ephemeral });
                    }
                    await m.delete().catch(() => {});
                });

                kickCollector.on('end', (collected) => {
                    if (!collected.size) {
                        interaction.followUp({ content: 'No valid user ID provided within 30 seconds.', flags: MessageFlags.Ephemeral });
                    }
                });
                break;
        }
    });
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */