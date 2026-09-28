module.exports = () => {
    // Ctrl + C
    process.on('SIGINT', () => {
        console.log('\n[PROCESS] Shutting down Strikers gracefully...');
        process.exit(0);
    });

    // Uncaught exception
    process.on('uncaughtException', (err) => {
        if (err && err.message && (
            err.message.includes('before initial connection is complete') ||
            err.message.includes('buffering timed out') ||
            err.message.includes('ECONNREFUSED') ||
            err.message.includes('Could not connect to any servers in your MongoDB Atlas cluster') ||
            err.message.includes('Unknown interaction') ||
            err.message.includes('Interaction has already been acknowledged') ||
            err.message.includes('The reply to this interaction has already been sent')
        )) return;
        console.error(`[ERROR] Uncaught Exception:`, err.message || err);
    });

    // Killed process
    process.on('SIGTERM', () => {
        process.exit(0);
    });

    // Unhandled rejection
    process.on('unhandledRejection', (err) => {
        // Filter out expected DNS, MongoDB buffering, Discord interaction timeouts, or cancelled requests
        if (err && err.message && (
            err.message.includes('before initial connection is complete') ||
            err.message.includes('ECONNREFUSED') ||
            err.message.includes('buffering timed out') ||
            err.message.includes('Could not connect to any servers in your MongoDB Atlas cluster') ||
            err.message.includes('Unknown interaction') ||
            err.message.includes('Interaction has already been acknowledged') ||
            err.message.includes('The reply to this interaction has already been sent')
        )) return;
        console.error(`[ERROR] Unhandled Rejection:`, err.message || err);
    });

    // Filter out noisy deprecation warnings
    process.on('warning', (warning) => {
        if (warning.name === 'DeprecationWarning') return;
        console.warn(`[WARN] ${warning.message || warning}`);
    });
};