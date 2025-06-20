console.log('=== IP Capture and Validation Testing ===');

const axios = require('axios');
const net = require('net');

function isPrivateIP(ip) {
    if (!ip) return true;
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
    const privateRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./];
    return privateRanges.some(range => range.test(ip));
}

function isValidIP(ip) {
    return net.isIP(ip) !== 0;
}

function getClientIP(req) {
    // Extract IP from X-Forwarded-For header (first valid public IP)
    let xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        for (const ip of ips) {
            if (isValidIP(ip) && !isPrivateIP(ip)) {
                return ip;
            }
        }
    }

    // Check other proxy headers
    const proxyHeaders = ['cf-connecting-ip', 'true-client-ip', 'x-real-ip', 'x-client-ip', 'x-forwarded', 'forwarded-for', 'forwarded'];
    for (const header of proxyHeaders) {
        const headerValue = req.headers[header];
        if (headerValue) {
            const ips = headerValue.split(',').map(ip => ip.trim());
            for (const ip of ips) {
                if (isValidIP(ip) && !isPrivateIP(ip)) {
                    return ip;
                }
            }
        }
    }

    // Fallback to direct connection IP
    let directIP = req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
    if (directIP) {
        if (directIP.startsWith('::ffff:')) directIP = directIP.substring(7);
        if (directIP === '::1') directIP = '127.0.0.1';
        if (directIP.includes(':')) directIP = directIP.split(':')[0];
        if (isValidIP(directIP) && !isPrivateIP(directIP)) {
            return directIP;
        }
    }
    return 'unknown';
}

async function getIPInfo(ip) {
    try {
        const { data } = await axios.get(`https://ipwho.is/${ip}`);
        if (data && data.success) {
            return data;
        } else {
            return { success: false, message: data.message || 'Invalid IP' };
        }
    } catch (err) {
        return { success: false, message: err.message };
    }
}

const tests = [
    {
        name: 'Public IP via X-Forwarded-For',
        req: {
            headers: { 'x-forwarded-for': '143.137.94.158, 192.168.1.1' },
            connection: { remoteAddress: '127.0.0.1' }
        }
    },
    {
        name: 'Cloudflare IP',
        req: {
            headers: { 'cf-connecting-ip': '198.51.100.42' },
            connection: { remoteAddress: '127.0.0.1' }
        }
    },
    {
        name: 'Local Development',
        req: {
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        }
    },
    {
        name: 'Private IP Filtering',
        req: {
            headers: { 'x-forwarded-for': '192.168.1.100' },
            connection: { remoteAddress: '127.0.0.1' }
        }
    },
    {
        name: 'Multiple Headers with Private IPs',
        req: {
            headers: {
                'x-forwarded-for': '192.168.1.100',
                'cf-connecting-ip': '143.137.94.158'
            },
            connection: { remoteAddress: '127.0.0.1' }
        }
    }
];

(async () => {
    for (const test of tests) {
        console.log('Test:', test.name);
        const ip = getClientIP(test.req);
        console.log('Captured IP:', ip);
        const ipInfo = await getIPInfo(ip);
        if (ipInfo.success) {
            console.log('IP Info:', {
                ip: ipInfo.ip,
                country: ipInfo.country,
                city: ipInfo.city,
                isp: ipInfo.isp
            });
        } else {
            console.log('IP Info fetch failed:', ipInfo.message);
        }
        console.log('---');
    }
    console.log('=== Testing Complete ===');
})();
