const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const ms = require("ms");
const Giveaway = require('../../Schemas/giveawaySchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start a giveaway')
                .addStringOption(option => option.setName('prize').setDescription('The prize to give away').setRequired(true))
                .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(true))
                .addStringOption(option => option.setName('duration').setDescription('Duration (e.g., 60s, 5m, 1h)').setRequired(true))
                .addIntegerOption(option => option.setName('required_messages').setDescription('Required messages to enter').setRequired(false))
                .addIntegerOption(option => option.setName('required_invites').setDescription('Required invites to enter').setRequired(false))
                .addRoleOption(option => option.setName('bonus_role').setDescription('Role for bonus entries').setRequired(false))
                .addIntegerOption(option => option.setName('bonus_entries').setDescription('Number of bonus entries for the role').setRequired(false))
                .addChannelOption(option => option.setName('channel').setDescription('The channel to send the giveaway to').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reroll')
                .setDescription('Reroll a giveaway')
                .addStringOption(option => option.setName('giveaway_id').setDescription('The ID of the giveaway to reroll').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit a giveaway')
                .addStringOption(option => option.setName('giveaway_id').setDescription('The ID of the giveaway to edit').setRequired(true))
                .addStringOption(option => option.setName('prize').setDescription('The new prize').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('End a giveaway early')
                .addStringOption(option => option.setName('giveaway_id').setDescription('The ID of the giveaway to end').setRequired(true))
        ),
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.MentionEveryone)) {
            return await interaction.reply({
              content: "❌ You do not have permission to use giveaway commands.",
              flags: MessageFlags.Ephemeral
            });
          }
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'start') {
                const prize = interaction.options.getString('prize');
                const winners = interaction.options.getInteger('winners');
                const duration = interaction.options.getString('duration');
                const requiredMessages = interaction.options.getInteger('required_messages') ?? 0;
                const requiredInvites = interaction.options.getInteger('required_invites') ?? 0;
                const bonusRole = interaction.options.getRole('bonus_role');
                const bonusEntries = interaction.options.getInteger('bonus_entries') ?? 0;
                const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;

                if (bonusRole && bonusEntries <= 0) {
                    return interaction.reply({ content: 'Please provide a positive number of bonus entries when specifying a bonus role!', flags: MessageFlags.Ephemeral });
                }

                const timeInMs = ms(duration);
                if (!timeInMs) return interaction.reply({ content: 'Invalid duration format! Use something like 60s, 5m, or 1h.', flags: MessageFlags.Ephemeral });

                const endTime = new Date(Date.now() + timeInMs);
                const embed = new EmbedBuilder()
                    .setTitle('🎉 GIVEAWAY 🎉')
                    .setDescription(
                        `**Prize:** ${prize}\n` +
                        `**Winners:** ${winners}\n` +
                        `**Hosted by:** ${interaction.user}\n` +
                        `**Ends in:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
                        `**Requirements:**\n` +
                        `- Messages: ${requiredMessages}\n` +
                        `- Invites: ${requiredInvites}\n` +
                        (bonusRole ? `**Bonus:** ${bonusEntries} extra entries for <@&${bonusRole.id}>` : '')
                    )
                    .setColor('#00FF00');

                const enterButton = new ButtonBuilder()
                    .setCustomId('giveaway_enter')
                    .setLabel('Enter')
                    .setStyle(ButtonStyle.Primary);

                const showEntriesButton = new ButtonBuilder()
                    .setCustomId('giveaway_show_entries')
                    .setLabel('Show Entries: 0')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const row = new ActionRowBuilder().addComponents(enterButton, showEntriesButton);

                const message = await targetChannel.send({
                    embeds: [embed.setFooter({ text: `Giveaway ID: (will be set after sending)` })],
                    components: [row],
                });

                embed.setFooter({ text: `Giveaway ID: ${message.id}` });
                await message.edit({ embeds: [embed], components: [row] });

                const giveaway = new Giveaway({
                    giveawayId: message.id,
                    messageId: message.id,
                    channelId: targetChannel.id,
                    guildId: interaction.guild.id,
                    prize,
                    winners,
                    endTime,
                    host: interaction.user.id,
                    entrants: [],
                    requiredMessages,
                    requiredInvites,
                    bonusRole: bonusRole ? bonusRole.id : null,
                    bonusEntries,
                    hasEnded: false,
                });
                await giveaway.save();
                // %%RESOURCE%%
                console.log(`[Giveaway Started] Giveaway ID: ${message.id}, Prize: ${prize}, Entrants: ${giveaway.entrants.length}`);

                await interaction.reply({ content: `The giveaway has been started in ${targetChannel}!`, flags: MessageFlags.Ephemeral });

                setTimeout(async () => await endGiveaway(message.id, client), timeInMs);
            }

            else if (subcommand === 'reroll') {
                const giveawayId = interaction.options.getString('giveaway_id');
                const giveaway = await Giveaway.findOne({ giveawayId });
                if (!giveaway) return interaction.reply({ content: 'Giveaway not found!', flags: MessageFlags.Ephemeral });

                if (!giveaway.hasEnded) return interaction.reply({ content: 'This giveaway has not yet ended! Please end it first.', flags: MessageFlags.Ephemeral });

                const channel = client.channels.cache.get(giveaway.channelId);
                if (!channel) return interaction.reply({ content: 'Channel not found!', flags: MessageFlags.Ephemeral });

                const entrants = giveaway.entrants;
                if (entrants.length === 0) return interaction.reply({ content: 'No one entered the giveaway to reroll!', flags: MessageFlags.Ephemeral });

                const uniqueEntrants = [...new Set(entrants)];
                const winnerList = uniqueEntrants.sort(() => Math.random() - 0.5).slice(0, Math.min(giveaway.winners, uniqueEntrants.length));

                // Send only the public message in the giveaway channel
                await channel.send(`🎉 Rerolled! New winners: ${winnerList.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`);

                // Reply with a simple ephemeral confirmation
                await interaction.reply({ content: 'Giveaway rerolled successfully!', flags: MessageFlags.Ephemeral });
            }

            else if (subcommand === 'edit') {
                const giveawayId = interaction.options.getString('giveaway_id');
                const newPrize = interaction.options.getString('prize');
                const giveaway = await Giveaway.findOne({ giveawayId });
                if (!giveaway) return interaction.reply({ content: 'Giveaway not found!', flags: MessageFlags.Ephemeral });

                if (new Date() > giveaway.endTime || giveaway.hasEnded) return interaction.reply({ content: 'This giveaway has already ended!', flags: MessageFlags.Ephemeral });

                giveaway.prize = newPrize;
                await giveaway.save();

                const channel = client.channels.cache.get(giveaway.channelId);
                const message = await channel.messages.fetch(giveaway.messageId);
                const embed = EmbedBuilder.from(message.embeds[0]);
                embed.setDescription(
                    `**Prize:** ${newPrize}\n` +
                    `**Winners:** ${giveaway.winners}\n` +
                    `**Hosted by:** <@${giveaway.host}>\n` +
                    `**Ends in:** <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n` +
                    `**Requirements:**\n` +
                    `- Messages: ${giveaway.requiredMessages}\n` +
                    `- Invites: ${giveaway.requiredInvites}\n` +
                    (giveaway.bonusRole ? `**Bonus:** ${giveaway.bonusEntries} extra entries for <@&${giveaway.bonusRole}>` : '')
                );
                await message.edit({ embeds: [embed] });

                await interaction.reply({ content: `Giveaway updated! New prize: **${newPrize}**`, flags: MessageFlags.Ephemeral });
            }
            // // 29648
            else if (subcommand === 'end') {
                const giveawayId = interaction.options.getString('giveaway_id');
                const giveaway = await Giveaway.findOne({ giveawayId });
                if (!giveaway) return interaction.reply({ content: 'Giveaway not found!', flags: MessageFlags.Ephemeral });

                if (new Date() > giveaway.endTime || giveaway.hasEnded) return interaction.reply({ content: 'This giveaway has already ended!', flags: MessageFlags.Ephemeral });

                await endGiveaway(giveawayId, client);
                await interaction.reply({ content: 'Giveaway ended early!', flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'An error occurred while executing this command!', flags: MessageFlags.Ephemeral });
        }
    },
};

async function endGiveaway(giveawayId, client) {
    try {
        const giveaway = await Giveaway.findOne({ giveawayId });
        if (!giveaway) {
            console.error(`[End Giveaway] Giveaway not found for ID: ${giveawayId}`);
            return;
        }

        const channel = client.channels.cache.get(giveaway.channelId);
        if (!channel) {
            console.error(`[End Giveaway] Channel not found for ID: ${giveaway.channelId}`);
            return;
        }

        const message = await channel.messages.fetch(giveaway.messageId);
        const embed = EmbedBuilder.from(message.embeds[0]);
        const entrants = giveaway.entrants;

        console.log(`[End Giveaway] Ending giveaway ID: ${giveawayId}, Prize: ${giveaway.prize}, Entrants: ${entrants.length}, Entrant IDs: ${entrants.join(', ')}`);

        if (entrants.length === 0) {
            embed.setDescription(`**Giveaway Ended**\nNo one entered the giveaway for **${giveaway.prize}**!`);
            await message.edit({ embeds: [embed], components: [] });
        } else {
            const uniqueEntrants = [...new Set(entrants)];
            if (uniqueEntrants.length === 0) {
                embed.setDescription(`**Giveaway Ended**\nNo valid entrants for **${giveaway.prize}**!`);
                await message.edit({ embeds: [embed], components: [] });
            } else {
                const winnerList = uniqueEntrants.sort(() => Math.random() - 0.5).slice(0, Math.min(giveaway.winners, uniqueEntrants.length));
                embed.setDescription(`**Giveaway Ended**\n**Prize:** ${giveaway.prize}\n**Winners:** ${winnerList.map(id => `<@${id}>`).join(', ')}`);
                await message.edit({ embeds: [embed], components: [] });
                await channel.send(`🎉 Congratulations ${winnerList.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`);
            }
        }

        giveaway.hasEnded = true;
        await giveaway.save();
    } catch (error) {
        console.error(`[End Giveaway] Error: ${error.message}`);
    }
}