console.clear();
require("dotenv").config();
const process = require('node:process');
const { verifyENV } = require("./write");
const { textColored, createNecesaryFiles } = require("./function");
const CFonts = require('cfonts');

// Display the bot name
CFonts.say("Strikers", {
  font: "block",
  align: "center",
  colors: ["#00f5d4", 'white']
});

// Display the bot description
CFonts.say("Strikers - Backup & Member Restorer", {
  font: "console",
  align: 'center',
  colors: ["cyan"]
});

// Start function to create necessary files and verify environment
const start = async () => {
  const filesCreated = await createNecesaryFiles();
  
  if (filesCreated) {
    console.log(textColored("✓ Your required files have been created, please restart the bot."));
    setTimeout(() => {
      return process.exit();
    }, 5000); // 0x1388 in decimal is 5000
  } else {
    verifyENV();
    require('../load');
  }
};

// Execute the start function
start();