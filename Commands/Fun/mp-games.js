const {
  Client,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
} = require("discord.js");
const { Connect4, RockPaperScissors, TicTacToe } = require("discord-gamecord");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("games-multiplayer")
    .setDescription("Play a multi-player minigame within Discord. 🎮")
    .addStringOption((option) =>
      option
        .setName("game")
        .setDescription("*Choose a game to play.")
        .setRequired(true)
        .addChoices(
          { name: "Connect-4", value: "connect4" },
          { name: "Rock-Paper-Scissors", value: "rps" },
          { name: "Tic-Tac-Toe", value: "tictactoe" }
        )
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("*Choose your opponent for the game.")
        .setRequired(true)
    )
    .setDMPermission(false),
  /**
   * @param {Client} client
   * @param {ChatInputCommandInteraction} interaction
   */
  async execute(interaction, client) {
    const game = interaction.options.getString("game");
    const user = interaction.options.getUser("user");

    if (!user) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(
              ":warning: | The target specified has most likely left the server."
            ),
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (user.bot) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(
              ":warning: | You are not allowed to play with or against a bot."
            ),
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (user.id === interaction.user.id) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(
              ":warning: | You cannot play a multi-player game with yourself."
            ),
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    switch (game) {
      case "connect4":
        {
          const Game = new Connect4({
            message: interaction,
            slash_command: true,
            opponent: interaction.options.getUser("user"),
            embed: {
              title: "Connect4 Game",
              statusTitle: "Status",
              color: client.config.embedColor,
            },
            emojis: {
              board: "⚪",
              player1: "🔴",
              player2: "🟡",
            },
            mentionUser: true,
            timeoutTime: 60000,
            buttonStyle: "PRIMARY",
            turnMessage: "{emoji} | Its turn of player **{player}**.",
            winMessage: "{emoji} | **{player}** won the Connect4 Game.",
            tieMessage: "The Game tied! No one won the Game!",
            timeoutMessage: "The Game went unfinished! No one won the Game!",
            playerOnlyMessage:
              "Only {player} and {opponent} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
        // %%USERNAME%%

      case "rps":
        {
          const Game = new RockPaperScissors({
            message: interaction,
            slash_command: true,
            opponent: interaction.options.getUser("user"),
            embed: {
              title: "Rock Paper Scissors",
              color: client.config.embedColor,
              description: "Press a button below to make a choice.",
            },
            buttons: {
              rock: "Rock",
              paper: "Paper",
              scissors: "Scissors",
            },
            emojis: {
              rock: "🌑",
              paper: "📰",
              scissors: "✂️",
            },
            mentionUser: true,
            timeoutTime: 60000,
            buttonStyle: "PRIMARY",
            pickMessage: "You choose {emoji}.",
            winMessage: "**{player}** won the Game! Congratulations!",
            tieMessage: "The Game tied! No one won the Game!",
            timeoutMessage: "The Game went unfinished! No one won the Game!",
            playerOnlyMessage:
              "Only {player} and {opponent} can use these buttons.",
          });

          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
      case "tictactoe":
        {
          const Game = new TicTacToe({
            message: interaction,
            slash_command: true,
            opponent: interaction.options.getUser("user"),
            embed: {
              title: "Tic Tac Toe",
              color: client.config.embedColor,
              statusTitle: "Status",
              overTitle: "Game Over",
            },
            emojis: {
              xButton: "❌",
              oButton: "🔵",
              blankButton: "➖",
            },
            mentionUser: true,
            timeoutTime: 60000,
            xButtonStyle: "DANGER",
            oButtonStyle: "PRIMARY",
            turnMessage: "{emoji} | Its turn of player **{player}**.",
            winMessage: "{emoji} | **{player}** won the TicTacToe Game.",
            tieMessage: "The Game tied! No one won the Game!",
            timeoutMessage: "The Game went unfinished! No one won the Game!",
            playerOnlyMessage:
              "Only {player} and {opponent} can use these buttons.",
          });
          // Madeq
          Game.startGame();
          Game.on("gameOver", (result) => {
            console.log(result); // =>  { result... }
          });
        }
        break;
    }
  },
};


/**
 * Credits: Arpan | @arpandevv
 */