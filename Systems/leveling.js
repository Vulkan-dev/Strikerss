const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionsBitField,
    ButtonStyle,
} = require('discord.js');
const levelSchema = require("../Schemas/level");
const levelschema = require("../Schemas/levelsetup");
const levelRoleSchema = require("../Schemas/levelRoleSchema");

module.exports = (client) => {
    client.on(Events.MessageCreate, async (message) => {
        const { guild, author, member, channel } = message;
      
        if (!guild || author.bot) return;
      
        try {
          const leveldata = await levelschema.findOne({ Guild: guild.id });
          if (!leveldata || leveldata.Disabled === "disabled") return;
      
          let userData = await levelSchema.findOne({
            Guild: guild.id,
            User: author.id,
          });
          if (!userData) {
            userData = await levelSchema.create({
              Guild: guild.id,
              User: author.id,
              XP: 0,
              Level: 1,
            });
          }
      
          const baseXP = 8;
          let xpEarned = baseXP;
      
          const hasMultiplierRole = member.roles.cache.some(
            (role) => role.id === leveldata.Role
          );
          if (hasMultiplierRole) {
            let multiplier = parseFloat(leveldata.Multi);
            if (isNaN(multiplier) || multiplier < 1 || multiplier > 5) {
              multiplier = 1;
            }
            xpEarned = baseXP * multiplier;
          }
      
          xpEarned = Math.min(xpEarned, 100);
      
          userData.XP += xpEarned;
      
          let requiredXP = userData.Level * 40;
          let leveledUp = false;
      
          while (userData.XP >= requiredXP) {
            userData.XP -= requiredXP;
            userData.Level += 1;
            leveledUp = true;
            requiredXP = userData.Level * 40;
          }
      
          await userData.save();
      
          if (leveledUp) {
            const notificationChannelId = leveldata.NotificationChannel;
            const notificationChannel = guild.channels.cache.get(notificationChannelId);
            const levelembed = new EmbedBuilder()
              .setColor(client.config.embedColor)
              .setTitle(`> ${author.username} has Leveled Up!`)
              .setDescription(`🎉 **Congratulations!** You've reached **Level ${userData.Level}**!`)
              .setFooter({ text: `Keep up the activity to level up faster!` })
              .setTimestamp();
      
            const roleData = await levelRoleSchema.findOne({ GuildID: guild.id });
            if (roleData) {
              for (const item of roleData.LevelRoleData) {
                const level = item.level;
                const roleId = item.roleId;
                if (
                  !message.member.roles.cache.has(roleId) &&
                  userData.Level > level
                ) {
                  message.member.roles.add(roleId);
                }
                if (userData.Level === level) {
                  const role = guild.roles.cache.get(roleId);
                  if (role) {
                    message.member.roles.add(role);
                    levelembed.setDescription(
                      `${author.username}, you have reached ${userData.Level} and got <@&${roleId}>!`
                    );
                  }
                }
              }
            }
      
            await notificationChannel.send({ embeds: [levelembed] });
          }
        } catch (error) {
          console.error("Error processing leveling system:", error);
        }
      });
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */