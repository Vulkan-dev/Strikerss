const express = require('express');
const OAuthMember = require('../Schemas/oauthMemberSchema');
const OAuthVerify = require('../Schemas/oauthVerifySchema');
const VerificationSchema = require('../Schemas/verificationSchema');
const VerifyUsers = require('../Schemas/verifyusers');
const { exchangeCode, fetchUserProfile } = require('./oauthHelper');

function initOAuthServer(client) {
    const app = express();
    const port = process.env.PORT || client.config.oauth?.port || 3000;

    // Auto-detect redirect URI: explicit env → Railway domain → localhost fallback
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
    const redirectUri = process.env.REDIRECT_URI
        || (railwayDomain ? `https://${railwayDomain}/api/auth/callback` : null)
        || `http://localhost:${port}/api/auth/callback`;

    // Warn if falling back to localhost (OAuth won't work in production)
    if (redirectUri.startsWith('http://localhost')) {
        console.warn('[OAUTH] ⚠️  REDIRECT_URI is set to localhost! OAuth will not work in production.');
        console.warn('[OAUTH] ⚠️  Set REDIRECT_URI=https://<your-railway-domain>/api/auth/callback in Railway variables.');
    }

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Enable CORS for web portal
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    // Status endpoint
    app.get('/', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Strikers Bot - Auth Server</title>
                <style>
                    body {
                        background-color: #0f172a;
                        color: #f8fafc;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: #1e293b;
                        padding: 2.5rem;
                        border-radius: 1rem;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                        text-align: center;
                        max-width: 420px;
                        border: 1px solid #334155;
                    }
                    .status-dot {
                        display: inline-block;
                        width: 12px;
                        height: 12px;
                        background: #10b981;
                        border-radius: 50%;
                        margin-right: 8px;
                    }
                    h1 { color: #00f5d4; font-size: 1.8rem; margin-bottom: 0.5rem; }
                    p { color: #94a3b8; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Strikers Restorer Server</h1>
                    <p><span class="status-dot"></span>Authentication server is online and operational.</p>
                </div>
            </body>
            </html>
        `);
    });

    // Discord OAuth2 Callback
    app.get('/api/auth/callback', async (req, res) => {
        const { code, state, error, error_description } = req.query;

        if (error) {
            return res.status(400).send(renderResponsePage({
                success: false,
                title: "Authorization Cancelled",
                message: error_description || "You cancelled the authorization request.",
                hint: "You can return to Discord and click Verify again if this was a mistake."
            }));
        }

        if (!code) {
            return res.status(400).send(renderResponsePage({
                success: false,
                title: "Invalid Request",
                message: "No authorization code was provided by Discord.",
                hint: "Please retry verification from Discord."
            }));
        }

        try {
            // Exchange code for tokens
            const tokenData = await exchangeCode(code, redirectUri);
            const { access_token, refresh_token, expires_in, scope } = tokenData;

            // Fetch user profile
            const userProfile = await fetchUserProfile(access_token);
            const userId = userProfile.id;

            // Parse state if present (guildId_userId)
            let targetGuildId = null;
            if (state) {
                const parts = state.split('_');
                targetGuildId = parts[0];
            }

            // Check if MongoDB is connected
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState !== 1) {
                return res.status(503).send(renderResponsePage({
                    success: false,
                    title: "Database Connecting",
                    message: "The database is currently connecting. Please wait 10 seconds and try again.",
                    hint: "Return to Discord and click the verify button again in a moment."
                }));
            }

            // Save or update member in database (Strict Single Record per Discord User ID)
            const cleanUserId = String(userId).trim();
            const expiresAt = new Date(Date.now() + (expires_in || 604800) * 1000);

            // Clean up any potential duplicate documents for this userId first
            const existingDocs = await OAuthMember.find({ userId: cleanUserId }).sort({ updatedAt: -1 });
            if (existingDocs.length > 1) {
                const idsToDelete = existingDocs.slice(1).map(d => d._id);
                await OAuthMember.deleteMany({ _id: { $in: idsToDelete } });
            }

            const updateFields = {
                username: userProfile.username,
                discriminator: userProfile.discriminator || '0',
                avatar: userProfile.avatar,
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: expiresAt,
                scope: scope || 'identify guilds.join',
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                updatedAt: new Date()
            };

            const mongoUpdate = {
                $set: updateFields,
                $setOnInsert: {
                    userId: cleanUserId,
                    createdAt: new Date()
                }
            };

            if (targetGuildId) {
                mongoUpdate.$addToSet = { guilds: String(targetGuildId).trim() };
            }

            await OAuthMember.findOneAndUpdate(
                { userId: cleanUserId },
                mongoUpdate,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            let roleAssigned = false;
            let guildName = 'the server';

            // Assign role in target guild if configured
            if (targetGuildId) {
                const guild = client.guilds.cache.get(targetGuildId);
                if (guild) {
                    guildName = guild.name;
                    let targetRoleId = null;

                    // 1. Check Captcha Verification schema (/verify-config)
                    const capConfig = await VerificationSchema.findOne({ Guild: targetGuildId });
                    if (capConfig && capConfig.Role) {
                        const userCapData = await VerifyUsers.findOne({ Guild: targetGuildId, User: cleanUserId });
                        const isAlreadyVerified = Array.isArray(capConfig.Verified) && capConfig.Verified.includes(cleanUserId);

                        // Anti-Bot: Require Captcha to be solved in Discord first
                        if (!isAlreadyVerified && (!userCapData || !userCapData.Solved)) {
                            return res.status(403).send(renderResponsePage({
                                success: false,
                                title: "Captcha Required First",
                                message: "You must solve the verification Captcha inside Discord before authorizing.",
                                hint: "Please return to Discord, click Verify in the verification channel, and enter the Captcha code first."
                            }));
                        }

                        targetRoleId = capConfig.Role;
                        await VerificationSchema.updateOne(
                            { Guild: targetGuildId },
                            { $addToSet: { Verified: cleanUserId } }
                        );
                        await VerifyUsers.deleteOne({ Guild: targetGuildId, User: cleanUserId });
                    }

                    // 2. Fallback to OAuthVerify schema (/setup verify) if configured
                    if (!targetRoleId) {
                        const verifyConfig = await OAuthVerify.findOne({ guildId: targetGuildId, enabled: true });
                        if (verifyConfig && verifyConfig.roleId) {
                            targetRoleId = verifyConfig.roleId;
                        }
                    }

                    if (targetRoleId) {
                        try {
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                await member.roles.add(targetRoleId);
                                roleAssigned = true;

                                // Send verification log if log channel is configured
                                const channelLogId = client.config?.logchannel;
                                const channelLog = channelLogId ? guild.channels.cache.get(channelLogId) : null;
                                if (channelLog) {
                                    const { EmbedBuilder } = require('discord.js');
                                    const channelLogEmbed = new EmbedBuilder()
                                        .setColor('Green')
                                        .setTitle('✅ Member 2-Step Verified!')
                                        .setDescription(`<@${userId}> (*${userProfile.username}*) completed Captcha and authorized with Backup Bot. <@&${targetRoleId}> role has been assigned!`)
                                        .setTimestamp()
                                        .setFooter({ text: '2-Step Verification Logs' });
                                    channelLog.send({ embeds: [channelLogEmbed] }).catch(() => {});
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to assign role to ${userId} in ${targetGuildId}:`, err);
                        }
                    }
                }
            }

            console.log(`[OAUTH] Member verified: ${userProfile.username} (${userId}) for guild: ${guildName}`);

            // If callback originates from Clan Name Manager portal
            if (state && state.startsWith('clan_portal')) {
                // Generate a secure HMAC signature for the verified user
                const crypto = require('crypto');
                const secret = process.env.clientSecret || 'clan_secret_key';
                const timestamp = Date.now();
                const sigPayload = `${userId}:${userProfile.username}:${timestamp}`;
                const signature = crypto.createHmac('sha256', secret).update(sigPayload).digest('hex');
                const authToken = Buffer.from(JSON.stringify({
                    userId,
                    username: userProfile.username,
                    timestamp,
                    sig: signature
                })).toString('base64');

                // Try redirecting back to portal (default to standard port 5500 or file/window closer)
                return res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>Authorization Successful</title></head>
                    <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                        <div style="background:#1e293b;padding:2rem;border-radius:1rem;text-align:center;max-width:400px;border:1px solid #334155;">
                            <h2 style="color:#10b981;margin-bottom:0.5rem;">Identity Verified! ✓</h2>
                            <p style="color:#94a3b8;font-size:0.95rem;">You have authorized as <strong>@${userProfile.username}</strong>.</p>
                            <p style="color:#64748b;font-size:0.85rem;">Returning you to Clan Portal...</p>
                        </div>
                        <script>
                            const tokenData = {
                                token: "${authToken}",
                                userId: "${userId}",
                                username: "${userProfile.username}",
                                avatar: "${userProfile.avatar || ''}"
                            };
                            if (window.opener) {
                                window.opener.postMessage({ type: 'STR_DISCORD_AUTH_SUCCESS', data: tokenData }, '*');
                                window.close();
                            } else {
                                // Direct redirect fallback
                                const redirectUrl = localStorage.getItem('str_portal_return_url') || 'http://localhost:5500';
                                window.location.href = redirectUrl + '?auth_token=' + encodeURIComponent("${authToken}") + '&user_id=' + encodeURIComponent("${userId}");
                            }
                        </script>
                    </body>
                    </html>
                `);
            }

            return res.send(renderResponsePage({
                success: true,
                title: "Verification Successful! 🎉",
                message: `Welcome, **${userProfile.username}**! You have been verified successfully in **${guildName}**.`,
                hint: roleAssigned 
                    ? "Your verified role has been assigned. You may now return to Discord!" 
                    : "Your account is verified and saved for recovery. You may now return to Discord!"
            }));

        } catch (err) {
            console.error('[OAUTH ERROR]', err.response?.data || err.message);
            return res.status(500).send(renderResponsePage({
                success: false,
                title: "Verification Failed",
                message: "An error occurred while communicating with Discord OAuth.",
                hint: "Please try clicking the verify button again in Discord."
            }));
        }
    });

    // -------------------------------------------------------------
    // API: Fetch Discord Profile & Calculate Legitimacy / Age
    // -------------------------------------------------------------
    app.get('/api/discord/user/:id', async (req, res) => {
        let userId = req.params.id.trim();

        // If it is not a Snowflake, attempt to resolve via username
        if (!/^\d{17,20}$/.test(userId)) {
            let targetGuild = null;
            if (client.config.clanManager?.guildId) {
                targetGuild = client.guilds.cache.get(client.config.clanManager.guildId);
            }
            if (!targetGuild) targetGuild = client.guilds.cache.first();

            if (targetGuild) {
                const query = userId.toLowerCase();
                const member = targetGuild.members.cache.find(m => 
                    m.user.username.toLowerCase() === query || 
                    m.user.globalName?.toLowerCase() === query || 
                    m.user.tag.toLowerCase() === query
                );
                
                if (member) {
                    userId = member.id;
                } else {
                    return res.status(404).json({ error: 'User not found in the server by that username. Please enter your 17-20 digit Discord ID, or ensure you have joined the server.' });
                }
            } else {
                return res.status(500).json({ error: 'Bot is not connected to a server to resolve usernames.' });
            }
        }

        try {
            // Calculate Snowflake Creation Date: (snowflake >> 22) + 1420070400000
            const epoch = 1420070400000n;
            const createdAtTimestamp = Number((BigInt(userId) >> 22n) + epoch);
            const createdAt = new Date(createdAtTimestamp);
            const now = new Date();

            const diffTime = Math.abs(now - createdAt);
            const accountAgeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const accountAgeMonths = parseFloat((accountAgeDays / 30.4375).toFixed(1));

            // Required: At least 3 months (90 days)
            const isEligible = accountAgeDays >= 90;

            // Fetch full user profile using Discord.js Client (force fetch to populate banner & decoration)
            let user = await client.users.fetch(userId, { force: true }).catch(() => null);

            // Fallback to axios if client fetch returned null
            let discordData = null;
            if (!user) {
                const axios = require('axios');
                try {
                    const response = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
                        headers: { Authorization: `Bot ${process.env.token}` }
                    });
                    discordData = response.data;
                } catch (apiErr) {
                    if (apiErr.response?.status === 404) {
                        return res.status(404).json({ error: 'Discord User not found with this ID.' });
                    }
                }
            }

            const username = user?.username || discordData?.username || `User_${userId.slice(-4)}`;
            const globalName = user?.globalName || discordData?.global_name || discordData?.display_name || username;

            // Avatar URL
            let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
            if (user) {
                avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: false });
            } else if (discordData?.avatar) {
                const isGif = discordData.avatar.startsWith('a_');
                avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${discordData.avatar}.${isGif ? 'gif' : 'png'}?size=512`;
            } else {
                avatarUrl = `https://cdn.discordapp.com/embed/avatars/${(BigInt(userId) >> 22n) % 6n}.png`;
            }

            // Banner URL
            let bannerUrl = null;
            if (user) {
                bannerUrl = user.bannerURL({ extension: 'png', size: 1024, forceStatic: false });
            } else if (discordData?.banner) {
                const isGif = discordData.banner.startsWith('a_');
                bannerUrl = `https://cdn.discordapp.com/banners/${userId}/${discordData.banner}.${isGif ? 'gif' : 'png'}?size=1024`;
            }

            // Decoration URL
            let decorationUrl = null;
            if (user && user.avatarDecorationURL) {
                decorationUrl = user.avatarDecorationURL();
            }
            if (!decorationUrl) {
                const decorationAsset = user?.avatarDecorationData?.asset || discordData?.avatar_decoration_data?.asset;
                if (decorationAsset) {
                    decorationUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${decorationAsset}.png`;
                }
            }

            // Accent Color
            let accentColor = '#121212';
            if (user?.hexAccentColor) {
                accentColor = user.hexAccentColor;
            } else if (discordData?.accent_color) {
                accentColor = `#${discordData.accent_color.toString(16).padStart(6, '0')}`;
            } else if (discordData?.banner_color) {
                accentColor = discordData.banner_color;
            }

            // Check if user is a member of the configured Clan Guild
            let targetGuild = null;
            let isGuildMember = false;
            let guildName = null;
            let guildIcon = null;

            if (client.config.clanManager?.guildId) {
                targetGuild = client.guilds.cache.get(client.config.clanManager.guildId) ||
                    await client.guilds.fetch(client.config.clanManager.guildId).catch(() => null);
            }
            if (!targetGuild) {
                targetGuild = client.guilds.cache.first();
            }

            if (targetGuild) {
                guildName = targetGuild.name;
                guildIcon = targetGuild.iconURL({ dynamic: true });
                const member = await targetGuild.members.fetch(userId).catch(() => null);
                if (member) {
                    isGuildMember = true;
                }
            }

            const formattedCreatedDate = createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

            return res.json({
                id: userId,
                username,
                globalName,
                global_name: globalName,
                discriminator: discordData?.discriminator || '0',
                avatarUrl,
                avatar_url: avatarUrl,
                bannerUrl,
                banner_url: bannerUrl,
                decorationUrl,
                avatar_decoration_url: decorationUrl,
                accentColor,
                accent_color: accentColor,
                createdAt: createdAt.toISOString(),
                created_at: createdAt.toISOString(),
                createdAtFormatted: formattedCreatedDate,
                accountAgeDays,
                age_days: accountAgeDays,
                accountAgeMonths,
                age_months: accountAgeMonths,
                isEligible,
                is_eligible: isEligible,
                requiredDays: 90,
                isGuildMember,
                guildName,
                guildIcon
            });
        } catch (error) {
            console.error('[API USER FETCH ERROR]', error);
            return res.status(500).json({ error: 'Failed to verify Discord account.' });
        }
    });

    // In-memory rate limiting and application cooldowns to prevent abuse/nuking
    const userApplyCooldowns = new Map(); // discordId -> timestamp
    const ipApplyCooldowns = new Map();   // ip -> count of attempts in window

    // Helper: Verify Signed Auth Token
    function verifyAuthToken(token, expectedUserId) {
        if (!token) return false;
        try {
            const crypto = require('crypto');
            const secret = process.env.clientSecret || 'clan_secret_key';
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (!decoded || !decoded.userId || !decoded.timestamp || !decoded.sig) return false;
            if (decoded.userId !== expectedUserId) return false;
            // Token valid for 2 hours (7200000 ms)
            if (Date.now() - decoded.timestamp > 7200000) return false;

            const sigPayload = `${decoded.userId}:${decoded.username}:${decoded.timestamp}`;
            const expectedSig = crypto.createHmac('sha256', secret).update(sigPayload).digest('hex');
            return crypto.timingSafeEqual(Buffer.from(decoded.sig), Buffer.from(expectedSig));
        } catch (e) {
            return false;
        }
    }

    // -------------------------------------------------------------
    // API: Clan Auth URL generator
    // -------------------------------------------------------------
    app.get('/api/clan/auth-url', (req, res) => {
        const clientId = process.env.clientId;
        const redirect = redirectUri;
        const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=identify&state=clan_portal`;
        return res.json({ authUrl });
    });

    // -------------------------------------------------------------
    // API: Clan Name Manager Application Submission & Channel Creation
    // -------------------------------------------------------------
    app.post('/api/clan/apply', async (req, res) => {
        const {
            discordId,
            username,
            age,
            hasMic,
            favouriteGame,
            gamesPlayed,
            clanMoniker,
            avatarUrl,
            accountAgeDays,
            accountAgeMonths,
            authToken
        } = req.body;

        if (!discordId || !username) {
            return res.status(400).json({ error: 'Discord ID and Username are required.' });
        }

        // Anti-Nuking / Anti-Abuse Authorization Check
        // Requires user to have authorized through OAuth
        const isAuthorized = verifyAuthToken(authToken, discordId);
        if (!isAuthorized) {
            return res.status(401).json({
                error: 'Unauthorized: You must click "Authorize with Discord" to verify account ownership and prevent spam.'
            });
        }

        // Rate Limiting: IP Level (Max 5 submissions per 15 minutes per IP)
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const ipRecord = ipApplyCooldowns.get(clientIp) || { count: 0, resetTime: now + 15 * 60 * 1000 };
        if (now > ipRecord.resetTime) {
            ipRecord.count = 0;
            ipRecord.resetTime = now + 15 * 60 * 1000;
        }
        if (ipRecord.count >= 5) {
            return res.status(429).json({
                error: 'Too many applications from your IP address. Please wait 15 minutes before submitting again.'
            });
        }
        ipRecord.count++;
        ipApplyCooldowns.set(clientIp, ipRecord);

        // Rate Limiting: User Level (Cooldown of 15 minutes per Discord account)
        const lastApplied = userApplyCooldowns.get(discordId);
        if (lastApplied && (now - lastApplied) < 15 * 60 * 1000) {
            const minutesLeft = Math.ceil((15 * 60 * 1000 - (now - lastApplied)) / 60000);
            return res.status(429).json({
                error: `An application was recently submitted for your account. Please wait ${minutesLeft} minute(s) before applying again.`
            });
        }
        userApplyCooldowns.set(discordId, now);

        // Validate 3-month age requirement on server side
        const epoch = 1420070400000n;
        const createdAtTimestamp = Number((BigInt(discordId) >> 22n) + epoch);
        const ageDays = Math.floor((Date.now() - createdAtTimestamp) / (1000 * 60 * 60 * 24));
        if (ageDays < 90) {
            return res.status(403).json({
                error: `Account is only ${ageDays} days old. A minimum account age of 90 days (3 months) is strictly required.`
            });
        }

        try {
            const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

            // Find configured guild or fall back to client's primary guild
            let targetGuild = null;
            if (client.config.clanManager?.guildId) {
                targetGuild = client.guilds.cache.get(client.config.clanManager.guildId) ||
                    await client.guilds.fetch(client.config.clanManager.guildId).catch(() => null);
            }
            if (!targetGuild) {
                targetGuild = client.guilds.cache.first();
            }

            if (!targetGuild) {
                return res.status(500).json({ error: 'Bot is not connected to any server to create channels.' });
            }

            // Find category
            let categoryId = client.config.clanManager?.categoryId;
            let parentCategory = null;
            if (categoryId) {
                parentCategory = targetGuild.channels.cache.get(categoryId);
            }
            // If not found by ID, look for a category named "Verification" or "Applications"
            if (!parentCategory) {
                parentCategory = targetGuild.channels.cache.find(c =>
                    c.type === ChannelType.GuildCategory &&
                    (c.name.toLowerCase().includes('verif') || c.name.toLowerCase().includes('applicat') || c.name.toLowerCase().includes('clan'))
                );
            }

            // Clean channel name: `verify-username`
            const sanitizedUser = username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
            const channelName = `verify-${sanitizedUser}`;

            // Check if a channel for this applicant already exists
            const existingChannel = targetGuild.channels.cache.find(c => c.name === channelName && c.parentId === (parentCategory?.id || null));
            if (existingChannel) {
                return res.json({
                    success: true,
                    alreadyExists: true,
                    channelId: existingChannel.id,
                    channelName: existingChannel.name,
                    guildName: targetGuild.name
                });
            }

            // Check if applicant is a member of the target Discord server
            let applicantMember = null;
            try {
                applicantMember = await targetGuild.members.fetch(discordId).catch(() => null);
            } catch (e) {
                applicantMember = null;
            }

            if (!applicantMember) {
                return res.status(403).json({
                    error: `You are not a member of the server (${targetGuild.name}). You must join the Discord server first before verifying!`
                });
            }

            // Setup permission overwrites (Strictly applicant member + Staff/Admin can see, everyone else denied)
            const permissionOverwrites = [
                {
                    id: targetGuild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.ManageChannels
                    ]
                },
                {
                    id: discordId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                }
            ];

            // If staff role configured, allow staff
            if (client.config.clanManager?.staffRoleId) {
                permissionOverwrites.push({
                    id: client.config.clanManager.staffRoleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages
                    ]
                });
            }

            // Create Channel
            const channel = await targetGuild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: parentCategory ? parentCategory.id : null,
                topic: `STR Clan Intake Verification for <@${discordId}> (${username})`,
                permissionOverwrites: permissionOverwrites
            });

            // Build Bot Embed
            const embed = new EmbedBuilder()
                .setTitle("⚡ 𝑺𝑻𝑹𝑰𝑲𝑬𝑹𝑺 乂 𝑴𝑬𝑴𝑩𝑬𝑹 𝑽𝑬𝑹𝑰𝑭𝑰𝑪𝑨𝑻𝑰𝑶𝑵")
                .setColor(0x1f1f1f)
                .setDescription("A new verified clan applicant has submitted their intake form.")
                .setThumbnail(avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png')
                .addFields(
                    { name: "👤 Applicant", value: `<@${discordId}> (\`${username}\` / \`${discordId}\`)`, inline: false },
                    { name: "🛡️ Legitimacy Check", value: `✅ **Verified Discord Account**\n• Age: \`${accountAgeDays || ageDays} days\` (~${accountAgeMonths || (ageDays / 30).toFixed(1)} months)\n• 3-Month Requirement: **PASSED**`, inline: false },
                    { name: "🎂 Age", value: `\`${age}\``, inline: true },
                    { name: "🎙️ Has Mic?", value: `\`${hasMic}\``, inline: true },
                    { name: "🎮 Favourite Game", value: `\`${favouriteGame}\``, inline: true },
                    { name: "🕹️ Games Played", value: `\`${gamesPlayed}\``, inline: false }
                )
                .setFooter({ text: "STR Clan Management • Bot Verified" })
                .setTimestamp();

            if (clanMoniker) {
                embed.addFields({ name: "🏷️ Requested Clan Moniker", value: `\`\`\`${clanMoniker}\`\`\``, inline: false });
            }

            // Action Buttons for Staff
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`clan_approve_${discordId}`)
                    .setLabel("Approve Applicant")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("✅"),
                new ButtonBuilder()
                    .setCustomId(`clan_reject_${discordId}`)
                    .setLabel("Reject & Close")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("✖️")
            );

            await channel.send({
                content: `🔔 <@${discordId}> New applicant intake review channel created! Staff attention requested.`,
                embeds: [embed],
                components: [row]
            });

            return res.json({
                success: true,
                channelId: channel.id,
                channelName: channel.name,
                guildName: targetGuild.name
            });
        } catch (err) {
            console.error('[CLAN APPLY ERROR]', err);
            return res.status(500).json({ error: 'Failed to create verification channel in Discord: ' + (err.message || err) });
        }
    });

    const server = app.listen(port, '0.0.0.0', () => {
        client.logs ? client.logs.success(`[OAUTH] Member Restorer Web Server running on port ${port}`) : console.log(`[OAUTH] Server running on port ${port}`);
        console.log(`[OAUTH] Redirect URI: ${redirectUri}`);
    });

    return server;
}

function renderResponsePage({ success, title, message, hint }) {
    const formattedMsg = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - Strikers</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                background: linear-gradient(135deg, #0b0f19 0%, #171d2d 100%);
                color: #f1f5f9;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 1rem;
            }
            .container {
                background: rgba(30, 41, 59, 0.85);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 1.25rem;
                padding: 2.5rem 2rem;
                max-width: 480px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            .icon-wrapper {
                width: 72px;
                height: 72px;
                margin: 0 auto 1.5rem;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
                color: ${success ? '#10b981' : '#ef4444'};
                font-size: 2.2rem;
            }
            h1 {
                font-size: 1.6rem;
                font-weight: 700;
                margin-bottom: 0.75rem;
                color: ${success ? '#00f5d4' : '#ff4a4a'};
            }
            p.message {
                color: #cbd5e1;
                font-size: 1.05rem;
                line-height: 1.6;
                margin-bottom: 1.25rem;
            }
            .hint-box {
                background: rgba(15, 23, 42, 0.6);
                border-left: 4px solid ${success ? '#00f5d4' : '#ef4444'};
                padding: 0.85rem 1rem;
                border-radius: 0.5rem;
                color: #94a3b8;
                font-size: 0.9rem;
                line-height: 1.4;
                text-align: left;
            }
            .footer-tag {
                margin-top: 1.75rem;
                font-size: 0.8rem;
                color: #64748b;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon-wrapper">
                ${success ? '✓' : '✕'}
            </div>
            <h1>${title}</h1>
            <p class="message">${formattedMsg}</p>
            <div class="hint-box">
                ${hint}
            </div>
            <div class="footer-tag">
                Powered by Strikers Bot Member Restorer
            </div>
        </div>
    </body>
    </html>
    `;
}

module.exports = { initOAuthServer };
