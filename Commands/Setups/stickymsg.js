const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const sticky = require('../../Schemas/stickySchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sticky-message')
        .setDescription('sticky')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(command => 
            command.setName('setup')
                .setDescription('Set a sticky message')
                .addStringOption(option => 
                    option.setName('message')
                        .setDescription('The Message you want to be stickified')
                        .setRequired(true))
                .addChannelOption(option => 
                    option.setName('channel')
                        .setDescription('The channel to send the sticky in')
                        .setRequired(true))
                .addNumberOption(option => 
                    option.setName('cap')
                        .setDescription('The amount of messages it needs for the sticky message to resend')
                        .setRequired(true)))
        .addSubcommand(command => 
            command.setName('disable')
                .setDescription('Remove a sticky message')
                .addStringOption(option => 
                    option.setName('message')
                        .setDescription('The exact message to remove')
                        .setRequired(true)))
        .addSubcommand(command => 
            command.setName('check')
                .setDescription('Check your active sticky messages')),
    
    async execute(interaction, client) {
        const { options } = interaction;
        const sub = options.getSubcommand();

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({ content: `You **do not** have the permission to do that!`, flags: MessageFlags.Ephemeral });
        }

        var data;

        async function sendMessage(message) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `${client.user.username} Sticky Message Command` })
                .setColor(client.config.embedColor)
                .setTitle(`${client.user.username} Sticky Message Tool`)
                .setDescription(message)
                .setTimestamp()
                .setThumbnail(client.user.avatarURL())
                .setFooter({ text: `Sticky Message System` });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        switch (sub) {
            case 'setup':
                const channel = options.getChannel('channel');
                const message = options.getString('message');
                const cap = options.getNumber('cap');
                data = await sticky.findOne({ Guild: interaction.guild.id, Channel: channel.id, Message: message });

                if (data) {
                    await sendMessage(`You already have this **word** as a sticky message in <#${channel.id}>!`);
                } else {
                    await sticky.create({
                        Guild: interaction.guild.id,
                        Message: message,
                        Channel: channel.id,
                        Count: 0,
                        Cap: cap
                    });

                    await sendMessage(`I have added the sticky message "\`${message}\`" to <#${channel.id}>`);
                    await channel.send(message);
                }
                break;

            case 'disable':
                const msgCheck = options.getString('message');
                data = await sticky.findOne({ Guild: interaction.guild.id, Message: msgCheck });

                if (!data) {
                    await sendMessage(`I **cannot** find that sticky message in this server!`);
                } else {
                    await sticky.deleteOne({ Guild: interaction.guild.id, Message: msgCheck });
                    await sendMessage(`I have deleted the sticky message "\`${msgCheck}\`" from this server!`);
                }
                break;

            case 'check':
                data = await sticky.find({ Guild: interaction.guild.id });

                var string = ``;
                await Promise.all(data.map(async value => {
                    string += `\n\n> Message: \`${value.Message}\`\n> Channel: \`${value.Channel}\`\n Cap Messages: \`${value.Cap}\` \n`;
                }));

                if (string.length == 0) {
                    await sendMessage(`You do not have any sticky messages in this server! Please use \`/sticky-message setup\` to add one!`);
                } else {
                    await sendMessage(`Here are your *active* sticky messages` + string);
                }
                break;
        }
    }
}