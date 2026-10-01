const axios = require('axios');

/**
 * Checks an IP for VPN, Proxy, or Hosting datacenter characteristics.
 * Uses ip-api.com fields: status, country, proxy, hosting
 */
async function checkIp(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return { isVpn: false, cleanIp: ip, country: 'Local' };
    }

    try {
        const response = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,proxy,hosting`, {
            timeout: 4000
        });

        if (response.data && response.data.status === 'success') {
            const isVpn = Boolean(response.data.proxy || response.data.hosting);
            return {
                isVpn,
                country: response.data.country || 'Unknown',
                proxy: Boolean(response.data.proxy),
                hosting: Boolean(response.data.hosting)
            };
        }
    } catch (e) {
        console.warn(`[ANTI-VPN] IP check skipped or timed out for ${ip}: ${e.message}`);
    }

    return { isVpn: false, country: 'Unknown' };
}

module.exports = {
    checkIp
};
