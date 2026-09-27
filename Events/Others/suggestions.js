const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const suggestion = require("../../Schemas/suggestionSchema");
const formatResults = require("../../Utils/formatResults");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
      if (!interaction.guild) return;
      if (!interaction.message) return;

      if (interaction.isButton()) {
          const data = await suggestion.findOne({
              GuildID: interaction.guild.id,
              Msg: interaction.message.id,
          });
          if (!data) return;
          const message = await interaction.channel.messages.fetch(data.Msg);

          if (interaction.customId === "upv") {
              if (data.Upmembers.includes(interaction.user.id))
                  return await interaction.reply({
                      content: `You cannot vote again! You have already sent an upvote on this suggestion.`,
                      flags: MessageFlags.Ephemeral,
                  });

              let Downvotes = data.downvotes;
              if (data.Downmembers.includes(interaction.user.id)) {
                  Downvotes = Downvotes - 1;
              }

              if (data.Downmembers.includes(interaction.user.id)) {
                  data.downvotes = data.downvotes - 1;
              }

              data.Upmembers.push(interaction.user.id);
              data.Downmembers.pull(interaction.user.id);

              const newEmbed = EmbedBuilder.from(message.embeds[0]).setFields(
                  { name: `Upvotes`, value: `> **${data.upvotes + 1}** Votes`, inline: true },
                  { name: `Downvotes`, value: `> **${Downvotes}** Votes`, inline: true },
                  { name: `Author`, value: `> <@${data.AuthorID}>`, inline: false },
                  { name: `Votes`, value: formatResults(data.Upmembers, data.Downmembers) }
              );

              const button = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                      .setCustomId("upv")
                      .setLabel("Upvotes")
                      .setStyle(ButtonStyle.Primary)
                      .setEmoji(`${client.emoji.upvote}`),
                  new ButtonBuilder()
                      .setCustomId("downv")
                      .setEmoji(`${client.emoji.downvote}`)
                      .setLabel("Downvotes")
                      .setStyle(ButtonStyle.Primary),
                  new ButtonBuilder()
                      .setCustomId("totalvotes")
                      .setEmoji(`${client.emoji.votes}`)
                      .setLabel("Votes")
                      .setStyle(ButtonStyle.Secondary)
              );

              const button2 = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                      .setCustomId("appr")
                      .setLabel("Approve")
                      .setEmoji(`${client.emoji.tick}`)
                      .setStyle(ButtonStyle.Success),
                  new ButtonBuilder()
                      .setCustomId("rej")
                      .setEmoji(`${client.emoji.cross}`)
                      .setLabel("Reject")
                      .setStyle(ButtonStyle.Danger)
              );

              await interaction.update({ embeds: [newEmbed], components: [button, button2] });

              data.upvotes++;
              data.save();
          }

          if (interaction.customId === "downv") {
              if (data.Downmembers.includes(interaction.user.id))
                  return await interaction.reply({
                      content: `You cannot down vote twice on this suggestion!`,
                      flags: MessageFlags.Ephemeral,
                  });

              let Upvotes = data.upvotes;
              if (data.Upmembers.includes(interaction.user.id)) {
                  Upvotes = Upvotes - 1;
              }

              if (data.Upmembers.includes(interaction.user.id)) {
                  data.upvotes = data.upvotes - 1;
              }

              data.Downmembers.push(interaction.user.id);
              data.Upmembers.pull(interaction.user.id);

              const newEmbed = EmbedBuilder.from(message.embeds[0]).setFields(
                  { name: `Upvotes`, value: `> **${Upvotes}** Votes`, inline: true },
                  { name: `Downvotes`, value: `> **${data.downvotes + 1}** Votes`, inline: true },
                  { name: `Author`, value: `> <@${data.AuthorID}>`, inline: false },
                  { name: `Votes`, value: formatResults(data.Upmembers, data.Downmembers) }
              );

              const button = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                      .setCustomId("upv")
                      .setLabel("Upvotes")
                      .setStyle(ButtonStyle.Primary)
                      .setEmoji(`${client.emoji.upvote}`),
                  new ButtonBuilder()
                      .setCustomId("downv")
                      .setEmoji(`${client.emoji.downvote}`)
                      .setLabel("Downvotes")
                      .setStyle(ButtonStyle.Primary),
                  new ButtonBuilder()
                      .setCustomId("totalvotes")
                      .setEmoji(`${client.emoji.votes}`)
                      .setLabel("Votes")
                      .setStyle(ButtonStyle.Secondary)
              );

              const button2 = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                      .setCustomId("appr")
                      .setLabel("Approve")
                      .setEmoji(`${client.emoji.tick}`)
                      .setStyle(ButtonStyle.Success),
                  new ButtonBuilder()
                      .setCustomId("rej")
                      .setEmoji(`${client.emoji.cross}`)
                      .setLabel("Reject")
                      .setStyle(ButtonStyle.Danger)
              );

              await interaction.update({ embeds: [newEmbed], components: [button, button2] });

              data.downvotes++;
              data.save();
          }

          if (interaction.customId === "totalvotes") {
              let upvoters = [];
              await data.Upmembers.forEach(async (member) => {
                  upvoters.push(`<@${member}>`);
              });

              let downvoters = [];
              await data.Downmembers.forEach(async (member) => {
                  downvoters.push(`<@${member}>`);
              });

              const embed = new EmbedBuilder()
                  .addFields({
                      name: `Upvoters (${upvoters.length})`,
                      value: `> ${upvoters.join(", ").slice(0, 1020) || `No upvoters!`}`,
                      inline: true,
                  })
                  .addFields({
                      name: `Downvoters (${downvoters.length})`,
                      value: `> ${downvoters.join(", ").slice(0, 1020) || `No downvoters!`}`,
                      inline: true,
                  })
                  .setColor(client.config.embedColor)
                  .setTimestamp()
                  .setFooter({ text: `💭 Vote Data` })
                  .setAuthor({ name: `${interaction.guild.name}'s Suggestion System` });

              await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
          }

          if (interaction.customId === "appr") {
              if (
                  !interaction.member.permissions.has(
                      PermissionsBitField.Flags.ModerateMembers
                  )
              )
                  return await interaction.reply({
                      content: `Only Admins & Staffs can use this button.`,
                      flags: MessageFlags.Ephemeral,
                  });

              const newEmbed = EmbedBuilder.from(message.embeds[0]).addFields({
                  name: "Status:",
                  value: `> __***${client.emoji.tick} Your suggestion has been approved!***__`,
                  inline: true,
              });

              await interaction.update({
                  embeds: [newEmbed],
                  components: [message.components[0]],
              });

              // Fetch suggestion details
              const suggestionId = message.embeds[0].footer.text.split("Suggestion ID: ")[1];
              const suggestionOwnerId = data.AuthorID;
              const suggestionLink = `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${message.id}`;
              const serverName = interaction.guild.name;
              const approvedBy = interaction.user.tag;

              // Send DM to the suggestion owner
              try {
                  const owner = await client.users.fetch(suggestionOwnerId);
                  const dmEmbed = new EmbedBuilder()
                      .setColor("Green")
                      .setTitle("Suggestion Approved")
                      .setDescription(`Your suggestion in **${serverName}** has been approved!`)
                      .addFields(
                          { name: "Suggestion ID", value: suggestionId, inline: true },
                          { name: "Approved By", value: approvedBy, inline: true },
                          { name: "Suggestion Link", value: `[Click Here](${suggestionLink})`, inline: false }
                      )
                      .setTimestamp();

                  await owner.send({ embeds: [dmEmbed] });
              } catch (error) {
                  console.error(`Failed to send DM to user ${suggestionOwnerId}:`, error);
                  await interaction.followUp({
                      content: `Suggestion approved, but I couldn't DM the owner (they might have DMs disabled).`,
                      flags: MessageFlags.Ephemeral,
                  });
              }
          }

          if (interaction.customId === "rej") {
              if (
                  !interaction.member.permissions.has(
                      PermissionsBitField.Flags.ModerateMembers
                  )
              )
                  return await interaction.reply({
                      content: `Only Admins & Staffs can use this button.`,
                      flags: MessageFlags.Ephemeral,
                  });

              const modal = new ModalBuilder()
                  .setCustomId(`reject-modal-${message.id}`)
                  .setTitle("Reason for Rejection");

              const reasonInput = new TextInputBuilder()
                  .setCustomId("reject-reason")
                  .setLabel("Please provide a reason for rejection")
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true);

              const actionRow = new ActionRowBuilder().addComponents(reasonInput);
              modal.addComponents(actionRow);

              await interaction.showModal(modal);
          }
      }

      if (interaction.isModalSubmit()) {
          if (interaction.customId.startsWith("reject-modal-")) {
              const messageId = interaction.customId.split("-")[2];
              const reason = interaction.fields.getTextInputValue("reject-reason");

              const data = await suggestion.findOne({
                  GuildID: interaction.guild.id,
                  Msg: messageId,
              });

              if (!data) {
                  return await interaction.reply({
                      content: `No suggestion found with that message ID!`,
                      flags: MessageFlags.Ephemeral,
                  });
              }

              const message = await interaction.channel.messages.fetch(messageId);
              const newEmbed = EmbedBuilder.from(message.embeds[0])
                  .addFields({
                      name: "Status:",
                      value: `> __***${client.emoji.cross} Your suggestion has been rejected!***__`,
                      inline: true,
                  })
                  .addFields({
                      name: "Reason:",
                      value: `> ${reason}`,
                      inline: true,
                  });

              await message.edit({
                  embeds: [newEmbed],
                  components: [message.components[0]],
              });

              // Fetch suggestion details
              const suggestionId = message.embeds[0].footer.text.split("Suggestion ID: ")[1];
              const suggestionOwnerId = data.AuthorID;
              const suggestionLink = `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${message.id}`;
              const serverName = interaction.guild.name;
              const rejectedBy = interaction.user.tag;

              // Send DM to the suggestion owner
              try {
                  const owner = await client.users.fetch(suggestionOwnerId);
                  const dmEmbed = new EmbedBuilder()
                      .setColor("Red")
                      .setTitle("Suggestion Rejected")
                      .setDescription(`Your suggestion in **${serverName}** has been rejected.`)
                      .addFields(
                          { name: "Suggestion ID", value: suggestionId, inline: true },
                          { name: "Rejected By", value: rejectedBy, inline: true },
                          { name: "Reason", value: reason, inline: false },
                          { name: "Suggestion Link", value: `[Click Here](${suggestionLink})`, inline: false }
                      )
                      .setTimestamp();

                  await owner.send({ embeds: [dmEmbed] });
              } catch (error) {
                  console.error(`Failed to send DM to user ${suggestionOwnerId}:`, error);
                  await interaction.followUp({
                      content: `Suggestion rejected, but I couldn't DM the owner (they might have DMs disabled).`,
                      flags: MessageFlags.Ephemeral,
                  });
              }

              await interaction.reply({
                  content: `Suggestion with ID ${messageId} has been rejected!`,
                  flags: MessageFlags.Ephemeral,
              });
          }
      }
  },
};