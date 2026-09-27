const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const levelSchema = require("../../Schemas/level");
const voiceLevelSchema = require("../../Schemas/voiceLevel"); // Import the voice level schema
const { Font, RankCardBuilder } = require("canvacord");
const levelschema = require("../../Schemas/levelsetup");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDMPermission(false)
    .addSubcommand((command) =>
      command
        .setName("message")
        .setDescription("Displays specified user's message rank.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription(`Specified user's message rank will be displayed.`)
            .setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("voice")
        .setDescription("Displays specified user's voice rank.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription(`Specified user's voice rank will be displayed.`)
            .setRequired(false)
        )
    )
    .setDescription(`Displays specified user's current rank (level).`),
  async execute(interaction) {
    const { options, user, guild } = interaction;

    const subcommand = options.getSubcommand();
    const Member = options.getMember("user") || user;
    const member = guild.members.cache.get(Member.id);

    if (subcommand === "message") {
      const levelsetup = await levelschema.findOne({
        Guild: guild.id,
      });
      if (!levelsetup || levelsetup.Disabled === "disabled")
        return await interaction.reply({
          content: `The **Administrators** of this server **have not** set up the **leveling system** yet!`,
          flags: MessageFlags.Ephemeral,
        });

      const Data = await levelSchema.findOne({
        Guild: guild.id,
        User: member.id,
      });

      const embednoxp = new EmbedBuilder()
        .setColor("Purple")
        .setTimestamp()
        .setTitle(`> ${Member.username}'s Message Rank`)
        .setFooter({ text: `⬆ ${Member.username}'s Ranking` })
        .setAuthor({ name: `⬆ Level Playground` })
        .addFields({
          name: `• Level Details`,
          value: `> Specified member has not gained any XP`,
        });

      if (!Data) return await interaction.reply({ embeds: [embednoxp] });

      await interaction.deferReply();

      const Required = Data.Level * Data.Level * 20 + 20;
      Font.loadDefault();

      const rank = new RankCardBuilder()
        .setDisplayName(member.user.displayName)
        .setUsername(member.user.username)
        .setAvatar(member.displayAvatarURL({ forceStatic: true }))
        .setCurrentXP(Data.XP)
        .setRequiredXP(Required)
        .setLevel(Data.Level, "Level")
        .setRank(1, "Rank", false)
        .setOverlay(90)
        .setBackground("https://i.imgur.com/pUGnmZA.png") // New background image
        .setStatus("online");

      const Card = await rank.build({
        format: "png",
      });

      const attachment = new AttachmentBuilder(Card, { name: "rank.png" });

      await interaction.editReply({ files: [attachment] });
    } else if (subcommand === "voice") {
      const voiceData = await voiceLevelSchema.findOne({
        Guild: guild.id,
        User: member.id,
      });

      const embednoxp = new EmbedBuilder()
        .setColor("Purple")
        .setTimestamp()
        .setTitle(`> ${Member.username}'s Voice Rank`)
        .setFooter({ text: `⬆ ${Member.username}'s Ranking` })
        .setAuthor({ name: `⬆ Voice Level Playground` })
        .addFields({
          name: `• Level Details`,
          value: `> Specified member has not gained any Voice XP`,
        });

      if (!voiceData) return await interaction.reply({ embeds: [embednoxp] });

      await interaction.deferReply();

      const Required = voiceData.Level * voiceData.Level * 20 + 20;
      Font.loadDefault();

      const rank = new RankCardBuilder()
        .setDisplayName(member.user.displayName)
        .setUsername(member.user.username)
        .setAvatar(member.displayAvatarURL({ forceStatic: true }))
        .setCurrentXP(voiceData.XP)
        .setRequiredXP(Required)
        .setLevel(voiceData.Level, "Voice Level")
        .setRank(1, "Voice Rank", false)
        .setOverlay(90)
        .setBackground("https://i.imgur.com/pUGnmZA.png") // New background image
        .setStatus("online");

      const Card = await rank.build({
        format: "png",
      });

      const attachment = new AttachmentBuilder(Card, { name: "voice_rank.png" });

      await interaction.editReply({ files: [attachment] });
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */