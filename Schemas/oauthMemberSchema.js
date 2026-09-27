const mongoose = require('mongoose');

const oauthMemberSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    username: {
        type: String,
        default: 'Unknown'
    },
    discriminator: {
        type: String,
        default: '0'
    },
    avatar: {
        type: String,
        default: null
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    scope: {
        type: String,
        default: 'identify guilds.join'
    },
    guilds: {
        type: [String],
        default: []
    },
    ip: {
        type: String,
        default: null
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

oauthMemberSchema.index({ guilds: 1 });

module.exports = mongoose.model('OAuthMember', oauthMemberSchema);
