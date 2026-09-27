const mongoose = require("mongoose");

const premiumGuildSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    isPremiumGuild: {
        type: Boolean,
        default: false,
    },
    premium: {
        redeemedBy: {
            type: Array,
            default: [],
        },
        redeemedAt: {
            type: Date,
            default: null,
        },
        // %%VERSION%%
        expiresAt: {
            type: Date,
            default: null,
        },
        plan: {
            type: String,
            default: null,
        },
    },
});

module.exports = mongoose.model("PremiumGuild", premiumGuildSchema);