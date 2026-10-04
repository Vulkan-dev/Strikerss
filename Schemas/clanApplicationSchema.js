const { model, Schema } = require("mongoose");

module.exports = model("clan_applications", new Schema({
    discordId: { type: String, required: true, unique: true, index: true },
    ip: { type: String, index: true },
    username: { type: String, required: true },
    age: { type: String },
    hasMic: { type: String },
    favouriteGame: { type: String },
    gamesPlayed: { type: [String], default: [] },
    clanMoniker: { type: String },
    channelId: { type: String },
    hasVerifiedRole: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now, index: true }
}));
