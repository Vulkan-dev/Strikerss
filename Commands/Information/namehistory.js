const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");
const NameHistory = require("../../Schemas/nameHistorySchema");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("namehistory")
        .setDescription("View the nickname and name history of a member in this server")
        .setDMPermission(false)
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The user whose name history you want to check (defaults to you)")
                .setRequired(false)
        ),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        const targetUser = interaction.options.getUser("user") || interaction.user;
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        await interaction.deferReply();

        const history = await NameHistory.find({
            guildId: interaction.guild.id,
            userId: targetUser.id
        })
            .sort({ timestamp: -1 })
            .limit(15);

        const currentName = targetMember ? targetMember.displayName : targetUser.username;

        const embed = new EmbedBuilder()
            .setTitle(`📜 Name History for @${targetUser.username}`)
            .setColor(client.config?.embedColor || "#00f5d4")
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`**Current Server Name:** \`${currentName}\`\n**User Tag:** \`${targetUser.tag}\`\n**User ID:** \`${targetUser.id}\``)
            .setFooter({ text: "STRIKERS Identity Archive • Powered by Blame Engine" })
            .setTimestamp();

        if (history && history.length > 0) {
            const historyLines = history.map((entry, index) => {
                const unix = Math.floor(new Date(entry.timestamp).getTime() / 1000);
                return `**${index + 1}.** \`${entry.oldName}\` ➔ \`${entry.newName}\` • <t:${unix}:R>`;
            });

            embed.addFields({
                name: `📝 Past Nicknames (${history.length} recorded)`,
                value: historyLines.join("\n"),
                inline: false
            });
        } else {
            embed.addFields({
                name: "📝 Past Nicknames",
                value: "*No nickname changes have been recorded for this user yet. Changes are automatically logged going forward.*",
                inline: false
            });
        }

        return await interaction.editReply({ embeds: [embed] });
    }
};
