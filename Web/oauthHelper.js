const axios = require('axios');

const DISCORD_API = 'https://discord.com/api/v10';

async function exchangeCode(code, redirectUri) {
    const params = new URLSearchParams({
        client_id: process.env.clientId,
        client_secret: process.env.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
    });

    const response = await axios.post(`${DISCORD_API}/oauth2/token`, params.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    return response.data;
}

async function refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
        client_id: process.env.clientId,
        client_secret: process.env.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const response = await axios.post(`${DISCORD_API}/oauth2/token`, params.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    return response.data;
}

async function fetchUserProfile(accessToken) {
    const response = await axios.get(`${DISCORD_API}/users/@me`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    return response.data;
}

async function addGuildMember(guildId, userId, accessToken) {
    try {
        const response = await axios.put(
            `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
            { access_token: accessToken },
            {
                headers: {
                    Authorization: `Bot ${process.env.token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // 201 = Created (joined), 204 = Already in guild
        return { status: response.status, data: response.data };
    } catch (error) {
        if (error.response) {
            return { status: error.response.status, error: error.response.data };
        }
        return { status: 500, error: error.message };
    }
}

async function validateAndRefreshToken(oauthDoc) {
    if (!oauthDoc || !oauthDoc.refreshToken) {
        return { valid: false, deauthorized: true, reason: 'NO_TOKEN' };
    }

    // 1. If access token is still within expiry, check with /users/@me
    const isExpired = oauthDoc.expiresAt && new Date(oauthDoc.expiresAt).getTime() <= Date.now() + 60000;

    if (!isExpired && oauthDoc.accessToken) {
        try {
            const userProfile = await fetchUserProfile(oauthDoc.accessToken);
            return { valid: true, userProfile };
        } catch (err) {
            // 401 Unauthorized means token revoked early (e.g. user deauthorized)
            if (err.response?.status !== 401) {
                return { valid: true, error: err.message };
            }
        }
    }

    // 2. Token expired or returned 401: Attempt refresh
    try {
        const refreshData = await refreshAccessToken(oauthDoc.refreshToken);
        const expiresAt = new Date(Date.now() + (refreshData.expires_in || 604800) * 1000);

        oauthDoc.accessToken = refreshData.access_token;
        oauthDoc.refreshToken = refreshData.refresh_token;
        oauthDoc.expiresAt = expiresAt;
        oauthDoc.updatedAt = new Date();
        await oauthDoc.save();

        return { valid: true, refreshed: true };
    } catch (err) {
        // If refresh fails with 400 invalid_grant or 401, the user has DEAUTHORIZED the app
        const isDeauth = err.response?.status === 400 && 
            (err.response?.data?.error === 'invalid_grant' || !err.response?.data?.error);
        const isUnauthorized = err.response?.status === 401;

        if (isDeauth || isUnauthorized) {
            return { valid: false, deauthorized: true, reason: 'REVOKED_BY_USER' };
        }

        return { valid: true, error: err.message };
    }
}

module.exports = {
    exchangeCode,
    refreshAccessToken,
    fetchUserProfile,
    addGuildMember,
    validateAndRefreshToken
};
