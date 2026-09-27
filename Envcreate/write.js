const prompt = require("prompt");
const fs = require('fs').promises;
const { textColored } = require("./function");

module.exports = {
  createENV: async () => {
    prompt.message = textColored("Bot Startup", "#800080");
    
    let schema = {
      properties: {
        token: {
          description: textColored("Enter your bot token here"),
          required: true,
          hidden: true
        },
        clientId: {
          description: textColored("Enter your bot ID here"),
          required: true
        },
        mongodbURL: {
          description: textColored("Enter your MongoDB URL here"),
          required: true,
          hidden: true
        },
        developerId: {
          description: textColored("Enter the developer ID"),
          required: true
        },
        message: {
          message: textColored("Let's start the optional settings")
        },
        serverId: {
          description: textColored("Enter the Dev Guild ID (If you want a single server bot)"),
          required: false
        }
      },
      noPrompt: true
    };

    const {
      developerId,
      token,
      clientId,
      mongodbURL,
      serverId,
    } = await prompt.get(schema);

    const envContent = `############# BOT INFO #############\n\nclientId=${clientId}\n############ BOT SETTINGS #############\n\ntoken=${token}\nmongodbURL=${mongodbURL}\nserverId=${serverId || ""}\n############ USER SETTINGS #############\n\ndeveloperId=${developerId}`;
    
    await fs.writeFile(".env", envContent, 'utf8');
  },

  verifyENV: () => {
    const { textColored } = require("./function");
    
    let checks = {
      developerId: {
        message: process.env.developerId.trim() === "??????" ? "developerId is not set" : "✓ OwnerID set.",
        color: process.env.developerId.trim() === '??????' ? "#ff0000" : false
      },
      token: {
        message: process.env.token.trim() === "??????" ? "Bot token is not set" : "✓ Bot token set.",
        color: process.env.token.trim() === '??????' ? "#ff0000" : false
      },
      clientId: {
        message: process.env.clientId.trim() === "??????" ? "Bot ID is not set" : "✓ Bot ID set.",
        color: process.env.clientId.trim() === "??????" ? "#ff0000" : false
      },
      mongodbURL: {
        message: process.env.mongodbURL.trim() === "??????" ? "MongoDB URL not set" : "✓ MongoDB URL set.",
        color: process.env.mongodbURL.trim() === "??????" ? "#ff0000" : false
      }
    };

    console.log(textColored("════════════════ ⋆★⋆ ════════════════", '#800080'));
    console.log('⋆★⋆', textColored(checks.developerId.message, checks.developerId.color));
    console.log('⋆★⋆', textColored(checks.token.message, checks.token.color));
    console.log('⋆★⋆', textColored(checks.clientId.message, checks.clientId.color));
    console.log("⋆★⋆", textColored(checks.mongodbURL.message, checks.mongodbURL.color));
    console.log(textColored("════════════════ ⋆★⋆ ════════════════", "#800080"));
  }
};