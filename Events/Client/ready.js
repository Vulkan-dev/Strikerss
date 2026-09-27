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
        client.logs.logging(`[BOT] ${client.user.username} has been launched!`);
        client.logs.info(`[EVENTS] Started loading events...`);
        client.logs.success(`[EVENTS] Loaded ${client.eventNames().length} events.`);

        // MongoDB connection
        const mongodbURL = process.env.mongodbURL;
        if (!mongodbURL) {
            client.logs.error("[DATABASE] Cannot find MongodbURL in .env file.");
            return process.exit(1);
        }

        mongoose.set("strictQuery", false);
        
        // Database connection with safeguards
        try {
            const dns = require('dns');
            dns.setServers(['8.8.8.8', '1.1.1.1']);
            
            await mongoose.connect(mongodbURL);
            client.logs.success('[DATABASE] Connected to MongoDB successfully.');

            // Safely load schema files
            try {
                const schemasPath = path.resolve(BASE_DIR, '../../Schemas');
                const files = fs.readdirSync(schemasPath);
                client.logs.success(`[SCHEMAS] Loaded ${files.length} schema files.`);
            } catch (err) {
                client.logs.error(`[ERROR] Error reading schemas folder: ${err.message}`);
            }
        } catch (error) {
            client.logs.error(`[DATABASE] Failed to connect to MongoDB: ${error.message}`);
            setTimeout(() => {
                process.exit(1);
            }, 5000);
        }

        // Safely load triggers
        try {
            const triggersPath = path.resolve(BASE_DIR, '../../Triggers');
            const files = fs.readdirSync(triggersPath);
            client.logs.info(`[TRIGGERS] Started loading triggers...`);
            client.logs.success(`[TRIGGERS] Loaded ${files.length} trigger files.`);
        } catch (err) {
            client.logs.error(`Error reading trigger folder: ${err.message}`);
        }

        require('events').EventEmitter.defaultMaxListeners = config.eventListeners;
    },
};