const { ShardingManager } = require('discord.js');
require('dotenv').config();
const si = require("systeminformation");
const logs = require('./Utils/logs');

// Function to get system information
async function getSystemInfo() {
    try {
        const cpuInfo = await si.cpu();
        logs.info(`[SPECS] | CPU: ${cpuInfo.manufacturer} ${cpuInfo.brand}`);
        const memInfo = await si.memLayout();
        memInfo.forEach((mem, index) => {
            logs.info(`[SPECS] | RAM Slot ${index + 1}: ${mem.manufacturer || "No data available"} ${mem.partNum}`);
        });
        const gpuInfo = await si.graphics();
        gpuInfo.controllers.forEach((gpu, index) => {
            logs.info(`[SPECS] | GPU ${index + 1}: ${gpu.model}`);
        });
    } catch (error) {
        logs.error(`[SPECS] | Error occurred while getting system information: ${error}`);
    }
}

// Main function to run the application
async function main() {
    await getSystemInfo();

    const manager = new ShardingManager('./index.js', {
        token: process.env.token,
        totalShards: 1
    });

    manager.on('shardCreate', shard => {
        logs.logging(`[SHARD] | Launched shard ${shard.id}`);
    });

    manager.spawn().catch(console.error);
}

// Execute the main function
main().catch(error => {
    logs.error(`An error occurred: ${error}`);
    process.exit(1);
});