const { inspect } = require('node:util');
const path = require('path');

const color = {
    red: '\x1b[31m',
    orange: '\x1b[38;5;202m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    pink: '\x1b[38;5;213m',
    turquoise: '\x1b[38;5;45m',
    reset: '\x1b[0m'
};

function getTimestamp() {
    return new Date().toISOString(); // ISO format for better readability
}

function write(message = '', prefix = '', colors = true) {
    const properties = inspect(message, { depth: 3, colors: Boolean(colors && typeof message !== 'string') });
    const lines = properties.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0) {
            console.log(prefix + line);
        } else {
            console.log(line);
        }
    }
}

function getCallerInfo() {
    const stack = new Error().stack.split('\n')[3]; // Get the caller's stack trace
    const caller = stack.match(/\((.*):(\d+):(\d+)\)/);
    if (caller) {
        const filePath = caller[1];
        const lineNumber = caller[2];
        return ` [${path.basename(filePath)}:${lineNumber}]`;
    }
    return '';
}

function info(message) {
    return write(message, `${color.yellow}[${getTimestamp()}]${color.reset} ${color.turquoise}[INFO]${color.reset}${getCallerInfo()}: `);
}

function warn(message) {
    return write(message, `${color.orange}[${getTimestamp()}]${color.reset} ${color.turquoise}[WARN]${color.reset}${getCallerInfo()}: `);
}

function error(message) {
    const errorMessage = typeof message === 'object' ? message.stack || message.message : message;
    return write(errorMessage, `${color.red}[${getTimestamp()}]${color.reset} ${color.turquoise}[ERROR]${color.reset}${getCallerInfo()}: `, false);
}


function success(message) {
    return write(message, `${color.green}[${getTimestamp()}]${color.reset} ${color.turquoise}[SUCCESS]${color.reset}${getCallerInfo()}: `);
}

function debug(message) {
    return write(message, `${color.blue}[${getTimestamp()}]${color.reset} ${color.turquoise}[DEBUG]${color.reset}${getCallerInfo()}: `);
}

function logging(message) {
    return write(message, `${color.pink}[${getTimestamp()}]${color.reset} ${color.turquoise}[LOG]${color.reset}${getCallerInfo()}: `);
}

module.exports = { getTimestamp, write, info, warn, error, success, debug, logging, color };
