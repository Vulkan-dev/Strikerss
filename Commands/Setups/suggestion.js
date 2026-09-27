const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const suggestion = require("../../Schemas/suggestionSchema");
const formatResults = require("../../Utils/formatResults");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("suggestion")
    .setDescription("Configure the suggestion system.")
    .addSubcommand((command) =>
      command
        .setName("setup")
        .setDescription("Setup a suggestion system.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Input a channel.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("disable")
        .setDescription("Disable an already-existed suggestion channel.")
    )
    .addSubcommand((command) =>
      command
        .setName("submit")
        .setDescription("Submit a suggestion.")
        .addStringOption((option) =>
          option
            .setName("suggestion")
            .setDescription("Input a suggestion.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("image")
            .setDescription(
              "If you have any image for your suggestion paste the image link! (imgur)"
            )
            .setRequired(false)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("approve")
        .setDescription("Approve a suggestion by message ID.")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message ID of the suggestion to approve.")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("reject")
        .setDescription("Reject a suggestion by message ID.")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message ID of the suggestion to reject.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("The reason for rejection.")
            .setRequired(true)
        )
    ),
  async execute(interaction, client) {
    const { options } = interaction;
    const sub = options.getSubcommand();
    const Schannel = options.getChannel("channel");
    const Data = await suggestion.findOne({ GuildID: interaction.guild.id });
    const suggestmsg = options.getString("suggestion");
    const image = options.getString("image");
    const messageId = options.getString("message-id");
    const reason = options.getString("reason");

    switch (sub) {
      case "setup":
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.Administrator
          )
        )
          return await interaction.reply({
            content: `You can't use this command!`,
            flags: MessageFlags.Ephemeral,
          });

        if (Data) {
          const channel = client.channels.cache.get(Data.ChannelID);

          return await interaction.reply({
            content: `You already have a suggestion system **setup** in ${channel}!`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await suggestion.create({
            GuildID: interaction.guild.id,
            ChannelID: Schannel.id,
          });

          const embed = new EmbedBuilder()
            .setColor("Green")
            .setAuthor({
              name: `${interaction.guild.name}'s Suggestion System`,
            })
            .setTitle("Success!")
            .setDescription(
              `${client.emoji.tick}・The suggestion system has been successfully **setup** in ${Schannel}!`
            );

          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        break;

      case "disable":
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.Administrator
          )
        )
          return await interaction.reply({
            content: `You can't use this command!`,
            flags: MessageFlags.Ephemeral,
          });

        if (!Data) {
          return await interaction.reply({
            content: `You don't have a suggestion system **setup**!`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await suggestion.deleteMany({
            GuildID: interaction.guild.id,
          });

          const embed = new EmbedBuilder()
            .setColor("Green")
            .setAuthor({
              name: `${interaction.guild.name}'s Suggestion System`,
            })
            .setTitle("Success!")
            .setDescription(
              `${client.emoji.tick}・The suggestion system has been successfully **disable**!`
            );

          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        break;

      case "submit":
        if (!Data) {
          return await interaction.reply({
            content: `You don't have a suggestion system **setup**!`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          const schannel = Data.ChannelID;
          const suggestionchannel =
            interaction.guild.channels.cache.get(schannel);

          const num1 = Math.floor(Math.random() * 256);
          const num2 = Math.floor(Math.random() * 256);
          const num3 = Math.floor(Math.random() * 256);
          const num4 = Math.floor(Math.random() * 256);
          const num5 = Math.floor(Math.random() * 256);
          const num6 = Math.floor(Math.random() * 256);
          const SuggestionID = `${num1}${num2}${num3}${num4}${num5}${num6}`;

          const suggestionembed = new EmbedBuilder()
            .setAuthor({
              name: `${interaction.guild.name}'s Suggestion System`,
              iconURL: interaction.guild.iconURL({ size: 256 }),
            })
            .setColor("Blurple")
            .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
            .setTitle(`Suggestion from ${interaction.user.username}`)
            .setDescription(`> \`${suggestmsg}\``)
            .setTimestamp()
            .setImage(image || "https://share.creavite.co/674d995f8d50aabc5606ad60.gif")
            .setFooter({ text: `Suggestion ID: ${SuggestionID}` })
            .addFields({ name: "Upvotes", value: "**No votes**", inline: true })
            .addFields({
              name: "Downvotes",
              value: "**No votes**",
              inline: true,
            })
            .addFields({ name: `Votes`, value: formatResults() })
            .addFields({
              name: "Author",
              value: `> ${interaction.user}`,
              inline: false,
            });

          const upvotebutton = new ButtonBuilder()
            .setCustomId("upv")
            .setEmoji(`${client.emoji.upvote}`)
            .setLabel("Upvote")
            .setStyle(ButtonStyle.Primary);

          const downvotebutton = new ButtonBuilder()
            .setCustomId("downv")
            .setEmoji(`${client.emoji.downvote}`)
            .setLabel("Downvote")
            .setStyle(ButtonStyle.Primary);

          const totalvotesbutton = new ButtonBuilder()
            .setCustomId("totalvotes")
            .setEmoji(`${client.emoji.votes}`)
            .setLabel("Votes")
            .setStyle(ButtonStyle.Secondary);

          const btnrow = new ActionRowBuilder().addComponents(
            upvotebutton,
            downvotebutton,
            totalvotesbutton
          );

          const button2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("appr")
              .setEmoji(`${client.emoji.tick}`)
              .setLabel("Approve")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("rej")
              .setEmoji(`${client.emoji.cross}`)
              .setLabel("Reject")
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.reply({
            content: `Your suggestion has been submitted in ${suggestionchannel}!`,
            flags: MessageFlags.Ephemeral,
          });

          const msg = await suggestionchannel.send({
            content: `${interaction.user}'s Suggestion`,
            embeds: [suggestionembed],
            components: [btnrow, button2],
          });

          // Create a public discussion thread
          await msg.startThread({
            name: "Discussion",
            autoArchiveDuration: 10080, // 7 days
            type: ChannelType.PublicThread,
          });

          msg.createMessageComponentCollector();

          await suggestion.create({
            GuildID: interaction.guild.id,
            ChannelID: suggestionchannel.id,
            Msg: msg.id,
            AuthorID: interaction.user.id,
            upvotes: 0,
            downvotes: 0,
            Upmembers: [],
            Downmembers: [],
          });
        }
        break;

      case "approve":
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.ModerateMembers
          )
        ) {
          return await interaction.reply({
            content: `Only Admins & Staff can use this command.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const approveData = await suggestion.findOne({
          GuildID: interaction.guild.id,
          Msg: messageId,
        });

        if (!approveData) {
          return await interaction.reply({
            content: `No suggestion found with that message ID!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const approveChannel = interaction.guild.channels.cache.get(
          approveData.ChannelID
        );
        const approveMessage = await approveChannel.messages.fetch(messageId);

        const approveEmbed = EmbedBuilder.from(approveMessage.embeds[0]).addFields({
          name: "Status:",
          value: `> __***${client.emoji.tick} Your suggestion has been approved!***__`,
          inline: true,
        });

        await approveMessage.edit({
          embeds: [approveEmbed],
          components: [approveMessage.components[0]],
        });

        await interaction.reply({
          content: `Suggestion with ID ${messageId} has been approved!`,
          flags: MessageFlags.Ephemeral,
        });
        break;

      case "reject":
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.ModerateMembers
          )
        ) {
          return await interaction.reply({
            content: `Only Admins & Staff can use this command.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const rejectData = await suggestion.findOne({
          GuildID: interaction.guild.id,
          Msg: messageId,
        });

        if (!rejectData) {
          return await interaction.reply({
            content: `No suggestion found with that message ID!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const rejectChannel = interaction.guild.channels.cache.get(
          rejectData.ChannelID
        );
        const rejectMessage = await rejectChannel.messages.fetch(messageId);

        const rejectEmbed = EmbedBuilder.from(rejectMessage.embeds[0]).addFields({
          name: "Status:",
          value: `> __***${client.emoji.cross} Your suggestion has been rejected!***__`,
          inline: true,
        });

        if (reason) {
          rejectEmbed.addFields({
            name: "Reason:",
            value: `> ${reason}`,
            inline: true,
          });
        }

        await rejectMessage.edit({
          embeds: [rejectEmbed],
          components: [rejectMessage.components[0]],
        });

        await interaction.reply({
          content: `Suggestion with ID ${messageId} has been rejected!`,
          flags: MessageFlags.Ephemeral,
        });
        break;
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */