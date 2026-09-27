const mongoose = require("mongoose");

const redeemSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  plan: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  redeemedBy: {
    type: [String],
    default: []
  }
});

const Redeem = mongoose.model("CreateRedeem", redeemSchema);

module.exports = Redeem;