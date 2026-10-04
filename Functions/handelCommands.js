const { REST, Routes } = require('discord.js');
const fs = require('fs');

module.exports = (client) => {
    client.handleCommands = async (commandFolders, basePath) => {
        client.commandArray = [];
        const seenNames = new Set();

        for (const folder of commandFolders) {
            const commandFiles = fs.readdirSync(`${basePath}/${folder}`).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                try {
                    const command = require(`../Commands/${folder}/${file}`);
                    if (command.data && command.data.name) {
                        if (!seenNames.has(command.data.name)) {
                            seenNames.add(command.data.name);
                            client.commands.set(command.data.name, command);
                            client.commandArray.push(command.data.toJSON());
                        } else {
                            console.warn(`[COMMANDS] Skipping duplicate command: ${command.data.name} in ${folder}/${file}`);
                        }
                    }
                } catch (err) {
                    console.error(`[COMMANDS] Error loading command ${folder}/${file}:`, err.message);
                }
            }
        }

        client.logs ? client.logs.success(`[COMMANDS] Successfully loaded ${client.commands.size} SlashCommands.`)
                    : console.log(`[COMMANDS] Successfully loaded ${client.commands.size} SlashCommands.`);

        const rest = new REST({ version: '10' }).setToken(process.env.token);

        try {
            // 1. Deploy directly as guild commands for target guild for INSTANT 0-second availability
            const targetGuildId = process.env.serverId || process.env.CLAN_GUILD_ID;
            if (targetGuildId) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.clientId, targetGuildId),
                    { body: client.commandArray }
                ).catch((err) => {
                    console.error(`[SLASH_COMMANDS] Failed to register guild commands for ${targetGuildId}:`, err.message);
                });
                client.logs ? client.logs.success(`[SLASH_COMMANDS] Guild slash commands registered instantly for guild ${targetGuildId} (${client.commandArray.length} commands).`)
                            : console.log(`[SLASH_COMMANDS] Guild slash commands registered instantly for guild ${targetGuildId} (${client.commandArray.length} commands).`);
            }

            // 2. Also deploy globally so all future and external servers receive them
            await rest.put(
                Routes.applicationCommands(process.env.clientId),
                { body: client.commandArray }
            );
            client.logs ? client.logs.success(`[SLASH_COMMANDS] Application commands registered globally (${client.commandArray.length} unique commands).`)
                        : console.log(`[SLASH_COMMANDS] Application commands registered globally (${client.commandArray.length} unique commands).`);
        } catch (error) {
            console.error('[SLASH_COMMANDS ERROR]', error.message || error);
        }
    };
};