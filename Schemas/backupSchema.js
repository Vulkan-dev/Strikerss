const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
    backupId: {
        type: String,
        index: true
    },
    data: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    guildName: {
        type: String,
        default: 'Unknown'
    },
    state: {
        type: String,
        required: true
    },
    isAuto: {
        type: Boolean,
        default: false
    },
    backupDate: {
        type: String
    },
    creatorId: {
        type: String,
        default: 'System'
    },
    size: {
        type: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for frequent queries
backupSchema.index({ guildId: 1, state: 1 });
backupSchema.index({ guildId: 1, isAuto: 1, createdAt: 1 });

module.exports = mongoose.model('Backup', backupSchema);