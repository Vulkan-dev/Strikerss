const { model, Schema } = require("mongoose");
 
let verifyusers = new Schema({
    Guild: String,
    Key: String,
    User: String,
    Solved: { type: Boolean, default: false }
})
 
module.exports = model("verifyusers", verifyusers);