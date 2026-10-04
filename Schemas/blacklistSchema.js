const { model, Schema } = require("mongoose")

module.exports = model("blacklist", new Schema({
    userId: { type: String, default: null, index: true },
    ip: { type: String, default: null, index: true },
    reason: { type: String, default: "Honeypot Triggered" },
    timestamp: { type: Date, default: Date.now }
}))