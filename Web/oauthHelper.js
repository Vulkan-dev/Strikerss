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

module.exports = {
    exchangeCode,
    refreshAccessToken,
    fetchUserProfile,
    addGuildMember
};
