const { REST } = require("@discordjs/rest");
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');

module.exports = (client) => {
    client.handleCommands = async (commandFolders, basePath) => {
        client.commandArray = [];
        for (const folder of commandFolders) {
            const commandFiles = fs.readdirSync(`${basePath}/${folder}`).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(`../Commands/${folder}/${file}`);
                if (command.data && command.data.name) {
                    client.commands.set(command.data.name, command);
                    client.commandArray.push(command.data.toJSON());
                }
            }
        }

        client.logs ? client.logs.success(`[COMMANDS] Successfully loaded ${client.commands.size} SlashCommands.`)
                    : console.log(`[COMMANDS] Successfully loaded ${client.commands.size} SlashCommands.`);

        const rest = new REST({ version: '9' }).setToken(process.env.token);

        (async () => {
            try {
                if (process.env.serverId) {
                    await rest.put(
                        Routes.applicationGuildCommands(process.env.clientId, process.env.serverId),
                        { body: client.commandArray }
                    );
                } else {
                    await rest.put(
                        Routes.applicationCommands(process.env.clientId),
                        { body: client.commandArray }
                    );
                }
                client.logs ? client.logs.success(`[SLASH_COMMANDS] Application commands registered with Discord.`)
                            : console.log(`[SLASH_COMMANDS] Application commands registered with Discord.`);
            } catch (error) {
                console.error('[SLASH_COMMANDS ERROR]', error.message || error);
            }
        })();
    };
};