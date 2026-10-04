const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");
const VerificationSchema = require("../../Schemas/verificationSchema");
const VerifyUsers = require("../../Schemas/verifyusers");
const {
    getVerifiedRoleId,
    checkUserAuthorization,
    setSimulationGrace,
    clearSimulationGrace,
    getOAuthAuthorizeUrl
} = require("../../Utils/oauthDeauthGuard");
const { transitionToVerified, transitionToUnverified } = require("../../Utils/roleGuard");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verify")
        .setDescription("Verification system management and simulation.")
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName("sim")
                .setDescription("Simulate portal verification for a member (requires bot authorization).")
                .addUserOption(opt =>
                    opt
                        .setName("user")
                        .setDescription("The user to simulate portal verification for.")
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        if (!interaction.guild) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "sim") {
            const staffRoleId = client.config.clanManager?.staffRoleId || process.env.CLAN_STAFF_ROLE_ID;
            const isStaff =
                interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
                (staffRoleId && interaction.member.roles.cache.has(staffRoleId)) ||
                interaction.user.id === interaction.guild.ownerId ||
                interaction.user.id === process.env.developerId;

            if (!isStaff) {
                return await interaction.reply({
                    content: "❌ You **do not** have permission to simulate verification. Clan Staff or Administrator permissions are required.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const targetUser = interaction.options.getUser("user");
            if (targetUser.bot) {
                return await interaction.reply({
                    content: "❌ You cannot simulate verification for a bot.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                return await interaction.reply({
                    content: "❌ That user is not a member of this server.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const verifiedRoleId = await getVerifiedRoleId(interaction.guild, client);
            if (!verifiedRoleId) {
                return await interaction.reply({
                    content: "⚠️ No verified role configured for this server. Please configure the verification system using `/verify-config` first or set `VERIFIED_ROLE_ID`.",
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply();

            try {
                // 1. Mark simulated portal intake in MongoDB
                await VerificationSchema.updateOne(
                    { Guild: interaction.guild.id },
                    { $addToSet: { Verified: targetMember.id } },
                    { upsert: true }
                ).catch(() => {});

                await VerifyUsers.findOneAndUpdate(
                    { Guild: interaction.guild.id, User: targetMember.id },
                    { Guild: interaction.guild.id, User: targetMember.id, Solved: true },
                    { upsert: true }
                ).catch(() => {});

                // 2. Check active OAuth2 bot authorization status
                const auth = await checkUserAuthorization(targetMember.id, true);

                // Case A: User is ALREADY authorized with the bot
                if (auth.authorized) {
                    await transitionToVerified(targetMember, verifiedRoleId);
                    clearSimulationGrace(targetMember.id);

                    const embed = new EmbedBuilder()
                        .setTitle("✅ Portal Verification Simulated")
                        .setColor(0x10b981)
                        .setDescription(
                            `Successfully simulated portal verification for <@${targetMember.id}> (*${targetUser.tag}*).\n\n` +
                            `🔐 **Bot OAuth2 Status:** ✅ **Active & Authorized**\n` +
                            `This member already has active bot authorization. Their <@&${verifiedRoleId}> role is **confirmed and permanent**.`
                        )
                        .addFields(
                            { name: "👤 Member", value: `<@${targetMember.id}> (\`${targetUser.id}\`)`, inline: true },
                            { name: "🛡️ Assigned Role", value: `<@&${verifiedRoleId}>`, inline: true },
                            { name: "⚡ Status", value: "Verified (OAuth Confirmed)", inline: true }
                        )
                        .setFooter({ text: "STRIKERS Verification Engine • Simulation Mode" })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                    try {
                        await targetMember.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(`✅ Verification Confirmed in ${interaction.guild.name}`)
                                    .setColor(0x10b981)
                                    .setDescription(`Staff simulated your portal verification in **${interaction.guild.name}**. Your active bot authorization was verified, and your <@&${verifiedRoleId}> role is confirmed!`)
                                    .setTimestamp()
                            ]
                        });
                    } catch (e) {}

                    return;
                }

                // Case B: User has NOT authorized with the bot yet
                const GRACE_DURATION_MS = 3 * 60 * 1000; // 3 minutes grace period
                const expiresTimestampSec = Math.floor((Date.now() + GRACE_DURATION_MS) / 1000);

                // Set simulation grace period to prevent immediate role stripping by guildMemberUpdate
                setSimulationGrace(targetMember.id, interaction.guild.id, GRACE_DURATION_MS);

                // Assign the Verified role
                await transitionToVerified(targetMember, verifiedRoleId);

                // Generate OAuth authorize link
                const authUrl = getOAuthAuthorizeUrl(client, interaction.guild.id, targetMember.id);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("Authorize with Bot")
                        .setStyle(ButtonStyle.Link)
                        .setURL(authUrl)
                        .setEmoji("🔐")
                );

                const embed = new EmbedBuilder()
                    .setTitle("⚡ Portal Verification Simulated (Pending Authorization)")
                    .setColor(0xffaa00)
                    .setDescription(
                        `Simulated portal intake verification for <@${targetMember.id}> (*${targetUser.tag}*).\n\n` +
                        `⚠️ **Bot OAuth2 Status:** ❌ **Not Yet Authorized**\n` +
                        `⏳ **Countdown:** Must authorize by <t:${expiresTimestampSec}:R> (<t:${expiresTimestampSec}:T>)\n\n` +
                        `> The <@&${verifiedRoleId}> role was temporarily assigned. **However, <@${targetMember.id}> MUST authorize with the bot within 3 minutes.**\n` +
                        `> If they do not authorize, their role will automatically reverse back to **Unverified**!`
                    )
                    .addFields(
                        { name: "👤 Member", value: `<@${targetMember.id}> (\`${targetUser.id}\`)`, inline: true },
                        { name: "🛡️ Temporary Role", value: `<@&${verifiedRoleId}>`, inline: true },
                        { name: "⏱️ Grace Period", value: `3 Minutes (<t:${expiresTimestampSec}:R>)`, inline: true }
                    )
                    .setFooter({ text: "STRIKERS Verification Engine • Role Reversal Guard Active" })
                    .setTimestamp();

                await interaction.editReply({
                    content: `🔔 <@${targetMember.id}> Your verification was simulated! Please authorize with the bot below to keep your role.`,
                    embeds: [embed],
                    components: [row]
                });

                // DM notification to target user
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle(`⚡ Action Required: Authorize with Bot in ${interaction.guild.name}`)
                        .setColor(0xffaa00)
                        .setDescription(
                            `Your verification in **${interaction.guild.name}** was simulated by staff.\n\n` +
                            `⚠️ **IMPORTANT REQUIREMENT:**\n` +
                            `You have **3 minutes** (<t:${expiresTimestampSec}:R>) to click **Authorize with Bot** below.\n\n` +
                            `If you do not complete authorization before time runs out, your **Verified** role will automatically **reverse back to Unverified**!`
                        )
                        .setFooter({ text: "Strikers OAuth2 Security Guard" })
                        .setTimestamp();

                    await targetMember.send({
                        embeds: [dmEmbed],
                        components: [row]
                    });
                } catch (e) {}

                // Schedule the 3-minute grace expiration check
                setTimeout(async () => {
                    try {
                        clearSimulationGrace(targetMember.id);

                        // Re-check OAuth authorization status
                        const freshAuth = await checkUserAuthorization(targetMember.id, true);
                        const currentMember = await interaction.guild.members.fetch(targetMember.id).catch(() => null);
                        if (!currentMember) return;

                        if (freshAuth.authorized) {
                            console.log(`[SIMULATION] Member ${currentMember.user.tag} (${currentMember.id}) authorized in time. Retaining Verified role.`);
                            try {
                                await currentMember.send({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setTitle(`✅ Verified Role Confirmed`)
                                            .setColor(0x10b981)
                                            .setDescription(`Thank you for authorizing with the bot! Your **Verified** role in **${interaction.guild.name}** is now permanent.`)
                                            .setTimestamp()
                                    ]
                                });
                            } catch (e) {}
                        } else {
                            console.log(`[SIMULATION] Member ${currentMember.user.tag} (${currentMember.id}) failed to authorize within 3 minutes. Reversing role to Unverified.`);
                            await transitionToUnverified(
                                currentMember,
                                verifiedRoleId,
                                "Simulation grace period expired without bot authorization"
                            );

                            try {
                                await currentMember.send({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setTitle(`❌ Verification Reversed`)
                                            .setColor(0xff3333)
                                            .setDescription(
                                                `Your simulated verification in **${interaction.guild.name}** has expired because you did not authorize with the bot within 3 minutes.\n\n` +
                                                `Your role has been **reversed back to Unverified**.\n\n` +
                                                `To regain access, please complete verification and authorize with the bot.`
                                            )
                                            .setTimestamp()
                                    ]
                                });
                            } catch (e) {}

                            // Send notification to log channel
                            const logChannelId = client.config?.logchannel || client.config?.clanManager?.logChannelId;
                            const logChannel = logChannelId ? interaction.guild.channels.cache.get(logChannelId) : null;
                            if (logChannel) {
                                const revEmbed = new EmbedBuilder()
                                    .setTitle("⏱️ Simulated Verification Reversed")
                                    .setColor(0xff3333)
                                    .setDescription(
                                        `**Member:** <@${currentMember.id}> (*${currentMember.user.tag}*)\n` +
                                        `**Action:** Role <@&${verifiedRoleId}> was revoked and Unverified assigned.\n` +
                                        `**Reason:** Did not authorize with bot within the 3-minute simulation grace period.`
                                    )
                                    .setTimestamp();
                                await logChannel.send({ embeds: [revEmbed] }).catch(() => {});
                            }
                        }
                    } catch (timerErr) {
                        console.error("[SIMULATION EXPIRATION HANDLER ERROR]", timerErr);
                    }
                }, GRACE_DURATION_MS);

            } catch (err) {
                console.error("[VERIFY SIM ERROR]", err);
                await interaction.editReply({
                    content: `❌ An error occurred while executing the simulation: ${err.message || err}`
                });
            }
        }
    }
};
