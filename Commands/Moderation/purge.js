const { SlashCommandBuilder, PermissionFlagsBits, Collection, EmbedBuilder, MessageFlags } = require("discord.js");

  module.exports = {
    data: new SlashCommandBuilder()
        .setName("purge")
        .setDescription(
            "Purge a specific amount of messages from a target or channel"
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("all")
                .setDescription("Remove all Messages")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("user")
                .setDescription("Removes all messages from the user given")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
                .addUserOption((options) =>
                    options
                        .setName("user")
                        .setDescription("Input user")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("bot")
                .setDescription("Removes a bot user's messages")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("links")
                .setDescription("Remove messages containing links")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        .addSubcommand((subcommand) =>
    subcommand
        .setName("caps")
        .setDescription("Remove messages containing all capital letters")
        .addIntegerOption((options) =>
            options
                .setName("count")
                .setDescription("Input count")
                .setMinValue(1)
                .setRequired(true)
        )
)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("images")
                .setDescription("Remove messages containing images/GIF/files")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("reactions")
                .setDescription("Remove messages containing reactions")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("mentions")
                .setDescription("Remove messages containing mentions")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("embed")
                .setDescription("Remove messages containing embeds")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("emojis")
                .setDescription("Remove messages containing emojis")
                .addIntegerOption((options) =>
                    options
                        .setName("count")
                        .setDescription("Input count")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
        subcommand
            .setName("stickers")
            .setDescription("Remove messages containing stickers")
            .addIntegerOption((options) =>
                options
                    .setName("count")
                    .setDescription("Input count")
                    .setMinValue(1)
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
    subcommand
        .setName("webhooks")
        .setDescription("Remove messages sent by webhooks")
        .addIntegerOption((options) =>
            options
                .setName("count")
                .setDescription("Input count")
                .setMinValue(1)
                .setRequired(true)
        )
)
.addSubcommand((subcommand) =>
subcommand
    .setName("pins")
    .setDescription("Remove pinned messages")
    .addIntegerOption((options) =>
        options
            .setName("count")
            .setDescription("Input count")
            .setMinValue(1)
            .setRequired(true)
    )
),
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({
            content: `${client.emoji.cross} | You do not have **Manage Messages** permission.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

         // Move the initial check outside the help section
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return;
  }
    
        let amount = interaction.options.getInteger("count");
        if (amount > 100) amount = 100;
        if (amount < 1) amount = 1;
    
        const fetch = await interaction.channel.messages.fetch({ limit: amount });
        const user = interaction.options.getUser("user");
    
        async function results(deletedMessages) {
          if (deletedMessages.size === 0) {
              const embed = new EmbedBuilder()
                  .setDescription("No messages to delete for the specified criteria.")
                  .setColor(client.config.embedColor)
              
              await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
              return;
          }
        
          const results = {};
          for (const [, deleted] of deletedMessages) {
              const user = `${deleted.author.username}`;
              if (!results[user]) results[user] = 0;
              results[user]++;
          }
        
          const userMessageMap = Object.entries(results);
        
          const finalResult = userMessageMap
              .map(([user, messages]) => `**${user} - ${messages}**`)
              .join("\n");
        
          const embed = new EmbedBuilder()
              .setDescription(`Successfully purged **${deletedMessages.size}** messages for the specified criteria.\n \n${finalResult}`)
              .setColor(client.config.embedColor)
        
          const msg = await interaction.reply({ embeds: [embed], withResponse: true });
          
          // Check if the message is deletable
          if (msg.deletable) {
              setTimeout(() => {
                  msg.delete().catch(console.error);
              }, 5000);
          }
      }
           
        let filtered;
        let deletedMessages;

        try {
          switch (interaction.options.getSubcommand()) {
            case "all":
              deletedMessages = await interaction.channel.bulkDelete(fetch, true);
              results(deletedMessages);
              break;
    
            case "bot":
              filtered = fetch.filter((m) => m.author.bot);
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
            case "user":
              filtered = fetch.filter((m) => m.author.id === user.id);
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;

              case "links":
                filtered = fetch.filter((m) => /https?:\/\/\S+/i.test(m.content));
                deletedMessages = await interaction.channel.bulkDelete(filtered, true);
                results(deletedMessages);
                break;

              case "caps":
              filtered = fetch.filter((m) => m.content.match(/[A-Z]/g) !== null);
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
              case "images":
                filtered = fetch.filter((m) =>
                  m.attachments.some((attachment) =>
                    /\.(png|jpe?g|gif|bmp|webp)$/i.test(attachment.url)
                  ) ||
                  /\/\/\S+\.(png|jpe?g|gif|bmp|webp)$/i.test(m.content)
                );
                deletedMessages = await interaction.channel.bulkDelete(filtered, true);
                results(deletedMessages);
                break;
    
            case "images":
              filtered = fetch.filter((m) =>
                m.attachments.some((attachment) =>
                  /\.(png|jpe?g|gif|discordapp|cdn|bmp|png?|webp)$/i.test(attachment.url) // Two cases as this one may block out undercover attachments
                )
              );
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
            case "reactions":
              filtered = fetch.filter((m) => m.reactions.cache.size > 0);
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
            case "mentions":
              filtered = fetch.filter((m) => m.mentions.users.size > 0);
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
            case "embed":
              filtered = fetch.filter((m) => m.embeds.length > 0);
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
            case "emojis":
              filtered = fetch.filter((m) => /<:.+?:\d+>|<a:.+?:\d+>/i.test(m.content));
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
            case "stickers":
              filtered = fetch.filter((m) => m.stickers.size > 0);
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
              case "webhooks":
                filtered = fetch.filter((m) => m.webhookId);
                try {
                  // Attempt to delete messages sent by webhooks
                  deletedMessages = await interaction.channel.bulkDelete(filtered, true);
                  results(deletedMessages);
                } catch (error) {
                  // Handle different types of errors
                  if (error.code === 10015) {
                    // Invalid Webhook Token error
                    await interaction.reply({
                      content: "An error occurred while processing the purge webhook command. The webhook token is invalid.",
                      flags: MessageFlags.Ephemeral
                    });
                  } else {
                    // Handle other errors, log it, and notify the user
                    console.error("[Error during purge:]", error);
                    await interaction.reply({
                      content: "An error occurred while processing the purge command.",
                      flags: MessageFlags.Ephemeral
                    });
                  }
                }
                break;
    
            case "pins":
              filtered = fetch.filter((m) => m.pinned);
              deletedMessages = await interaction.channel.bulkDelete(filtered, true);
              results(deletedMessages);
              break;
    
              default:
                await interaction.reply({
                  content: "Unknown purge subcommand.",
                  flags: MessageFlags.Ephemeral
                });
                break;
            }
          } catch (error) {
            console.error("[Error during purge:]", error);
        
            if (error.message.includes("Unknown interaction")) {
              await interaction.reply({
                content: "An error occurred while processing the command. Please try again.",
                flags: MessageFlags.Ephemeral
              });
            } else {
              await interaction.reply({
                content: "An error occurred while processing the purge command..",
                flags: MessageFlags.Ephemeral
              });
            }
          }
        }
      }
  

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */