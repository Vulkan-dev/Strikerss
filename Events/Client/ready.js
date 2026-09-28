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

module.exports = {
    name: 'ready',
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
        
        // Database connection with safeguards
        try {
            const dns = require('dns');
            if (dns.setDefaultResultOrder) {
                dns.setDefaultResultOrder('ipv4first');
            }
            dns.setServers(['8.8.8.8', '1.1.1.1']);
            
            await mongoose.connect(mongodbURL, {
                serverSelectionTimeoutMS: 10000,
                family: 4
            });
            client.logs.success('[DATABASE] Connected to MongoDB successfully.');
        } catch (error) {
            client.logs.error(`[DATABASE] Failed to connect to MongoDB: ${error.message}`);
            client.logs.warn('[DATABASE] IMPORTANT: If deployed on cloud platforms like Railway, whitelist 0.0.0.0/0 in MongoDB Atlas Network Access: https://cloud.mongodb.com/');
        }

        require('events').EventEmitter.defaultMaxListeners = config.eventListeners;
    },
};