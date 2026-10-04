const { model, Schema } = require("mongoose");

module.exports = model("NameHistory", new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    oldName: { type: String, required: true },
    newName: { type: String, required: true },
    type: { type: String, default: "nickname" },
    timestamp: { type: Date, default: Date.now }
}));
