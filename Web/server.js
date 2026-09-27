const express = require('express');
const OAuthMember = require('../Schemas/oauthMemberSchema');
const OAuthVerify = require('../Schemas/oauthVerifySchema');
const { exchangeCode, fetchUserProfile } = require('./oauthHelper');

function initOAuthServer(client) {
    const app = express();
    const port = process.env.PORT || client.config.oauth?.port || 3000;
    const redirectUri = process.env.REDIRECT_URI || client.config.oauth?.redirectUri || `http://localhost:${port}/api/auth/callback`;

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

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

            // Save or update member in database
            const expiresAt = new Date(Date.now() + (expires_in || 604800) * 1000);
            const existingMember = await OAuthMember.findOne({ userId });

            let updatedGuilds = [];
            if (existingMember) {
                updatedGuilds = existingMember.guilds || [];
                if (targetGuildId && !updatedGuilds.includes(targetGuildId)) {
                    updatedGuilds.push(targetGuildId);
                }
                existingMember.username = userProfile.username;
                existingMember.discriminator = userProfile.discriminator || '0';
                existingMember.avatar = userProfile.avatar;
                existingMember.accessToken = access_token;
                existingMember.refreshToken = refresh_token;
                existingMember.expiresAt = expiresAt;
                existingMember.guilds = updatedGuilds;
                existingMember.ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                existingMember.updatedAt = new Date();
                await existingMember.save();
            } else {
                if (targetGuildId) updatedGuilds.push(targetGuildId);
                await OAuthMember.create({
                    userId,
                    username: userProfile.username,
                    discriminator: userProfile.discriminator || '0',
                    avatar: userProfile.avatar,
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresAt,
                    scope: scope || 'identify guilds.join',
                    guilds: updatedGuilds,
                    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            let roleAssigned = false;
            let guildName = 'the server';

            // Assign role in target guild if configured
            if (targetGuildId) {
                const guild = client.guilds.cache.get(targetGuildId);
                if (guild) {
                    guildName = guild.name;
                    const verifyConfig = await OAuthVerify.findOne({ guildId: targetGuildId, enabled: true });
                    if (verifyConfig && verifyConfig.roleId) {
                        try {
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                await member.roles.add(verifyConfig.roleId);
                                roleAssigned = true;
                            }
                        } catch (err) {
                            console.error(`Failed to assign role to ${userId} in ${targetGuildId}:`, err);
                        }
                    }
                }
            }

            console.log(`[OAUTH] Member verified: ${userProfile.username} (${userId}) for guild: ${guildName}`);

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

    const server = app.listen(port, () => {
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
