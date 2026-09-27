const { model, Schema } = require("mongoose");

const inviteSchema = new Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    inviterId: { type: String, default: null },
    code: { type: String, default: null },
    tracked: { type: Number, default: 0 },
    fake: { type: Number, default: 0 },
    left: { type: Number, default: 0 },
    added: { type: Number, default: 0 }
}, {
    timestamps: true
});

inviteSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model("Invite", inviteSchema);
