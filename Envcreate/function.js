const chalk = require("chalk");
const path = require("path");
const fs = require("fs");

module.exports = {
  textColored: (message, color) => {
    return !color ? chalk.hex("#00ff00")(message) : chalk.hex(color)(message);
  },

  createNecesaryFiles: async () => {
    try {
      const { createENV } = require("./write");
      const fs = require("fs");

      if (fs.existsSync(".env")) {
        return false;
      } else {
        await createENV();
      }
      return true;
    } catch (err) {
      throw new Error(err);
    }
  },
};
