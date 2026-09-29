const config = require('../../config');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const chalk = require('chalk');

// function to get the directory path safely
function getSafeDirPath() {
    try {
        if (typeof __dirname !== 'undefined') {
            return __dirname;
        }
        if (typeof module !== 'undefined' && module.filename) {
            return path.dirname(module.filename);
        }
        const stackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = Infinity;
        const stack = new Error().stack;
        Error.stackTraceLimit = stackTraceLimit;
        const match = stack.match(/(?:file|http|https):\/\/\S+?js/i);
        if (match) {
            return path.dirname(match[0].replace(/^(file|http|https):\/\//i, ''));
        }
        return process.cwd();
    } catch (e) {
        return process.cwd();
    }
}

const BASE_DIR = getSafeDirPath();

const requiredEnvVars = [
    'mongodbURL'
];

for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        console.error(`${chalk.red.bold(`Error:`)} Missing required environment variable: ${varName}. Please fill it in the .env file.`);
        process.exit(1);
    }
}

const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        client.logs.success(`[BOT] Logged in as ${client.user.tag}!`);

        // MongoDB connection
        const mongodbURL = process.env.mongodbURL;
        if (!mongodbURL) {
            client.logs.error("[DATABASE] Missing mongodbURL in .env file.");
            return process.exit(1);
        }

        mongoose.set("strictQuery", false);
        
        // Database connection with auto-reconnect and retry logic
        const connectWithRetry = async () => {
            try {
                const dns = require('dns');
                if (dns.setDefaultResultOrder) {
                    dns.setDefaultResultOrder('ipv4first');
                }
                dns.setServers(['8.8.8.8', '1.1.1.1']);
                
                await mongoose.connect(mongodbURL, {
                    serverSelectionTimeoutMS: 15000,
                    family: 4
                });
                client.logs.success('[DATABASE] Connected to MongoDB successfully.');
            } catch (error) {
                client.logs.error(`[DATABASE] Failed to connect to MongoDB: ${error.message}`);
                client.logs.warn('[DATABASE] Retrying MongoDB connection in 5 seconds... Make sure 0.0.0.0/0 is whitelisted in MongoDB Atlas: https://cloud.mongodb.com/');
                setTimeout(connectWithRetry, 5000);
            }
        };

        mongoose.connection.on('disconnected', () => {
            client.logs.warn('[DATABASE] MongoDB disconnected. Attempting reconnection...');
            setTimeout(connectWithRetry, 5000);
        });

        if (mongoose.connection.readyState === 1) {
            client.logs.success('[DATABASE] Connected to MongoDB successfully.');
        } else {
            await connectWithRetry();
        }

        // Auto-sync Verification schema for server
        try {
            const VerificationSchema = require('../../Schemas/verificationSchema');
            const targetGuild = client.guilds.cache.get('1553407415523999824');
            if (targetGuild) {
                const verifiedRole = targetGuild.roles.cache.find(r => r.name === 'Verified');
                const verifyChannel = targetGuild.channels.cache.get('1554194429017985204');
                if (verifiedRole && verifyChannel) {
                    await VerificationSchema.findOneAndUpdate(
                        { Guild: targetGuild.id },
                        {
                            Guild: targetGuild.id,
                            Channel: verifyChannel.id,
                            Role: verifiedRole.id,
                            MessageContent: 'Complete the Captcha and verify with Discord to get full access to the server!'
                        },
                        { upsert: true }
                    );
                    client.logs.success('[VERIFY] Successfully synced Captcha Verification Schema with Verified role.');
                }
            }
        } catch (err) {
            console.error('[VERIFY SYNC ERROR]:', err.message);
        }

        require('events').EventEmitter.defaultMaxListeners = config.eventListeners;
    },
};