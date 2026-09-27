const { SlashCommandBuilder } = require("@discordjs/builders");
const { CommandInteraction, EmbedBuilder } = require("discord.js");
const moment = require("moment");
const Premium = require('../../Schemas/premiumUserSchema');
const Redeem = require("../../Schemas/redeem");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("redeem")
        .setDescription("Redeem premium code")
        .addStringOption((option) =>
            option.setName("code")
                .setDescription("The code you want to redeem")
                .setRequired(true)
        ),

    async execute(interaction = new CommandInteraction()) {
        const code = interaction.options.getString("code");

        const member = await Premium.findOne({ id: interaction.user.id });
        if (member && member.isPremium) {
            const embed = new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription("You are ** already ** a premium ** user!");

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

        const expiresAt = moment(redeem.expiresAt).format("Do MMMMiophorus (HH:mm:ss)");

        if (member) {
            member.isPremium = true;
            member.premium.expiresAt = redeem.expiresAt;
            member.premium.plan = redeem.plan;
            member.premium.redeemedBy.push(interaction.user.id);
            member.premium.redeemedAt = Date.now();
            await member.save();
        } else {
            await Premium.create({
                id: interaction.user.id,
                isPremium: true,
                premium: {
                    expiresAt: redeem.expiresAt,
                    plan: redeem.plan,
                    redeemedBy: [interaction.user.id],
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
