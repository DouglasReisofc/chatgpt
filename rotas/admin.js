
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const axios = require('axios');

// Admin authentication middleware
const requireAdmin = async (req, res, next) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    next();
};

// Use custom admin layout for dashboard pages
const adminLayout = (req, res, next) => {
    res.locals.layout = 'layouts/admin/main';
    next();
};

// Root admin route - redirect to login or dashboard
router.get('/', (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.redirect('/admin/login');
});

// Admin login page
router.get('/login', (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }

    res.render('admin/login_standalone', {
        title: 'Admin Login',
        error: null,
        layout: false
    });
});

// Admin login POST
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = req.db;

    try {
        console.log('👤 Admin login attempt:', { username });

        const admin = await db.collection('admin_users').findOne({
            username: username
        });

        console.log('🔍 Found admin user:', admin ? 'Yes' : 'No');

        if (!admin) {
            console.log('❌ Admin user not found');
            return res.render('admin/login_standalone', {
                title: 'Admin Login',
                error: 'Invalid credentials',
                layout: false
            });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        console.log('🔐 Password match:', passwordMatch ? 'Yes' : 'No');

        if (!passwordMatch) {
        return res.render('admin/login_standalone', {
            title: 'Admin Login',
            error: 'Invalid credentials',
            layout: false
        });
        }

        // Update last login
        await db.collection('admin_users').updateOne(
            { _id: admin._id },
            { $set: { lastLogin: new Date() } }
        );

        req.session.admin = {
            id: admin._id,
            username: admin.username,
            isAdmin: true
        };

        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Admin login error:', error);
        res.render('admin/login_standalone', {
            title: 'Admin Login',
            error: 'An error occurred',
            layout: false
        });
    }
});

// Admin dashboard
router.get('/dashboard', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const stats = {
            totalUsers: await db.collection('users').countDocuments(),
            totalLogins: await db.collection('access_logs').countDocuments({ action: 'verification_success' }),
            todayLogins: await db.collection('access_logs').countDocuments({
                action: 'verification_success',
                timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            })
        };

        const recentUsers = await db.collection('users')
            .find()
            .sort({ lastLogin: -1 })
            .limit(10)
            .toArray();

        const recentLogs = await db.collection('access_logs')
            .find()
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats,
            recentUsers,
            recentLogs,
            page: 'dashboard'
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Access logs page
router.get('/logs', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const logs = await db.collection('access_logs')
            .find()
            .sort({ timestamp: -1 })
            .limit(100)
            .toArray();

        const blockedIps = await db.collection('blocked_ips').find().toArray();

        res.render('admin/logs', {
            title: 'Logs de Acesso',
            logs,
            blockedIps,
            page: 'logs'
        });
    } catch (error) {
        console.error('Logs page error:', error);
        res.status(500).send('Error loading logs');
    }
});

// Blocked IPs management page
router.get('/blocked-ips', requireAdmin, adminLayout, async (req, res) => {
    try {
        const blockedIps = await req.db.collection('blocked_ips')
            .find()
            .sort({ blockedAt: -1 })
            .toArray();

        res.render('admin/blocked_ips', {
            title: 'Bloqueio de IPs',
            blockedIps,
            page: 'blocked-ips'
        });
    } catch (error) {
        console.error('Blocked IPs page error:', error);
        res.status(500).send('Error loading blocked IPs');
    }
});

// Fetch detailed IP info from ipwho.is
router.get('/ip-info/:ip', requireAdmin, async (req, res) => {
    const ip = req.params.ip;
    try {
        const { data } = await axios.get(`https://ipwho.is/${ip}`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching IP info:', error);
        res.status(500).json({ error: 'Failed to fetch IP info' });
    }
});

// Settings page
router.get('/settings', requireAdmin, adminLayout, async (req, res) => {
    try {
        res.render('admin/settings', {
            title: 'Configurações do Sistema',
            page: 'settings'
        });
    } catch (error) {
        console.error('Settings error:', error);
        res.status(500).send('Error loading settings');
    }
});

// Session limit settings page
router.get('/code-settings', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const sessionLimit =
            (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
                limitEnabled: true,
                durationEnabled: true,
                maxSessions: 3,
                sessionDuration: 5
            };
        res.render('admin/code_settings', {
            title: 'Limite de Sessões',
            sessionLimit,
            page: 'code-settings'
        });
    } catch (error) {
        console.error('Session limit settings error:', error);
        res.status(500).send('Error loading session limit settings');
    }
});

// System messages settings page
router.get('/messages', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const messages =
            (await db.collection('settings').findOne({ key: 'messages' })) || {
                sessionLimitReached:
                    'Limite de sessões atingido. Faça logout em outro dispositivo.',
                sessionExpired: 'Sessão expirada. Faça login novamente.',
                invalidCode: 'Código inválido.'
            };
        res.render('admin/messages', {
            title: 'Mensagens do Sistema',
            messages,
            page: 'messages'
        });
    } catch (error) {
        console.error('Messages settings error:', error);
        res.status(500).send('Error loading messages');
    }
});

// Update system messages
router.post('/messages', requireAdmin, async (req, res) => {
    const { sessionLimitReached, sessionExpired, invalidCode } = req.body;
    const db = req.db;

    try {
        await db.collection('settings').updateOne(
            { key: 'messages' },
            {
                $set: {
                    sessionLimitReached,
                    sessionExpired,
                    invalidCode
                }
            },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving messages:', error);
        res.status(500).json({ error: 'Failed to save messages' });
    }
});

// Save global session settings
router.post('/settings/session-limit', requireAdmin, async (req, res) => {
    const {
        limitEnabled,
        durationEnabled,
        maxSessions,
        sessionDuration,
        applyToAll
    } = req.body;
    const db = req.db;

    if (
        typeof maxSessions !== 'number' ||
        typeof sessionDuration !== 'number'
    ) {
        return res.status(400).json({ error: 'Invalid input types' });
    }

    try {
        await db.collection('settings').updateOne(
            { key: 'sessionLimit' },
            {
                $set: {
                    limitEnabled: !!limitEnabled,
                    durationEnabled: !!durationEnabled,
                    maxSessions,
                    sessionDuration
                }
            },
            { upsert: true }
        );

        if (applyToAll) {
            await db.collection('users').updateMany({}, { $set: { maxSessions, sessionDuration } });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving session limit:', error);
        res.status(500).json({ error: 'Failed to save session limit' });
    }
});

// Toggle code page access limit

// Block IP
router.post('/settings/block-ip', requireAdmin, async (req, res) => {
    const { ip } = req.body;
    const db = req.db;

    if (!ip) {
        return res.status(400).json({ error: 'IP address is required' });
    }

    try {
        // Check if IP is already blocked
        const existingBlock = await db.collection('blocked_ips').findOne({ address: ip });
        if (existingBlock) {
            return res.status(400).json({ error: 'IP already blocked' });
        }

        await db.collection('blocked_ips').insertOne({
            address: ip,
            blockedAt: new Date(),
            blockedBy: req.session.admin.username
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error blocking IP:', error);
        res.status(500).json({ error: 'Failed to block IP' });
    }
});

// Unblock IP
router.post('/settings/unblock-ip', requireAdmin, async (req, res) => {
    const { ip } = req.body;
    const db = req.db;

    if (!ip) {
        return res.status(400).json({ error: 'IP address is required' });
    }

    try {
        await db.collection('blocked_ips').deleteOne({ address: ip });
        res.json({ success: true });
    } catch (error) {
        console.error('Error unblocking IP:', error);
        res.status(500).json({ error: 'Failed to unblock IP' });
    }
});

// Reset all logs
router.post('/settings/reset-logs', requireAdmin, async (req, res) => {
    const db = req.db;

    try {
        await db.collection('access_logs').deleteMany({});
        console.log('All logs reset by admin:', req.session.admin.username);
        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting logs:', error);
        res.status(500).json({ error: 'Failed to reset logs' });
    }
});

// Reset all active sessions
router.post('/settings/reset-sessions', requireAdmin, async (req, res) => {
    const db = req.db;

    try {
        await db.collection('active_sessions').deleteMany({});
        console.log('All sessions reset by admin:', req.session.admin.username);
        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting sessions:', error);
        res.status(500).json({ error: 'Failed to reset sessions' });
    }
});

// List all users
router.get('/users', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const users = await db.collection('users').find().toArray();

        const successCounts = await db
            .collection('access_logs')
            .aggregate([
                { $match: { action: 'verification_success' } },
                { $group: { _id: '$email', count: { $sum: 1 } } }
            ])
            .toArray();

        const blockCounts = await db
            .collection('access_logs')
            .aggregate([
                { $match: { action: 'session_limit_reached' } },
                { $group: { _id: '$email', count: { $sum: 1 } } }
            ])
            .toArray();

        const accessMap = Object.fromEntries(
            successCounts.map(c => [c._id, c.count])
        );
        const blockMap = Object.fromEntries(blockCounts.map(c => [c._id, c.count]));

        const decorated = users.map(u => ({
            ...u,
            accessCount: accessMap[u.email] || 0,
            blockedCount: blockMap[u.email] || 0
        }));

        decorated.sort((a, b) => b.accessCount - a.accessCount);

        const globalSettings =
            (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
                limitEnabled: true,
                durationEnabled: true,
                maxSessions: 3,
                sessionDuration: 5
            };

        res.render('admin/users', {
            title: 'Manage Users',
            users: decorated,
            globalSettings,
            page: 'users'
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Error loading users');
    }
});

// Add new user
router.post('/users', requireAdmin, async (req, res) => {
    const db = req.db;
    let { email, emails } = req.body;

    // Support both single email and bulk input
    if (!emails) {
        emails = email;
    }

    if (typeof emails === 'string') {
        emails = emails.split(/[\s,;\n]+/);
    }

    if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: 'No emails provided' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleaned = emails
        .map(e => String(e).trim().toLowerCase())
        .filter(e => e && emailRegex.test(e));

    if (cleaned.length === 0) {
        return res.status(400).json({ error: 'No valid emails provided' });
    }

    try {
        const ops = cleaned.map(e => ({
            updateOne: {
                filter: { email: e },
                update: {
                    $setOnInsert: {
                        email: e,
                        verified: true,
                        createdAt: new Date(),
                        lastLogin: null
                    }
                },
                upsert: true
            }
        }));

        if (ops.length > 0) {
            await db.collection('users').bulkWrite(ops);
        }

        res.json({ success: true, added: cleaned.length });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ error: 'Failed to add user' });
    }
});

// Delete user
router.delete('/users/:email', requireAdmin, async (req, res) => {
    const { email } = req.params;
    const db = req.db;

    try {
        await db.collection('users').deleteOne({ email });
        await db.collection('verification_codes').deleteMany({ email });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Reset user sessions
router.post('/users/:email/reset-session', requireAdmin, async (req, res) => {
    const { email } = req.params;
    const db = req.db;

    try {
        // Remove any active sessions and pending verification codes
        await db.collection('active_sessions').deleteMany({ email });
        await db.collection('verification_codes').deleteMany({ email });

        // Restore the user's session limits to the global defaults
        const globalSettings =
            (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
                limitEnabled: true,
                durationEnabled: true,
                maxSessions: 3,
                sessionDuration: 5
            };

        await db.collection('users').updateOne(
            { email },
            {
                $set: {
                    maxSessions: globalSettings.maxSessions,
                    sessionDuration: globalSettings.sessionDuration
                }
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting session:', error);
        res.status(500).json({ error: 'Failed to reset session' });
    }
});

// Update user session settings (maxSessions and sessionDuration)
router.put('/users/:email/session-settings', requireAdmin, async (req, res) => {
    const { email } = req.params;
    const { maxSessions, sessionDuration } = req.body;
    const db = req.db;

    if (
        typeof maxSessions !== 'number' ||
        typeof sessionDuration !== 'number'
    ) {
        return res.status(400).json({ error: 'Invalid input types' });
    }

    try {
        const result = await db.collection('users').updateOne(
            { email },
            { $set: { maxSessions, sessionDuration } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating session settings:', error);
        res.status(500).json({ error: 'Failed to update session settings' });
    }
});

// Admin logout
router.get('/logout', (req, res) => {
    req.session.admin = null;
    res.redirect('/admin/login');
});

module.exports = router;
