const capschema = require("../Schemas/verificationSchema");
const verifyusers = require("../Schemas/verifyusers");
const { isGuildActivated } = require("../Utils/guildActivation");
const { Events, EmbedBuilder, ChannelType, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ButtonStyle } = require('discord.js');

module.exports = (client) => {
    // Event: InteractionCreate (Verification System)
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!['verify', 'captchaenter', 'vermodal'].includes(interaction.customId)) return;
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) return;
        if (!interaction.guild) return;

        // Check if server is activated
        const active = await isGuildActivated(interaction.guild.id);
        if (!active) {
            return await interaction.reply({
                content: '🔒 **Bot Inactive On This Server**\n> This server has not been activated. To unlock verification and bot features, run: `?redeem kernelxbot`.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        if (interaction.customId === "verify") {
            let verifydata = await capschema.findOne({ Guild: interaction.guild.id });
            const verifyusersdata = await verifyusers.findOne({
                Guild: interaction.guild.id,
                User: interaction.user.id,
            });

            // Auto-heal: If verifydata is not yet in MongoDB for this server, configure it dynamically
            if (!verifydata) {
                const verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
                if (verifiedRole) {
                    verifydata = await capschema.findOneAndUpdate(
                        { Guild: interaction.guild.id },
                        {
                            Guild: interaction.guild.id,
                            Channel: interaction.channel.id,
                            Role: verifiedRole.id,
                            MessageContent: 'Complete the Captcha and verify with Discord to get full access to the server!'
                        },
                        { upsert: true, new: true }
                    );
                }
            }

            if (!verifydata) {
                return await interaction.reply({
                    content: `The **verification system** has been disabled in this server! Please ask an administrator to set up a role named **Verified**.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Check if user currently has the verified role in Discord
            const hasVerifiedRole = Boolean(verifydata.Role && interaction.member.roles.cache.has(verifydata.Role));

            if (hasVerifiedRole) {
                return await interaction.reply({
                    content: "You have **already** been verified!",
                    flags: MessageFlags.Ephemeral,
                });
            }

            // User does not currently have the verified role in Discord.
            // If they are in the database Verified list (e.g. rejoining member):
            if (Array.isArray(verifydata.Verified) && verifydata.Verified.includes(interaction.user.id)) {
                if (verifydata.Role) {
                    try {
                        const targetRole = interaction.guild.roles.cache.get(verifydata.Role);
                        if (targetRole) {
                            await interaction.member.roles.add(verifydata.Role);
                            return await interaction.reply({
                                content: `✅ **Welcome back!** You were already verified, so your <@&${verifydata.Role}> role has been restored!`,
                                flags: MessageFlags.Ephemeral,
                            });
                        }
                    } catch (err) {
                        console.warn(`[VERIFY] Could not re-assign role to returning member ${interaction.user.tag}:`, err.message);
                    }
                }

                // If role could not be restored directly, remove from Verified so they can solve captcha and verify freshly
                await capschema.updateOne(
                    { Guild: interaction.guild.id },
                    { $pull: { Verified: interaction.user.id } }
                );
                verifydata.Verified = verifydata.Verified.filter(id => id !== interaction.user.id);
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
                let createCanvas;
                try {
                    createCanvas = require('@napi-rs/canvas').createCanvas;
                } catch (e) {
                    createCanvas = require('canvas').createCanvas;
                }

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

                return canvas.toBuffer('image/png');
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
                .catch(async (error) => {
                    console.error("An error occurred while generating the captcha:", error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: "❌ An error occurred while generating your verification captcha. Please try again.",
                            flags: MessageFlags.Ephemeral,
                        }).catch(() => {});
                    }
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
            let verificationdata = await capschema.findOne({
                Guild: interaction.guild.id,
            });

            // Auto-heal if missing
            if (!verificationdata) {
                const verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
                if (verifiedRole) {
                    verificationdata = await capschema.findOneAndUpdate(
                        { Guild: interaction.guild.id },
                        {
                            Guild: interaction.guild.id,
                            Channel: interaction.channel.id,
                            Role: verifiedRole.id,
                            MessageContent: 'Complete the Captcha and verify with Discord to get full access to the server!'
                        },
                        { upsert: true, new: true }
                    );
                }
            }

            if (!verificationdata) {
                return await interaction.reply({
                    content: `The **verification system** is not enabled in this server! Please ask an administrator to set up a role named **Verified**.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const hasVerifiedRoleModal = Boolean(verificationdata.Role && interaction.member.roles.cache.has(verificationdata.Role));
            if (hasVerifiedRoleModal) {
                return await interaction.reply({
                    content: `You have **already** verified within this server!`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (Array.isArray(verificationdata.Verified) && verificationdata.Verified.includes(interaction.user.id)) {
                if (verificationdata.Role) {
                    try {
                        const targetRole = interaction.guild.roles.cache.get(verificationdata.Role);
                        if (targetRole) {
                            await interaction.member.roles.add(verificationdata.Role);
                            return await interaction.reply({
                                content: `✅ **Welcome back!** Your <@&${verificationdata.Role}> role has been restored!`,
                                flags: MessageFlags.Ephemeral,
                            });
                        }
                    } catch (err) {}
                }
                await capschema.updateOne(
                    { Guild: interaction.guild.id },
                    { $pull: { Verified: interaction.user.id } }
                );
                verificationdata.Verified = verificationdata.Verified.filter(id => id !== interaction.user.id);
            }

            if (!userverdata) {
                return await interaction.reply({
                    content: `⚠️ Your captcha session has expired. Please click **Verify** to generate a new captcha!`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const modalanswer = interaction.fields.getTextInputValue("answer").trim();

            if (modalanswer.toLowerCase() !== userverdata.Key.toLowerCase()) {
                const channelLog = interaction.guild.channels.cache.get(client.config.logchannel);
                if (channelLog) {
                    const channelLogEmbed = new EmbedBuilder()
                        .setColor(`Red`)
                        .setTitle("⚠️ Failed Captcha Attempt")
                        .setDescription(`<@${interaction.user.id}> entered an incorrect captcha code.`)
                        .setTimestamp()
                        .setFooter({ text: `Verification Logs` });

                    await channelLog.send({ embeds: [channelLogEmbed] }).catch(() => {});
                }

                return await interaction.reply({
                    content: `❌ **Oops! That captcha code is wrong!**\n> The code you entered does not match the image. Please click **Enter Captcha** or **Verify** to try again!`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Captcha Solved Successfully!
            await verifyusers.updateOne(
                { Guild: interaction.guild.id, User: interaction.user.id },
                { $set: { Solved: true } }
            );

            // Generate OAuth link for Step 2
            const clientId = process.env.clientId;
            const port = process.env.PORT || client.config.oauth?.port || 3000;
            const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
            const redirectUri = process.env.REDIRECT_URI
                || (railwayDomain ? `https://${railwayDomain}/api/auth/callback` : null)
                || `http://localhost:${port}/api/auth/callback`;
            const state = `${interaction.guild.id}_${interaction.user.id}`;
            const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify%20guilds.join&state=${state}`;

            const step2Embed = new EmbedBuilder()
                .setColor(client.config.embedColor || '#00f5d4')
                .setTitle('🔐 Final Step: Authorize with Discord')
                .setDescription(
                    `✅ **Captcha solved successfully!**\n\n` +
                    `To complete verification in **${interaction.guild.name}** and receive your <@&${verificationdata.Role}> role:\n\n` +
                    `👉 **Click the button below to authorize with Discord.**\n\n` +
                    `**Why is this required?**\n` +
                    `• **Anti-Raid Protection**: Blocks automated bot attacks.\n` +
                    `• **Instant Role**: You will receive your role immediately upon authorizing.\n` +
                    `• **Member Restorer**: Your server access is securely backed up in our database in case of server loss.`
                )
                .setFooter({
                    text: 'Strikers Two-Step Verification',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Click to Authorize & Get Role')
                    .setStyle(ButtonStyle.Link)
                    .setURL(authUrl)
                    .setEmoji('🔗')
            );

            return await interaction.reply({
                embeds: [step2Embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }
    });

    // Event: GuildMemberAdd (Auto-restore verified role when a verified member rejoins)
    client.on(Events.GuildMemberAdd, async (member) => {
        try {
            if (!member || !member.guild || !member.user || member.user.bot) return;
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState !== 1) return;

            const verificationdata = await capschema.findOne({ Guild: member.guild.id });
            if (!verificationdata || !verificationdata.Role) return;

            const isVerifiedInDb = Array.isArray(verificationdata.Verified) && verificationdata.Verified.includes(member.user.id);
            if (isVerifiedInDb) {
                const roleObj = member.guild.roles.cache.get(verificationdata.Role);
                if (roleObj && !member.roles.cache.has(verificationdata.Role)) {
                    await member.roles.add(verificationdata.Role).catch(() => {});
                    console.log(`[VERIFY] Auto-restored Verified role to rejoining member: ${member.user.tag} (${member.user.id}) in ${member.guild.name}`);
                }
            }
        } catch (err) {
            console.error('[VERIFY] GuildMemberAdd auto-restore error:', err.message);
        }
    });

    // Event: guildMemberRemove (Clean up pending temporary captcha sessions)
    client.on(Events.GuildMemberRemove, async (member) => {
        try {
            if (!member || !member.guild || !member.user) return;
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState !== 1) return;

            const userId = member.user.id;
            await verifyusers.deleteMany({ Guild: member.guild.id, User: userId }).catch(() => {});
        } catch (err) {
            console.error('[VERIFY] GuildMemberRemove error:', err.message);
        }
    });
};

/**
 * Credits: Arpan | @arpandevv
 */