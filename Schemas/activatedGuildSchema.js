const { Schema, model } = require('mongoose');

const activatedGuildSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    guildName: {
        type: String,
        default: 'Unknown'
    },
    redeemedBy: {
        type: String,
        required: true
    },
    key: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    redeemedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = model('ActivatedGuild', activatedGuildSchema);
