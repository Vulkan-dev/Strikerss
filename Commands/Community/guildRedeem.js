const { SlashCommandBuilder } = require("@discordjs/builders");
const { CommandInteraction, EmbedBuilder } = require("discord.js");
const moment = require("moment");
const Premium = require('../../Schemas/premiumGuildSchema');
const Redeem = require("../../Schemas/redeem");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("guildredeem")
        .setDescription("Redeem premium code for your guild")
        .addStringOption((option) =>
            option.setName("code")
                .setDescription("The code you want to redeem")
                .setRequired(true)
        ),

    async execute(interaction = new CommandInteraction()) {
        const code = interaction.options.getString("code");

        const guild = await Premium.findOne({ id: interaction.guild.id });
        if (guild && guild.isPremiumGuild) {
            const embed = new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription("You're guild is ** already ** a premium ** guild!");

            return interaction.reply({ embeds: [embed] });
        }

        const redeem = await Redeem.findOne({ code: code.toUpperCase() });
        if (!redeem) {
            const embed = new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription(
                    "Invalid code! Please check that you have entered the code correctly and have not used it before."
                );

            return interaction.reply({ embeds: [embed] });
        }

        const expiresAt = moment(redeem.expiresAt).format("Do MMMM YYYY (HH:mm:ss)");

        if (guild) {
            guild.isPremiumGuild = true;
            guild.premium.expiresAt = redeem.expiresAt;
            guild.premium.plan = redeem.plan;
            guild.premium.redeemedBy.push(interaction.guild.id);
            guild.premium.redeemedAt = Date.now();
            await guild.save();
        } else {
            await Premium.create({
                id: interaction.guild.id,
                isPremiumGuild: true,
                premium: {
                    expiresAt: redeem.expiresAt,
                    plan: redeem.plan,
                    redeemedBy: [interaction.guild.id],
                    redeemedAt: Date.now(),
                },
            });
        }

        await redeem.deleteOne();

        const embed = new EmbedBuilder()
            .setColor("#00FF00")
            .setTitle("Premium activated!")
            .setDescription(`🎉 **Subscribe:** \`${redeem.plan}\`📆 **Expires:** \`${expiresAt}\``);

        return interaction.reply({ embeds: [embed] });
    },
};
