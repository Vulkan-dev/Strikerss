const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const moment = require('moment');
const voucher_codes = require('voucher-code-generator');
const Redeem = require("../../Schemas/redeem");
const Premium = require("../../Schemas/premiumUserSchema");
const PremiumGuild = require('../../Schemas/premiumGuildSchema.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("premium")
        .setDescription("Manage premium codes and users.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("gencode_user")
                .setDescription("🪙 | Create premium code for 1 user/guild")
                .addStringOption(option =>
                    option.setName("plan")
                        .setDescription("Premium time interval")
                        .setRequired(true)
                        .addChoices(
                            { name: "🤍 Daily", value: "daily" },
                            { name: "💚 Weekly", value: "weekly" },
                            { name: "🧡 Month", value: "monthly" },
                            { name: "💛 Year", value: "yearly" },
                            { name: "💖 Lifetime", value: "lifetime" },
                        ))
                .addStringOption(option =>
                    option.setName("amount")
                        .setDescription("How much codes do you want to make?")
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('premiumlist')
                .setDescription('List all premium users/guilds.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName("removeguildpremium")
                .setDescription("Remove premium from a guild.")
                .addStringOption(option =>
                    option.setName("guild")
                        .setDescription("The guild to remove premium from. (Use its id.)")
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName("removepremium")
                .setDescription("Remove premium from a user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to remove premium from. (use their id)")
                        .setRequired(true))),
    developer: true,

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "gencode_user") {
            try {
                await interaction.deferReply();
                const { options } = interaction;
                const name = options.getString("plan");
                const camount = options.getString("amount");
                const plan = name;
                const plans = ['daily', 'weekly', 'monthly', 'yearly', 'lifetime'];

                if (!plans.includes(name))
                    return interaction.editReply({ content: `**Selectable subscriptions:** *${plans}*` });

                let time;
                if (plan === 'daily') time = Date.now() + 86400000;
                if (plan === 'weekly') time = Date.now() + 86400000 * 7;
                if (plan === 'monthly') time = Date.now() + 86400000 * 30;
                if (plan === 'yearly') time = Date.now() + 86400000 * 365;
                if (plan === 'lifetime') time = Date.now() + 86400000 * 36525;

                let amount = camount || 1;
                const embed = new EmbedBuilder()
                    .setColor(0xd4af37)
                    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp()
                    .setFooter({ text: `®️ Razor-Bot 2024 - ${new Date().getFullYear()} | All rights reserved`, iconURL: interaction.client.user.displayAvatarURL() });

                for (let i = 0; i < amount; i++) {
                    const codePremium = voucher_codes.generate({
                        prefix: "PREM",
                        postfix: "Razor-Bot",
                        pattern: '-####-####-####-####-'
                    });

                    const code = codePremium.toString().toUpperCase();
                    const find = await Redeem.findOne({ code: code });

                    if (!find) {
                        await Redeem.create({
                            code: code,
                            plan: plan,
                            expiresAt: time
                        });

                        embed.addFields(
                            { name: `⚜️ • Code ${i + 1}`, value: "```yaml\n" + code + "\n```", inline: false },
                            { name: `☄️• Subscription ${i + 1}`, value: "```yaml\n" + plan + "\n```", inline: true },
 { name: `📆 • Expiry date ${i + 1}`, value: "```yaml\n" + moment(time).format('YYYY-MM-DD') + "\n```", inline: true }
                        );
                    }
                }

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'An error occurred while executing this command.', flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'premiumlist') {
            try {
                const premiums = await Premium.find({ isPremium: true });
                const premiumguilds = await PremiumGuild.find({ isPremiumGuild: true });
                const embed = new EmbedBuilder()
                    .setColor('#f7d864')
                    .setTitle('List of Premium Users/Guilds')
                    .setDescription(`There are currently **${premiums.length}** premium users and **${premiumguilds.length}** premium guilds.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: "An error occurred while fetching the premium list.", flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === "removeguildpremium") {
            const guild = interaction.options.getString("guild");
            try {
                const premiumGuild = await PremiumGuild.findOne({ id: guild, isPremiumGuild: true });
                if (!premiumGuild) {
                    return interaction.reply({ content: "This guild does not have premium.", flags: MessageFlags.Ephemeral });
                }

                premiumGuild.isPremiumGuild = false;
                await premiumGuild.save();
                return interaction.reply({ content: "Premium has been removed from this guild.", flags: MessageFlags.Ephemeral });
            } catch (error) {
                console.error(error);
                return interaction.reply({ content: "An error occurred while removing premium from this guild.", flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === "removepremium") {
            const user = interaction.options.getUser ('user');
            try {
                const premium = await Premium.findOne({ id: user.id, isPremium: true });
                if (!premium) {
                    return interaction.reply({ content: "This user does not have premium.", flags: MessageFlags.Ephemeral });
                }

                premium.isPremium = false;
                await premium.save();
                return interaction.reply({ content: "Premium has been removed from this user.", flags: MessageFlags.Ephemeral });
            } catch (error) {
                console.error(error);
                return interaction.reply({ content: "An error occurred while removing premium from this user.", flags: MessageFlags.Ephemeral });
            }
        }
    }
};