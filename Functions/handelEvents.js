const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    client.handleEvents = async (dirPath) => {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // If it's a directory, recursively handle events in that directory
                await client.handleEvents(fullPath);
            } else if (file.endsWith('.js')) {
                // If it's a JavaScript file, require it and register the event
                const event = require(fullPath);
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
            }
        }
    };
}