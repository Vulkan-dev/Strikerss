const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { Slots } = require('discord-gamecord');
const User = require('../../Schemas/userAccount');
const Bank = require('../../Schemas/bankSchema');
const Cooldown = require('../../Schemas/CoolDownDaily');

// In-memory cooldowns for commands
const cooldowns = {
  beg: {},
  rob: {},
  heist: {},
  work: {},
  fish: {},
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Manage your economy account and perform various actions.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('startacc')
        .setDescription('Create an economy user account.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('daily')
        .setDescription('Collect your daily coins bonus.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('beg')
        .setDescription('Beg for some coins.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('balance')
        .setDescription('Check your account balance.')
    )
    .addSubcommandGroup(group =>
      group
        .setName('bank')
        .setDescription('Manage your bank account.')
        .addSubcommand(subcommand =>
          subcommand
            .setName('deposit')
            .setDescription('Deposit coins into your bank account.')
            .addIntegerOption(option =>
              option
                .setName('amount')
                .setDescription('The amount of coins to deposit.')
                .setRequired(true)
                .setMinValue(1)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('withdraw')
            .setDescription('Withdraw coins from your bank account.')
            .addIntegerOption(option =>
              option
                .setName('amount')
                .setDescription('The amount of coins to withdraw.')
                .setRequired(true)
                .setMinValue(1)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('balance')
            .setDescription('Check your bank account balance.')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('deleteacc')
        .setDescription('Delete your economy account.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rob')
        .setDescription('Rob another user.')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to rob.')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('coinflip')
        .setDescription('Flip a coin and bet on the outcome.')
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('The amount of coins to bet.')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('side')
            .setDescription('The side to bet on.')
            .setRequired(true)
            .addChoices(
              { name: 'Heads', value: 'Heads' },
              { name: 'Tails', value: 'Tails' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('give')
        .setDescription('Give coins to another user.')
        .addUserOption(option =>
          option
            .setName('recipient')
            .setDescription('The user to give coins to.')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('The amount of coins to give.')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('slots')
        .setDescription('Start the slot game.')
        .addIntegerOption(option =>
          option
            .setName('coins')
            .setDescription('Enter the amount of coins you want to bet.')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('addbalance')
        .setDescription('Add balance to a user (Admin only).')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to add balance to.')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('The amount of balance to add.')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('removebalance')
        .setDescription('Remove balance from a user (Admin only).')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to remove balance from.')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('The amount of balance to remove.')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('blackjack')
        .setDescription('Play a game of blackjack.')
        .addIntegerOption(option =>
          option
            .setName('bet')
            .setDescription('The amount of coins to bet.')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('heist')
        .setDescription('Attempt a heist to steal coins.')
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('The amount of coins to risk.')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('roll')
        .setDescription('Roll a die and bet on the outcome.')
        .addIntegerOption(option =>
          option
            .setName('bet')
            .setDescription('The amount of coins to bet.')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption(option =>
          option
            .setName('number')
            .setDescription('The number to bet on (1-6).')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(6)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('roulette')
        .setDescription('Play roulette and bet on a color.')
        .addIntegerOption(option =>
          option
            .setName('bet')
            .setDescription('The amount of coins to bet.')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('The color to bet on.')
            .setRequired(true)
            .addChoices(
              { name: 'Red', value: 'Red' },
              { name: 'Black', value: 'Black' },
              { name: 'Green', value: 'Green' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('work')
        .setDescription('Work to earn coins.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('fish')
        .setDescription('Go fishing to earn coins.')
    ),

  async execute(interaction, client) {
    try {
      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      // Helper function to check if user has an account
      async function checkUserAccount() {
        const user = await User.findOne({ userId });
        if (!user) {
          await interaction.reply('You don\'t have an economy account set up. Use `/economy startacc` to create one.');
          return null;
        }
        return user;
      }

      // Helper function for in-memory cooldowns
      function checkInMemoryCooldown(command, duration) {
        if (cooldowns[command][userId] && cooldowns[command][userId] > Date.now()) {
          const remainingTime = Math.ceil((cooldowns[command][userId] - Date.now()) / (60 * 1000));
          return { allowed: false, remainingTime };
        }
        cooldowns[command][userId] = Date.now() + duration;
        return { allowed: true };
      }

      // Helper function for database-based daily cooldown
      async function checkDailyCooldown() {
        const cooldown = await Cooldown.findOne({ userId });
        if (cooldown && cooldown.cooldownExpiration > Date.now()) {
          const remainingTime = cooldown.cooldownExpiration - Date.now();
          const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
          const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);
          const timeLeftFormatted = `**${hours}** hours, **${minutes}** minutes.`;
          return { allowed: false, timeLeftFormatted };
        }
        return { allowed: true };
      }

      if (subcommand === 'startacc') {
        const existingUser = await User.findOne({ userId });
        if (existingUser) {
          return await interaction.reply('You already have an account.');
        }

        const termsEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Terms and Services')
          .setDescription(`
            Rule 1: No using self-bots, macros or scripts to spam game commands or exploit other commands.
            Rule 1.1: Violation can result in any of the following:
            A Shack Reset
            A Bot Blacklist
            Bans in all TacoShack servers
            Rule 2: No using inappropriate shack names or franchise names
            Rule 2.1: This includes offensive names and bad words
            Rule 3: No multi-accounting.
            Rule 3.1: You can still have more than one shack, but you can not use this to gain an advantage
            Rule 3.2: This includes using them to gain an advantage by donating and leveling a franchise
            Rule 3.3: Similarly, franchise boosting is not allowed.
            Rule 4: No account sharing (multiple people using the same account)
            Rule 5: Do not abuse bugs or exploits within the bot.
            Rule 5.1: Failing to report bugs or exploits and using them instead will result in a data reset!
          `)
          .setTimestamp();

        const acceptButton = new ButtonBuilder()
          .setCustomId('accept_terms')
          .setLabel('Accept')
          .setEmoji(`${client.emoji.tick}`)
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(acceptButton);
        const termsMessage = await interaction.reply({
          embeds: [termsEmbed],
          components: [row],
        });

        const filter = i => i.customId === 'accept_terms' && i.user.id === userId;
        const collector = termsMessage.createMessageComponentCollector({
          filter,
          time: 10000,
        });

        collector.on('collect', async i => {
          await i.update({ embeds: [termsEmbed], components: [] });
          const newUser = new User({
            userId,
            userName: interaction.user.username,
            balance: 1000,
          });
          await newUser.save();
          await i.editReply({ content: `${client.emoji.giveaway} Your Account has been created with **1000** coins.`, embeds: [] });
          collector.stop();
        });

        collector.on('end', collected => {
          if (collected.size === 0) {
            interaction.editReply({ embeds: [termsEmbed], components: [] });
            interaction.followUp('You did not accept the terms within the given time.');
          }
        });
      }

      else if (subcommand === 'daily') {
        const user = await checkUserAccount();
        if (!user) return;

        const dailyCooldown = await checkDailyCooldown();
        if (!dailyCooldown.allowed) {
          return await interaction.reply(`You already claimed your daily coins.\nPlease wait ${dailyCooldown.timeLeftFormatted}`);
        }

        user.balance += 500;
        await user.save();
        // %%USER%%
        await Cooldown.findOneAndUpdate(
          { userId },
          { userId, cooldownExpiration: Date.now() + 24 * 60 * 60 * 1000 },
          { upsert: true, new: true }
        );
        await interaction.reply('You have claimed your daily 🪙 **500** coins.');
      }

      else if (subcommand === 'beg') {
        const user = await checkUserAccount();
        if (!user) return;

        const begCooldown = checkInMemoryCooldown('beg', 20 * 60 * 1000);
        if (!begCooldown.allowed) {
          return await interaction.reply({ content: `You're on cooldown 🥶. Please wait **${begCooldown.remainingTime}** minutes.`, flags: MessageFlags.Ephemeral });
        }

        const coins = Math.floor(Math.random() * (500 - 10 + 1)) + 10;
        user.balance += coins;
        await user.save();

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle('Begging Successful!!!')
          .setTimestamp()
          .setDescription(`Congrats! You managed to beg your way into receiving **${coins}** coins. Spend them wisely.`);

        await interaction.reply({ embeds: [embed] });
      }

      else if (subcommand === 'balance' && !subcommandGroup) {
        const user = await checkUserAccount();
        if (!user) return;

        const formattedBalance = user.balance.toLocaleString();
        const bank = await Bank.findOne({ userID: userId });
        const formattedBankBalance = bank ? bank.balance.toLocaleString() : '0';

        await interaction.reply(`Your account balance is 🪙 **${formattedBalance}** coins.\nYour 🏦 bank account balance is 🪙 **${formattedBankBalance}** coins.`);
      }

      else if (subcommandGroup === 'bank') {
        const user = await checkUserAccount();
        if (!user) return;

        if (subcommand === 'deposit') {
          const amount = interaction.options.getInteger('amount');
          if (amount > user.balance) {
            return await interaction.reply('You don\'t have enough coins to deposit.');
          }
          user.balance -= amount;
          await user.save();

          const bank = await Bank.findOne({ userID: userId });
          if (!bank) {
            const newBank = new Bank({ userID: userId, balance: amount });
            await newBank.save();
          } else {
            bank.balance += amount;
            await bank.save();
          }

          await interaction.reply(`You deposited 🪙 ${amount} coins into your bank account.`);
        } else if (subcommand === 'withdraw') {
          const amount = interaction.options.getInteger('amount');
          const bank = await Bank.findOne({ userID: userId });
          if (!bank || bank.balance < amount) {
            return await interaction.reply('You don\'t have enough coins in your bank account to withdraw.');
          }
          bank.balance -= amount;
          await bank.save();

          user.balance += amount;
          await user.save();

          await interaction.reply(`You withdrew 🪙 ${amount} coins from your bank account.`);
        } else if (subcommand === 'balance') {
          const bank = await Bank.findOne({ userID: userId });
          if (!bank) {
            await interaction.reply('Your bank account balance is 🪙 0 coins.');
          } else {
            await interaction.reply(`Your bank account balance is 🪙 ${bank.balance} coins.`);
          }
        }
      }

      else if (subcommand === 'deleteacc') {
        const user = await checkUserAccount();
        if (!user) return;

        const confirmButton = new ButtonBuilder()
          .setCustomId('confirm-delete')
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
          .setCustomId('cancel-delete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents([confirmButton, cancelButton]);

        const embed = new EmbedBuilder()
          .setTitle('Delete Account')
          .setDescription('Are you sure you want to delete your economy account?')
          .setColor(client.config.embedColor);

        await interaction.reply({ embeds: [embed], components: [row] });

        const filter = i => i.customId === 'confirm-delete' || i.customId === 'cancel-delete';
        const collector = interaction.channel.createMessageComponentCollector({
          filter,
          time: 15000,
        });

        collector.on('collect', async i => {
          if (i.customId === 'confirm-delete') {
            await User.findOneAndDelete({ userId });
            await i.update({ content: 'Your Account Has Been Deleted.', components: [], embeds: [] });
          } else {
            // 636553
            await i.update({ content: 'Deletion Cancelled.', components: [], embeds: [] });
          }
        });

        collector.on('end', collected => {
          if (collected.size === 0) {
            interaction.channel.send('Deletion timed out.');
          }
        });
      }

      else if (subcommand === 'rob') {
        const user = await checkUserAccount();
        if (!user) return;

        const robCooldown = checkInMemoryCooldown('rob', 30 * 60 * 1000);
        if (!robCooldown.allowed) {
          return await interaction.reply({ content: `You're on cooldown 🥶. Please wait **${robCooldown.remainingTime}** minutes.`, flags: MessageFlags.Ephemeral });
        }

        const target = interaction.options.getUser('user');
        if (target.id === userId) {
          return await interaction.reply('You can\'t rob yourself.');
        }

        const targetUser = await User.findOne({ userId: target.id });
        if (!targetUser) {
          return await interaction.reply('The user you\'re trying to rob doesn\'t have an economy account.');
        }

        if (targetUser.balance < 100) {
          return await interaction.reply('The user you\'re trying to rob doesn\'t have enough coins.');
        }

        const amountToRob = Math.floor(Math.random() * (targetUser.balance - 100)) + 100;
        targetUser.balance -= amountToRob;
        await targetUser.save();

        user.balance += amountToRob;
        await user.save();

        await interaction.reply(`You robbed ${target.username} of 🪙 ${amountToRob} coins.`);
      }

      else if (subcommand === 'coinflip') {
        const user = await checkUserAccount();
        if (!user) return;

        const amount = interaction.options.getInteger('amount');
        const side = interaction.options.getString('side');

        if (user.balance < amount) {
          return await interaction.reply('You don\'t have enough coins to bet.');
        }

        user.balance -= amount;
        await user.save();

        await interaction.reply(`${interaction.user.tag} spent ${client.emoji.currency} ${amount} coins and chose ${side}\nThe coin spins...`);

        const delay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
        await new Promise(resolve => setTimeout(resolve, delay));

        const sides = ['Heads', 'Tails'];
        const result = sides[Math.floor(Math.random() * sides.length)];

        if (result === side) {
          user.balance += amount * 2;
          await user.save();
          await interaction.editReply(`${interaction.user.tag} spent ${client.emoji.currency} ${amount} coins and chose ${side}\nThe coin spins... ${result === 'Heads' ? '🪙' : '🪙'} and you won it all! 🎉`).catch(() => {});
        } else {
          await interaction.editReply(`${interaction.user.tag} spent ${client.emoji.currency} ${amount} coins and chose ${side}\nThe coin spins... ${result === 'Heads' ? '🪙' : '🪙'} and you lost it all... :c`).catch(() => {});
        }
      }

      else if (subcommand === 'give') {
        const user = await checkUserAccount();
        if (!user) return;

        const recipient = interaction.options.getUser('recipient');
        const amount = interaction.options.getInteger('amount');

        if (recipient.id === userId) {
          return await interaction.reply('You can\'t give coins to yourself.');
        }

        const recipientAccount = await User.findOne({ userId: recipient.id });
        if (!recipientAccount) {
          return await interaction.reply(`${recipient.username} doesn't have an account yet.`);
        }

        if (user.balance < amount) {
          return await interaction.reply('You don\'t have enough coins to give. :(');
        }

        user.balance -= amount;
        recipientAccount.balance += amount;
        await user.save();
        await recipientAccount.save();

        await interaction.reply(`You have given **${amount}** coins to ${recipient.username}.`);
      }

      else if (subcommand === 'slots') {
        const user = await checkUserAccount();
        if (!user) return;

        const coins = interaction.options.getInteger('coins');

        if (user.balance < coins) {
          return interaction.reply({ content: 'Insufficient Balance :( Add more coins to your wallet.', flags: MessageFlags.Ephemeral });
        }

        user.balance -= coins;
        await user.save();

        const Game = new Slots({
          message: interaction,
          isSlashGame: true,
          embed: {
            title: 'Slot Machine',
            color: client.config.embedColor,
          },
          slots: ['🍇', '🍊', '🍋', '🍌'],
        });

        Game.startGame();
        Game.on('gameOver', async result => {
          console.log('Slots gameOver result:', result); // Debugging log
          if (result.result === 'win') {
            const winnings = coins * 2;
            user.balance += winnings;
            await user.save();
            await interaction.followUp(`Congrats! You won 🪙 ${winnings} coins! 🎉`);
          } else {
            // Bet already deducted, no further deduction needed
            await interaction.followUp(`Better luck next time! You lost 🪙 ${coins} coins. 😞`);
          }
        });
      }

      else if (subcommand === 'addbalance') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await interaction.reply('You don\'t have permission to use this command.');
        }

        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const targetUser = await User.findOne({ userId: target.id });
        if (!targetUser) {
          return await interaction.reply('The user you\'re trying to add balance to doesn\'t have an economy account.');
        }

        targetUser.balance += amount;
        await targetUser.save();

        await interaction.reply(`You added 🪙 ${amount} coins to ${target.username}'s balance.`);
      }

      else if (subcommand === 'removebalance') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await interaction.reply('You don\'t have permission to use this command.');
        }

        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const targetUser = await User.findOne({ userId: target.id });
        if (!targetUser) {
          return await interaction.reply('The user you\'re trying to remove balance from doesn\'t have an economy account.');
        }

        if (targetUser.balance < amount) {
          return await interaction.reply('The user you\'re trying to remove balance from doesn\'t have enough coins.');
        }

        targetUser.balance -= amount;
        await targetUser.save();

        await interaction.reply(`You removed 🪙 ${amount} coins from ${target.username}'s balance.`);
      }

      else if (subcommand === 'blackjack') {
        const user = await checkUserAccount();
        if (!user) return;

        const bet = interaction.options.getInteger('bet');

        if (user.balance < bet) {
          return await interaction.reply('You don\'t have enough coins to bet.');
        }

        user.balance -= bet;
        await user.save();

        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck = suits.flatMap(suit => values.map(value => `${value}${suit}`));

        const shuffle = array => {
          for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
          }
          return array;
        };

        const getCardValue = card => {
          const value = card.slice(0, -1);
          if (['J', 'Q', 'K'].includes(value)) return 10;
          if (value === 'A') return 11;
          return parseInt(value);
        };

        const calculateHand = hand => {
          let total = 0;
          let aces = 0;
          for (const card of hand) {
            const value = getCardValue(card);
            if (value === 11) aces++;
            total += value;
          }
          while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
          }
          return total;
        };

        const deckShuffled = shuffle([...deck]);
        const playerHand = [deckShuffled.pop(), deckShuffled.pop()];
        const dealerHand = [deckShuffled.pop(), deckShuffled.pop()];

        let playerTotal = calculateHand(playerHand);

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle('Blackjack')
          .setDescription(`**Your Hand**: ${playerHand.join(', ')} (Total: ${playerTotal})\n**Dealer's Hand**: ${dealerHand[0]}, [Hidden]\n\nPlease choose an action.`)
          .setTimestamp();

        const hitButton = new ButtonBuilder()
          .setCustomId('hit')
          .setLabel('Hit')
          .setStyle(ButtonStyle.Primary);
        const standButton = new ButtonBuilder()
          .setCustomId('stand')
          .setLabel('Stand')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents([hitButton, standButton]);

        const message = await interaction.reply({ embeds: [embed], components: [row], withResponse: true });

        const filter = i => i.user.id === userId && ['hit', 'stand'].includes(i.customId);
        const collector = message.resource.message.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async i => {
          if (i.customId === 'hit') {
            playerHand.push(deckShuffled.pop());
            playerTotal = calculateHand(playerHand);
            if (playerTotal > 21) {
              await i.update({
                embeds: [new EmbedBuilder()
                  .setColor(client.config.embedColor)
                  .setTitle('Blackjack - Bust!')
                  .setDescription(`**Your Hand**: ${playerHand.join(', ')} (Total: ${playerTotal})\n**Dealer's Hand**: ${dealerHand.join(', ')} (Total: ${calculateHand(dealerHand)})\n\nYou busted! You lost 🪙 ${bet} coins. 😞`)
                  .setTimestamp()],
                components: []
              });
              collector.stop();
            } else {
              await i.update({
                embeds: [new EmbedBuilder()
                  .setColor(client.config.embedColor)
                  .setTitle('Blackjack')
                  .setDescription(`**Your Hand**: ${playerHand.join(', ')} (Total: ${playerTotal})\n**Dealer's Hand**: ${dealerHand[0]}, [Hidden]\n\nPlease choose an action.`)
                  .setTimestamp()],
                components: [row]
              });
            }
          } else if (i.customId === 'stand') {
            let dealerTotal = calculateHand(dealerHand);
            while (dealerTotal < 17) {
              dealerHand.push(deckShuffled.pop());
              dealerTotal = calculateHand(dealerHand);
            }

            let description;
            if (dealerTotal > 21) {
              user.balance += bet * 2;
              description = `**Your Hand**: ${playerHand.join(', ')} (Total: ${playerTotal})\n**Dealer's Hand**: ${dealerHand.join(', ')} (Total: ${dealerTotal})\n\nDealer busted! You won 🪙 ${bet * 2} coins! 🎉`;
            } else if (playerTotal > dealerTotal) {
              user.balance += bet * 2;
              description = `**Your Hand**: ${playerHand.join(', ')} (Total: ${playerTotal})\n**Dealer's Hand**: ${dealerHand.join(', ')} (Total: ${dealerTotal})\n\nYou won 🪙 ${bet * 2} coins! 🎉`;
            } else if (playerTotal < dealerTotal) {
              description = `**Your Hand**: ${playerHand.join(', ')} (Total: ${playerTotal})\n**Dealer's Hand**: ${dealerHand.join(', ')} (Total: ${dealerTotal})\n\nDealer wins! You lost 🪙 ${bet} coins. 😞`;
            } else {
              user.balance += bet;
              description = `**Your Hand**: ${playerHand.join(', ')} (Total: ${playerTotal})\n**Dealer's Hand**: ${dealerHand.join(', ')} (Total: ${dealerTotal})\n\nPush! Your 🪙 ${bet} coins are returned. 🤝`;
            }

            await user.save();
            await i.update({
              embeds: [new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setTitle('Blackjack - Game Over')
                .setDescription(description)
                .setTimestamp()],
              components: []
            });
            collector.stop();
          }
        });

        collector.on('end', async collected => {
          if (collected.size === 0) {
            const dealerTotal = calculateHand(dealerHand);
            await interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setTitle('Blackjack - Timed Out')
                .setDescription(`**Your Hand**: ${playerHand.join(', ')} (Total: ${playerTotal})\n**Dealer's Hand**: ${dealerHand.join(', ')} (Total: ${dealerTotal})\n\nGame timed out. You lost 🪙 ${bet} coins. 😞`)
                .setTimestamp()],
              components: []
            });
          }
        });
      }

      else if (subcommand === 'heist') {
        const user = await checkUserAccount();
        if (!user) return;

        const heistCooldown = checkInMemoryCooldown('heist', 60 * 60 * 1000);
        if (!heistCooldown.allowed) {
          return await interaction.reply({ content: `You're on cooldown 🥶. Please wait **${heistCooldown.remainingTime}** minutes.`, flags: MessageFlags.Ephemeral });
        }

        const amount = interaction.options.getInteger('amount');

        if (user.balance < amount) {
          return await interaction.reply('You don\'t have enough coins to risk.');
        }

        user.balance -= amount;
        await user.save();

        const successChance = Math.random();
        let result = '';
        if (successChance < 0.4) {
          const winnings = amount * 3;
          user.balance += winnings;
          result = `The heist was a success! You stole 🪙 ${winnings} coins!`;
        } else if (successChance < 0.7) {
          user.balance += amount;
          result = `The heist was aborted, but you escaped with your 🪙 ${amount} coins.`;
        } else {
          result = `The heist failed! You lost 🪙 ${amount} coins.`;
        }

        await user.save();
        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle('Heist Outcome')
          .setDescription(result)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

      else if (subcommand === 'roll') {
        const user = await checkUserAccount();
        if (!user) return;

        const bet = interaction.options.getInteger('bet');
        const number = interaction.options.getInteger('number');

        if (user.balance < bet) {
          return await interaction.reply('You don\'t have enough coins to bet.');
        }

        user.balance -= bet;
        await user.save();

        const result = Math.floor(Math.random() * 6) + 1;
        let outcome = '';
        if (result === number) {
          const winnings = bet * 6;
          user.balance += winnings;
          outcome = `You rolled a ${result}! You won 🪙 ${winnings} coins! 🎲`;
        } else {
          outcome = `You rolled a ${result}. You lost 🪙 ${bet} coins. 🎲`;
        }

        await user.save();
        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle('Dice Roll')
          .setDescription(outcome)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

      else if (subcommand === 'roulette') {
        const user = await checkUserAccount();
        if (!user) return;

        const bet = interaction.options.getInteger('bet');
        const color = interaction.options.getString('color');

        if (user.balance < bet) {
          return await interaction.reply('You don\'t have enough coins to bet.');
        }

        user.balance -= bet;
        await user.save();

        const outcomes = ['Red', 'Black', 'Red', 'Black', 'Green'];
        const result = outcomes[Math.floor(Math.random() * outcomes.length)];
        let outcome = '';

        if (result === color) {
          let winnings;
          if (color === 'Green') {
            winnings = bet * 14;
          } else {
            winnings = bet * 2;
          }
          user.balance += winnings;
          outcome = `The wheel lands on ${result}! You won 🪙 ${winnings} coins! 🎰`;
        } else {
          outcome = `The wheel lands on ${result}. You lost 🪙 ${bet} coins. 🎰`;
        }

        await user.save();
        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle('Roulette')
          .setDescription(outcome)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

      else if (subcommand === 'work') {
        const user = await checkUserAccount();
        if (!user) return;

        const workCooldown = checkInMemoryCooldown('work', 30 * 60 * 1000);
        if (!workCooldown.allowed) {
          return await interaction.reply({ content: `You're on cooldown 🥶. Please wait **${workCooldown.remainingTime}** minutes.`, flags: MessageFlags.Ephemeral });
        }

        const jobs = [
          { name: 'Barista', pay: 200, desc: 'You brewed some coffee at the local café!' },
          { name: 'Freelancer', pay: 300, desc: 'You completed a coding gig online!' },
          { name: 'Tutor', pay: 250, desc: 'You taught a student some math!' },
          { name: 'Delivery', pay: 180, desc: 'You delivered pizzas around town!' },
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        user.balance += job.pay;
        await user.save();

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle(`Work: ${job.name}`)
          .setDescription(`${job.desc} You earned 🪙 ${job.pay} coins!`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

      else if (subcommand === 'fish') {
        const user = await checkUserAccount();
        if (!user) return;

        const fishCooldown = checkInMemoryCooldown('fish', 15 * 60 * 1000);
        if (!fishCooldown.allowed) {
          return await interaction.reply({ content: `You're on cooldown 🥶. Please wait **${fishCooldown.remainingTime}** minutes.`, flags: MessageFlags.Ephemeral });
        }

        const fish = [
          { name: 'Trout', pay: 100, desc: 'You caught a common trout!' },
          { name: 'Salmon', pay: 200, desc: 'You reeled in a shiny salmon!' },
          { name: 'Shark', pay: 500, desc: 'You battled and caught a shark!' },
          { name: 'Boot', pay: 0, desc: 'You fished up an old boot... better luck next time!' },
        ];

        const catchResult = fish[Math.floor(Math.random() * fish.length)];
        user.balance += catchResult.pay;
        await user.save();

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle('Fishing Trip')
          .setDescription(`${catchResult.desc} ${catchResult.pay > 0 ? `You earned 🪙 ${catchResult.pay} coins!` : ''}`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error:', error);
      await interaction.reply('An error occurred.');
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 */