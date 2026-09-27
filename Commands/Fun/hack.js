const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const ms = require("ms");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hack')
    .setDescription("Hack someone. (Just for fun, don\'t try this in real life)")
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('Unlucky soul you want to hack.')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    try {
      const target = interaction.options.getUser('target');

      await interaction.reply(`**INITIATING HACKING PROTOCOL**\nTarget: ${target}\nPlease wait...`);

      const time1 = "3s";
      setTimeout(async function () {
        await interaction.editReply(`**ACCESS GRANTED**\nGaining access to ${target}'s secure server...`);
      }, ms(time1));

      const time2 = "6s";
      setTimeout(async function () {
        await interaction.editReply(`**FIREWALL BREACHED**\nBypassing firewalls and encryption...`);
      }, ms(time2));

      const time3 = "9s";
      setTimeout(async function () {
        await interaction.editReply(`**CONFIDENTIAL DATA EXPOSED**\nExtracting confidential information...`);
      }, ms(time3));

      const time4 = "12s";
      setTimeout(async function () {
        await interaction.editReply(`**EMAIL COMPROMISED**\nAccessing personal emails...\nEmail: ${target}@gmail.com\nPassword: asswq1********`);
      }, ms(time4));

      const time5 = "15s";
      setTimeout(async function () {
        await interaction.editReply(`**SOCIAL MEDIA ACCOUNTS HACKED**\nAnalyzing social media accounts...`);
      }, ms(time5));

      const time6 = "18s";
      setTimeout(async function () {
        await interaction.editReply(`**ACCOUNT INFO LEAKED**\nSuccefully founded 13 account info.`);
      }, ms(time6));

      const time7 = "21s";
      setTimeout(async function () {
        await interaction.editReply(`**HIDDEN FILES EXPOSED**\nLocating hidden files...\nFiles found: 15`);
      }, ms(time7));

      const time8 = "24s";
      setTimeout(async function () {
        await interaction.editReply(`**HACK COMPLETE**\nAll information sent in your dms...`);
        await interaction.user.send("https://imgur.com/NQinKJB")
      }, ms(time8));
    } catch (error) {
      console.error(error);
    }
  }
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */