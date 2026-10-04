const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ChannelType,
} = require("discord.js");
const mongoose = require("mongoose");
const os = require("os");
const changelogs = require("../../Schemas/changelogs");
const { formatTime } = require("../../Utils/time");
const logs = require("../../Utils/logs");
// TODO some commands are not working

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bot")
        .setDescription("Jarvis OP")
        .addSubcommand((command) =>
            command.setName("suggest").setDescription("Suggest a feature").addStringOption((option) => option.setName("suggestion").setDescription("The suggestion").setRequired(true))
        )
        .addSubcommand((command) => command.setName("info").setDescription("Shows the status of the bot."))
        .addSubcommand((command) => command.setName("support").setDescription("Get support server invite."))
        .addSubcommand((command) => command.setName("source-code").setDescription("Want to buy the source code of this bot?"))
        .addSubcommand((command) => command.setName("uptime").setDescription("Displays the bot uptime and system uptime"))
        .addSubcommand((command) => command.setName("invite").setDescription("Invite our Bot to your servers"))
        .addSubcommand((command) => command.setName("ping").setDescription("Pong! View the speed of the bot's response"))
        .addSubcommand((command) => command.setName("changelogs").setDescription("Show last bot changelogs"))
        .addSubcommand((command) => command.setName("report-bug").setDescription("Report a bug to the Developers of this Bot!").addStringOption((option) => option.setName("command").setDescription("The not-working/bugging command").setRequired(true)).addStringOption((option) => option.setName("details").setDescription("Describe the Problem (not required)").setRequired(false)))
        .addSubcommand((command) => command.setName("feedback").setDescription("Give feedback to my developer.").addStringOption((option) => option.setName("message").setDescription("Your feedback message").setRequired(true))),
    
    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        try {
            switch (sub) {
                case "support":
                    return await interaction.reply({ content: "For support, please contact the server administrator or clan staff.", flags: MessageFlags.Ephemeral });
                case "source-code":
                    return await interaction.reply({ content: "The STRIKERS bot source code is proprietary and private.", flags: MessageFlags.Ephemeral });
                case "suggest":
                    return await handleSuggestion(interaction, client);
                case "ping":
                    return await handlePing(interaction, client);
                case "changelogs":
                    return await handleChangelogs(interaction);
                case "invite":
                    return await handleInvite(interaction, client);
                case "uptime":
                    return await handleUptime(interaction);
                case " report-bug":
                    return await handleBugReport(interaction, client);
                case "info":
                    return await handleInfo(interaction, client);
                case "feedback":
                    return await handleFeedback(interaction, client);
                default:
                    return await interaction.reply({ content: "Invalid subcommand.", flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            logs.error(error);
            return await interaction.reply({ content: "An error occurred while processing your request.", flags: MessageFlags.Ephemeral });
        }
    },
};

async function handleSuggestion(interaction, client) {
    const suggestion = interaction.options.getString("suggestion");
    const userId = interaction.user.id;

    const embed = new EmbedBuilder()
        .setTitle("NEW SUGGESTION!")
        .setColor("Green")
        .addFields({ name: ":User  ", value: `<@${userId}>`, inline: false })
        .setDescription(suggestion)
        .setTimestamp();

    const responseEmbed = new EmbedBuilder()
        .setTitle("You sent us a suggestion!")
        .setDescription(suggestion)
        .setColor("Green");

    const channel = client.channels.cache.get(client.config.botsuggestions);
    await channel.send({ embeds: [embed] }).catch(() => {});

    return await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function handlePing(interaction, client) {
    const icon = interaction.user.displayAvatarURL();
    const tag = interaction.user.tag;

    const dbPingStart = Date.now();
    await Test.findOne();
    const dbPing = Date.now() - dbPingStart;

    const embed = new EmbedBuilder()
        .setTitle("**PONG!**")
        .setDescription(`${client.emoji.ping} | **Latency:** \`${client.ws.ping}ms\`\n${client.emoji.thunder} | **Database Latency:** \`${dbPing}ms\``)
        .setColor(client.config.embedColor)
        .setFooter({ text: `Requested by ${tag}`, iconURL: icon })
        .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("btn")
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Reload")
            .setEmoji(`${client.emoji.loading}`)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [button] });
    const collector = msg.createMessageComponentCollector();

    collector.on("collect", async (i) => {
        if (i.customId === "btn") {
            i.update({
                content: `${client.emoji.loading} Refreshed The Ping Stats`,
                embeds: [embed],
                components: [button],
            });
        }
    });
}

async function handleChangelogs(interaction) {
    const data = await changelogs.findOne({}).sort({ date: -1 }).exec();
    if (!data) {
        return await interaction.reply({ content: `> ${client.emoji.cross} No changelogs have been published`, flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle(data.config.title || `${interaction.client.user.username} Changelogs`)
        .setDescription(data.config.description || `${client.emoji.error} A new changelog is here!`)
        .setFooter({ text: `${data.config.footer || `${interaction.client.user.username} Changelogs`} | ${data.config.type || 'Bot'}`, iconURL: interaction.client.user.avatarURL() })
        .setColor(data.config.color || "White");

    return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleInvite(interaction, client) {
    const link = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands`;
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setURL(link)
            .setLabel("Invite Me")
            .setStyle(ButtonStyle.Link)
    );

    const inviteEmbed = new EmbedBuilder()
        .setAuthor({ name: `${client.user.tag}` })
        .setDescription(`*Click on the button below to invite me*`)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setColor(client.config.embedColor);

    return await interaction.reply({ embeds: [inviteEmbed], components: [buttons] });
}

async function handleUptime(interaction) {
    const botUptime = process.uptime();
    const formattedBotUptime = formatTime(botUptime);
    const systemUptime = os.uptime();
    const formattedSystemUptime = formatTime(systemUptime);

    return await interaction.reply({
        content: `## Bot uptime: ${formattedBotUptime}\n## System uptime: ${formattedSystemUptime}`,
    });
}

async function handleBugReport(interaction, client) {
    const userTag = interaction.user.tag;
    const command = interaction.options.getString("command");
    const bugDetails = interaction.options.getString("details") || "No details given!";

    const embed = new EmbedBuilder()
        .setTitle("NEW REPORTED BUG!")
        .setDescription(`Bug: ${bugDetails}`)
        .addFields({ name: "Command", value: command, inline: false })
        .addFields({ name: "User ", value: userTag, inline: false });

    const sendEmbed = new EmbedBuilder()
        .setTitle("YOU REPORTED A BUG!")
        .setDescription(`Bug: ${bugDetails}`)
        .addFields({ name: "Command", value: command })
        .setFooter({ text: "The Developer Team will contact you as fast as they can!" });

    const channel = client.channels.cache.get(client.config.bugreport);
    await channel.send({ embeds: [embed] }).catch(() => {});

    return await interaction.reply({ embeds: [sendEmbed], flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function handleInfo(interaction, client) {
    const botUptime = process.uptime();
    const formattedBotUptime = formatTime(botUptime);
    const status = [
        "Disconnected",
        "Connected",
        "Connecting",
        "Disconnecting",
    ];

    await client.user.fetch();
    await client.application.fetch();

    const getChannelTypeSize = (type) =>
        client.channels.cache.filter((channel) => type.includes(channel.type)).size;

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands`)
            .setLabel("Invite Me")
            .setStyle(ButtonStyle.Link)
    );

    return await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setTitle(`${client.user.username}`)
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                .addFields({
                    name: "**Basic Information**",
                    value: `>>> **Client ID:** \`[${client.user.id}]\`\n**Server Count:** ${client.guilds.cache.size}\n**User  Count:** ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}\n**Channel Count:** ${getChannelTypeSize([ChannelType.GuildText, ChannelType.GuildNews])}\n**Total Commands:** ${client.commands.size}\n**Developer:** <@${client.application.owner.id}>`,
                    inline: false,
                })
                .addFields({
                    name: "**Status**",
                    value: `>>> **Ping:** ${client.ws.ping}ms\n**Uptime:** ${formattedBotUptime}\n**OS:** ${os.type().replace("Windows_NT", "Windows").replace("Darwin", "macOS")}\n**CPU Usage:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}%\n**CPU Model:** ${os.cpus()[0].model}`,
                    inline: false,
                }),
        ],
        components: [button],
    });
}

async function handleFeedback(interaction, client) {
    const userTag = interaction.user.tag;
    const feedbackMessage = interaction.options.getString("message");

    const embed = new EmbedBuilder()
        .setTitle("NEW Feedback")
        .addFields({ name: "Feedback", value: feedbackMessage, inline: false })
        .addFields({ name: "User ", value: userTag, inline: false });

    const sendEmbed = new EmbedBuilder()
        .setTitle("Thanks For Your Feedback")
        .addFields({ name: "Feedback", value: feedbackMessage })
        .setFooter({ text: "The Developer Team Received Your Feedback" });

    const channel = client.channels.cache.get(client.config.feedback);
    await channel.send({ embeds: [embed] }).catch(() => {});

    return await interaction.reply({ embeds: [sendEmbed], flags: MessageFlags.Ephemeral }).catch(() => {});
}