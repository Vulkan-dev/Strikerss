const { SlashCommandBuilder, PermissionsBitField, MessageFlags, EmbedBuilder } = require("discord.js");
const levelschema = require("../../Schemas/levelsetup");
const levelSchema = require("../../Schemas/level");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leveling")
        .setDMPermission(false)
        .setDescription("Configure your leveling system.")
        .addSubcommand((command) =>
            command
                .setName("reset-level")
                .setDescription("Reset the level of a user.")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("User  to reset level.")
                        .setRequired(true)
                )
        )
        .addSubcommand((command) =>
            command
                .setName("give-xp")
                .setDescription("Give a user specified amount of XP.")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("Specified user will be given specified amount of XP.")
                        .setRequired(true)
                )
                .addNumberOption((option) =>
                    option
                        .setName("amount")
                        .setDescription("The amount of XP you want to give specified user.")
                        .setRequired(true)
                )
        )
        .addSubcommand((command) =>
            command
                .setName("role-multiplier")
                .setDescription("Set up an XP multiplier for a specified role.")
                .addRoleOption((option) =>
                    option
                        .setName("role")
                        .setDescription("Specified role will receive a multiplier.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("multiplier")
                        .addChoices(
                            { name: "1.5x Multiplier", value: "1.5" },
                            { name: "2x Multiplier", value: "2" },
                            { name: "2.5x Multiplier", value: "2.5" },
                            { name: "3x Multiplier", value: "3" },
                            { name: "5x Multiplier", value: "5" },
                            { name: "EXTREME: 10x Multiplier", value: "10" },
                            { name: "EXTREME: 100x Multiplier", value: "100" },
                            { name: "EXTREME: 1000x Multiplier", value: "1000" }
                        )
                        .setRequired(true)
                        .setDescription("Specified amount of multiplier will be applied to specified role.")
                )
        )
        .addSubcommand((command) =>
            command
                .setName("disable")
                .setDescription("Disables your leveling system.")
        )
        .addSubcommand((command) =>
            command
                .setName("enable")
                .setDescription("Enables your leveling system.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The channel to send level-up messages.")
                        .setRequired(true)
                )
        )
        .addSubcommand((command) =>
            command
                .setName("disable-multiplier")
                .setDescription("Disables the multiplier of your role.")
        ),
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({
                content: "You **do not** have the permission to do that!",
                flags: MessageFlags.Ephemeral,
            });
        }

        const sub = await interaction.options.getSubcommand();
        const multiplier = await interaction.options.getString("multiplier");
        const multirole = await interaction.options.getRole("role");
        const notificationChannel = await interaction.options.getChannel("channel");
        const leveldata = await levelschema.findOne({ Guild: interaction.guild.id });

        switch (sub) {
            case "enable":
                if (leveldata && leveldata.Disabled === "enabled") {
                    return await interaction.reply({
                        content: `You **already** have your **leveling system** set up. \n> Do **/leveling disable** to undo.`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    const setupembed = new EmbedBuilder()
                        .setColor(client.config.embedColor)
                        .setAuthor({ name: `⬆ Leveling System` })
                        .setFooter({ text: `⬆ Leveling System Setup` })
                        .setTimestamp()
                        .setTitle("> Leveling Enabled")
                        .addFields({
                            name: `• Leveling was set up`,
                            value: `> Your members will now be able \n> to earn XP through the leveling \n> system! Notifications will be sent to ${notificationChannel}.`,
                        });

                    if (leveldata) {
                        await levelschema.updateOne(
                            { Guild: interaction.guild.id },
                            { $set: { Disabled: "enabled", NotificationChannel: notificationChannel.id } }
                        );
                    } else {
                        await levelschema.create({
                            Guild: interaction.guild.id,
                            Disabled: "enabled",
                            Role: " ",
                            Multiplier: " ",
                            NotificationChannel: notificationChannel.id,
                        });
                    }

                    await interaction.reply({ embeds: [setupembed] });
                }
                break;
            case "disable":
                if (!leveldata || leveldata.Disabled === "disabled") {
                    return await interaction.reply({
                        content: `You **have not** set up your **leveling system** yet. \n> Do **/leveling enable** to setup your **leveling system**.`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    const disableembed = new EmbedBuilder()
                        .setColor(client.config.embedColor)
                        .setAuthor({ name: `⬆ Leveling System` })
                        .setFooter({ text: `⬆ Leveling System Disabled` })
                        .setTimestamp()
                        .setTitle("> Leveling Disabled")
                        .addFields({
                            name: `• Leveling was Disabled`,
                            value: `> Your members will no longer be able \n> to earn XP through the leveling \n> system!`,
                        });

                    await levelschema.updateOne(
                        { Guild: interaction.guild.id },
                        { $set: { Disabled: "disabled" } }
                    );

                    await interaction.reply({ embeds: [disableembed] });
                }
                break;
            case "role-multiplier":
                if (!leveldata || leveldata.Disabled === "disabled") {
                    return await interaction.reply({
                        content: `You **have not** set up your **leveling system** yet.`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    if (leveldata.Role !== " ") {
                        return await interaction.reply({
                            content: `You **already** have a multiplier role **set up**! (${leveldata.Role})`,
                            flags: MessageFlags.Ephemeral,
                        });
                    } else {
                        await levelschema.updateOne(
                            { Guild: interaction.guild.id },
                            { $set: { Role: multirole.id, Multiplier: multiplier } }
                        );
                        await interaction.reply({
                            content: `Your role ${multirole} has been **set up** to receive **multiplied** XP! Multiplication level: **${multiplier}**x`,
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                }
                break;
            case "give-xp":
                const user = interaction.options.getUser ('user');
                const amount = interaction.options.getNumber('amount');

                levelSchema.findOne({ Guild: interaction.guild.id, User: user.id }, async (err, data) => {
                    if (err) throw err;

                    if (!data) return await interaction.reply({ content: `${user} needs to have **earned** past XP in order to add to their XP.`, flags: MessageFlags.Ephemeral });

                    const give = amount;
                    const Data = await levelSchema.findOne({ Guild: interaction.guild.id, User: user.id });

                    if (!Data) return;

                    const requiredXP = Data.Level * Data.Level * 20 + 20;
                    Data.XP += give;
                    Data.save();

                    interaction.reply({ content: `Gave **${user.username}** **${amount}** XP.`, flags: MessageFlags.Ephemeral });
                });
                break;
            case "reset-level":
                const userToReset = await interaction.options.getUser ("user");
                const userData = await levelSchema.findOne({
                    Guild: interaction.guild.id,
                    User: userToReset.id,
                });

                if (!userData) {
                    return await interaction.reply({
                        content: `User  ${userToReset.username} has no level data.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await levelSchema.updateOne(
                    { Guild: interaction.guild.id, User: userToReset.id },
                    { $set: { XP: 0, Level: 0 } }
                );

                await interaction.reply({
                    content: `User  ${userToReset.username} level has been reset.`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            case "disable-multiplier":
                if (!leveldata || leveldata.Disabled === "disabled") {
                    return await interaction.reply({
                        content: `You **have not** set up your **leveling system** yet.`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    if (leveldata.Role === " ") {
                        return await interaction.reply({
                            content: `You **have not** set up a role multiplier yet, cannot disable **nothing**..`,
                            flags: MessageFlags.Ephemeral,
                        });
                    } else {
                        await interaction.reply({
                            content: `Your multiplier role <@&${leveldata.Role}> has been **disabled**!`,
                            flags: MessageFlags.Ephemeral,
                        });
                        await levelschema.updateOne(
                            { Guild: interaction.guild.id },
                            { $set: { Role: " ", Multiplier: " " } }
                        );
                    }
                }
        }
    },
};