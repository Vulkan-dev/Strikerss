const mongoose = require('mongoose');

const oauthVerifySchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    channelId: {
        type: String,
        required: true
    },
    roleId: {
        type: String,
        required: true
    },
    embedTitle: {
        type: String,
        default: 'Server Verification'
    },
    embedMessage: {
        type: String,
        required: true
    },
    buttonLabel: {
        type: String,
        default: 'Verify Now'
    },
    color: {
        type: String,
        default: '#00f5d4'
    },
    messageId: {
        type: String,
        default: null
    },
    enabled: {
        type: Boolean,
        default: true
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

module.exports = mongoose.model('OAuthVerify', oauthVerifySchema);
