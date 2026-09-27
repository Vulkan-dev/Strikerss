const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  PermissionsBitField,
} = require("discord.js");
const ms = require("ms");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channel")
    .setDescription("Manage the channels of the discord server.")
    .addSubcommand((command) =>
      command
        .setName("nuke")
        .setDescription(
          "Deletes a channel and then clones it again (not a raid command)."
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("*The channel to nuke.")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.GuildVoice
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("*The reason for nuking the channel.")
            .setRequired(true)
            .setMaxLength(512)
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("*Specify the channel type.")
            .addChoices(
              { name: `Text Channel`, value: `text` },
              { name: `Voice Channel`, value: `voice` },
              { name: `Announcement Channel`, value: `announcement` }
            )
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName("send-message")
            .setDescription(
              "*Whether or not to send a message in the new channel."
            )
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("lock")
        .setDescription("Lock a channel.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("*The channel to lock.")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("unlock")
        .setDescription("Unlock a channel.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("*The channel to unlock.")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
            .setRequired(true)
        )
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  /**
   *
   * @param {ChatInputCommandInteraction} interaction
   * @param {Client} client
   */
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "nuke":
        {
          const { options, guild } = interaction;
          const channel = options.getChannel("channel");
          const Reason = options.getString("reason");
          const type = options.getString("type");

          // Send message option.
          const sendMSG = options.getBoolean("send-message");

          // Getting channel info.
          const channelID = await guild.channels.cache.get(channel.id);

          if (!channel)
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("Red")
                  .setDescription(
                    `${client.emoji.error} | The channel specified does not exist.`
                  ),
              ],
            });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("nukeConfirm")
              .setLabel("Confirm")
              .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
              .setCustomId("nukeCancel")
              .setLabel("Cancel")
              .setStyle(ButtonStyle.Danger)
          );

          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("nukeConfirm")
              .setLabel("Confirm")
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),

            new ButtonBuilder()
              .setCustomId("nukeCancel")
              .setLabel("Cancel")
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );

          const embed = new EmbedBuilder()
            .setColor("Red")
            .setDescription(
              `${client.emoji.error} | You are about to nuke the channel <#${channel.id}> and all data will be deleted. Please make a decision below.`
            )
            .addFields(
              { name: `Reason`, value: `${Reason}`, inline: true },
              { name: `Type`, value: `${type} channel`, inline: true },
              { name: `Send Message`, value: `${sendMSG}`, inline: true }
            );

          const message = await interaction.reply({
            embeds: [embed],
            components: [row],
          });

          const collector = message.createMessageComponentCollector({
            time: ms("10m"),
          });

          collector.on("collect", async (c) => {
            if (c.customId === "nukeConfirm") {
              if (c.user.id !== interaction.user.id) {
                return await c.reply({
                  embeds: [
                    new EmbedBuilder()
                      .setDescription(
                        `${client.emoji.error} | Only ${interaction.user.tag} can interact with these buttons.`
                      )
                      .setColor("Red"),
                  ],
                  flags: MessageFlags.Ephemeral
                });
              }

              await guild.channels.delete(channelID);

              const newChannel = await guild.channels.create({
                name: channel.name,
                type: type === "text" ? ChannelType.GuildText : type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildAnnouncement,
                topic: channel.topic || null,
                parent: channel.parent,
              }).catch((err) => {
                interaction.reply({
                  embeds: [
                    new EmbedBuilder()
                      .setColor("Red")
                      .setDescription(
                        `${client.emoji.cross} | I cannot nuke the channel; please ensure that I have the *manage_channels* permission.`
                      ),
                  ],
                  flags: MessageFlags.Ephemeral
                });
              });

              const channelembed = new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setDescription(
                  `${client.emoji.tick} | The channel **#${channel.name}** has been deleted with the reason ${Reason}. The new channel is <#${newChannel.id}>.`
                );

              await c.update({
                embeds: [channelembed],
                components: [disabledRow],
              });

              if (sendMSG) {
                await newChannel.send({
                  embeds: [
                    new EmbedBuilder()
                      .setColor(client.config.embedColor)
                      .setDescription(
                        `${client.emoji.thunder} | This channel was nuked by ${interaction.user}.`
                      ),
                  ],
                });
              }
            }

            if (c.customId === "nukeCancel") {
              if (c.user.id !== interaction.user.id) {
                return await c.reply({
                  embeds: [
                    new EmbedBuilder()
                      .setDescription(
                        `${client.emoji.error} | Only ${interaction.user.tag} can interact with these buttons.`
                      )
                      .setColor("Red"),
                  ],
                  flags: MessageFlags.Ephemeral
                });
              }

              await c.update({
                embeds: [
                  new EmbedBuilder()
                    .setColor(client.config.embedColor)
                    .setDescription(
                      `${client.emoji.tick} | The nuke request has been successfully cancelled.`
                    ),
                ],
                components: [disabledRow],
              });
            }
          });
        }
        break;

      case "lock":
        {
          const channel = interaction.options.getChannel("channel");
          if (!channel) return interaction.reply({ content: "Channel not found.", flags: MessageFlags.Ephemeral });

          try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
              SendMessages: false,
            });
            await interaction.reply({ content: `The channel <#${channel.id}> has been locked.`, flags: MessageFlags.Ephemeral });
          } catch (error) {
            console.error(error);
            await interaction.reply({ content: "An error occurred while locking the channel.", flags: MessageFlags.Ephemeral });
          }
        }
        break;

      case "unlock":
        {
          const channel = interaction.options.getChannel("channel");
          if (!channel) return interaction.reply({ content: "Channel not found.", flags: MessageFlags.Ephemeral });

          try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
              SendMessages: true,
            });
            await interaction.reply({ content: `The channel <#${channel.id}> has been unlocked.`, flags: MessageFlags.Ephemeral });
          } catch (error) {
            console.error(error);
            await interaction.reply({ content: "An error occurred while unlocking the channel.", flags: MessageFlags.Ephemeral });
          }
        }
        break;
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */