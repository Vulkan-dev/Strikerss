const { SlashCommandBuilder, PermissionsBitField, MessageFlags, EmbedBuilder } = require("discord.js");
const voiceLevelSchema = require("../../Schemas/voiceLevel");
const voiceBlacklistSchema = require("../../Schemas/voiceBlacklist");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("voiceleveling")
        .setDMPermission(false)
        .setDescription("Configure the voice leveling system.")
        .addSubcommand((command) =>
            command
                .setName("enable")
                .setDescription("Enables the voice leveling system.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The channel to send level-up messages.")
                        .setRequired(true)
                )
        )
        .addSubcommand((command) =>
            command
                .setName("disable")
                .setDescription("Disables the voice leveling system.")
        )
        .addSubcommand((command) =>
            command
                .setName("add-blacklist")
                .setDescription("Add a voice channel to the blacklist.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The voice channel to blacklist.")
                        .setRequired(true)
                )
        )
        .addSubcommand((command) =>
            command
                .setName("remove-blacklist")
                .setDescription("Remove a voice channel from the blacklist.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The voice channel to remove from blacklist.")
                        .setRequired(true)
                )
        ),
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({
                content: "You **do not** have the permission to do that!",
                flags: MessageFlags.Ephemeral,
            });
        }

        const sub = interaction.options.getSubcommand();

        switch (sub) {
            case "enable":
                const notificationChannel = interaction.options.getChannel("channel");
                
                const existingData = await voiceLevelSchema.findOne({ Guild: interaction.guild.id });
                if (existingData && existingData.IsEnabled) {
                    return await interaction.reply({
                        content: `The voice leveling system is already enabled. Level-up notifications are being sent to ${notificationChannel.name}.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                
                await voiceLevelSchema.updateOne(
                    { Guild: interaction.guild.id },
                    { $set: { IsEnabled: true, NotificationChannel: notificationChannel.id } },
                    { upsert: true }
                );

                const setupEmbed = new EmbedBuilder()
                    .setColor(client.config.embedColor)
                    .setTitle("✅ Voice Leveling System Enabled")
                    .setDescription(`The voice leveling system has been successfully set up!`)
                    .addFields(
                        { name: "Setup By", value: `${interaction.user.username}`, inline: true },
                        { name: "Notification Channel", value: `${notificationChannel}`, inline: true }
                    )
                    .setFooter({ text: `Voice leveling is now active!` })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [setupEmbed]
                });
                break;
            case "disable":
                // Disable the voice leveling system
                await voiceLevelSchema.updateOne(
                    { Guild: interaction.guild.id },
                    { $set: { IsEnabled: false } },
                    { upsert: true }
                );
                await interaction.reply({ content: "Voice leveling system has been disabled.", flags: MessageFlags.Ephemeral });
                break;
            case "add-blacklist":
                const addChannel = interaction.options.getChannel("channel");
                const existingBlacklist = await voiceBlacklistSchema.findOne({
                    Guild: interaction.guild.id,
                    ChannelID: addChannel.id,
                });

                if (existingBlacklist) {
                    return await interaction.reply({
                        content: `The channel ${addChannel.name} is already blacklisted.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await voiceBlacklistSchema.create({
                    Guild: interaction.guild.id,
                    ChannelID: addChannel.id,
                });

                await interaction.reply({
                    content: `The channel ${addChannel.name} has been added to the blacklist.`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            case "remove-blacklist":
                const removeChannel = interaction.options.getChannel("channel");
                const blacklistEntry = await voiceBlacklistSchema.findOneAndDelete({
                    Guild: interaction.guild.id,
                    ChannelID: removeChannel.id,
                });

                if (!blacklistEntry) {
                    return await interaction.reply({
                        content: `The channel ${removeChannel.name} is not in the blacklist.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await interaction.reply({
                    content: `The channel ${removeChannel.name} has been removed from the blacklist.`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
        }
    },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */