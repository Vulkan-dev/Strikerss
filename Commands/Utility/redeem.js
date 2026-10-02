const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");
const { activateGuild, isGuildActivated } = require("../../Utils/guildActivation");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("redeem")
        .setDescription("Redeem bot license key to activate this server")
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option =>
            option.setName("key")
                .setDescription("Activation license key")
                .setRequired(true)),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                        interaction.user.id === interaction.guild.ownerId ||
                        interaction.user.id === process.env.developerId;

        if (!isAdmin) {
            return interaction.reply({
                content: '❌ Only **Server Administrators** or the **Server Owner** can redeem bot activation keys.',
                flags: MessageFlags.Ephemeral
            });
        }

        const key = interaction.options.getString("key");
        const result = await activateGuild(interaction.guild, interaction.user, key);

        const embed = new EmbedBuilder()
            .setTitle(result.success ? '⚡ Strikers Activation Successful' : '❌ Activation Failed')
            .setColor(result.success ? '#00f5d4' : '#ff3333')
            .setDescription(result.message)
            .setFooter({ text: 'Strikers Security & Activation System' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
