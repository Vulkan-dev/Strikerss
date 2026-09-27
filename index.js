/*
██████╗  █████╗ ███████╗ ██████╗ ██████╗ 
██╔══██╗██╔══██╗╚══███╔╝██╔═══██╗██╔══██╗
██████╔╝███████║  ███╔╝ ██║   ██║██████╔╝
██╔══██╗██╔══██║ ███╔╝  ██║   ██║██╔══██╗
██║  ██║██║  ██║███████╗╚██████╔╝██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝

Developed by: @arpandevv. All rights reserved. (2025)
MIT License
*/

// -------------------------------
// Module Imports
// -------------------------------
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  PermissionsBitField, 
  Permissions, 
  MessageManager, 
  Embed, 
  Collection, 
  Partials, 
  Events, 
  ActivityType,
  REST,
  Routes
} = require('discord.js');
const fs = require('fs');
const mongoose = require('mongoose');
const cron = require('node-cron');
const path = require('path');
const dayjs = require('dayjs');
const chalk = require('chalk');
const dns = require('dns');

// Fix SRV DNS resolution for MongoDB Atlas on Windows
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const axios = require('axios');
const MongoStore = require('connect-mongo');
require('dotenv').config();

// -------------------------------
// Configuration and Constants
// -------------------------------
const currentVersion = 'v2.0.1';
const Premium = require('./Schemas/premiumUserSchema.js');
const PremiumGuild = require('./Schemas/premiumGuildSchema.js');
const { handleLogs } = require("./Events/Others/handleLogs");
const { color, getTimestamp } = require('./Utils/logEffects.js');

// -------------------------------
// Client Initialization
// -------------------------------
const client = new Client({
  intents: Object.keys(GatewayIntentBits),
  partials: [
    Partials.GuildMember, 
    Partials.Channel,
    Partials.GuildScheduledEvent,
    Partials.Message,
    Partials.Reaction, 
    Partials.ThreadMember, 
    Partials.User
  ]
});

// Loading utilities
client.logs = require('./Utils/logs.js');
client.config = require('./config');
client.emoji = require('./emoji.json');

// Setting up collections
client.commands = new Collection();
client.setMaxListeners(35);

// -------------------------------
// System Loaders
// -------------------------------
const systemsPath = path.join(__dirname, "Systems");
const systemFiles = fs
  .readdirSync(systemsPath)
  .filter((file) => file.endsWith(".js"));

let loadedSystemsCount = 0;

for (const file of systemFiles) {
  const system = require(path.join(systemsPath, file));
  system(client);
  loadedSystemsCount++;
}

client.logs.success(`[SYSTEM] - Loaded Systems: ${loadedSystemsCount}`);

// -------------------------------
// File Handlers Setup
// -------------------------------
require('./Functions/processHandlers.js')();

const functions = fs.readdirSync('./Functions').filter(file => file.endsWith('.js'));
const eventFiles = fs.readdirSync('./Events').filter(file => file.endsWith('.js'));
const triggerFiles = fs.readdirSync('./Triggers').filter(file => file.endsWith('.js'));
const commandFolders = fs.readdirSync('./Commands');

// -------------------------------
// Bot Status System
// -------------------------------
client.on('ready', async (client) => {
  try {
    setInterval(() => {
      let activities = [
        { type: 'Watching', name: `${client.commands.size} slash commands!` },
        { type: 'Watching', name: `${client.guilds.cache.size} servers!` },
        { type: 'Watching', name: `${client.guilds.cache.reduce((a,b) => a+b.memberCount, 0)} members!` },
        { type: 'Playing', name: `/help | @${client.user.username}` },
      ];

      const status = activities[Math.floor(Math.random() * activities.length)];

      if (status.type === 'Watching') {
        client.user.setPresence({ 
          activities: [{ name: `${status.name}`, type: ActivityType.Watching }]
        });
      } else {
        client.user.setPresence({ 
          activities: [{ name: `${status.name}`, type: ActivityType.Playing }]
        });
      } 
    }, 7500);
    client.logs.success(`[STATUS] Rotating status loaded successfully.`);
  } catch (error) {
    client.logs.error(`[STATUS] Error while loading rotating status.`);
  }
});

client.on('ready', () => {
  try {
    client.user.setStatus(client.config.status);
    client.logs.success(`[STATUS] Bot status loaded as ${client.config.status}.`);
  } catch (error) {
    client.logs.error(`[STATUS] Error while loading bot status.`);
  }
});

// -------------------------------
// Guild Events
// -------------------------------
client.on('guildCreate', guild => {
  client.logs.info(`[BOT] | I'm in a new guild: ${guild.name}!`);
});

client.on('guildDelete', guild => {
  client.logs.info(`[BOT] | I'm not in ${guild.name} any more...`);
});

// -------------------------------
// Ticket Remind Function
// -------------------------------

const ticketCommand = require('./Commands/Setups/ticket.js');
ticketCommand.setupMessageListener(client);

// -------------------------------
// Command Logging System
// -------------------------------
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction || !interaction.isChatInputCommand()) return;
  
  if (client.config.slashCommandLoggingChannel) {
    const channel = client.channels.cache.get(client.config.slashCommandLoggingChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setAuthor({ 
          name: `${user} has used a command.`, 
          iconURL: client.user.avatarURL({ dynamic: true })
        })
        .setTitle(`${client.user.username} Command Logger`)
        .addFields({ name: 'Server Name', value: `${server}` })
        .addFields({ name: 'Command', value: `\`\`\`${interaction}\`\`\`` })
        .addFields({ name: 'User', value: `${user} | ${userID}` })
        .setTimestamp()
        .setFooter({ 
          text: `Command Logger ${client.config.devBy}`, 
          iconURL: interaction.user.avatarURL({ dynamic: true })
        });

      await channel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  console.log(`[CMD] ${user} (${userID}) used /${interaction.commandName} in ${server}`);
});

// -------------------------------
// Premium System
// -------------------------------
cron.schedule('0 6 * * *', async () => {
  try {
    const currentDate = new Date();
    
    const allPremiumUsers = await Premium.find({});
    const expiredPremiumUsers = allPremiumUsers.filter(user => user.premium.expiresAt < currentDate);

    for (const user of expiredPremiumUsers) {
      await Premium.deleteOne({ _id: user._id });
      client.logs.info(`Deleted premium from: <@${user.id}>`);
    }

    const activePremiumUsers = allPremiumUsers.filter(user => user.premium.expiresAt >= currentDate);
    activePremiumUsers.forEach(user => {
      client.logs.info(`Active premium: <@${user.id}>, expires: ${user.premium.expiresAt}`);
    });

    client.logs.info('Expired premiums deleted.');
  } catch (error) {
    client.logs.error(`Error checking premium expiry: ${error}`);
  }
});

// -------------------------------
// Premium Guild System
// -------------------------------
cron.schedule('0 6 * * *', async () => {
  try {
    const currentDate = new Date();
    const allPremiumGuilds = await PremiumGuild.find({});
    const expiredPremiumGuilds = allPremiumGuilds.filter(guild => guild.premium.expiresAt < currentDate);

    for (const guild of expiredPremiumGuilds) {
      await PremiumGuild.deleteOne({ _id: guild._id });
      client.logs.info(`Deleted premium from: ${guild.id}`);
    }

    const activePremiumGuilds = allPremiumGuilds.filter(guild => guild.premium.expiresAt >= currentDate);
    activePremiumGuilds.forEach(guild => {
      client.logs.info(`Active PremiumGuild: ${guild.id}, expires: ${guild.premium.expiresAt}`);
    });

    client.logs.info('Expired PremiumGuilds deleted.');
  } catch (error) {
    client.logs.error(`Error checking PremiumGuild expiry: ${error}`);
  }
});


// -------------------------------
// Initialize Bot
// -------------------------------
(async () => {
  for (const file of functions) {
    require(`./Functions/${file}`)(client);
  }
  await client.handleEvents(path.join(__dirname, './Events'));
  await client.handleTriggers(triggerFiles, './Triggers');
  await client.handleCommands(commandFolders, './Commands');

  // Start Member Restorer Web Server
  const { initOAuthServer } = require('./Web/server.js');
  initOAuthServer(client);

  client.login(process.env.token).then(() => {
    handleLogs(client);
  });
})();

// -------------------------------
// Snipe Command System
// -------------------------------
client.on("messageDelete", (message) => {
  require("./Commands/Moderation/snipe.js").onMessageDelete(message);
});

// -------------------------------
// Export Client
// -------------------------------
module.exports = client;

/*
setTimeout(() => {
  console.clear();
  client.logs.logging(`[CONSOLE] | Console cleared!`);
}, 5000); // 5000 milliseconds = 5 seconds
*/