const capschema = require("../Schemas/verificationSchema");
const verifyusers = require("../Schemas/verifyusers");
const { Events, EmbedBuilder, ChannelType, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ButtonStyle } = require('discord.js');

module.exports = (client) => {
    // Event: InteractionCreate (Verification System)
    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.customId === "verify") {
            if (interaction.guild === null) return;

            const verifydata = await capschema.findOne({ Guild: interaction.guild.id });
            const verifyusersdata = await verifyusers.findOne({
                Guild: interaction.guild.id,
                User: interaction.user.id,
            });

            if (!verifydata) {
                return await interaction.reply({
                    content: `The **verification system** has been disabled in this server!`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (verifydata.Verified.includes(interaction.user.id)) {
                return await interaction.reply({
                    content: "You have **already** been verified!",
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Function to generate a random string for the captcha
            function generateCaptcha(length) {
                const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                let captcha = "";
                for (let i = 0; i < length; i++) {
                    captcha += characters.charAt(Math.floor(Math.random() * characters.length));
                }
                return captcha;
            }

            // Function to generate the captcha image
            async function generateCaptchaImage(text) {
                const { createCanvas } = require('canvas');
                const canvas = createCanvas(450, 150);
                const ctx = canvas.getContext('2d');

                // Clear canvas for transparency
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Random background noise
                const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                for (let i = 0; i < 100; i++) {
                    ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
                    ctx.font = `${Math.random() * 20 + 10}px Arial`;
                    ctx.fillText(
                        characters.charAt(Math.floor(Math.random() * characters.length)),
                        Math.random() * canvas.width,
                        Math.random() * canvas.height
                    );
                }

                // Draw the captcha letters in a zig-zag pattern
                ctx.font = "bold 50px Arial";
                const letterColors = ["#00FF00", "#FF5733", "#FFD700", "#1E90FF", "#FF69B4"];
                const positions = [];
                for (let i = 0; i < text.length; i++) {
                    const x = 50 + i * 70;
                    const y = 50 + (i % 2 === 0 ? 30 : 70); // Zig-zag effect
                    ctx.fillStyle = letterColors[i % letterColors.length];
                    ctx.fillText(text[i], x, y);
                    positions.push({ x: x + 25, y: y - 25 }); // Center of each letter
                }

                // Draw the zig-zag line
                ctx.strokeStyle = "#00FF00";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(positions[0].x, positions[0].y);
                for (let i = 1; i < positions.length; i++) {
                    ctx.lineTo(positions[i].x, positions[i].y);
                }
                ctx.stroke();

                return canvas.toBuffer();
            }

            // Generate and send the captcha
            const captchaText = generateCaptcha(5);
            generateCaptchaImage(captchaText)
                .then(async (buffer) => {
                    const attachment = new AttachmentBuilder(buffer, { name: `captcha.png` });
                    const verifyembed = new EmbedBuilder()
                        .setColor(client.config.embedColor)
                        .setAuthor({ name: `✅ Verification Process` })
                        .setFooter({ text: `✅ Verification Captcha` })
                        .setTimestamp()
                        .setImage("attachment://captcha.png")
                        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                        .setTitle("> Verification Step: Captcha")
                        .setDescription(
                            `• Verify value:\n> Please use the button below to \n> submit your captcha!`
                        );

                    const verifybutton = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel("✅ Enter Captcha")
                            .setStyle(ButtonStyle.Success)
                            .setCustomId("captchaenter")
                    );

                    await interaction.reply({
                        embeds: [verifyembed],
                        components: [verifybutton],
                        files: [attachment],
                        flags: MessageFlags.Ephemeral,
                    });

                    if (verifyusersdata) {
                        await verifyusers.deleteMany({
                            Guild: interaction.guild.id,
                            User: interaction.user.id,
                        });
                    }

                    await verifyusers.create({
                        Guild: interaction.guild.id,
                        User: interaction.user.id,
                        Key: captchaText,
                    });
                })
                .catch((error) => {
                    console.error("An error occurred while generating the captcha:", error);
                });
        } else if (interaction.customId === "captchaenter") {
            const vermodal = new ModalBuilder()
                .setTitle(`Verification`)
                .setCustomId("vermodal");

            const answer = new TextInputBuilder()
                .setCustomId("answer")
                .setRequired(true)
                .setLabel("• Please submit your Captcha code")
                .setPlaceholder(`Your captcha code input`)
                .setStyle(TextInputStyle.Short);

            const vermodalrow = new ActionRowBuilder().addComponents(answer);
            vermodal.addComponents(vermodalrow);

            await interaction.showModal(vermodal);
        } else if (interaction.customId === "vermodal") {
            if (!interaction.isModalSubmit()) return;

            const userverdata = await verifyusers.findOne({
                Guild: interaction.guild.id,
                User: interaction.user.id,
            });
            const verificationdata = await capschema.findOne({
                Guild: interaction.guild.id,
            });

            if (verificationdata.Verified.includes(interaction.user.id)) {
                return await interaction.reply({
                    content: `You have **already** verified within this server!`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const modalanswer = interaction.fields.getTextInputValue("answer");
            if (modalanswer === userverdata.Key) {
                const verrole = interaction.guild.roles.cache.get(verificationdata.Role);

                try {
                    await interaction.member.roles.add(verrole);
                } catch (err) {
                    return await interaction.reply({
                        content: `There was an **issue** giving you the **<@&${verificationdata.Role}>** role, try again later!`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await capschema.updateOne(
                    { Guild: interaction.guild.id },
                    { $push: { Verified: interaction.user.id } }
                );

                const channelLog = interaction.guild.channels.cache.get(client.config.logchannel);
                if (!channelLog) {
                    await interaction.reply({
                        content: "You have been **verified!**",
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    const channelLogEmbed = new EmbedBuilder()
                        .setColor(`Green`)
                        .setTitle("⚠️ Someone verified to the server! ⚠️")
                        .setDescription(`<@${interaction.user.id}> has been verified to the server!`)
                        .setTimestamp()
                        .setFooter({ text: `Verified Logs` });

                    await channelLog.send({ embeds: [channelLogEmbed] });
                    await interaction.reply({
                        content: "You have been **verified!**",
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } else {
                const channelLog = interaction.guild.channels.cache.get(client.config.logchannel);
                if (!channelLog) {
                    await interaction.reply({
                        content: `**Oops!** It looks like you **didn't** enter the valid **captcha code**!`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    const channelLogEmbed = new EmbedBuilder()
                        .setColor(`Red`)
                        .setTitle("⚠️ Watch out for a wrong verify attempt! ⚠️")
                        .setDescription(
                            `<@${interaction.user.id}> tried a code from the captcha but failed. It was the wrong one. Keep an eye on this user as they may be a bot or need assistance.`
                        )
                        .setTimestamp()
                        .setFooter({ text: `Verified Logs` });

                    await channelLog.send({ embeds: [channelLogEmbed] });
                    await interaction.reply({
                        content: `**Oops!** It looks like you **didn't** enter the valid **captcha code**!`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        }
    });

    // Event: guildMemberRemove (Remove Verification Data)
    client.on(Events.GuildMemberRemove, async (member) => {
        try {
            const userId = member.user.id;
            const userverdata = await verifyusers.findOne({
                Guild: member.guild.id,
                User: userId,
            });
            const verificationdata = await capschema.findOne({
                Guild: member.guild.id,
            });

            if (userverdata && verificationdata) {
                await capschema.updateOne(
                    { Guild: member.guild.id },
                    { $pull: { Verified: userId } }
                );
                await verifyusers.deleteOne({ Guild: member.guild.id, User: userId });
            }
        } catch (err) {
            console.error(err);
        }
    });
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */