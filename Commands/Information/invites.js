const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const Invite = require("../../Schemas/inviteSchema");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("invites")
        .setDescription("Check your or another member's invite statistics")
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName("show")
                .setDescription("Show invite statistics for a user")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("The user whose invites you want to check")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("inviter")
                .setDescription("Check who invited a user to this server")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("The user whose inviter you want to see")
                        .setRequired(false)
                )
        ),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser("user") || interaction.user;

        if (sub === "show") {
            const data = await Invite.findOne({
                guildId: interaction.guild.id,
                userId: targetUser.id
            });

            const tracked = data ? (data.tracked || 0) : 0;
            const fake = data ? (data.fake || 0) : 0;
            const left = data ? (data.left || 0) : 0;
            const added = data ? (data.added || 0) : 0;

            const total = Math.max(0, tracked + added - fake - left);

            const embed = new EmbedBuilder()
                .setTitle(`📨 Invites for ${targetUser.username}`)
                .setColor(client.config.embedColor || "#00f5d4")
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(`**Total Invites:** \`${total}\``)
                .addFields(
                    { name: "✅ Regular / Tracked", value: `\`${tracked}\``, inline: true },
                    { name: "🚪 Left", value: `\`${left}\``, inline: true },
                    { name: "🤖 Fake / Self", value: `\`${fake}\``, inline: true },
                    { name: "🎁 Bonus / Added", value: `\`${added}\``, inline: true }
                )
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            return await interaction.reply({ embeds: [embed] });
        }

        if (sub === "inviter") {
            const data = await Invite.findOne({
                guildId: interaction.guild.id,
                userId: targetUser.id
            });

            if (!data || !data.inviterId) {
                return await interaction.reply({
                    content: `Could not determine who invited <@${targetUser.id}>. They may have joined before invite tracking was active or via an unknown link.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const inviterText = data.inviterId === "VANITY" 
                ? "Custom Vanity URL" 
                : `<@${data.inviterId}> (\`${data.inviterId}\`)`;

            const embed = new EmbedBuilder()
                .setTitle(`🔍 Inviter Info: ${targetUser.username}`)
                .setColor(client.config.embedColor || "#00f5d4")
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: "Member", value: `<@${targetUser.id}>`, inline: true },
                    { name: "Invited By", value: inviterText, inline: true },
                    { name: "Invite Code", value: data.code ? `\`${data.code}\`` : "N/A", inline: true }
                )
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            return await interaction.reply({ embeds: [embed] });
        }
    }
};
