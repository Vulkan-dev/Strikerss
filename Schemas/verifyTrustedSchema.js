const { model, Schema } = require("mongoose");

const verifyTrustedSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    addedBy: { type: String, default: "1127146188701970442" },
    addedAt: { type: Date, default: Date.now }
});

module.exports = model("VerifyTrusted", verifyTrustedSchema);
